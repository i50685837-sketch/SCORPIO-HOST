require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");


/* =====================================================
   APP
===================================================== */

const app = express();


/* =====================================================
   CONFIG
===================================================== */

const PORT =
    process.env.PORT || 5000;

const MONGO_URI =
    process.env.MONGO_URI;

const JWT_SECRET =
    process.env.JWT_SECRET;


/* =====================================================
   BASIC VALIDATION
===================================================== */

if (!MONGO_URI) {

    console.error(
        "❌ MONGO_URI is missing"
    );

    process.exit(1);
}


if (!JWT_SECRET) {

    console.error(
        "❌ JWT_SECRET is missing"
    );

    process.exit(1);
}


/* =====================================================
   SECURITY
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


/* =====================================================
   BODY PARSERS
===================================================== */

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
   REQUEST LOGGING
===================================================== */

app.use(
    (req, res, next) => {

        console.log(
            `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
        );

        next();

    }
);


/* =====================================================
   DATABASE
===================================================== */

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

        process.exit(1);

    });


/* =====================================================
   STATIC FRONTEND
===================================================== */

const publicPath =
    path.join(
        __dirname,
        "public"
    );


app.use(
    express.static(
        publicPath
    )
);


/* =====================================================
   MODELS
===================================================== */

const User =
    require("./models/User");

const Wallet =
    require("./models/Wallet");

const Transaction =
    require("./models/Transaction");


/* =====================================================
   ROUTES
===================================================== */

let authRoutes;
let walletRoutes;
let intasendRoutes;


/* -----------------------------------------------------
   AUTH
----------------------------------------------------- */

try {

    authRoutes =
        require("./routes/auth");

    app.use(
        "/api/auth",
        authRoutes
    );

    console.log(
        "✅ Auth routes loaded"
    );

} catch (error) {

    console.error(
        "❌ Auth routes failed:"
    );

    console.error(
        error.message
    );

}


/* -----------------------------------------------------
   WALLET
----------------------------------------------------- */

try {

    walletRoutes =
        require("./routes/wallet");

    app.use(
        "/api/wallet",
        walletRoutes
    );

    console.log(
        "✅ Wallet routes loaded"
    );

} catch (error) {

    console.error(
        "❌ Wallet routes failed:"
    );

    console.error(
        error.message
    );

}


/* -----------------------------------------------------
   INTASEND
----------------------------------------------------- */

try {

    intasendRoutes =
        require("./intasend/routes");

    app.use(
        "/api/intasend",
        intasendRoutes
    );

    console.log(
        "✅ IntaSend routes loaded"
    );

} catch (error) {

    console.error(
        "❌ IntaSend routes failed:"
    );

    console.error(
        error.message
    );

}


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
    "/api/health",
    async (req, res) => {

        const mongoState =
            mongoose.connection.readyState;

        res.status(200).json({

            success: true,

            service:
                "Scorpio Host",

            status:
                "online",

            database:
                mongoState === 1
                    ? "connected"
                    : "disconnected",

            intasend:
                process.env.INTASEND_PUBLISHABLE_KEY
                    ? "configured"
                    : "not configured",

            environment:
                process.env.NODE_ENV ||
                "production",

            timestamp:
                new Date().toISOString()

        });

    }
);


/* =====================================================
   API INFORMATION
===================================================== */

app.get(
    "/api",
    (req, res) => {

        res.json({

            success: true,

            name:
                "Scorpio Host API",

            version:
                "1.0.0",

            endpoints: {

                auth: [
                    "POST /api/auth/register",
                    "POST /api/auth/login"
                ],

                wallet: [
                    "GET /api/wallet",
                    "GET /api/wallet/transactions",
                    "GET /api/wallet/transactions/:id"
                ],

                intasend: [
                    "POST /api/intasend/stk",
                    "POST /api/intasend/webhook"
                ]

            }

        });

    }
);


/* =====================================================
   ROOT
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
   EXPLICIT FRONTEND PAGES
===================================================== */

/*
 * These routes make the important pages work even when
 * someone enters the URL directly.
 *
 * The actual HTML files live inside /public.
 */

const frontendPages = [

    "index",
    "login",
    "register",
    "dashboard",
    "wallet",

    "projects",
    "bots",
    "deployments",
    "domains",

    "profile",
    "settings",

    "transactions",
    "notifications",

    "about",
    "contact"

];


frontendPages.forEach(
    (page) => {

        app.get(
            `/${page}.html`,
            (req, res) => {

                res.sendFile(
                    path.join(
                        publicPath,
                        `${page}.html`
                    )
                );

            }
        );

    }
);


/* =====================================================
   404 HANDLER
===================================================== */

/*
 * IMPORTANT:
 *
 * DO NOT use:
 *
 * app.get("*", ...)
 *
 * because Express/path-to-regexp in the current
 * environment throws:
 *
 * PathError: Missing parameter name at index 1: *
 *
 * This middleware has no wildcard route.
 */

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


        /*
         * If a requested frontend file doesn't exist,
         * return a simple 404 instead of crashing.
         */

        res.status(404).send(`

            <!DOCTYPE html>

            <html>

            <head>

                <meta charset="UTF-8">

                <meta
                    name="viewport"
                    content="width=device-width,initial-scale=1"
                >

                <title>404 — Scorpio Host</title>

                <style>

                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #08000f;
                        color: white;
                        font-family: Arial;
                        text-align: center;
                    }

                    h1 {
                        font-size: 70px;
                        margin: 0;
                    }

                    p {
                        color: #aaa;
                    }

                    a {
                        color: #a855f7;
                        text-decoration: none;
                    }

                </style>

            </head>

            <body>

                <div>

                    <h1>404</h1>

                    <p>
                        Page not found.
                    </p>

                    <a href="/">
                        Back to Scorpio Host
                    </a>

                </div>

            </body>

            </html>

        `);

    }
);


/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(
    (error, req, res, next) => {

        console.error(
            "❌ Server error:"
        );

        console.error(
            error
        );


        if (
            res.headersSent
        ) {

            return next(error);

        }


        res.status(
            error.status || 500
        ).json({

            success: false,

            message:
                process.env.NODE_ENV === "production"
                    ? "Internal server error."
                    : error.message

        });

    }
);


/* =====================================================
   START SERVER
===================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "       SCORPIO HOST SERVER"
        );
        console.log(
            "========================================"
        );

        console.log(
            `🚀 Server running on port ${PORT}`
        );

        console.log(
            `🌐 Environment: ${
                process.env.NODE_ENV || "production"
            }`
        );

        console.log(
            "🔐 Authentication: enabled"
        );

        console.log(
            "💳 Wallet: enabled"
        );

        console.log(
            "📱 IntaSend: enabled"
        );

        console.log(
            "💰 M-Pesa STK: enabled"
        );

        console.log(
            "========================================"
        );
        console.log("");

    }
);
