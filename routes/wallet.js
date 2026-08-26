const express = require("express");
const jwt = require("jsonwebtoken");

const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const router = express.Router();


/* =====================================================
   AUTHENTICATION MIDDLEWARE
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
                message: "Authentication required."
            });

        }

        const token =
            authHeader.substring(7);

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token."
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
             * Safety net for existing users.
             */

            if (!wallet) {

                wallet =
                    await Wallet.create({

                        user: req.user.id,

                        balance: 0,

                        totalDeposited: 0,

                        totalSpent: 0,

                        totalWithdrawn: 0,

                        currency: "KES",

                        status: "active"

                    });

            }

            return res.status(200).json({

                success: true,

                wallet: {

                    id:
                        wallet._id,

                    balance:
                        wallet.balance,

                    totalDeposited:
                        wallet.totalDeposited,

                    totalSpent:
                        wallet.totalSpent,

                    totalWithdrawn:
                        wallet.totalWithdrawn,

                    currency:
                        wallet.currency,

                    status:
                        wallet.status

                }

            });

        } catch (error) {

            console.error(
                "❌ GET WALLET ERROR:",
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
                        user: req.user.id
                    })
                    .sort({
                        createdAt: -1
                    })
                    .limit(100);

            return res.status(200).json({

                success: true,

                count:
                    transactions.length,

                transactions

            });

        } catch (error) {

            console.error(
                "❌ TRANSACTIONS ERROR:",
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
                "❌ TRANSACTION ERROR:",
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
   WALLET SUMMARY
   GET /api/wallet/summary
===================================================== */

router.get(
    "/summary",
    authenticate,
    async (req, res) => {

        try {

            const wallet =
                await Wallet.findOne({
                    user: req.user.id
                });


            const completedDeposits =
                await Transaction.aggregate([

                    {
                        $match: {

                            user:
                                wallet
                                    ? wallet.user
                                    : req.user.id,

                            type:
                                "deposit",

                            status:
                                "completed"

                        }

                    },

                    {
                        $group: {

                            _id: null,

                            total: {
                                $sum: "$amount"
                            }

                        }

                    }

                ]);


            const totalDeposits =
                completedDeposits[0]?.total ||
                0;


            return res.status(200).json({

                success: true,

                summary: {

                    balance:
                        wallet?.balance || 0,

                    totalDeposited:
                        wallet?.totalDeposited ||
                        totalDeposits,

                    totalSpent:
                        wallet?.totalSpent || 0,

                    totalWithdrawn:
                        wallet?.totalWithdrawn || 0,

                    currency:
                        wallet?.currency || "KES"

                }

            });

        } catch (error) {

            console.error(
                "❌ WALLET SUMMARY ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load wallet summary."

            });

        }

    }
);


/* =====================================================
   EXPORT
===================================================== */

module.exports = router;
