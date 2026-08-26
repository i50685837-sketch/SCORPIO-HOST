const express = require("express");

const {
    register,
    login
} = require("../controllers/authController");

const router = express.Router();


/* =========================================
   REGISTER
   POST /api/auth/register
========================================= */

router.post(
    "/register",
    register
);


/* =========================================
   LOGIN
   POST /api/auth/login
========================================= */

router.post(
    "/login",
    login
);


/* =========================================
   HEALTH
========================================= */

router.get(
    "/health",
    (req, res) => {

        res.json({
            success: true,
            service: "Authentication",
            status: "online"
        });

    }
);


module.exports = router;
