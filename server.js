require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const IntaSend = require("intasend-node");

/*
========================================================
SCORPIO HOST
COMPLETE SERVER
INTASEND M-PESA STK PUSH
========================================================
*/

/* ======================================================
   APP
====================================================== */

const app = express();

const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI;

const APP_URL =
    process.env.APP_URL ||
    `http://localhost:${PORT}`;


/* ======================================================
   BASIC CONFIG
====================================================== */

app.set("trust proxy", 1);

app.use(cors({
    origin: true,
    credentials: true
}));

/*
 IMPORTANT:
 Webhook needs JSON parsing.
*/
app.use(express.json({
    limit: "2mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "2mb"
}));


/* ======================================================
   STATIC FRONTEND
====================================================== */

const publicPath = path.join(
    __dirname,
    "public"
);

app.use(
    express.static(publicPath)
);


/* ======================================================
   MONGODB
====================================================== */

if (!MONGO_URI) {

    console.error(
        "❌ MONGO_URI is missing from .env"
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


/* ======================================================
   INTASEND CONFIG
====================================================== */

const INTASEND_PUBLISHABLE_KEY =
    process.env.INTASEND_PUBLISHABLE_KEY;

const INTASEND_SECRET_KEY =
    process.env.INTASEND_SECRET_KEY;

const INTASEND_TEST_MODE =
    String(
        process.env.INTASEND_TEST_MODE || "true"
    ).toLowerCase() === "true";


if (!INTASEND_PUBLISHABLE_KEY) {

    console.error(
        "❌ INTASEND_PUBLISHABLE_KEY is missing"
    );

}

if (!INTASEND_SECRET_KEY) {

    console.error(
        "❌ INTASEND_SECRET_KEY is missing"
    );

}


/* ======================================================
   INTASEND CLIENT
====================================================== */

let intasend = null;

if (
    INTASEND_PUBLISHABLE_KEY &&
    INTASEND_SECRET_KEY
) {

    intasend = new IntaSend(
        INTASEND_PUBLISHABLE_KEY,
        INTASEND_SECRET_KEY,
        INTASEND_TEST_MODE
    );

    console.log(
        `✅ IntaSend initialized (${INTASEND_TEST_MODE ? "SANDBOX" : "LIVE"})`
    );
}


/* ======================================================
   HEALTH CHECK
====================================================== */

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            success: true,
            service: "Scorpio Host",
            status: "online",
            mongodb:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",
            intasend:
                intasend
                    ? "configured"
                    : "not configured",
            environment:
                INTASEND_TEST_MODE
                    ? "sandbox"
                    : "live",
            time:
                new Date().toISOString()
        });

    }
);


/* ======================================================
   HOME
====================================================== */

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


/* ======================================================
   PHONE NORMALIZATION
====================================================== */

