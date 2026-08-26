require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const crypto = require("crypto");

const app = express();

/* =====================================================
   CONFIG
===================================================== */

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const INTASEND_PUBLISHABLE_KEY =
    process.env.INTASEND_PUBLISHABLE_KEY;

const INTASEND_SECRET_KEY =
    process.env.INTASEND_SECRET_KEY;

const INTASEND_TEST =
    String(process.env.INTASEND_TEST || "true").toLowerCase() === "true";

if (!MONGO_URI) {
    console.error("❌ MONGO_URI is missing");
    process.exit(1);
}

if (!INTASEND_PUBLISHABLE_KEY || !INTASEND_SECRET_KEY) {
    console.error("❌ IntaSend credentials are missing");
    console.error(
        "Required: INTASEND_PUBLISHABLE_KEY and INTASEND_SECRET_KEY"
    );
    process.exit(1);
}

/* =====================================================
   INTASEND
===================================================== */

let intasend;

try {
    const IntaSend = require("intasend-node");

    intasend = new IntaSend(
        INTASEND_PUBLISHABLE_KEY,
        INTASEND_SECRET_KEY,
        INTASEND_TEST
    );

    console.log(
        `✅ IntaSend initialized (${INTASEND_TEST ? "SANDBOX" : "LIVE"})`
    );
} catch (error) {
    console.error("❌ Failed to initialize IntaSend");
    console.error(error.message);
    process.exit(1);
}

/* =====================================================
   EXPRESS SECURITY
===================================================== */

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Try again later."
    }
});

app.use("/api", apiLimiter);

/* =====================================================
   STATIC FRONTEND
===================================================== */

app.use(express.static(path.join(__dirname, "public")));

/* =====================================================
   DATABASE
===================================================== */

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB connected");
    })
    .catch((error) => {
        console.error("❌ MongoDB connection failed");
        console.error(error.message);
        process.exit(1);
    });

/* =====================================================
   MODELS
===================================================== */

let Wallet;
let Transaction;

try {
    Wallet = require("./models/Wallet");
    console.log("✅ Wallet model loaded");
} catch (error) {
    console.warn("⚠️ Wallet model not loaded:", error.message);
}

try {
    Transaction = require("./models/Transaction");
    console.log("✅ Transaction model loaded");
} catch (error) {
    console.warn(
        "⚠️ Transaction model not loaded:",
        error.message
    );
}

/* =====================================================
   ROUTES
===================================================== */

function loadRoute(file, route) {
    try {
        app.use(route, require(`./routes/${file}`));
        console.log(`✅ ${route} loaded`);
    } catch (error) {
        console.warn(
            `⚠️ ${route} not loaded: ${error.message}`
        );
    }
}

loadRoute("auth", "/api/auth");
loadRoute("users", "/api/users");
loadRoute("wallet", "/api/wallet");
loadRoute("transactions", "/api/transactions");
loadRoute("projects", "/api/projects");
loadRoute("bots", "/api/bots");
loadRoute("deployments", "/api/deployments");
loadRoute("domains", "/api/domains");

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        service: "Scorpio Host",
        status: "online",
        environment: INTASEND_TEST
            ? "sandbox"
            : "production",
        database:
            mongoose.connection.readyState === 1
                ? "connected"
                : "disconnected",
        intasend: intasend
            ? "initialized"
            : "not initialized",
        timestamp: new Date().toISOString()
    });
});

/* =====================================================
   INTASEND M-PESA STK PUSH
===================================================== */

/*
   POST /api/payment/stk

   Body:

   {
       "first_name": "Morde",
       "last_name": "User",
       "email": "user@example.com",
       "phone_number": "254712345678",
       "amount": 100
   }
*/

