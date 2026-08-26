const express = require("express");
const jwt = require("jsonwebtoken");

const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const router = express.Router();


/* =====================================================
   AUTH MIDDLEWARE
===================================================== */

function authenticate(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;


        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        const token =
            authHeader.substring(7);


        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        req.user =
            decoded;


        next();


    } catch (error) {

        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired token."

        });

    }

}


/* =====================================================
   GET WALLET
   GET /api/wallet
===================================================== */

router.get(
    "/",
    authenticate,
    async (req, res) => {

        try {

            let wallet =
                await Wallet.findOne({
                    user: req.user.id
                });


            /*
             * Create wallet automatically if the user
             * doesn't have one.
             */

            if (!wallet) {

                wallet =
                    await Wallet.create({

                        user:
                            req.user.id,

                        balance:
                            0,

                        currency:
                            "KES",

                        totalDeposited:
                            0,

                        totalSpent:
                            0,

                        totalWithdrawn:
                            0,

                        status:
                            "active"

                    });

            }


            return res.status(200).json({

                success: true,

                wallet

            });


        } catch (error) {

            console.error(
                "Wallet error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load wallet."

            });

        }

    }
);


/* =====================================================
   GET TRANSACTIONS
   GET /api/wallet/transactions
===================================================== */

router.get(
    "/transactions",
    authenticate,
    async (req, res) => {

        try {

            const transactions =
                await Transaction
                    .find({
                        user:
                            req.user.id
                    })
                    .sort({
                        createdAt: -1
                    })
                    .limit(50);


            return res.status(200).json({

                success: true,

                transactions

            });


        } catch (error) {

            console.error(
                "Transactions error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load transactions."

            });

        }

    }
);


/* =====================================================
   GET SINGLE TRANSACTION
   GET /api/wallet/transactions/:id
===================================================== */

router.get(
    "/transactions/:id",
    authenticate,
    async (req, res) => {

        try {

            const transaction =
                await Transaction.findOne({

                    _id:
                        req.params.id,

                    user:
                        req.user.id

                });


            if (!transaction) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Transaction not found."

                });

            }


            return res.status(200).json({

                success: true,

                transaction

            });


        } catch (error) {

            console.error(
                "Transaction lookup error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load transaction."

            });

        }

    }
);


/* =====================================================
   WALLET ROUTE CHECK
===================================================== */

router.get(
    "/health",
    (req, res) => {

        res.json({

            success: true,

            service:
                "Scorpio Host Wallet",

            status:
                "online"

        });

    }
);


/* =====================================================
   EXPORT
===================================================== */

module.exports =
    router;
