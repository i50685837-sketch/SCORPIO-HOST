require("dotenv").config();


/* =====================================================
   INTASEND CONFIGURATION
===================================================== */

const INTASEND_PUBLISHABLE_KEY =
    process.env.INTASEND_PUBLISHABLE_KEY;

const INTASEND_SECRET_KEY =
    process.env.INTASEND_SECRET_KEY;

const INTASEND_TEST =
    String(
        process.env.INTASEND_TEST ?? "true"
    ).toLowerCase() === "true";


/* =====================================================
   APPLICATION
===================================================== */

const APP_URL =
    process.env.APP_URL ||
    `http://localhost:${process.env.PORT || 5000}`;


/* =====================================================
   WEBHOOK
===================================================== */

const WEBHOOK_URL =
    process.env.INTASEND_WEBHOOK_URL ||
    `${APP_URL}/api/intasend/webhook`;


/* =====================================================
   VALIDATION
===================================================== */

if (!INTASEND_PUBLISHABLE_KEY) {

    console.warn(
        "⚠️ INTASEND_PUBLISHABLE_KEY is missing."
    );

}


if (!INTASEND_SECRET_KEY) {

    console.warn(
        "⚠️ INTASEND_SECRET_KEY is missing."
    );

}


/* =====================================================
   ENVIRONMENT
===================================================== */

const environment =
    INTASEND_TEST
        ? "sandbox"
        : "live";


/* =====================================================
   LOGGING
===================================================== */

console.log(
    `💳 IntaSend initialized (${environment.toUpperCase()})`
);


/* =====================================================
   EXPORT
===================================================== */

module.exports = {

    publishableKey:
        INTASEND_PUBLISHABLE_KEY,

    secretKey:
        INTASEND_SECRET_KEY,

    test:
        INTASEND_TEST,

    environment,

    appUrl:
        APP_URL,

    webhookUrl:
        WEBHOOK_URL

};
