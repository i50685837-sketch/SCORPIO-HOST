const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Wallet = require("../models/Wallet");


/* =====================================================
   CREATE JWT
===================================================== */

function createToken(user) {

    return jwt.sign(
        {
            id: user._id.toString(),
            email: user.email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

}


/* =====================================================
   REGISTER
   POST /api/auth/register
===================================================== */

async function register(req, res) {

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
           CREATE USER
           Password is automatically hashed by User.js
        --------------------------------------------- */

        const user =
            await User.create({

                name:
                    cleanName,

                email:
                    cleanEmail,

                password:
                    password

            });


        /* ---------------------------------------------
           CREATE WALLET
        --------------------------------------------- */

        await Wallet.create({

            user:
                user._id,

            balance:
                0,

            currency:
                "KES",

            totalDeposited:
                0,

            totalSpent:
                0,

            totalWithdrawn:
                0,

            status:
                "active"

        });


        /* ---------------------------------------------
           JWT
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

                status:
                    user.status

            }

        });


    } catch (error) {

        console.error(
            "❌ Register error:",
            error
        );


        /* ---------------------------------------------
           DUPLICATE EMAIL RACE CONDITION
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

}


/* =====================================================
   LOGIN
   POST /api/auth/login
===================================================== */

async function login(req, res) {

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
           password is select:false in User.js,
           so explicitly request it.
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
                    "This account is suspended."

            });

        }


        /* ---------------------------------------------
           PASSWORD
        --------------------------------------------- */

        const passwordMatch =
            await user.comparePassword(
                password
            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        /* ---------------------------------------------
           ENSURE WALLET EXISTS
        --------------------------------------------- */

        let wallet =
            await Wallet.findOne({
                user:
                    user._id
            });


        if (!wallet) {

            wallet =
                await Wallet.create({

                    user:
                        user._id,

                    balance:
                        0,

                    currency:
                        "KES",

                    totalDeposited:
                        0,

                    totalSpent:
                        0,

                    totalWithdrawn:
                        0,

                    status:
                        "active"

                });

        }


        /* ---------------------------------------------
           JWT
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

                status:
                    user.status

            },

            wallet: {

                balance:
                    wallet.balance,

                currency:
                    wallet.currency

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

}


/* =====================================================
   EXPORT
===================================================== */

module.exports = {

    register,
    login

};
