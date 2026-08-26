const crypto = require("crypto");

const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");

const {
    sendMpesaStk,
    getPaymentStatus
} = require("./service");


/* =====================================================
   HELPERS
===================================================== */

function createReference() {

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


function normalizePhone(phone) {

    if (!phone) {
        return null;
    }

    let value =
        String(phone)
            .trim()
            .replace(/\s+/g, "")
            .replace(/-/g, "");


    if (value.startsWith("+254")) {
        value = value.substring(1);
    }


    if (
        value.startsWith("07") ||
        value.startsWith("01")
    ) {
        value =
            "254" +
            value.substring(1);
    }


    if (
        value.length === 9 &&
        (
            value.startsWith("7") ||
            value.startsWith("1")
        )
    ) {
        value = "254" + value;
    }


    if (
        !/^254(7|1)\d{8}$/.test(value)
    ) {
        return null;
    }


    return value;

}


/* =====================================================
   STK PUSH
   POST /api/intasend/stk
===================================================== */

exports.stkPush = async (req, res) => {

    try {

        const {
            amount,
            phoneNumber,
            email,
            firstName,
            lastName
        } = req.body;


        /* ---------------------------------------------
           USER
        --------------------------------------------- */

        const userId =
            req.user.id;


        /* ---------------------------------------------
           AMOUNT
        --------------------------------------------- */

        const numericAmount =
            Number(amount);


        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Enter a valid amount."

            });

        }


        /* ---------------------------------------------
           PHONE
        --------------------------------------------- */

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
           WALLET
        --------------------------------------------- */

        let wallet =
            await Wallet.findOne({
                user: userId
            });


        if (!wallet) {

            wallet =
                await Wallet.create({

                    user: userId,

                    balance: 0,

                    currency: "KES",

                    status: "active"

                });

        }


        if (
            wallet.status !== "active"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Your wallet is not active."

            });

        }


        /* ---------------------------------------------
           REFERENCE
        --------------------------------------------- */

        const reference =
            createReference();


        /* ---------------------------------------------
           CREATE PENDING TRANSACTION
        --------------------------------------------- */

        const transaction =
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
                    "M-Pesa wallet deposit",

                apiRef:
                    reference

            });


        /* ---------------------------------------------
           SEND STK
        --------------------------------------------- */

        try {

            const payment =
                await sendMpesaStk({

                    amount:
                        numericAmount,

                    phoneNumber:
                        phone,

                    email:
                        email,

                    firstName:
                        firstName ||
                        "Scorpio",

                    lastName:
                        lastName ||
                        "Host",

                    apiRef:
                        reference,

                    host:
                        process.env.APP_URL ||
                        ""

                });


            /* -----------------------------------------
               SAVE PROVIDER RESPONSE
            ----------------------------------------- */

            const providerInvoice =
                payment?.invoice_id ||
                payment?.invoice?.invoice_id ||
                payment?.id ||
                null;


            transaction.providerReference =
                providerInvoice;


            transaction.providerData =
                payment;


            transaction.status =
                "processing";


            await transaction.save();


            /* -----------------------------------------
               RESPONSE
            ----------------------------------------- */

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

                payment

            });


        } catch (paymentError) {

            /* -----------------------------------------
               MARK TRANSACTION FAILED
            ----------------------------------------- */

            transaction.status =
                "failed";

            transaction.providerData =
                paymentError?.response?.data ||
                {
                    message:
                        paymentError.message
                };

            await transaction.save();


            throw paymentError;

        }


    } catch (error) {

        console.error(
            "❌ STK PUSH ERROR:"
        );

        console.error(
            error?.response?.data ||
            error.message ||
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to send M-Pesa STK prompt.",

            error:
                error?.response?.data ||
                error.message

        });

    }

};


/* =====================================================
   PAYMENT STATUS
   GET /api/intasend/status/:invoiceId
===================================================== */

exports.paymentStatus = async (req, res) => {

    try {

        const {
            invoiceId
        } = req.params;


        if (!invoiceId) {

            return res.status(400).json({

                success: false,

                message:
                    "Invoice ID is required."

            });

        }


        const payment =
            await getPaymentStatus(
                invoiceId
            );


        return res.status(200).json({

            success: true,

            payment

        });


    } catch (error) {

        console.error(
            "❌ PAYMENT STATUS ERROR:",
            error?.response?.data ||
            error.message
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to check payment status.",

            error:
                error?.response?.data ||
                error.message

        });

    }

};
