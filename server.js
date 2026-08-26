require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const IntaSend = require("intasend-node");

const app = express();

/* =====================================================
   CONFIG
===================================================== */

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const APP_URL =
    process.env.APP_URL ||
    "http://localhost:" + PORT;

const INTASEND_PUBLISHABLE_KEY =
    process.env.INTASEND_PUBLISHABLE_KEY;

const INTASEND_SECRET_KEY =
    process.env.INTASEND_SECRET_KEY;

const INTASEND_TEST_MODE =
    String(
        process.env.INTASEND_TEST_MODE || "true"
    ).toLowerCase() === "true";


/* =====================================================
   STARTUP INFORMATION
===================================================== */

console.log("");
console.log("========================================");
console.log("        SCORPIO HOST SERVER");
console.log("========================================");


/* =====================================================
   EXPRESS CONFIG
===================================================== */

app.set("trust proxy", 1);

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);


/* =====================================================
   STATIC FRONTEND
===================================================== */

const publicPath =
    path.join(__dirname, "public");

app.use(
    express.static(publicPath)
);


/* =====================================================
   MONGODB
===================================================== */

if (!MONGO_URI) {

    console.error(
        "❌ MONGO_URI is missing"
    );

} else {

    mongoose
        .connect(MONGO_URI)
        .then(() => {

            console.log(
                "✅ MongoDB Connected"
            );

        })
        .catch((error) => {

            console.error(
                "❌ MongoDB connection failed:"
            );

            console.error(
                error.message
            );

        });

}


/* =====================================================
   INTASEND
===================================================== */

let intasend = null;

if (
    INTASEND_PUBLISHABLE_KEY &&
    INTASEND_SECRET_KEY
) {

    try {

        intasend = new IntaSend(
            INTASEND_PUBLISHABLE_KEY,
            INTASEND_SECRET_KEY,
            INTASEND_TEST_MODE
        );

        console.log(
            "✅ IntaSend initialized (" +
            (
                INTASEND_TEST_MODE
                    ? "SANDBOX"
                    : "LIVE"
            ) +
            ")"
        );

    } catch (error) {

        console.error(
            "❌ IntaSend initialization failed:"
        );

        console.error(
            error.message
        );

    }

} else {

    console.error(
        "❌ IntaSend credentials are missing"
    );

    if (!INTASEND_PUBLISHABLE_KEY) {
        console.error(
            "❌ INTASEND_PUBLISHABLE_KEY missing"
        );
    }

    if (!INTASEND_SECRET_KEY) {
        console.error(
            "❌ INTASEND_SECRET_KEY missing"
        );
    }

}


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            service:
                "Scorpio Host",

            status:
                "online",

            mongodb:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",

            intasend:
                intasend
                    ? "configured"
                    : "not configured",

            mode:
                INTASEND_TEST_MODE
                    ? "sandbox"
                    : "live",

            time:
                new Date().toISOString()

        });

    }
);


/* =====================================================
   HOME PAGE
===================================================== */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                publicPath,
                "index.html"
            )
        );

    }
);


/* =====================================================
   PHONE NUMBER NORMALIZER
===================================================== */

function normalizeKenyanPhone(phone) {

    if (!phone) {
        return null;
    }

    let value =
        String(phone)
            .trim()
            .replace(/\s+/g, "")
            .replace(/-/g, "");


    /*
       +254712345678
       ->
       254712345678
    */

    if (
        value.startsWith("+254")
    ) {

        value =
            value.substring(1);

    }


    /*
       0712345678
       ->
       254712345678
    */

    if (
        value.startsWith("07") ||
        value.startsWith("01")
    ) {

        value =
            "254" +
            value.substring(1);

    }


    /*
       712345678
       ->
       254712345678
    */

    if (
        value.length === 9 &&
        (
            value.startsWith("7") ||
            value.startsWith("1")
        )
    ) {

        value =
            "254" + value;

    }


    /*
       Validate Kenyan mobile number
    */

    if (
        !/^254(7|1)\d{8}$/.test(
            value
        )
    ) {

        return null;

    }

    return value;

}


/* =====================================================
   PAYMENT REFERENCE
===================================================== */

function createPaymentReference() {

    return (
        "SCORPIO-" +
        Date.now() +
        "-" +
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()
    );

}


/* =====================================================
   INTASEND M-PESA STK PUSH
=====================================================

   POST

   /api/intasend/stk

   Example body:

   {
       "amount": 100,
       "phoneNumber": "0712345678",
       "email": "user@example.com",
       "firstName": "Scorpio",
       "lastName": "User"
   }

===================================================== */

