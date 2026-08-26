require("dotenv").config();

const crypto = require("crypto");
const IntaSend = require("intasend-node");

/* =====================================================
   CONFIG
===================================================== */

const PUBLISHABLE_KEY =
    process.env.INTASEND_PUBLISHABLE_KEY;

const SECRET_KEY =
    process.env.INTASEND_SECRET_KEY;

const TEST_MODE =
    String(process.env.INTASEND_TEST || "true")
        .toLowerCase() === "true";

const APP_URL =
    process.env.APP_URL ||
    "http://localhost:5000";

if (!PUBLISHABLE_KEY) {
    throw new Error(
        "INTASEND_PUBLISHABLE_KEY is missing"
    );
}

if (!SECRET_KEY) {
    throw new Error(
        "INTASEND_SECRET_KEY is missing"
    );
}

/* =====================================================
   INTASEND CLIENT
===================================================== */

const intasend = new IntaSend(
    PUBLISHABLE_KEY,
    SECRET_KEY,
    TEST_MODE
);

const collection = intasend.collection();

/* =====================================================
   HELPERS
===================================================== */

function normalizePhone(phone) {
    if (!phone) {
        throw new Error(
            "Phone number is required"
        );
    }

    let value = String(phone)
        .replace(/\s+/g, "")
        .replace(/-/g, "");

    if (value.startsWith("+254")) {
        value = value.substring(1);
    }

    if (value.startsWith("07")) {
        value = "254" + value.substring(1);
    }

    if (value.startsWith("01")) {
        value = "254" + value.substring(1);
    }

    if (!/^254[17]\d{8}$/.test(value)) {
        throw new Error(
            "Invalid Kenyan phone number"
        );
    }

    return value;
}

function validateAmount(amount) {
    const value = Number(amount);

    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        throw new Error(
            "Invalid payment amount"
        );
    }

    return Math.round(value * 100) / 100;
}

function createReference() {
    return (
        "SCORPIO-" +
        Date.now() +
        "-" +
        crypto
            .randomBytes(5)
            .toString("hex")
            .toUpperCase()
    );
}

/* =====================================================
   M-PESA STK PUSH
===================================================== */

async function mpesaStkPush({
    firstName,
    lastName,
    email,
    phoneNumber,
    amount,
    reference
}) {
    const phone = normalizePhone(
        phoneNumber
    );

    const paymentAmount =
        validateAmount(amount);

    const apiRef =
        reference || createReference();

    try {
        const response =
            await collection.mpesaStkPush({
                first_name:
                    firstName || "Scorpio",

                last_name:
                    lastName || "Host",

                email,

                host: APP_URL,

                amount: paymentAmount,

                phone_number: phone,

                api_ref: apiRef
            });

        return {
            success: true,

            reference: apiRef,

            amount: paymentAmount,

            phoneNumber: phone,

            response
        };
    } catch (error) {
        console.error(
            "❌ IntaSend STK Push failed:",
            error
        );

        throw new Error(
            error.message ||
            "Failed to initiate M-Pesa payment"
        );
    }
}

/* =====================================================
   CHECK PAYMENT STATUS
===================================================== */

async function getPaymentStatus(
    invoiceId
) {
    if (!invoiceId) {
        throw new Error(
            "Invoice ID is required"
        );
    }

    try {
        const response =
            await collection.status(
                invoiceId
            );

        return {
            success: true,
            response
        };
    } catch (error) {
        console.error(
            "❌ IntaSend status check failed:",
            error
        );

        throw new Error(
            error.message ||
            "Unable to check payment status"
        );
    }
}

/* =====================================================
   CHECK WHETHER PAYMENT IS COMPLETE
===================================================== */

function isSuccessfulPayment(
    payload
) {
    const state = String(
        payload?.state ||
        payload?.status ||
        payload?.invoice?.state ||
        ""
    ).toUpperCase();

    return state === "COMPLETE";
}

function isFailedPayment(
    payload
) {
    const state = String(
        payload?.state ||
        payload?.status ||
        payload?.invoice?.state ||
        ""
    ).toUpperCase();

    return [
        "FAILED",
        "CANCELLED",
        "CANCELED"
    ].includes(state);
}

/* =====================================================
   EXTRACT API REFERENCE
===================================================== */

function getApiReference(
    payload
) {
    return (
        payload?.api_ref ||
        payload?.invoice?.api_ref ||
        payload?.api_reference ||
        null
    );
}

/* =====================================================
   EXTRACT INVOICE ID
===================================================== */

function getInvoiceId(
    payload
) {
    return (
        payload?.invoice_id ||
        payload?.invoice?.invoice_id ||
        payload?.invoice?.id ||
        null
    );
}

/* =====================================================
   WEBHOOK VALIDATION
===================================================== */

/*
   IntaSend webhook setup provides a challenge.
   Store that challenge in your .env as:

   INTASEND_WEBHOOK_CHALLENGE=your_challenge

   The webhook route should compare the received
   challenge with this value before processing events.
*/

function validateWebhook(
    payload
) {
    const configuredChallenge =
        process.env.INTASEND_WEBHOOK_CHALLENGE;

    if (!configuredChallenge) {
        return false;
    }

    const receivedChallenge =
        payload?.challenge;

    if (!receivedChallenge) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(
            String(receivedChallenge)
        ),
        Buffer.from(
            String(configuredChallenge)
        )
    );
}

/* =====================================================
   EXPORTS
===================================================== */

module.exports = {
    intasend,

    collection,

    mpesaStkPush,

    getPaymentStatus,

    isSuccessfulPayment,

    isFailedPayment,

    getApiReference,

    getInvoiceId,

    validateWebhook,

    normalizePhone,

    validateAmount,

    createReference,

    TEST_MODE,

    APP_URL
};
