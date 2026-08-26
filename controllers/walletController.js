const crypto = require("crypto");

const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const intasendService = require("../services/intasendService");

/* =====================================================
   GET WALLET
===================================================== */

exports.getWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({
            user: req.user.id
        });

        if (!wallet) {
            wallet = await Wallet.create({
                user: req.user.id,
                balance: 0,
                currency: "KES"
            });
        }

        res.json({
            success: true,
            wallet
        });
    } catch (error) {
        console.error("Get wallet error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load wallet"
        });
    }
};

/* =====================================================
   INITIATE INTASEND M-PESA DEPOSIT
===================================================== */

exports.deposit = async (req, res) => {
    try {
        const {
            amount,
            phone_number
        } = req.body;

        const numericAmount = Number(amount);

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }

        if (numericAmount < 10) {
            return res.status(400).json({
                success: false,
                message: "Minimum deposit is KES 10"
            });
        }

        if (!phone_number) {
            return res.status(400).json({
                success: false,
                message: "M-Pesa phone number is required"
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const reference =
            "SCORPIO-" +
            Date.now() +
            "-" +
            crypto
                .randomBytes(4)
                .toString("hex")
                .toUpperCase();

        /*
          Create pending transaction FIRST.
          This allows the webhook to identify the user.
        */

        const transaction =
            await Transaction.create({
                user: user._id,
                reference,
                provider: "intasend",
                type: "deposit",
                amount: numericAmount,
                currency: "KES",
                phoneNumber: intasendService.normalizePhone(
                    phone_number
                ),
                email: user.email,
                status: "pending",
                walletCredited: false
            });

        const payment =
            await intasendService.mpesaStkPush({
                firstName: user.name
                    ?.split(" ")[0] || "Scorpio",

                lastName: user.name
                    ?.split(" ")
                    .slice(1)
                    .join(" ") || "User",

                email: user.email,

                phoneNumber: phone_number,

                amount: numericAmount,

                reference
            });

        transaction.providerResponse =
            payment.response;

        await transaction.save();

        res.status(200).json({
            success: true,
            message:
                "M-Pesa payment request sent",
            reference,
            amount: numericAmount,
            data: payment.response
        });
    } catch (error) {
        console.error(
            "Deposit error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to initiate deposit"
        });
    }
};

/* =====================================================
   INTASEND WEBHOOK
===================================================== */

exports.intasendWebhook = async (
    req,
    res
) => {
    try {
        const payload = req.body;

        console.log(
            "📩 IntaSend webhook:",
            JSON.stringify(payload)
        );

        /*
          Handle webhook challenge.
        */

        if (payload.challenge) {
            return res.status(200).json({
                challenge:
                    payload.challenge
            });
        }

        const reference =
            intasendService.getApiReference(
                payload
            );

        if (!reference) {
            return res.status(200).json({
                success: true,
                message:
                    "Webhook received without reference"
            });
        }

        const transaction =
            await Transaction.findOne({
                reference
            });

        if (!transaction) {
            console.warn(
                "⚠️ Unknown transaction:",
                reference
            );

            return res.status(200).json({
                success: true
            });
        }

        /*
          IMPORTANT:
          Prevent duplicate webhook events
          from crediting the wallet twice.
        */

        if (transaction.walletCredited) {
            return res.status(200).json({
                success: true,
                message:
                    "Transaction already processed"
            });
        }

        if (
            intasendService.isFailedPayment(
                payload
            )
        ) {
            transaction.status = "failed";
            transaction.providerResponse =
                payload;

            await transaction.save();

            return res.status(200).json({
                success: true
            });
        }

        if (
            !intasendService.isSuccessfulPayment(
                payload
            )
        ) {
            transaction.status =
                "processing";

            transaction.providerResponse =
                payload;

            await transaction.save();

            return res.status(200).json({
                success: true
            });
        }

        /*
          Successful payment.
          Use an atomic wallet update.
        */

        const wallet =
            await Wallet.findOneAndUpdate(
                {
                    user: transaction.user
                },
                {
                    $inc: {
                        balance:
                            transaction.amount,
                        totalDeposited:
                            transaction.amount
                    }
                },
                {
                    new: true,
                    upsert: true
                }
            );

        transaction.status =
            "completed";

        transaction.walletCredited =
            true;

        transaction.providerResponse =
            payload;

        transaction.providerReference =
            intasendService.getInvoiceId(
                payload
            ) || "";

        transaction.completedAt =
            new Date();

        await transaction.save();

        console.log(
            `✅ Wallet credited: ${transaction.amount} KES`
        );

        res.status(200).json({
            success: true,
            message:
                "Payment processed"
        });
    } catch (error) {
        console.error(
            "Webhook processing error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Webhook processing failed"
        });
    }
};

/* =====================================================
   PAYMENT STATUS
===================================================== */

exports.paymentStatus = async (
    req,
    res
) => {
    try {
        const transaction =
            await Transaction.findOne({
                reference:
                    req.params.reference,
                user: req.user.id
            }).select(
                "-providerResponse"
            );

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message:
                    "Transaction not found"
            });
        }

        res.json({
            success: true,
            transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Unable to retrieve payment status"
        });
    }
};

/* =====================================================
   TRANSACTION HISTORY
===================================================== */

exports.transactions = async (
    req,
    res
) => {
    try {
        const transactions =
            await Transaction.find({
                user: req.user.id
            })
                .sort({
                    createdAt: -1
                })
                .limit(100);

        res.json({
            success: true,
            transactions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Unable to load transactions"
        });
    }
};
