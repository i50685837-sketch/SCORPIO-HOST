const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");


/* =====================================================
   CONFIG
===================================================== */

const JWT_SECRET =
    process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.warn(
        "⚠️ JWT_SECRET is missing from .env"
    );
}


/* =====================================================
   CREATE JWT
===================================================== */

function createToken(user) {

    return jwt.sign(
        {
            id: user._id.toString(),
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

}


/* =====================================================
   REGISTER
=====================================================

   POST /api/auth/register

   Body:

   {
       "name": "Morde",
       "email": "morde@example.com",
       "password": "password123"
   }

===================================================== */

exports.register = async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;


        /* ---------------------------------------------
           VALIDATION
        --------------------------------------------- */

        if (
            !name ||
            !email ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Name, email and password are required."

            });

        }


        const cleanName =
            String(name).trim();

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        if (
            cleanName.length < 2
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Name must contain at least 2 characters."

            });

        }


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(cleanEmail)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Enter a valid email address."

            });

        }


        if (
            String(password).length < 6
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must contain at least 6 characters."

            });

        }


        /* ---------------------------------------------
           CHECK EXISTING USER
        --------------------------------------------- */

        const existingUser =
            await User.findOne({
                email: cleanEmail
            });


        if (existingUser) {

            return res.status(409).json({

                success: false,

                message:
                    "An account with this email already exists."

            });

        }


        /* ---------------------------------------------
           HASH PASSWORD
        --------------------------------------------- */

        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );


        /* ---------------------------------------------
           CREATE USER
        --------------------------------------------- */

        const user =
            await User.create({

                name:
                    cleanName,

                email:
                    cleanEmail,

                password:
                    hashedPassword,

                provider:
                    "local",

                emailVerified:
                    false,

                status:
                    "active",

                role:
                    "user"

            });


        /* ---------------------------------------------
           CREATE TOKEN
        --------------------------------------------- */

        const token =
            createToken(user);


        /* ---------------------------------------------
           RESPONSE
        --------------------------------------------- */

        return res.status(201).json({

            success: true,

            message:
                "Account created successfully.",

            token,

            user: {
                id:
                    user._id,

                name:
                    user.name,

                email:
                    user.email,

                avatar:
                    user.avatar,

                role:
                    user.role,

                provider:
                    user.provider,

                emailVerified:
                    user.emailVerified

            }

        });


    } catch (error) {

        console.error(
            "❌ Register error:",
            error
        );


        /* ---------------------------------------------
           DUPLICATE EMAIL SAFETY
        --------------------------------------------- */

        if (
            error.code === 11000
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "An account with this email already exists."

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Registration failed."

        });

    }

};


/* =====================================================
   LOGIN
=====================================================

   POST /api/auth/login

   Body:

   {
       "email": "morde@example.com",
       "password": "password123"
   }

===================================================== */

exports.login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        /* ---------------------------------------------
           VALIDATION
        --------------------------------------------- */

        if (
            !email ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required."

            });

        }


        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        /* ---------------------------------------------
           FIND USER
           
           password has select:false in User.js,
           therefore explicitly select it.
        --------------------------------------------- */

        const user =
            await User
                .findOne({
                    email: cleanEmail
                })
                .select("+password");


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        /* ---------------------------------------------
           ACCOUNT STATUS
        --------------------------------------------- */

        if (
            user.status !== "active"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "This account is not active."

            });

        }


        /* ---------------------------------------------
           CHECK PASSWORD
        --------------------------------------------- */

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        /* ---------------------------------------------
           UPDATE LAST LOGIN
        --------------------------------------------- */

        user.lastLogin =
            new Date();

        await user.save();


        /* ---------------------------------------------
           CREATE TOKEN
        --------------------------------------------- */

        const token =
            createToken(user);


        /* ---------------------------------------------
           RESPONSE
        --------------------------------------------- */

        return res.status(200).json({

            success: true,

            message:
                "Login successful.",

            token,

            user: {

                id:
                    user._id,

                name:
                    user.name,

                email:
                    user.email,

                avatar:
                    user.avatar,

                role:
                    user.role,

                provider:
                    user.provider,

                emailVerified:
                    user.emailVerified,

                lastLogin:
                    user.lastLogin

            }

        });


    } catch (error) {

        console.error(
            "❌ Login error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Login failed."

        });

    }

};


/* =====================================================
   GET CURRENT USER
=====================================================

   GET /api/auth/me

   Header:

   Authorization: Bearer YOUR_TOKEN

===================================================== */

exports.me = async (req, res) => {

    try {

        const user =
            await User.findById(
                req.user.id
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }


        return res.json({

            success: true,

            user

        });

    } catch (error) {

        console.error(
            "❌ /me error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve user."

        });

    }

};
