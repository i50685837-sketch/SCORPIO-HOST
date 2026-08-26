const express = require("express");

const {
    register,
    login
} = require("../controllers/authController");

const router = express.Router();


/* =====================================================
   AUTH HEALTH
   GET /api/auth/health
===================================================== */

router.get("/health", (req, res) => {

    res.status(200).json({
        success: true,
        service: "Authentication",
        status: "online"
    });

});


/* =====================================================
   REGISTER
   POST /api/auth/register
===================================================== */

router.post(
    "/register",
    register
);


/* =====================================================
   LOGIN
   POST /api/auth/login
===================================================== */

router.post(
    "/login",
    login
);


module.exports = router;
