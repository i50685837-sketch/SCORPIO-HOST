const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true
        },

        balance: {
            type: Number,
            default: 0,
            min: 0
        },

        totalDeposited: {
            type: Number,
            default: 0,
            min: 0
        },

        totalWithdrawn: {
            type: Number,
            default: 0,
            min: 0
        },

        currency: {
            type: String,
            default: "KES",
            uppercase: true
        },

        status: {
            type: String,
            enum: [
                "active",
                "locked"
            ],
            default: "active"
        }
    },

    {
        timestamps: true
    }
);


module.exports =
    mongoose.model(
        "Wallet",
        walletSchema
    );
