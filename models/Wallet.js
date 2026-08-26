const mongoose = require("mongoose");

/* =========================================================
   SCORPIO HOST — WALLET MODEL
========================================================= */

const walletSchema = new mongoose.Schema(
    {
        /* =====================================================
           USER
        ===================================================== */

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true
        },

        /* =====================================================
           BALANCE
        ===================================================== */

        balance: {
            type: Number,
            default: 0,
            min: 0
        },

        /* =====================================================
           TOTAL DEPOSITED
        ===================================================== */

        totalDeposited: {
            type: Number,
            default: 0,
            min: 0
        },

        /* =====================================================
           TOTAL WITHDRAWN
        ===================================================== */

        totalWithdrawn: {
            type: Number,
            default: 0,
            min: 0
        },

        /* =====================================================
           CURRENCY
        ===================================================== */

        currency: {
            type: String,
            default: "KES",
            uppercase: true,
            trim: true
        },

        /* =====================================================
           WALLET STATUS
        ===================================================== */

        status: {
            type: String,
            enum: [
                "active",
                "suspended",
                "locked"
            ],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

/* =========================================================
   BALANCE HELPERS
========================================================= */

walletSchema.methods.credit = async function(amount) {

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw new Error(
            "Invalid credit amount"
        );
    }

    this.balance += amount;

    this.totalDeposited += amount;

    return this.save();
};


walletSchema.methods.debit = async function(amount) {

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw new Error(
            "Invalid debit amount"
        );
    }

    if (this.balance < amount) {
        throw new Error(
            "Insufficient wallet balance"
        );
    }

    this.balance -= amount;

    this.totalWithdrawn += amount;

    return this.save();
};

/* =========================================================
   EXPORT
========================================================= */

module.exports =
    mongoose.model(
        "Wallet",
        walletSchema
    );
