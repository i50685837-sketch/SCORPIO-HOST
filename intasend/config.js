"intasend/config.js"

require("dotenv").config();

const IntaSend = require("intasend-node");

const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY;
const secretKey = process.env.INTASEND_SECRET_KEY;

if (!publishableKey) {
  console.warn("⚠️ INTASEND_PUBLISHABLE_KEY is missing");
}

if (!secretKey) {
  console.warn("⚠️ INTASEND_SECRET_KEY is missing");
}

const testMode =
  String(process.env.INTASEND_TEST_MODE || "true").toLowerCase() === "true";

const intasend = new IntaSend(
  publishableKey,
  secretKey,
  testMode
);

module.exports = {
  intasend,
  testMode
};

"intasend/service.js"

const { intasend } = require("./config");

function normalizePhone(phone) {
  if (!phone) return null;

  let value = String(phone).replace(/\s+/g, "");

  if (value.startsWith("+254")) {
    value = value.substring(1);
  }

  if (value.startsWith("07") || value.startsWith("01")) {
    value = "254" + value.substring(1);
  }

  return value;
}

/*
 * Start M-Pesa STK Push
 */
async function createStkPush({
  amount,
  phoneNumber,
  email,
  firstName = "Scorpio",
  lastName = "Host",
  apiRef
}) {
  if (!amount || Number(amount) <= 0) {
    throw new Error("Invalid payment amount");
  }

  const phone = normalizePhone(phoneNumber);

  if (!phone) {
    throw new Error("Phone number is required");
  }

  const collection = intasend.collection();

  const response = await collection.mpesaStkPush({
    first_name: firstName,
    last_name: lastName,
    email: email || "",
    amount: Number(amount),
    phone_number: phone,
    api_ref:
      apiRef ||
      `SCORPIO-${Date.now()}`
  });

  return response;
}


/*
 * Create IntaSend checkout
 * Useful if you want the customer to open
 * an IntaSend-hosted payment page.
 */
async function createCheckout({
  amount,
  phoneNumber,
  email,
  firstName = "Scorpio",
  lastName = "Host",
  apiRef,
  host,
  redirectUrl
}) {
  const collection = intasend.collection();

  const response = await collection.charge({
    first_name: firstName,
    last_name: lastName,
    email: email || "",
    phone_number: normalizePhone(phoneNumber),
    host,
    amount: Number(amount),
    currency: "KES",
    api_ref:
      apiRef ||
      `SCORPIO-${Date.now()}`,
    redirect_url: redirectUrl,
    method: "M-PESA"
  });

  return response;
}


/*
 * Check payment status
 */
async function getPaymentStatus(invoiceId) {
  if (!invoiceId) {
    throw new Error("invoiceId is required");
  }

  const collection = intasend.collection();

  const response =
    await collection.status(invoiceId);

  return response;
}


module.exports = {
  normalizePhone,
  createStkPush,
  createCheckout,
  getPaymentStatus
};

"intasend/controller.js"

const {
  createStkPush,
  createCheckout,
  getPaymentStatus
} = require("./service");


/*
 * POST /api/intasend/stk
 */
