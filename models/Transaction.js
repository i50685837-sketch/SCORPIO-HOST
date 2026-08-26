const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        /* =============================================
           USER
        ============================================= */

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },


        /* =============================================
           TRANSACTION TYPE
        ============================================= */

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


        /* =============================================
           AMOUNT
        ============================================= */

        amount: {
            type: Number,
            required: true,
            min: 0
        },


        currency: {
            type: String,
            default: "KES"
        },


        /* =============================================
           STATUS
        ============================================= */

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


        /* =============================================
           INTERNAL REFERENCE
        ============================================= */

        reference: {
            type: String,
            required: true,
            unique: true,
            index: true
        },


        /* =============================================
           PAYMENT PROVIDER
        ============================================= */

        provider: {
            type: String,
            default: "intasend"
        },


        paymentMethod: {
            type: String,
            default: "mpesa"
        },


        /* =============================================
           INTASEND REFERENCES
        ============================================= */

        apiRef: {
            type: String,
            index: true
        },


        providerReference: {
            type: String,
            index: true
        },


        providerData: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },


        /* =============================================
           PHONE
        ============================================= */

        phoneNumber: {
            type: String,
            default: null
        },


        /* =============================================
           DESCRIPTION
        ============================================= */

        description: {
            type: String,
            default: ""
        },


        /* =============================================
           COMPLETION
        ============================================= */

        completedAt: {
            type: Date,
            default: null
        }

    },

    {
        timestamps: true
    }
);


/* =============================================
   INDEXES
============================================= */

transactionSchema.index({
    user: 1,
    createdAt: -1
});

transactionSchema.index({
    apiRef: 1
});

transactionSchema.index({
    providerReference: 1
});


/* =============================================
   MODEL
============================================= */

module.exports =
    mongoose.model(
        "Transaction",
        transactionSchema
    );
