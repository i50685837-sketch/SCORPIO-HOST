const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const Domain = require("../models/Domain");

router.get("/", auth, async (req, res) => {
    try {
        const domains = await Domain.find({
            user: req.user.id
        }).sort({
            createdAt: -1
        });

        res.json({
            success: true,
            domains
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load domains"
        });
    }
});

router.post("/", auth, async (req, res) => {
    try {
        const domain = await Domain.create({
            ...req.body,
            user: req.user.id,
            status: "pending"
        });

        res.status(201).json({
            success: true,
            domain
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.delete("/:id", auth, async (req, res) => {
    try {
        const domain = await Domain.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!domain) {
            return res.status(404).json({
                success: false,
                message: "Domain not found"
            });
        }

        res.json({
            success: true,
            message: "Domain removed"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to remove domain"
        });
    }
});

module.exports = router;
