const mongoose = require("mongoose");

const domainSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        deployment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deployment",
            default: null
        },

        domain: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        status: {
            type: String,
            enum: [
                "pending",
                "active",
                "expired",
                "failed"
            ],
            default: "pending"
        },

        ssl: {
            type: Boolean,
            default: false
        },

        expiresAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Domain",
    domainSchema
);
