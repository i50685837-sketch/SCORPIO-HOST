const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const Transaction = require("../models/Transaction");

router.get("/", auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({
            user: req.user.id
        }).sort({
            createdAt: -1
        });

        res.json({
            success: true,
            transactions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load transactions"
        });
    }
});

router.get("/:reference", auth, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            reference: req.params.reference,
            user: req.user.id
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        res.json({
            success: true,
            transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to retrieve transaction"
        });
    }
});

module.exports = router;
