"use strict";

require("dotenv").config();

const IntaSend = require("intasend-node");

/* =====================================================
   CONFIGURATION
===================================================== */

const PUBLISHABLE_KEY =
    process.env.INTASEND_PUBLISHABLE_KEY;

const SECRET_KEY =
    process.env.INTASEND_SECRET_KEY;

/*
 * Set:
 *
 * NODE_ENV=production
 * INTASEND_MODE=live
 *
 * for live payments.
 *
 * Otherwise the service defaults to sandbox.
 */

const TEST_MODE =
    process.env.INTASEND_MODE !== "live";

/* =====================================================
   VALIDATE CONFIG
===================================================== */

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

/*
 * Prevent accidentally mixing live and test keys.
 */

if (
    TEST_MODE &&
    SECRET_KEY.includes("_live_")
) {
    console.warn(
        "⚠️ IntaSend is configured for SANDBOX but a live-looking secret key was supplied."
    );
}

if (
    !TEST_MODE &&
    SECRET_KEY.includes("_test_")
) {
    console.warn(
        "⚠️ IntaSend is configured for LIVE but a test-looking secret key was supplied."
    );
}

/* =====================================================
   INITIALIZE INTASEND
===================================================== */

const intasend = new IntaSend(
    PUBLISHABLE_KEY,
    SECRET_KEY,
    TEST_MODE
);

const collection =
    intasend.collection();

/* =====================================================
   PHONE NUMBER NORMALIZER
===================================================== */

function normalizePhone(phone) {

    if (
        phone === undefined ||
        phone === null
    ) {
        throw new Error(
            "Phone number is required"
        );
    }

    let value =
        String(phone)
            .trim()
            .replace(/[\s\-().]/g, "");

    /*
     * 07XXXXXXXX
     * 01XXXXXXXX
     */
    if (
        /^0[17]\d{8}$/.test(value)
    ) {
        value =
            "254" +
            value.substring(1);
    }

    /*
     * +2547XXXXXXXX
     */
    else if (
        /^\+254[17]\d{8}$/.test(value)
    ) {
        value =
            value.substring(1);
    }

    /*
     * 2547XXXXXXXX
     * 2541XXXXXXXX
     */
    else if (
        /^254[17]\d{8}$/.test(value)
    ) {
        // Already normalized.
    }

    else {
        throw new Error(
            "Invalid Kenyan M-Pesa phone number. Use 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX or 2547XXXXXXXX."
        );
    }

    return value;
}

/* =====================================================
   AMOUNT VALIDATOR
===================================================== */

function normalizeAmount(amount) {

    const numericAmount =
        Number(amount);

    if (
        !Number.isFinite(
            numericAmount
        )
    ) {
        throw new Error(
            "Invalid payment amount"
        );
    }

    if (
        numericAmount <= 0
    ) {
        throw new Error(
            "Payment amount must be greater than zero"
        );
    }

    /*
     * Currency is KES.
     * Keep two decimal places maximum.
     */

    return Number(
        numericAmount.toFixed(2)
    );
}

/* =====================================================
   NAME CLEANER
===================================================== */

function cleanName(value, fallback) {

    const name =
        String(
            value || fallback
        )
            .trim()
            .replace(
                /[^a-zA-Z0-9 _:-]/g,
                ""
            );

    return name || fallback;
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

    try {

        const normalizedPhone =
            normalizePhone(
                phoneNumber
            );

        const numericAmount =
            normalizeAmount(
                amount
            );

        if (!email) {
            throw new Error(
                "Customer email is required"
            );
        }

        if (!reference) {
            throw new Error(
                "Payment reference is required"
            );
        }

        const cleanFirstName =
            cleanName(
                firstName,
                "Scorpio"
            );

        const cleanLastName =
            cleanName(
                lastName,
                "User"
            );

        console.log(
            "=========================================="
        );

        console.log(
            "📲 INTASEND M-PESA STK PUSH"
        );

        console.log(
            `Environment: ${
                TEST_MODE
                    ? "SANDBOX"
                    : "LIVE"
            }`
        );

        console.log(
            `Phone: ${normalizedPhone}`
        );

        console.log(
            `Amount: KES ${numericAmount}`
        );

        console.log(
            `Reference: ${reference}`
        );

        console.log(
            "=========================================="
        );

        /*
         * IntaSend's documented Node SDK
         * collection.mpesaStkPush() method.
         */

        const response =
            await collection.mpesaStkPush({

                first_name:
                    cleanFirstName,

                last_name:
                    cleanLastName,

                email:
                    email.trim(),

                host:
                    process.env.APP_URL ||
                    "http://localhost:5000",

                amount:
                    numericAmount,

                phone_number:
                    normalizedPhone,

                api_ref:
                    reference
            });

        console.log(
            "✅ IntaSend STK response received"
        );

        console.log(
            JSON.stringify(
                response,
                null,
                2
            )
        );

        return {
            success: true,

            response,

            phoneNumber:
                normalizedPhone,

            amount:
                numericAmount,

            reference
        };

    } catch (error) {

        console.error(
            "❌ IntaSend STK Push failed"
        );

        /*
         * SDK errors can have different
         * response formats.
         */

        if (error.response) {

            console.error(
                "Status:",
                error.response.status
            );

            console.error(
                "Response:",
                JSON.stringify(
                    error.response.data ||
                    error.response,
                    null,
                    2
                )
            );

        } else {

            console.error(
                error.message ||
                error
            );
        }

        throw new Error(
            extractErrorMessage(
                error
            )
        );
    }
}

