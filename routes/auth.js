const express = require("express");

const router = express.Router();

const {
    register,
    login,
    me
} = require("../controllers/authController");

const jwt = require("jsonwebtoken");


/* =====================================================
   AUTHENTICATION MIDDLEWARE
===================================================== */

function authenticate(req, res, next) {

    try {

        const authorization =
            req.headers.authorization;


        if (
            !authorization ||
            !authorization.startsWith("Bearer ")
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        const token =
            authorization.substring(7);


        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        req.user =
            decoded;


        next();


    } catch (error) {

        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired authentication token."

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


module.exports = router;
