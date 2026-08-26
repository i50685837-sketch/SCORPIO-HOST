const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
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

        description: {
            type: String,
            default: ""
        },

        repository: {
            type: String,
            default: ""
        },

        language: {
            type: String,
            default: ""
        },

        status: {
            type: String,
            enum: [
                "created",
                "building",
                "running",
                "stopped",
                "failed"
            ],
            default: "created"
        },

        visibility: {
            type: String,
            enum: ["private", "public"],
            default: "private"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Project",
    projectSchema
);
