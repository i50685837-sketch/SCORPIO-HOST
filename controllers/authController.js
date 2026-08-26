const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Wallet = require("../models/Wallet");


/* =====================================================
   JWT
===================================================== */

function createToken(user) {

    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }

    return jwt.sign(
        {
            id: user._id.toString(),
            email: user.email,
            role: user.role
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

        if (!name || !email || !password) {

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

        const cleanPassword =
            String(password);


        if (cleanName.length < 2) {

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


        if (cleanPassword.length < 6) {

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
                cleanPassword,
                12
            );


        /* ---------------------------------------------
           CREATE USER
        --------------------------------------------- */

        const user =
            await User.create({

                name: cleanName,

                email: cleanEmail,

                password: hashedPassword,

                provider: "local",

                status: "active",

                role: "user",

                emailVerified: false

            });


        /* ---------------------------------------------
           CREATE WALLET
        --------------------------------------------- */

        let wallet;

        try {

            wallet =
                await Wallet.create({

                    user: user._id,

                    balance: 0,

                    totalDeposited: 0,

                    totalSpent: 0,

                    totalWithdrawn: 0,

                    currency: "KES",

                    status: "active"

                });

        } catch (walletError) {

            /*
             * If wallet creation fails, remove the
             * newly created user so we don't leave
             * an incomplete account behind.
             */

            await User.findByIdAndDelete(
                user._id
            );

            throw walletError;

        }


        /* ---------------------------------------------
           TOKEN
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

            },

            wallet: {

                id:
                    wallet._id,

                balance:
                    wallet.balance,

                currency:
                    wallet.currency

            }

        });


    } catch (error) {

        console.error(
            "❌ REGISTER ERROR:",
            error
        );


        if (error.code === 11000) {

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
   POST /api/auth/login
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

        if (!email || !password) {

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
           PASSWORD
        --------------------------------------------- */

        const passwordMatch =
            await bcrypt.compare(
                String(password),
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
           FIND WALLET
        --------------------------------------------- */

        let wallet =
            await Wallet.findOne({
                user: user._id
            });


        /*
         * Safety net:
         * If an older account doesn't have a wallet,
         * create one automatically.
         */

        if (!wallet) {

            wallet =
                await Wallet.create({

                    user: user._id,

                    balance: 0,

                    totalDeposited: 0,

                    totalSpent: 0,

                    totalWithdrawn: 0,

                    currency: "KES",

                    status: "active"

                });

        }


        /* ---------------------------------------------
           TOKEN
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

            },

            wallet: {

                id:
                    wallet._id,

                balance:
                    wallet.balance,

                currency:
                    wallet.currency

            }

        });


    } catch (error) {

        console.error(
            "❌ LOGIN ERROR:",
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
   CURRENT USER
   GET /api/auth/me
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


        const wallet =
            await Wallet.findOne({
                user: user._id
            });


        return res.status(200).json({

            success: true,

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

            },

            wallet: wallet
                ? {

                    id:
                        wallet._id,

                    balance:
                        wallet.balance,

                    currency:
                        wallet.currency,

                    totalDeposited:
                        wallet.totalDeposited,

                    totalSpent:
                        wallet.totalSpent,

                    totalWithdrawn:
                        wallet.totalWithdrawn

                }
                : null

        });


    } catch (error) {

        console.error(
            "❌ ME ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve account."

        });

    }

};
