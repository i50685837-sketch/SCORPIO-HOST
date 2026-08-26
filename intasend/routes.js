const express = require("express");

const {
    initiateSTK
} = require("./controller");

const router = express.Router();


/* =====================================================
   M-PESA STK PUSH
   POST /api/intasend/stk
===================================================== */

router.post(
    "/stk",
    initiateSTK
);


/* =====================================================
   INTASEND WEBHOOK
   POST /api/intasend/webhook
===================================================== */

router.post(
    "/webhook",
    require("./webhook")
);


/* =====================================================
   HEALTH CHECK
===================================================== */

router.get(
    "/health",
    (req, res) => {

        res.json({
            success: true,
            service: "IntaSend",
            status: "online"
        });

    }
);


module.exports = router;
