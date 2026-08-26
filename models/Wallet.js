const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        balance: {
            type: Number,
            default: 0,
            min: 0
        },

        totalDeposited: {
            type: Number,
            default: 0
        },

        totalSpent: {
            type: Number,
            default: 0
        },

        currency: {
            type: String,
            default: "KES"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Wallet", walletSchema);
