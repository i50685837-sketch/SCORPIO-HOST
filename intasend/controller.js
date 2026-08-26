const crypto = require("crypto");

const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const {
    initiateMpesaSTK
} = require("./service");


/* =====================================================
   AUTHENTICATION
===================================================== */

function getUserId(req) {

    const header =
        req.headers.authorization;

    if (
        !header ||
        !header.startsWith("Bearer ")
    ) {
        return null;
    }

    const token =
        header.substring(7);

    const decoded =
        jwt.verify(
            token,
            process.env.JWT_SECRET
        );

    return decoded.id;
}


/* =====================================================
   NORMALIZE PHONE
===================================================== */

function normalizePhone(phone) {

    if (!phone) {
        return null;
    }

    let value =
        String(phone)
            .trim()
            .replace(/\s+/g, "");


    if (value.startsWith("+254")) {

        value =
            value.substring(1);

    }


    if (value.startsWith("254")) {

        return value;

    }


    if (value.startsWith("07")) {

        return "254" + value.substring(1);

    }


    if (value.startsWith("01")) {

        return "254" + value.substring(1);

    }


    return null;
}


/* =====================================================
   GENERATE REFERENCE
===================================================== */

function generateReference() {

    return (
        "SCORPIO-" +
        Date.now() +
        "-" +
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()
    );

}


/* =====================================================
   INITIATE STK
   POST /api/intasend/stk
===================================================== */

async function initiateSTK(req, res) {

    let transaction = null;


    try {

        /* ---------------------------------------------
           AUTH
        --------------------------------------------- */

        const userId =
            getUserId(req);


        if (!userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        /* ---------------------------------------------
           INPUT
        --------------------------------------------- */

        const {
            amount,
            phoneNumber
        } = req.body;


        const numericAmount =
            Number(amount);


        if (
            !Number.isFinite(
                numericAmount
            ) ||
            numericAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Enter a valid amount."

            });

        }


        if (
            numericAmount < 10
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Minimum deposit is KES 10."

            });

        }


        const phone =
            normalizePhone(
                phoneNumber
            );


        if (!phone) {

            return res.status(400).json({

                success: false,

                message:
                    "Enter a valid Kenyan M-Pesa number."

            });

        }


        /* ---------------------------------------------
           USER
        --------------------------------------------- */

        const user =
            await User.findById(
                userId
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }


        /* ---------------------------------------------
           WALLET
        --------------------------------------------- */

        let wallet =
            await Wallet.findOne({
                user: userId
            });


        if (!wallet) {

            wallet =
                await Wallet.create({

                    user:
                        userId,

                    balance:
                        0,

                    currency:
                        "KES",

                    totalDeposited:
                        0,

                    totalSpent:
                        0,

                    totalWithdrawn:
                        0,

                    status:
                        "active"

                });

        }


        if (
            wallet.status !== "active"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Wallet is not active."

            });

        }


        /* ---------------------------------------------
           CREATE TRANSACTION
        --------------------------------------------- */

        const reference =
            generateReference();


        transaction =
            await Transaction.create({

                user:
                    userId,

                type:
                    "deposit",

                amount:
                    numericAmount,

                currency:
                    "KES",

                status:
                    "pending",

                reference:
                    reference,

                provider:
                    "intasend",

                paymentMethod:
                    "mpesa",

                phoneNumber:
                    phone,

                description:
                    "M-Pesa wallet deposit"

            });


        /* ---------------------------------------------
           SEND STK
        --------------------------------------------- */

        const stkResponse =
            await initiateMpesaSTK({

                amount:
                    numericAmount,

                phoneNumber:
                    phone,

                reference:
                    reference,

                email:
                    user.email,

                name:
                    user.name

            });


        /* ---------------------------------------------
           SAVE PROVIDER DATA
        --------------------------------------------- */

        const providerReference =
            stkResponse?.invoice_id ||
            stkResponse?.invoice?.invoice_id ||
            stkResponse?.api_ref ||
            stkResponse?.apiRef ||
            null;


        transaction.apiRef =
            stkResponse?.api_ref ||
            stkResponse?.apiRef ||
            providerReference ||
            null;


        transaction.providerReference =
            providerReference;


        transaction.providerData =
            stkResponse;


        transaction.status =
            "processing";


        await transaction.save();


        /* ---------------------------------------------
           RESPONSE
        --------------------------------------------- */

        return res.status(200).json({

            success: true,

            message:
                "M-Pesa STK prompt sent successfully.",

            transaction: {

                id:
                    transaction._id,

                reference:
                    transaction.reference,

                amount:
                    transaction.amount,

                status:
                    transaction.status

            },

            provider:
                stkResponse

        });


    } catch (error) {

        console.error(
            "❌ IntaSend STK error:",
            error
        );


        /* ---------------------------------------------
           MARK TRANSACTION FAILED
        --------------------------------------------- */

        if (transaction) {

            try {

                transaction.status =
                    "failed";

                transaction.providerData = {

                    error:
                        error.message

                };

                await transaction.save();

            } catch (saveError) {

                console.error(
                    "Failed to update transaction:",
                    saveError
                );

            }

        }


        /* ---------------------------------------------
           RESPONSE
        --------------------------------------------- */

        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to initiate M-Pesa STK prompt."

        });

    }

}


module.exports = {
    initiateSTK
};
