const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false
        },

        reference: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        provider: {
            type: String,
            enum: ["intasend", "system"],
            default: "intasend"
        },

        type: {
            type: String,
            enum: [
                "deposit",
                "withdrawal",
                "payment",
                "refund"
            ],
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        currency: {
            type: String,
            default: "KES"
        },

        phoneNumber: {
            type: String,
            default: ""
        },

        email: {
            type: String,
            default: ""
        },

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

        providerReference: {
            type: String,
            default: ""
        },

        providerResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        description: {
            type: String,
            default: ""
        },

        walletCredited: {
            type: Boolean,
            default: false
        },

        completedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Transaction",
    transactionSchema
);
