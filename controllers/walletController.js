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
        const userId = req.user.id;

        let wallet = await Wallet.findOne({
            user: userId
        });

        if (!wallet) {
            wallet = await Wallet.create({
                user: userId,
                balance: 0,
                totalDeposited: 0,
                currency: "KES"
            });
        }

        return res.json({
            success: true,
            wallet
        });

    } catch (error) {
        console.error("GET WALLET ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load wallet"
        });
    }
};


/* =====================================================
   INTASEND M-PESA STK PUSH
===================================================== */

exports.deposit = async (req, res) => {
    try {

        const {
            amount,
            phone_number
        } = req.body;

        /* -----------------------------
           VALIDATE AMOUNT
        ----------------------------- */

        const numericAmount = Number(amount);

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid amount"
            });
        }

        if (numericAmount < 10) {
            return res.status(400).json({
                success: false,
                message: "Minimum deposit is KES 10"
            });
        }


        /* -----------------------------
           VALIDATE PHONE
        ----------------------------- */

        if (!phone_number) {
            return res.status(400).json({
                success: false,
                message: "M-Pesa phone number is required"
            });
        }


        /* -----------------------------
           FIND USER
        ----------------------------- */

        const user = await User.findById(
            req.user.id
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User account not found"
            });
        }


        /* -----------------------------
           NORMALIZE PHONE
        ----------------------------- */

        const normalizedPhone =
            intasendService.normalizePhone(
                phone_number
            );


        /* -----------------------------
           CREATE UNIQUE REFERENCE
        ----------------------------- */

        const reference =
            "SCORPIO-" +
            Date.now() +
            "-" +
            crypto
                .randomBytes(4)
                .toString("hex")
                .toUpperCase();


        /* -----------------------------
           CREATE PENDING TRANSACTION
        ----------------------------- */

        const transaction =
            await Transaction.create({

                user: user._id,

                reference,

                provider: "intasend",

                type: "deposit",

                amount: numericAmount,

                currency: "KES",

                phoneNumber: normalizedPhone,

                email: user.email,

                status: "pending",

                walletCredited: false
            });


        /* -----------------------------
           SEND STK PUSH
        ----------------------------- */

        let payment;

        try {

            payment =
                await intasendService.mpesaStkPush({

                    firstName:
                        user.name
                            ?.split(" ")[0] ||
                        "Scorpio",

                    lastName:
                        user.name
                            ?.split(" ")
                            .slice(1)
                            .join(" ") ||
                        "User",

                    email:
                        user.email,

                    phoneNumber:
                        normalizedPhone,

                    amount:
                        numericAmount,

                    reference
                });

        } catch (intasendError) {

            console.error(
                "INTASEND STK ERROR:",
                intasendError
            );

            transaction.status =
                "failed";

            transaction.providerResponse = {
                error:
                    intasendError.message
            };

            await transaction.save();

            return res.status(502).json({
                success: false,
                message:
                    intasendError.message ||
                    "IntaSend STK push failed",
                reference
            });
        }


        /* -----------------------------
           SAVE INTASEND RESPONSE
        ----------------------------- */

        transaction.providerResponse =
            payment.response;

        transaction.status =
            "processing";

        await transaction.save();


        /* -----------------------------
           RETURN SUCCESS
        ----------------------------- */

        return res.status(200).json({

            success: true,

            message:
                "STK push sent successfully. Check your M-Pesa phone.",

            reference,

            amount:
                numericAmount,

            transactionId:
                transaction._id,

            data:
                payment.response
        });

    } catch (error) {

        console.error(
            "DEPOSIT ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to initiate M-Pesa payment"
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
            "📩 INTASEND WEBHOOK:",
            JSON.stringify(payload)
        );


        /* -----------------------------
           CHALLENGE
        ----------------------------- */

        if (payload.challenge) {

            return res.status(200).json({
                challenge:
                    payload.challenge
            });
        }


        /* -----------------------------
           GET REFERENCE
        ----------------------------- */

        const reference =
            intasendService.getApiReference(
                payload
            );

        if (!reference) {

            return res.status(200).json({
                success: true,
                message:
                    "Webhook received"
            });
        }


        /* -----------------------------
           FIND TRANSACTION
        ----------------------------- */

        const transaction =
            await Transaction.findOne({
                reference
            });

        if (!transaction) {

            console.warn(
                "Unknown transaction:",
                reference
            );

            return res.status(200).json({
                success: true
            });
        }


        /* -----------------------------
           PREVENT DOUBLE CREDIT
        ----------------------------- */

        if (transaction.walletCredited) {

            return res.status(200).json({
                success: true,
                message:
                    "Already processed"
            });
        }


        /* -----------------------------
           FAILED PAYMENT
        ----------------------------- */

        if (
            intasendService.isFailedPayment(
                payload
            )
        ) {

            transaction.status =
                "failed";

            transaction.providerResponse =
                payload;

            await transaction.save();

            return res.status(200).json({
                success: true,
                message:
                    "Payment marked failed"
            });
        }


        /* -----------------------------
           SUCCESSFUL PAYMENT
        ----------------------------- */

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
                success: true,
                message:
                    "Payment still processing"
            });
        }


        /* -----------------------------
           CREDIT WALLET
        ----------------------------- */

        const wallet =
            await Wallet.findOneAndUpdate(

                {
                    user:
                        transaction.user
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


        /* -----------------------------
           UPDATE TRANSACTION
        ----------------------------- */

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
            `✅ WALLET CREDITED: KES ${transaction.amount}`
        );


        return res.status(200).json({

            success: true,

            message:
                "Payment processed successfully",

            balance:
                wallet.balance
        });

    } catch (error) {

        console.error(
            "WEBHOOK ERROR:",
            error
        );

        return res.status(500).json({
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

                user:
                    req.user.id

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


        return res.json({

            success: true,

            transaction
        });

    } catch (error) {

        console.error(
            "PAYMENT STATUS ERROR:",
            error
        );

        return res.status(500).json({

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

                user:
                    req.user.id

            })
            .sort({
                createdAt: -1
            })
            .limit(100);


        return res.json({

            success: true,

            transactions
        });

    } catch (error) {

        console.error(
            "TRANSACTIONS ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load transactions"
        });
    }
};
