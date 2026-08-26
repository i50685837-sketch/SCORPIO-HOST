const express = require("express");

const router = express.Router();

const {
  stkPush,
  checkout,
  paymentStatus
} = require("./controller");

const {
  handleWebhook
} = require("./webhook");


/*
 * M-Pesa STK Push
 *
 * POST /api/intasend/stk
 */
router.post(
  "/stk",
  stkPush
);


/*
 * IntaSend checkout
 *
 * POST /api/intasend/checkout
 */
router.post(
  "/checkout",
  checkout
);


/*
 * Payment status
 *
 * GET /api/intasend/status/:invoiceId
 */
router.get(
  "/status/:invoiceId",
  paymentStatus
);


/*
 * IntaSend webhook
 *
 * POST /api/intasend/webhook
 */
router.post(
  "/webhook",
  handleWebhook
);


module.exports = router;
