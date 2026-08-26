const Domain = require("../models/Domain");

exports.create = async (req, res) => {
    try {
        const {
            domain,
            deployment
        } = req.body;

        if (!domain) {
            return res.status(400).json({
                success: false,
                message: "Domain is required"
            });
        }

        const normalizedDomain =
            domain
                .toLowerCase()
                .trim()
                .replace(/^https?:\/\//, "")
                .replace(/\/$/, "");

        const existing =
            await Domain.findOne({
                domain: normalizedDomain
            });

        if (existing) {
            return res.status(409).json({
                success: false,
                message:
                    "Domain is already registered"
            });
        }

        const newDomain =
            await Domain.create({
                user: req.user.id,
                domain: normalizedDomain,
                deployment:
                    deployment || null,
                status: "pending"
            });

        res.status(201).json({
            success: true,
            domain: newDomain
        });
    } catch (error) {
        console.error(
            "Domain create error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to add domain"
        });
    }
};

exports.list = async (req, res) => {
    try {
        const domains =
            await Domain.find({
                user: req.user.id
            })
                .populate(
                    "deployment",
                    "name status url"
                )
                .sort({
                    createdAt: -1
                });

        res.json({
            success: true,
            domains
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Unable to load domains"
        });
    }
};

exports.remove = async (req, res) => {
    try {
        const domain =
            await Domain.findOneAndDelete({
                _id: req.params.id,
                user: req.user.id
            });

        if (!domain) {
            return res.status(404).json({
                success: false,
                message:
                    "Domain not found"
            });
        }

        res.json({
            success: true,
            message:
                "Domain removed"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Unable to remove domain"
        });
    }
};
