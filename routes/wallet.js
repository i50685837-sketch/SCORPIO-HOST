const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

router.get("/", auth, async (req, res) => {
    try {
        const Wallet = require("../models/Wallet");

        let wallet = await Wallet.findOne({
            user: req.user.id
        });

        if (!wallet) {
            wallet = await Wallet.create({
                user: req.user.id,
                balance: 0
            });
        }

        res.json({
            success: true,
            wallet
        });
    } catch (error) {
        console.error("Wallet error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load wallet"
        });
    }
});

/*
    Start IntaSend M-Pesa deposit
*/
router.post("/deposit", auth, async (req, res) => {
    try {
        const {
            amount,
            phone_number,
            email,
            first_name,
            last_name
        } = req.body;

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid deposit amount"
            });
        }

        const response = await fetch(
            `${req.protocol}://${req.get("host")}/api/payment/stk`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount: numericAmount,
                    phone_number,
                    email,
                    first_name,
                    last_name
                })
            }
        );

        const data = await response.json();

        res.status(response.status).json(data);
    } catch (error) {
        console.error("Deposit error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to initiate deposit"
        });
    }
});

module.exports = router;
