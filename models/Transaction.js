const mongoose = require("mongoose");

/* =====================================================
   TRANSACTION SCHEMA
===================================================== */

const transactionSchema = new mongoose.Schema(
    {

        /* ---------------------------------------------
           USER
        --------------------------------------------- */

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },


        /* ---------------------------------------------
           TRANSACTION TYPE
        --------------------------------------------- */

        type: {
            type: String,
            enum: [
                "deposit",
                "withdrawal",
                "payment",
                "refund",
                "credit",
                "debit"
            ],
            required: true,
            index: true
        },


        /* ---------------------------------------------
           AMOUNT
        --------------------------------------------- */

        amount: {
            type: Number,
            required: true,
            min: 0
        },


        /* ---------------------------------------------
           CURRENCY
        --------------------------------------------- */

        currency: {
            type: String,
            default: "KES",
            uppercase: true
        },


        /* ---------------------------------------------
           STATUS
        --------------------------------------------- */

        status: {
            type: String,
            enum: [
                "pending",
                "processing",
                "completed",
                "failed",
                "cancelled"
            ],
            default: "pending",
            index: true
        },


        /* ---------------------------------------------
           INTERNAL REFERENCE
        --------------------------------------------- */

        reference: {
            type: String,
            required: true,
            unique: true,
            index: true
        },


        /* ---------------------------------------------
           PAYMENT PROVIDER
        --------------------------------------------- */

        provider: {
            type: String,
            enum: [
                "intasend",
                "system",
                "manual"
            ],
            default: "system"
        },


        /* ---------------------------------------------
           PROVIDER INVOICE
        --------------------------------------------- */

        providerReference: {
            type: String,
            default: null,
            index: true
        },


        /* ---------------------------------------------
           PAYMENT METHOD
        --------------------------------------------- */

        paymentMethod: {
            type: String,
            enum: [
                "mpesa",
                "card",
                "bank",
                "wallet",
                "other"
            ],
            default: "mpesa"
        },


        /* ---------------------------------------------
           PHONE USED FOR PAYMENT
        --------------------------------------------- */

        phoneNumber: {
            type: String,
            default: null
        },


        /* ---------------------------------------------
           DESCRIPTION
        --------------------------------------------- */

        description: {
            type: String,
            default: "",
            maxlength: 300
        },


        /* ---------------------------------------------
           INTASEND API REFERENCE
        --------------------------------------------- */

        apiRef: {
            type: String,
            default: null,
            index: true
        },


        /* ---------------------------------------------
           PROVIDER RESPONSE
        --------------------------------------------- */

        providerData: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },


        /* ---------------------------------------------
           COMPLETED DATE
        --------------------------------------------- */

        completedAt: {
            type: Date,
            default: null
        }

    },
    {
        timestamps: true
    }
);


/* =====================================================
   MODEL
===================================================== */

const Transaction =
    mongoose.model(
        "Transaction",
        transactionSchema
    );


module.exports = Transaction;
