const Deployment =
    require("../models/Deployment");

exports.create = async (req, res) => {
    try {
        const {
            name,
            project,
            bot,
            provider
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Deployment name is required"
            });
        }

        const deployment =
            await Deployment.create({
                user: req.user.id,
                name,
                project: project || null,
                bot: bot || null,
                provider:
                    provider || "scorpio",
                status: "pending"
            });

        res.status(201).json({
            success: true,
            deployment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Unable to create deployment"
        });
    }
};

exports.list = async (req, res) => {
    try {
        const deployments =
            await Deployment.find({
                user: req.user.id
            })
                .populate("project", "name")
                .populate("bot", "name platform")
                .sort({
                    createdAt: -1
                });

        res.json({
            success: true,
            deployments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Unable to load deployments"
        });
    }
};

exports.get = async (req, res) => {
    try {
        const deployment =
            await Deployment.findOne({
                _id: req.params.id,
                user: req.user.id
            })
                .populate("project")
                .populate("bot");

        if (!deployment) {
            return res.status(404).json({
                success: false,
                message:
                    "Deployment not found"
            });
        }

        res.json({
            success: true,
            deployment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Unable to load deployment"
        });
    }
};