app.post("/api/payment/stk", async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            phone_number,
            amount
        } = req.body;

        if (!phone_number) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const numericAmount = Number(amount);

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }

        /*
          Convert common Kenyan formats:

          0712345678
          +254712345678
          254712345678
        */

        let phone = String(phone_number).replace(/\s+/g, "");

        if (phone.startsWith("+254")) {
            phone = phone.substring(1);
        }

        if (phone.startsWith("07")) {
            phone = "254" + phone.substring(1);
        }

        if (!/^2547\d{8}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message:
                    "Use a valid Kenyan phone number, e.g. 254712345678"
            });
        }

        const apiRef =
            "SCORPIO-" +
            Date.now() +
            "-" +
            crypto.randomBytes(4).toString("hex");

        /*
          Save a pending transaction before contacting IntaSend.
        */

        let transaction = null;

        if (Transaction) {
            transaction = await Transaction.create({
                reference: apiRef,
                amount: numericAmount,
                currency: "KES",
                phoneNumber: phone,
                email,
                status: "pending",
                provider: "intasend",
                type: "deposit"
            });
        }

        const collection = intasend.collection();

        const response =
            await collection.mpesaStkPush({
                first_name:
                    first_name || "Scorpio",
                last_name:
                    last_name || "User",
                email,
                host:
                    process.env.APP_URL ||
                    "https://yourdomain.com",
                amount: numericAmount,
                phone_number: phone,
                api_ref: apiRef
            });

        /*
          Store the provider response where possible.
        */

        if (transaction) {
            transaction.providerResponse = response;
            await transaction.save();
        }

        return res.status(200).json({
            success: true,
            message:
                "M-Pesa payment request sent",
            reference: apiRef,
            data: response
        });
    } catch (error) {
        console.error(
            "❌ IntaSend STK error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to initiate payment",
            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });
    }
});

/* =====================================================
   INTASEND WEBHOOK
===================================================== */

/*
   Configure this URL inside the IntaSend dashboard:

   https://YOUR-DOMAIN.com/api/payment/intasend/webhook

   IntaSend sends payment collection events here.
*/

app.post(
    "/api/payment/intasend/webhook",
    async (req, res) => {
        try {
            console.log(
                "📩 IntaSend webhook received"
            );

            const payload = req.body;

            console.log(
                "IntaSend event:",
                JSON.stringify(payload)
            );

            /*
              The exact payload structure can vary by event.
              We therefore extract common fields safely.
            */

            const apiRef =
                payload.api_ref ||
                payload.api_reference ||
                payload.reference ||
                payload.invoice_id ||
                payload.order_reference;

            const status = String(
                payload.status ||
                payload.state ||
                ""
            ).toLowerCase();

            if (Transaction && apiRef) {
                const transaction =
                    await Transaction.findOne({
                        reference: apiRef
                    });

                if (transaction) {
                    transaction.providerResponse =
                        payload;

                    if (
                        [
                            "complete",
                            "completed",
                            "success",
                            "successful",
                            "paid"
                        ].includes(status)
                    ) {
                        transaction.status =
                            "completed";

                        await transaction.save();

                        /*
                          Wallet crediting should happen here,
                          after confirming the payment is genuinely
                          successful.

                          Do NOT simply trust a client-side response.
                        */
                    }

                    if (
                        [
                            "failed",
                            "cancelled",
                            "canceled",
                            "rejected"
                        ].includes(status)
                    ) {
                        transaction.status =
                            "failed";

                        await transaction.save();
                    }
                }
            }

            /*
              Respond quickly so IntaSend knows the webhook
              was received successfully.
            */

            return res.status(200).json({
                success: true,
                received: true
            });
        } catch (error) {
            console.error(
                "❌ IntaSend webhook error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Webhook processing failed"
            });
        }
    }
);

/* =====================================================
   PAYMENT STATUS
===================================================== */

app.get(
    "/api/payment/status/:reference",
    async (req, res) => {
        try {
            if (!Transaction) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Transaction model unavailable"
                });
            }

            const transaction =
                await Transaction.findOne({
                    reference:
                        req.params.reference
                }).select(
                    "-providerResponse"
                );

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Transaction not found"
                });
            }

            return res.json({
                success: true,
                transaction
            });
        } catch (error) {
            console.error(
                "Payment status error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to retrieve payment status"
            });
        }
    }
);

/* =====================================================
   API 404
===================================================== */

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found"
    });
});

/* =====================================================
   FRONTEND
===================================================== */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(
    (err, req, res, next) => {
        console.error(
            "❌ Global error:",
            err
        );

        res.status(
            err.status || 500
        ).json({
            success: false,
            message:
                process.env.NODE_ENV ===
                "production"
                    ? "Internal server error"
                    : err.message
        });
    }
);

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, () => {
    console.log("");
    console.log(
        "======================================"
    );
    console.log(
        "🦂 SCORPIO HOST"
    );
    console.log(
        "======================================"
    );
    console.log(
        `🚀 Server running on port ${PORT}`
    );
    console.log(
        `💳 IntaSend: ${
            INTASEND_TEST
                ? "SANDBOX"
                : "LIVE"
        }`
    );
    console.log(
        `🌐 ${process.env.APP_URL || `http://localhost:${PORT}`}`
    );
    console.log(
        "======================================"
    );
});
