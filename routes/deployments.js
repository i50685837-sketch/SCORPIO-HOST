const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const Deployment = require("../models/Deployment");

router.get("/", auth, async (req, res) => {
    try {
        const deployments = await Deployment.find({
            user: req.user.id
        }).sort({
            createdAt: -1
        });

        res.json({
            success: true,
            deployments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load deployments"
        });
    }
});

router.post("/", auth, async (req, res) => {
    try {
        const deployment = await Deployment.create({
            ...req.body,
            user: req.user.id,
            status: "pending"
        });

        res.status(201).json({
            success: true,
            deployment
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/:id", auth, async (req, res) => {
    try {
        const deployment = await Deployment.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!deployment) {
            return res.status(404).json({
                success: false,
                message: "Deployment not found"
            });
        }

        res.json({
            success: true,
            deployment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load deployment"
        });
    }
});

module.exports = router;