/* =====================================================
   ERROR EXTRACTION
===================================================== */

function extractErrorMessage(error) {

    if (
        error &&
        error.response &&
        error.response.data
    ) {

        const data =
            error.response.data;

        if (typeof data === "string") {
            return data;
        }

        if (data.detail) {
            return String(
                data.detail
            );
        }

        if (data.message) {
            return String(
                data.message
            );
        }

        if (data.error) {
            return String(
                data.error
            );
        }

        try {
            return JSON.stringify(
                data
            );
        } catch (_) {}
    }

    if (
        error &&
        error.message
    ) {
        return error.message;
    }

    return "IntaSend payment request failed";
}

/* =====================================================
   EXTRACT API REFERENCE
===================================================== */

function getApiReference(payload) {

    if (!payload) {
        return null;
    }

    return (
        payload.api_ref ||
        payload.api_reference ||
        payload.reference ||
        payload.invoice_id ||
        payload.invoice?.api_ref ||
        payload.invoice?.reference ||
        payload.data?.api_ref ||
        payload.data?.api_reference ||
        payload.data?.reference ||
        payload.data?.invoice_id ||
        null
    );
}

/* =====================================================
   EXTRACT INVOICE / PROVIDER ID
===================================================== */

function getInvoiceId(payload) {

    if (!payload) {
        return null;
    }

    return (
        payload.invoice_id ||
        payload.invoice?.invoice_id ||
        payload.invoice?.id ||
        payload.id ||
        payload.payment_id ||
        payload.transaction_id ||
        payload.data?.invoice_id ||
        payload.data?.id ||
        payload.data?.payment_id ||
        payload.data?.transaction_id ||
        null
    );
}

/* =====================================================
   PAYMENT STATUS NORMALIZATION
===================================================== */

function getPaymentStatus(payload) {

    if (!payload) {
        return null;
    }

    const status =
        payload.status ||
        payload.state ||
        payload.invoice?.state ||
        payload.invoice?.status ||
        payload.data?.status ||
        payload.data?.state ||
        payload.payment_status ||
        payload.data?.payment_status;

    if (!status) {
        return null;
    }

    return String(
        status
    )
        .trim()
        .toUpperCase();
}

/* =====================================================
   SUCCESS DETECTION
===================================================== */

function isSuccessfulPayment(
    payload
) {

    const status =
        getPaymentStatus(
            payload
        );

    /*
     * IntaSend may expose different
     * success states depending on the
     * callback/payment flow.
     */

    const successfulStates = [
        "COMPLETE",
        "COMPLETED",
        "SUCCESS",
        "SUCCESSFUL",
        "PAID",
        "PAYSUCCESS",
        "SUCCESSFUL_PAYMENT"
    ];

    if (
        successfulStates.includes(
            status
        )
    ) {
        return true;
    }

    /*
     * Some callback payloads expose
     * invoice state as a successful
     * payment indicator.
     */

    const invoiceState =
        payload?.invoice?.state;

    if (
        invoiceState &&
        successfulStates.includes(
            String(
                invoiceState
            )
                .toUpperCase()
        )
    ) {
        return true;
    }

    return false;
}

/* =====================================================
   FAILURE DETECTION
===================================================== */

function isFailedPayment(
    payload
) {

    const status =
        getPaymentStatus(
            payload
        );

    const failedStates = [
        "FAILED",
        "FAIL",
        "ERROR",
        "PAYERROR",
        "CANCELLED",
        "CANCELED",
        "REJECTED",
        "DECLINED",
        "EXPIRED",
        "INITIATION-FAILED",
        "RESULT-FAILED"
    ];

    return failedStates.includes(
        status
    );
}

/* =====================================================
   PROCESSING DETECTION
===================================================== */

function isProcessingPayment(
    payload
) {

    const status =
        getPaymentStatus(
            payload
        );

    const processingStates = [
        "PENDING",
        "PROCESSING",
        "INITIATED",
        "PROCESSING-RESULTS",
        "OBSERVATION"
    ];

    return processingStates.includes(
        status
    );
}

/* =====================================================
   EXPORTED SERVICE
===================================================== */

module.exports = {

    TEST_MODE,

    PUBLISHABLE_KEY,

    normalizePhone,

    normalizeAmount,

    mpesaStkPush,

    getApiReference,

    getInvoiceId,

    getPaymentStatus,

    isSuccessfulPayment,

    isFailedPayment,

    isProcessingPayment
};
