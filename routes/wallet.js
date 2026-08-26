const express = require("express");
const jwt = require("jsonwebtoken");

const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const router = express.Router();


/* =========================================
   AUTHENTICATION
========================================= */

function authenticate(req, res, next) {

    try {

        const header =
            req.headers.authorization;

        if (
            !header ||
            !header.startsWith("Bearer ")
        ) {

            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });

        }

        const token =
            header.substring(7);

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
            message: "Invalid or expired token."
        });

    }

}


/* =========================================
   WALLET
   GET /api/wallet
========================================= */

router.get(
    "/",
    authenticate,
    async (req, res) => {

        try {

            let wallet =
                await Wallet.findOne({
                    user: req.user.id
                });

            if (!wallet) {

                wallet =
                    await Wallet.create({
                        user: req.user.id,
                        balance: 0,
                        currency: "KES",
                        totalDeposited: 0,
                        totalSpent: 0,
                        totalWithdrawn: 0,
                        status: "active"
                    });

            }

            res.json({
                success: true,
                wallet
            });

        } catch (error) {

            console.error(
                "Wallet error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to load wallet."
            });

        }

    }
);


/* =========================================
   TRANSACTIONS
   GET /api/wallet/transactions
========================================= */

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
                    .limit(50);

            res.json({
                success: true,
                transactions
            });

        } catch (error) {

            console.error(
                "Transaction error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load transactions."
            });

        }

    }
);


/* =========================================
   SINGLE TRANSACTION
   GET /api/wallet/transactions/:id
========================================= */

router.get(
    "/transactions/:id",
    authenticate,
    async (req, res) => {

        try {

            const transaction =
                await Transaction.findOne({
                    _id: req.params.id,
                    user: req.user.id
                });

            if (!transaction) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Transaction not found."
                });

            }

            res.json({
                success: true,
                transaction
            });

        } catch (error) {

            console.error(
                "Transaction lookup error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load transaction."
            });

        }

    }
);


/* =========================================
   HEALTH
========================================= */

router.get(
    "/health",
    (req, res) => {

        res.json({
            success: true,
            service: "Wallet",
            status: "online"
        });

    }
);


module.exports = router;