async function stkPush(req, res) {
  try {
    const {
      amount,
      phoneNumber,
      email,
      firstName,
      lastName
    } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Amount and phone number are required"
      });
    }

    const apiRef =
      `SCORPIO-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;

    const payment = await createStkPush({
      amount,
      phoneNumber,
      email,
      firstName,
      lastName,
      apiRef
    });

    return res.json({
      success: true,
      message:
        "M-Pesa payment request sent",
      apiRef,
      payment
    });

  } catch (error) {
    console.error(
      "❌ IntaSend STK error:",
      error?.response?.data ||
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to initiate IntaSend payment",
      error:
        error?.response?.data ||
        error.message
    });
  }
}


/*
 * POST /api/intasend/checkout
 */
async function checkout(req, res) {
  try {
    const {
      amount,
      phoneNumber,
      email,
      firstName,
      lastName
    } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Amount is required"
      });
    }

    const host =
      process.env.APP_URL ||
      "http://localhost:5000";

    const redirectUrl =
      `${host}/wallet.html?payment=success`;

    const apiRef =
      `SCORPIO-${Date.now()}`;

    const payment = await createCheckout({
      amount,
      phoneNumber,
      email,
      firstName,
      lastName,
      apiRef,
      host,
      redirectUrl
    });

    return res.json({
      success: true,
      apiRef,
      payment
    });

  } catch (error) {
    console.error(
      "❌ IntaSend checkout error:",
      error?.response?.data ||
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create IntaSend checkout",
      error:
        error?.response?.data ||
        error.message
    });
  }
}


/*
 * GET /api/intasend/status/:invoiceId
 */
async function paymentStatus(req, res) {
  try {
    const { invoiceId } = req.params;

    const payment =
      await getPaymentStatus(invoiceId);

    return res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error(
      "❌ IntaSend status error:",
      error?.response?.data ||
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve payment status"
    });
  }
}


module.exports = {
  stkPush,
  checkout,
  paymentStatus
};

"intasend/webhook.js"

/*
 * IntaSend sends payment collection events
 * to this endpoint whenever the payment state
 * changes.
 *
 * IMPORTANT:
 * Only credit the user's wallet when state
 * is COMPLETE.
 */

async function handleWebhook(req, res) {
  try {
    const payload = req.body;

    console.log(
      "📩 IntaSend webhook:",
      JSON.stringify(payload, null, 2)
    );

    /*
     * IntaSend collection webhooks contain
     * fields such as:
     *
     * invoice_id
     * state
     * value
     * currency
     * api_ref
     * challenge
     */

    const state = payload?.state;
    const invoiceId =
      payload?.invoice_id;
    const apiRef =
      payload?.api_ref;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Missing invoice_id"
      });
    }

    /*
     * Payment successful
     */
    if (state === "COMPLETE") {

      console.log(
        `✅ IntaSend payment COMPLETE: ${invoiceId}`
      );

      /*
       * TODO:
       *
       * 1. Find Transaction using apiRef
       * 2. Make sure it hasn't already been credited
       * 3. Verify the amount
       * 4. Credit the user's wallet
       * 5. Mark transaction as COMPLETE
       *
       * Do NOT simply trust a frontend request
       * to increase wallet balance.
       */

      /*
       * Example:
       *
       * await Transaction.findOneAndUpdate(
       *   { reference: apiRef },
       *   {
       *     status: "completed",
       *     providerReference: invoiceId
       *   }
       * );
       */
    }

    /*
     * Payment failed
     */
    if (state === "FAILED") {
      console.log(
        `❌ IntaSend payment FAILED: ${invoiceId}`
      );
    }

    /*
     * Payment still processing
     */
    if (state === "PROCESSING") {
      console.log(
        `⏳ IntaSend payment PROCESSING: ${invoiceId}`
      );
    }

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error(
      "❌ IntaSend webhook error:",
      error.message
    );

    return res.status(500).json({
      success: false
    });
  }
}


module.exports = {
  handleWebhook
};

"intasend/routes.js"

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

".env"

Add these to your existing ".env":

INTASEND_PUBLISHABLE_KEY=ISPubKey_test_xxxxxxxxx
INTASEND_SECRET_KEY=ISSecretKey_test_xxxxxxxxx
INTASEND_TEST_MODE=true

APP_URL=https://your-scorspio-host-domain.com

For production, switch to the live IntaSend credentials and set "INTASEND_TEST_MODE=false". IntaSend distinguishes test and live keys/environments, and its secret key should remain backend-only.

"server.js"

Add:

const intasendRoutes =
  require("./intasend/routes");

app.use(
  "/api/intasend",
  intasendRoutes
);

Your endpoints are then:

POST /api/intasend/stk
POST /api/intasend/checkout
GET  /api/intasend/status/:invoiceId
POST /api/intasend/webhook

For an STK request, the frontend sends something like:

{
  "amount": 100,
  "phoneNumber": "2547XXXXXXXX",
  "email": "user@example.com",
  "firstName": "Scorpio",
  "lastName": "User"
}

IntaSend's documented STK flow sends the M-Pesa prompt directly to the customer's phone.

Important wallet rule

Don't increase the Scorpio Host wallet merely because "/stk" returned successfully. The payment can still be "PENDING", "PROCESSING", or "FAILED". IntaSend's webhook reports state changes, with "COMPLETE" meaning the payment succeeded.

For production, the webhook should also validate the challenge configured in the IntaSend dashboard and use HTTPS.

Also install the SDK:

npm install intasend-node

IntaSend currently documents "intasend-node" as its Node.js SDK.
