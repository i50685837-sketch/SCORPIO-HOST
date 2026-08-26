const mongoose = require("mongoose");

/* =====================================================
   WALLET SCHEMA
===================================================== */

const walletSchema = new mongoose.Schema(
    {

        /* ---------------------------------------------
           OWNER
        --------------------------------------------- */

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true
        },


        /* ---------------------------------------------
           AVAILABLE BALANCE
        --------------------------------------------- */

        balance: {
            type: Number,
            default: 0,
            min: 0
        },


        /* ---------------------------------------------
           TOTAL DEPOSITED
        --------------------------------------------- */

        totalDeposited: {
            type: Number,
            default: 0,
            min: 0
        },


        /* ---------------------------------------------
           TOTAL SPENT
        --------------------------------------------- */

        totalSpent: {
            type: Number,
            default: 0,
            min: 0
        },


        /* ---------------------------------------------
           TOTAL WITHDRAWN
        --------------------------------------------- */

        totalWithdrawn: {
            type: Number,
            default: 0,
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
           WALLET STATUS
        --------------------------------------------- */

        status: {
            type: String,
            enum: [
                "active",
                "frozen",
                "closed"
            ],
            default: "active"
        }

    },
    {
        timestamps: true
    }
);


/* =====================================================
   PREVENT NEGATIVE BALANCE
===================================================== */

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


/* =====================================================
   MODEL
===================================================== */

const Wallet =
    mongoose.model(
        "Wallet",
        walletSchema
    );


module.exports = Wallet;
