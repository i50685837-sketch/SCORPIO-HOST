const express = require("express");
const jwt = require("jsonwebtoken");

const {
    register,
    login,
    me
} = require("../controllers/authController");

const router = express.Router();


/* =====================================================
   AUTHENTICATION MIDDLEWARE
===================================================== */

function authenticate(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });

        }

        const token =
            authHeader.split(" ")[1];

        if (!token) {

            return res.status(401).json({
                success: false,
                message: "Authentication token missing."
            });

        }

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token."
        });

    }

}


/* =====================================================
   REGISTER
===================================================== */

router.post(
    "/register",
    register
);


/* =====================================================
   LOGIN
===================================================== */

router.post(
    "/login",
    login
);


/* =====================================================
   CURRENT USER
===================================================== */

router.get(
    "/me",
    authenticate,
    me
);


/* =====================================================
   EXPORT
===================================================== */

module.exports = router;