function normalizeKenyanPhone(phone) {

    if (!phone) {
        return null;
    }

    let value = String(phone)
        .trim()
        .replace(/\s+/g, "")
        .replace(/-/g, "");


    /*
    +254712345678
    -> 254712345678
    */

    if (value.startsWith("+254")) {

        value =
            value.substring(1);

    }


    /*
    0712345678
    -> 254712345678
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
    -> 254712345678
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
    Final validation
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


/* ======================================================
   CREATE PAYMENT REFERENCE
====================================================== */

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


/* ======================================================
   M-PESA STK PUSH
======================================================

POST

/api/intasend/stk

BODY

{
    "amount": 100,
    "phoneNumber": "0712345678",
    "email": "user@example.com",
    "firstName": "Scorpio",
    "lastName": "User"
}

====================================================== */

app.post(
    "/api/intasend/stk",
    async (req, res) => {

        try {

            if (!intasend) {

                return res.status(500).json({

                    success: false,

                    message:
                        "IntaSend is not configured. Check your .env keys."

                });

            }


            const {
                amount,
                phoneNumber,
                email,
                firstName,
                lastName
            } = req.body;


            /* ------------------------------------------
               AMOUNT
            ------------------------------------------ */

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
                        "Enter a valid payment amount."

                });

            }


            /*
            Optional safety limit.
            Change/remove according to your business rules.
            */

            if (
                numericAmount > 1000000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Payment amount is too large."

                });

            }


            /* ------------------------------------------
               PHONE
            ------------------------------------------ */

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


            /* ------------------------------------------
               REFERENCE
            ------------------------------------------ */

            const apiRef =
                createPaymentReference();


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


            /* ------------------------------------------
               INTASEND COLLECTION
            ------------------------------------------ */

            const collection =
                intasend.collection();


            /*
            This is the official IntaSend
            Node SDK STK Push method.
            */

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
                "✅ IntaSend STK response:"
            );

            console.log(
                JSON.stringify(
                    response,
                    null,
                    2
                )
            );


            /*
            Do NOT credit wallet here.

            This only means IntaSend accepted
            the STK request.

            Actual wallet credit should happen
            after COMPLETE webhook.
            */


            return res.status(200).json({

                success: true,

                message:
                    "M-Pesa STK prompt sent successfully.",

                apiRef,

                amount:
                    numericAmount,

                phone,

                payment:
                    response

            });


        } catch (error) {

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


/* ======================================================
   CHECK PAYMENT STATUS
======================================================

GET

/api/intasend/status/INVOICE_ID

====================================================== */

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


/* ======================================================
   INTASEND WEBHOOK
======================================================

POST

/api/intasend/webhook

Configure this URL inside your IntaSend dashboard.

Example:

https://your-domain.com/api/intasend/webhook

====================================================== */

app.post(
    "/api/intasend/webhook",
    async (req, res) => {

        try {

            const payload =
                req.body;


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


            /* ------------------------------------------
               WEBHOOK CHALLENGE
            ------------------------------------------ */

            const configuredChallenge =
                process.env.INTASEND_WEBHOOK_CHALLENGE;


            if (
                configuredChallenge &&
                payload.challenge !==
                    configuredChallenge
            ) {

                console.error(
                    "❌ Invalid IntaSend webhook challenge"
                );

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid webhook challenge."

                });

            }


            /* ------------------------------------------
               PAYMENT DATA
            ------------------------------------------ */

            const state =
                payload.state;

            const invoiceId =
                payload.invoice_id;

            const apiRef =
                payload.api_ref;

            const value =
                Number(
                    payload.value || 0
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
                "API Ref:",
                apiRef
            );

            console.log(
                "Value:",
                value
            );


            /* ------------------------------------------
               SUCCESS
            ------------------------------------------ */

            if (
                state === "COMPLETE"
            ) {

                console.log(
                    "✅ PAYMENT COMPLETE"
                );


                /*
                IMPORTANT:

                This is where Scorpio Host
                should credit the user's wallet.

                NEVER trust the frontend to
                confirm a payment.

                Use apiRef to find the transaction
                created when the STK request started.
                */


                /*
                Example future logic:

                const transaction =
                    await Transaction.findOne({
                        reference: apiRef
                    });

                if (
                    transaction &&
                    transaction.status !== "completed"
                ) {

                    transaction.status =
                        "completed";

                    transaction.providerReference =
                        invoiceId;

                    transaction.amount =
                        value;

                    await transaction.save();


                    await Wallet.findOneAndUpdate(
                        {
                            user:
                                transaction.user
                        },
                        {
                            $inc: {
                                balance:
                                    value
                            }
                        }
                    );

                }
                */


                console.log(
                    "💰 Payment is ready for wallet credit."
                );

            }


            /* ------------------------------------------
               PROCESSING
            ------------------------------------------ */

            else if (
                state === "PROCESSING"
            ) {

                console.log(
                    "⏳ Customer is processing payment."
                );

            }


            /* ------------------------------------------
               PENDING
            ------------------------------------------ */

            else if (
                state === "PENDING"
            ) {

                console.log(
                    "⏳ Payment is pending."
                );

            }


            /* ------------------------------------------
               FAILED
            ------------------------------------------ */

            else if (
                state === "FAILED"
            ) {

                console.log(
                    "❌ Payment failed."
                );

                console.log(
                    "Reason:",
                    payload.failed_reason
                );

            }


            /*
            Always acknowledge webhook.
            */

            return res.status(200).json({

                success: true

            });


        } catch (error) {

            console.error(
                "❌ WEBHOOK ERROR:",
                error.message
            );


            return res.status(500).json({

                success: false

            });

        }

    }
);


/* ======================================================
   GENERIC API 404
====================================================== */

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


/* ======================================================
   FRONTEND FALLBACK
====================================================== */

app.get(
    "*",
    (req, res) => {

        /*
        Don't intercept API routes.
        */

        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "API endpoint not found."

            });

        }


        res.sendFile(
            path.join(
                publicPath,
                "index.html"
            )
        );

    }
);


/* ======================================================
   ERROR HANDLER
====================================================== */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "🔥 SERVER ERROR:",
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


/* ======================================================
   START SERVER
====================================================== */

app.listen(
    PORT,
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "🚀 SCORPIO HOST SERVER"
        );

        console.log(
            `🌐 ${APP_URL}`
        );

        console.log(
            `📡 Port: ${PORT}`
        );

        console.log(
            `💳 IntaSend: ${
                intasend
                    ? (
                        INTASEND_TEST_MODE
                            ? "SANDBOX"
                            : "LIVE"
                    )
                    : "NOT CONFIGURED"
            }`
        );

        console.log(
            "========================================"
        );

    }
);


/* ======================================================
   PROCESS ERROR HANDLERS
====================================================== */

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "❌ Unhandled rejection:",
            error
        );

    }
);


process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "❌ Uncaught exception:",
            error
        );

    }
);
