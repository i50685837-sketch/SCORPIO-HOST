const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        /* =========================================
           NAME
        ========================================= */

        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100
        },


        /* =========================================
           EMAIL
        ========================================= */

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },


        /* =========================================
           PASSWORD
        ========================================= */

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false
        },


        /* =========================================
           ACCOUNT STATUS
        ========================================= */

        status: {
            type: String,
            enum: [
                "active",
                "suspended"
            ],
            default: "active"
        }

    },

    {
        timestamps: true
    }
);


/* =========================================
   HASH PASSWORD BEFORE SAVE
========================================= */

userSchema.pre(
    "save",
    async function(next) {

        try {

            /*
             * Don't hash the password again when
             * updating unrelated user fields.
             */

            if (!this.isModified("password")) {
                return next();
            }


            const salt =
                await bcrypt.genSalt(12);


            this.password =
                await bcrypt.hash(
                    this.password,
                    salt
                );


            next();

        } catch (error) {

            next(error);

        }

    }
);


/* =========================================
   COMPARE PASSWORD
========================================= */

userSchema.methods.comparePassword =
    async function(candidatePassword) {

        return bcrypt.compare(
            candidatePassword,
            this.password
        );

    };


/* =========================================
   REMOVE PASSWORD FROM JSON
========================================= */

userSchema.methods.toJSON =
    function() {

        const user =
            this.toObject();

        delete user.password;

        delete user.__v;

        return user;

    };


/* =========================================
   MODEL
========================================= */

module.exports =
    mongoose.model(
        "User",
        userSchema
    );
