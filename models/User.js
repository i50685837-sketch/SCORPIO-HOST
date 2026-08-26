const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            minlength: 6
        },

        avatar: {
            type: String,
            default: ""
        },

        githubId: {
            type: String,
            default: null
        },

        googleId: {
            type: String,
            default: null
        },

        provider: {
            type: String,
            enum: ["local", "google", "github"],
            default: "local"
        },

        isVerified: {
            type: Boolean,
            default: false
        },

        status: {
            type: String,
            enum: ["active", "suspended"],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
