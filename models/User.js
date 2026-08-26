const mongoose = require("mongoose");

/* =====================================================
   USER SCHEMA
===================================================== */

const userSchema = new mongoose.Schema(
    {

        /* ---------------------------------------------
           BASIC INFORMATION
        --------------------------------------------- */

        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 80
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },


        /* ---------------------------------------------
           PASSWORD
        --------------------------------------------- */

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false
        },


        /* ---------------------------------------------
           PROFILE
        --------------------------------------------- */

        avatar: {
            type: String,
            default: ""
        },


        /* ---------------------------------------------
           AUTH PROVIDER
        --------------------------------------------- */

        provider: {
            type: String,
            enum: [
                "local",
                "google",
                "github"
            ],
            default: "local"
        },

        providerId: {
            type: String,
            default: null
        },


        /* ---------------------------------------------
           ACCOUNT STATUS
        --------------------------------------------- */

        status: {
            type: String,
            enum: [
                "active",
                "suspended",
                "deleted"
            ],
            default: "active"
        },


        /* ---------------------------------------------
           ROLE
        --------------------------------------------- */

        role: {
            type: String,
            enum: [
                "user",
                "admin"
            ],
            default: "user"
        },


        /* ---------------------------------------------
           EMAIL VERIFICATION
        --------------------------------------------- */

        emailVerified: {
            type: Boolean,
            default: false
        },


        /* ---------------------------------------------
           LAST LOGIN
        --------------------------------------------- */

        lastLogin: {
            type: Date,
            default: null
        }

    },
    {
        timestamps: true
    }
);


/* =====================================================
   NORMALIZE EMAIL
===================================================== */

userSchema.pre(
    "save",
    function(next) {

        if (this.email) {

            this.email =
                this.email
                    .trim()
                    .toLowerCase();

        }

        next();

    }
);


/* =====================================================
   REMOVE SENSITIVE DATA FROM JSON
===================================================== */

userSchema.methods.toJSON =
    function() {

        const user =
            this.toObject();

        delete user.password;

        delete user.__v;

        return user;

    };


/* =====================================================
   MODEL
===================================================== */

const User =
    mongoose.model(
        "User",
        userSchema
    );


module.exports = User;