app.post(
    "/api/intasend/stk",
    async (req, res) => {

        try {

            /* -----------------------------------------
               CHECK INTASEND
            ----------------------------------------- */

            if (!intasend) {

                return res.status(500).json({

                    success: false,

                    message:
                        "IntaSend is not configured."

                });

            }


            /* -----------------------------------------
               GET REQUEST DATA
            ----------------------------------------- */

            const {
                amount,
                phoneNumber,
                email,
                firstName,
                lastName
            } = req.body;


            /* -----------------------------------------
               VALIDATE AMOUNT
            ----------------------------------------- */

            const numericAmount =
                Number(amount);


            if (
                !Number.isFinite(
                    numericAmount
                ) ||
                numericAmount <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Enter a valid amount."

                });

            }


            /* -----------------------------------------
               VALIDATE PHONE
            ----------------------------------------- */

            const phone =
                normalizeKenyanPhone(
                    phoneNumber
                );


            if (!phone) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Enter a valid Kenyan M-Pesa number."

                });

            }


            /* -----------------------------------------
               CREATE REFERENCE
            ----------------------------------------- */

            const apiRef =
                createPaymentReference();


            console.log("");
            console.log(
                "----------------------------------------"
            );

            console.log(
                "💳 INTASEND STK REQUEST"
            );

            console.log(
                "Amount:",
                numericAmount
            );

            console.log(
                "Phone:",
                phone
            );

            console.log(
                "Reference:",
                apiRef
            );


            /* -----------------------------------------
               INTASEND COLLECTION
            ----------------------------------------- */

            const collection =
                intasend.collection();


            /* -----------------------------------------
               SEND STK PUSH
            ----------------------------------------- */

            const response =
                await collection.mpesaStkPush({

                    first_name:
                        firstName ||
                        "Scorpio",

                    last_name:
                        lastName ||
                        "Host",

                    email:
                        email ||
                        "customer@example.com",

                    host:
                        APP_URL,

                    amount:
                        numericAmount,

                    phone_number:
                        phone,

                    api_ref:
                        apiRef

                });


            console.log(
                "✅ STK request accepted by IntaSend"
            );

            console.log(
                JSON.stringify(
                    response,
                    null,
                    2
                )
            );


            /* -----------------------------------------
               RESPONSE
            ----------------------------------------- */

            return res.status(200).json({

                success: true,

                message:
                    "M-Pesa STK prompt sent successfully.",

                apiRef:

                    apiRef,

                amount:

                    numericAmount,

                phone:

                    phone,

                payment:

                    response

            });


        } catch (error) {

            console.error("");
            console.error(
                "❌ INTASEND STK ERROR"
            );


            if (
                error &&
                error.response
            ) {

                console.error(
                    JSON.stringify(
                        error.response.data,
                        null,
                        2
                    )
                );

            } else {

                console.error(
                    error.message
                );

            }


            return res.status(500).json({

                success: false,

                message:
                    "Unable to send M-Pesa STK prompt.",

                error:
                    error?.response?.data ||
                    error?.message ||
                    "Unknown IntaSend error"

            });

        }

    }
);


/* =====================================================
   CHECK INTASEND PAYMENT STATUS
=====================================================

   GET

   /api/intasend/status/:invoiceId

===================================================== */

app.get(
    "/api/intasend/status/:invoiceId",
    async (req, res) => {

        try {

            if (!intasend) {

                return res.status(500).json({

                    success: false,

                    message:
                        "IntaSend is not configured."

                });

            }


            const invoiceId =
                req.params.invoiceId;


            if (!invoiceId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invoice ID is required."

                });

            }


            const collection =
                intasend.collection();


            const response =
                await collection.status(
                    invoiceId
                );


            return res.json({

                success: true,

                payment:
                    response

            });


        } catch (error) {

            console.error(
                "❌ Payment status error:",
                error?.response?.data ||
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to check payment status.",

                error:
                    error?.response?.data ||
                    error.message

            });

        }

    }
);


/* =====================================================
   INTASEND WEBHOOK
=====================================================

   POST

   /api/intasend/webhook

   Configure this in the IntaSend dashboard:

   https://YOUR-DOMAIN/api/intasend/webhook

===================================================== */

