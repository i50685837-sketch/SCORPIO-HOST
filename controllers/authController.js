const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Wallet = require("../models/Wallet");

const JWT_SECRET = process.env.JWT_SECRET;

function createToken(user) {
    return jwt.sign(
        {
            id: user._id,
            email: user.email
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(
            password,
            12
        );

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword
        });

        await Wallet.create({
            user: user._id,
            balance: 0,
            currency: "KES"
        });

        const token = createToken(user);

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Register error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (user.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "Account suspended"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = createToken(user);

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};

exports.me = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load account"
        });
    }
};
