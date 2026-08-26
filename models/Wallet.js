const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        /* =============================================
           OWNER
        ============================================= */

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true
        },


        /* =============================================
           BALANCE
        ============================================= */

        balance: {
            type: Number,
            default: 0,
            min: 0
        },


        currency: {
            type: String,
            default: "KES"
        },


        /* =============================================
           WALLET STATISTICS
        ============================================= */

        totalDeposited: {
            type: Number,
            default: 0,
            min: 0
        },


        totalSpent: {
            type: Number,
            default: 0,
            min: 0
        },


        totalWithdrawn: {
            type: Number,
            default: 0,
            min: 0
        },


        /* =============================================
           WALLET STATUS
        ============================================= */

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


/* =============================================
   PREVENT NEGATIVE BALANCE
============================================= */

walletSchema.pre(
    "save",
    function(next) {

        if (this.balance < 0) {

            return next(
                new Error(
                    "Wallet balance cannot be negative."
                )
            );

        }

        next();

    }
);


/* =============================================
   MODEL
============================================= */

module.exports =
    mongoose.model(
        "Wallet",
        walletSchema
    );
