const crypto = require("crypto");

const Wallet =
    require("../models/Wallet");

const Transaction =
    require("../models/Transaction");

const User =
    require("../models/User");

const intasend =
    require("../services/intasendService");

/* ==========================================
   GET WALLET
   GET /api/wallet
========================================== */

exports.getWallet = async (
    req,
    res
) => {

    try {

        const userId =
            req.user.id;

        let wallet =
            await Wallet.findOne({
                userId
            });

        if (!wallet) {

            wallet =
                await Wallet.create({
                    userId,
                    balance: 0,
                    totalDeposited: 0,
                    currency: "KES"
                });

        }

        res.json({
            success: true,
            wallet
        });

    } catch (error) {

        console.error(
            "GET WALLET:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load wallet"
        });

    }
};


/* ==========================================
   DEPOSIT
   POST /api/wallet/deposit
========================================== */

exports.deposit = async (
    req,
    res
) => {

    try {

        const {
            amount,
            phone_number
        } = req.body;

        const numericAmount =
            Number(amount);

        if (
            !Number.isFinite(
                numericAmount
            ) ||
            numericAmount < 10
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Minimum deposit is KES 10"
            });

        }

        const phone =
            intasend.normalizePhone(
                phone_number
            );

        if (!phone) {

            return res.status(400).json({
                success: false,
                message:
                    "Enter a valid Kenyan M-Pesa number"
            });

        }

        const user =
            await User.findById(
                req.user.id
            );

        if (!user) {

            return res.status(404).json({
                success: false,
                message:
                    "User not found"
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

        /* ------------------------------
           CREATE PENDING TRANSACTION
        ------------------------------ */

        const transaction =
            await Transaction.create({

                userId:
                    user._id,

                reference,

                provider:
                    "intasend",

                type:
                    "deposit",

                amount:
                    numericAmount,

                currency:
                    "KES",

                phoneNumber:
                    phone,

                email:
                    user.email || "",

                status:
                    "pending",

                walletCredited:
                    false

            });


        /* ------------------------------
           SEND STK
        ------------------------------ */

        let payment;

        try {

            payment =
                await intasend.mpesaStkPush({

                    firstName:
                        user.name
                            ?.split(" ")[0] ||
                        "Scorpio",

                    lastName:
                        user.name
                            ?.split(" ")
                            .slice(1)
                            .join(" ") ||
                        "Host",

                    email:
                        user.email ||
                        "customer@example.com",

                    phoneNumber:
                        phone,

                    amount:
                        numericAmount,

                    reference,

                    host:
                        process.env.APP_URL

                });

        } catch (stkError) {

            transaction.status =
                "failed";

            transaction.failureReason =
                stkError.message;

            transaction.providerResponse =
                {
                    error:
                        stkError.message
                };

            await transaction.save();

            console.error(
                "INTASEND STK ERROR:",
                stkError
            );

            return res.status(502).json({
                success: false,
                message:
                    "IntaSend STK request failed",
                error:
                    stkError.message,
                reference
            });

        }


        /* ------------------------------
           SAVE INTASEND RESPONSE
        ------------------------------ */

        transaction.status =
            "processing";

        transaction.providerResponse =
            payment.response;

        transaction.providerReference =
            intasend.getInvoiceId(
                payment.response
            ) || "";

        await transaction.save();


        return res.status(200).json({

            success: true,

            message:
                "M-Pesa STK Push sent. Check your phone and enter your M-Pesa PIN.",

            reference,

            amount:
                numericAmount,

            phone:
                payment.phone,

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
                "Unable to initiate deposit"

        });

    }
};


/* ==========================================
   INTASEND WEBHOOK
   POST /api/payment/intasend/webhook
========================================== */

exports.intasendWebhook =
async (
    req,
    res
) => {

    try {

        const payload =
            req.body;

        console.log(
            "📩 INTASEND WEBHOOK"
        );

        console.log(
            JSON.stringify(
                payload,
                null,
                2
            )
        );


        /* ------------------------------
           CHALLENGE
        ------------------------------ */

        if (payload?.challenge) {

            return res.status(200).json({
                challenge:
                    payload.challenge
            });

        }


        const reference =
            intasend.getApiReference(
                payload
            );

        if (!reference) {

            return res.status(200).json({
                success: true,
                message:
                    "Webhook received"
            });

        }


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


        /* ------------------------------
           PREVENT DOUBLE CREDIT
        ------------------------------ */

        if (
            transaction.walletCredited
        ) {

            return res.status(200).json({
                success: true,
                message:
                    "Already processed"
            });

        }


        /* ------------------------------
           FAILED
        ------------------------------ */

        if (
            intasend.isFailedPayment(
                payload
            )
        ) {

            transaction.status =
                "failed";

            transaction.failureReason =
                payload.failed_reason ||
                payload.failed_code ||
                "Payment failed";

            transaction.providerResponse =
                payload;

            await transaction.save();

            return res.status(200).json({
                success: true
            });

        }


        /* ------------------------------
           STILL PROCESSING
        ------------------------------ */

        if (
            intasend.isProcessingPayment(
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


        /* ------------------------------
           SUCCESS
        ------------------------------ */

        if (
            intasend.isSuccessfulPayment(
                payload
            )
        ) {

            const wallet =
                await Wallet.findOneAndUpdate(
                    {
                        userId:
                            transaction.userId
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
                intasend.getInvoiceId(
                    payload
                ) || "";

            transaction.completedAt =
                new Date();

            await transaction.save();


            console.log(
                `✅ KES ${transaction.amount} credited`
            );

            console.log(
                `Wallet balance: KES ${wallet.balance}`
            );

        }


        return res.status(200).json({
            success: true
        });

    } catch (error) {

        console.error(
            "WEBHOOK ERROR:",
            error
        );

        return res.status(500).json({
            success: false
        });

    }
};


/* ==========================================
   TRANSACTIONS
   GET /api/wallet/transactions
========================================== */

exports.transactions =
async (
    req,
    res
) => {

    try {

        const transactions =
            await Transaction
                .find({
                    userId:
                        req.user.id
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

        console.error(
            "TRANSACTIONS:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load transactions"
        });

    }
};


/* ==========================================
   PAYMENT STATUS
   GET /api/wallet/payment/:reference
========================================== */

exports.paymentStatus =
async (
    req,
    res
) => {

    try {

        const transaction =
            await Transaction.findOne({
                reference:
                    req.params.reference,

                userId:
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