app.post(
    "/api/intasend/webhook",
    async (req, res) => {

        try {

            const payload =
                req.body;


            console.log("");
            console.log(
                "========================================"
            );

            console.log(
                "📩 INTASEND WEBHOOK"
            );

            console.log(
                JSON.stringify(
                    payload,
                    null,
                    2
                )
            );


            /* -----------------------------------------
               WEBHOOK CHALLENGE
            ----------------------------------------- */

            const challenge =
                process.env
                    .INTASEND_WEBHOOK_CHALLENGE;


            if (
                challenge &&
                payload.challenge !==
                    challenge
            ) {

                console.error(
                    "❌ Invalid webhook challenge"
                );

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid webhook challenge."

                });

            }


            /* -----------------------------------------
               PAYMENT DATA
            ----------------------------------------- */

            const state =
                payload?.state;

            const invoiceId =
                payload?.invoice_id;

            const apiRef =
                payload?.api_ref;

            const value =
                Number(
                    payload?.value || 0
                );


            console.log(
                "Invoice:",
                invoiceId
            );

            console.log(
                "State:",
                state
            );

            console.log(
                "API Reference:",
                apiRef
            );

            console.log(
                "Amount:",
                value
            );


            /* -----------------------------------------
               COMPLETE
            ----------------------------------------- */

            if (
                state === "COMPLETE"
            ) {

                console.log(
                    "✅ PAYMENT COMPLETE"
                );

                /*
                   IMPORTANT:

                   Do not credit the wallet simply
                   because this webhook arrived.

                   The production wallet logic should:

                   1. Find the transaction by apiRef
                   2. Confirm it belongs to the user
                   3. Confirm the amount
                   4. Check it isn't already completed
                   5. Credit the wallet once
                   6. Save the IntaSend invoice ID
                */

                console.log(
                    "💰 Payment ready for transaction processing."
                );

            }


            /* -----------------------------------------
               PROCESSING
            ----------------------------------------- */

            else if (
                state === "PROCESSING"
            ) {

                console.log(
                    "⏳ Payment processing..."
                );

            }


            /* -----------------------------------------
               PENDING
            ----------------------------------------- */

            else if (
                state === "PENDING"
            ) {

                console.log(
                    "⏳ Payment pending..."
                );

            }


            /* -----------------------------------------
               FAILED
            ----------------------------------------- */

            else if (
                state === "FAILED"
            ) {

                console.log(
                    "❌ Payment failed."
                );

                console.log(
                    "Reason:",
                    payload?.failed_reason ||
                    "Unknown"
                );

            }


            /* -----------------------------------------
               UNKNOWN STATE
            ----------------------------------------- */

            else {

                console.log(
                    "ℹ️ Unknown payment state:",
                    state
                );

            }


            /* -----------------------------------------
               ACKNOWLEDGE WEBHOOK
            ----------------------------------------- */

            return res.status(200).json({

                success: true

            });


        } catch (error) {

            console.error(
                "❌ WEBHOOK ERROR:",
                error.message
            );

            return res.status(500).json({

                success: false,

                message:
                    "Webhook processing failed."

            });

        }

    }
);


/* =====================================================
   404 API HANDLER
===================================================== */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API endpoint not found.",

            path:
                req.originalUrl

        });

    }
);


/* =====================================================
   FRONTEND FALLBACK
=====================================================

   IMPORTANT:

   Do NOT use:

       app.get("*", ...)

   because newer Express/router versions reject
   the bare wildcard.

===================================================== */

app.use(
    (req, res, next) => {

        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "API endpoint not found.",

                path:
                    req.originalUrl

            });

        }


        const indexFile =
            path.join(
                publicPath,
                "index.html"
            );


        res.sendFile(
            indexFile,
            (error) => {

                if (error) {

                    next(error);

                }

            }
        );

    }
);


/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "🔥 SERVER ERROR:"
        );

        console.error(
            error
        );


        if (
            res.headersSent
        ) {

            return next(error);

        }


        res.status(500).json({

            success: false,

            message:
                "Internal server error."

        });

    }
);


/* =====================================================
   START SERVER
===================================================== */

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "🚀 SCORPIO HOST ONLINE"
        );

        console.log(
            "🌐 APP:",
            APP_URL
        );

        console.log(
            "📡 PORT:",
            PORT
        );

        console.log(
            "💳 INTASEND:",
            intasend
                ? (
                    INTASEND_TEST_MODE
                        ? "SANDBOX"
                        : "LIVE"
                )
                : "NOT CONFIGURED"
        );

        console.log(
            "💰 STK:",
            "/api/intasend/stk"
        );

        console.log(
            "📩 WEBHOOK:",
            "/api/intasend/webhook"
        );

        console.log(
            "========================================"
        );

        console.log("");

    }
);


/* =====================================================
   PROCESS ERROR HANDLERS
===================================================== */

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "❌ Unhandled Promise Rejection:"
        );

        console.error(
            error
        );

    }
);


process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "❌ Uncaught Exception:"
        );

        console.error(
            error
        );

    }
);
