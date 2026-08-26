const mongoose = require("mongoose");

const deploymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null
        },

        bot: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bot",
            default: null
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        provider: {
            type: String,
            enum: [
                "scorpio",
                "render",
                "railway",
                "other"
            ],
            default: "scorpio"
        },

        url: {
            type: String,
            default: ""
        },

        status: {
            type: String,
            enum: [
                "pending",
                "building",
                "running",
                "stopped",
                "failed"
            ],
            default: "pending"
        },

        logs: {
            type: String,
            default: ""
        },

        startedAt: {
            type: Date,
            default: null
        },

        stoppedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Deployment",
    deploymentSchema
);
