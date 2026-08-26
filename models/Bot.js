const mongoose = require("mongoose");

const botSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        platform: {
            type: String,
            enum: [
                "whatsapp",
                "telegram",
                "discord"
            ],
            required: true
        },

        repository: {
            type: String,
            default: ""
        },

        branch: {
            type: String,
            default: "main"
        },

        status: {
            type: String,
            enum: [
                "created",
                "pairing",
                "building",
                "running",
                "stopped",
                "failed"
            ],
            default: "created"
        },

        deploymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deployment",
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Bot", botSchema);
