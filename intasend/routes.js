const express = require("express");
const jwt = require("jsonwebtoken");

const {
    stkPush,
    paymentStatus
} = require("./controller");

const {
    handleWebhook
} = require("./webhook");

const router = express.Router();


/* =====================================================
   AUTHENTICATION
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
            authHeader.substring(7);

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
            message:
                "Invalid or expired authentication token."
        });

    }

}


/* =====================================================
   M-PESA STK PUSH
   POST /api/intasend/stk
===================================================== */

router.post(
    "/stk",
    authenticate,
    stkPush
);


/* =====================================================
   PAYMENT STATUS
   GET /api/intasend/status/:invoiceId
===================================================== */

router.get(
    "/status/:invoiceId",
    authenticate,
    paymentStatus
);


/* =====================================================
   INTASEND WEBHOOK
   POST /api/intasend/webhook
=====================================================

   IMPORTANT:
   Do NOT put JWT authentication here.

   IntaSend needs to be able to call this endpoint
   from its payment system.

===================================================== */

router.post(
    "/webhook",
    handleWebhook
);


/* =====================================================
   TEST / ROUTE CHECK
===================================================== */

router.get(
    "/",
    (req, res) => {

        res.status(200).json({

            success: true,

            service:
                "Scorpio Host IntaSend",

            endpoints: {

                stk:
                    "POST /api/intasend/stk",

                status:
                    "GET /api/intasend/status/:invoiceId",

                webhook:
                    "POST /api/intasend/webhook"

            }

        });

    }
);


/* =====================================================
   EXPORT
===================================================== */

module.exports = router;
