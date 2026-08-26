const Bot = require("../models/Bot");

exports.create = async (req, res) => {
    try {
        const {
            name,
            platform,
            repository,
            branch
        } = req.body;

        if (!name || !platform) {
            return res.status(400).json({
                success: false,
                message:
                    "Bot name and platform are required"
            });
        }

        const allowedPlatforms = [
            "whatsapp",
            "telegram",
            "discord"
        ];

        if (!allowedPlatforms.includes(platform)) {
            return res.status(400).json({
                success: false,
                message: "Unsupported bot platform"
            });
        }

        const bot = await Bot.create({
            user: req.user.id,
            name,
            platform,
            repository: repository || "",
            branch: branch || "main"
        });

        res.status(201).json({
            success: true,
            bot
        });
    } catch (error) {
        console.error("Bot create error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create bot"
        });
    }
};

exports.list = async (req, res) => {
    try {
        const bots = await Bot.find({
            user: req.user.id
        }).sort({
            createdAt: -1
        });

        res.json({
            success: true,
            bots
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load bots"
        });
    }
};

exports.get = async (req, res) => {
    try {
        const bot = await Bot.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot not found"
            });
        }

        res.json({
            success: true,
            bot
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load bot"
        });
    }
};

exports.remove = async (req, res) => {
    try {
        const bot =
            await Bot.findOneAndDelete({
                _id: req.params.id,
                user: req.user.id
            });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot not found"
            });
        }

        res.json({
            success: true,
            message: "Bot deleted"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to delete bot"
        });
    }
};
