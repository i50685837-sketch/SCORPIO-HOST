const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        reference: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        provider: {
            type: String,
            default: "intasend"
        },

        providerReference: {
            type: String,
            default: ""
        },

        type: {
            type: String,
            enum: [
                "deposit",
                "withdrawal",
                "payment"
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
                "failed"
            ],
            default: "pending",
            index: true
        },

        walletCredited: {
            type: Boolean,
            default: false
        },

        providerResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        failureReason: {
            type: String,
            default: ""
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

module.exports =
    mongoose.model(
        "Transaction",
        transactionSchema
    );
