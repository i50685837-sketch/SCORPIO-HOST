require("dotenv").config();

const IntaSend = require("intasend-node");

const PUBLISHABLE_KEY =
    process.env.INTASEND_PUBLISHABLE_KEY;

const SECRET_KEY =
    process.env.INTASEND_SECRET_KEY;

const TEST_MODE =
    String(process.env.INTASEND_TEST_MODE)
        .toLowerCase() === "true";

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

const intasend =
    new IntaSend(
        PUBLISHABLE_KEY,
        SECRET_KEY,
        TEST_MODE
    );

const collection =
    intasend.collection();

/* ==========================================
   NORMALIZE PHONE
========================================== */

function normalizePhone(phone) {

    if (!phone) {
        return null;
    }

    let value =
        String(phone)
            .trim()
            .replace(/\s+/g, "")
            .replace(/-/g, "");

    if (value.startsWith("+254")) {
        value =
            "254" +
            value.substring(4);
    }

    if (value.startsWith("07") ||
        value.startsWith("01")) {

        value =
            "254" +
            value.substring(1);
    }

    if (!/^254[17]\d{8}$/.test(value)) {
        return null;
    }

    return value;
}

/* ==========================================
   STK PUSH
========================================== */

async function mpesaStkPush({
    firstName,
    lastName,
    email,
    phoneNumber,
    amount,
    reference,
    host
}) {

    const phone =
        normalizePhone(phoneNumber);

    if (!phone) {
        throw new Error(
            "Invalid Kenyan M-Pesa phone number"
        );
    }

    const numericAmount =
        Number(amount);

    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {
        throw new Error(
            "Invalid payment amount"
        );
    }

    const response =
        await collection.mpesaStkPush({
            first_name:
                firstName || "Scorpio",

            last_name:
                lastName || "Host",

            email:
                email || "customer@example.com",

            host:
                host ||
                process.env.APP_URL,

            amount:
                numericAmount,

            phone_number:
                phone,

            api_ref:
                reference
        });

    return {
        response,
        phone
    };
}

/* ==========================================
   STATUS
========================================== */

function getState(payload) {

    return String(
        payload?.state ||
        payload?.invoice?.state ||
        payload?.payment?.state ||
        ""
    ).toUpperCase();
}

function isSuccessfulPayment(payload) {
    return getState(payload) === "COMPLETE";
}

function isFailedPayment(payload) {
    return getState(payload) === "FAILED";
}

function isProcessingPayment(payload) {

    return [
        "PENDING",
        "PROCESSING"
    ].includes(
        getState(payload)
    );
}

/* ==========================================
   API REFERENCE
========================================== */

function getApiReference(payload) {

    return (
        payload?.api_ref ||
        payload?.invoice?.api_ref ||
        payload?.payment?.api_ref ||
        null
    );
}

/* ==========================================
   INVOICE ID
========================================== */

function getInvoiceId(payload) {

    return (
        payload?.invoice_id ||
        payload?.invoice?.invoice_id ||
        payload?.payment?.invoice_id ||
        null
    );
}

module.exports = {

    TEST_MODE,

    normalizePhone,

    mpesaStkPush,

    getState,

    getApiReference,

    getInvoiceId,

    isSuccessfulPayment,

    isFailedPayment,

    isProcessingPayment
};
