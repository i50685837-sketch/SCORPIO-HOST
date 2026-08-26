require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

/* =========================================================
   SCORPIO HOST
   Main Express Server
   ========================================================= */

const app = express();

/* =========================================================
   CONFIGURATION
   ========================================================= */

const PORT = process.env.PORT || 5000;

const NODE_ENV =
    process.env.NODE_ENV || "development";

const MONGO_URI =
    process.env.MONGO_URI;

const JWT_SECRET =
    process.env.JWT_SECRET;

const INTASEND_PUBLISHABLE_KEY =
    process.env.INTASEND_PUBLISHABLE_KEY;

const INTASEND_SECRET_KEY =
    process.env.INTASEND_SECRET_KEY;

const APP_URL =
    process.env.APP_URL ||
    `http://localhost:${PORT}`;

const publicPath =
    path.join(__dirname, "public");

const pagesPath =
    path.join(publicPath, "pages");

/* =========================================================
   STARTUP VALIDATION
   ========================================================= */

console.log("");
console.log("==========================================");
console.log("🦂 SCORPIO HOST");
console.log("==========================================");

if (!MONGO_URI) {
    console.error("❌ MONGO_URI is missing");
    process.exit(1);
}

if (!JWT_SECRET) {
    console.error("❌ JWT_SECRET is missing");
    process.exit(1);
}

if (!INTASEND_PUBLISHABLE_KEY) {
    console.error(
        "❌ INTASEND_PUBLISHABLE_KEY is missing"
    );
    process.exit(1);
}

if (!INTASEND_SECRET_KEY) {
    console.error(
        "❌ INTASEND_SECRET_KEY is missing"
    );
    process.exit(1);
}

console.log("✅ Environment variables loaded");

/* =========================================================
   INTASEND
   ========================================================= */

let intasendService = null;

try {

    intasendService =
        require("./services/intasendService");

    console.log(
        `✅ IntaSend service loaded - ${
            intasendService.TEST_MODE
                ? "SANDBOX"
                : "LIVE"
        }`
    );

} catch (error) {

    console.error(
        "❌ Failed to load IntaSend service"
    );

    console.error(error);

    process.exit(1);
}

/* =========================================================
   EXPRESS SECURITY
   ========================================================= */

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

/*
   CORS

   For production you can replace origin:true
   with your actual frontend domain.
*/

app.use(
    cors({
        origin: true,
        credentials: true,
        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

/* =========================================================
   BODY PARSING
   ========================================================= */

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

/* =========================================================
   RATE LIMITING
   ========================================================= */

const apiLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        max: 300,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many requests. Please try again later."
        }
    });

app.use(
    "/api",
    apiLimiter
);

/*
   Extra protection for authentication endpoints.
*/

const authLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        max: 50,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many authentication attempts. Please try again later."
        }
    });

app.use(
    "/api/auth",
    authLimiter
);

/* =========================================================
   REQUEST LOGGER
   ========================================================= */

app.use(
    (req, res, next) => {

        const started =
            Date.now();

        res.on(
            "finish",
            () => {

                const duration =
                    Date.now() -
                    started;

                console.log(
                    `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
                );

            }
        );

        next();
    }
);

/* =========================================================
   STATIC FRONTEND
   ========================================================= */

/*
   This serves:

   /index.html
   /css/...
   /js/...
   /assets/...

   It also allows direct access to:

   /pages/login.html
   /pages/register.html
   /pages/dashboard.html
   /pages/wallet.html
   etc.
*/

app.use(
    express.static(
        publicPath,
        {
            extensions: ["html"]
        }
    )
);

/* =========================================================
   DATABASE
   ========================================================= */

mongoose.set(
    "strictQuery",
    true
);

mongoose
    .connect(
        MONGO_URI,
        {
            serverSelectionTimeoutMS: 10000
        }
    )
    .then(() => {

        console.log(
            "✅ MongoDB connected"
        );

    })
    .catch((error) => {

        console.error(
            "❌ MongoDB connection failed"
        );

        console.error(
            error.message
        );

        process.exit(1);

    });

mongoose.connection.on(
    "disconnected",
    () => {

        console.warn(
            "⚠️ MongoDB disconnected"
        );

    }
);

mongoose.connection.on(
    "reconnected",
    () => {

        console.log(
            "✅ MongoDB reconnected"
        );

    }
);

/* =========================================================
   ROUTE LOADER
   ========================================================= */

function loadRoute(
    filename,
    routePath
) {

    try {

        const router =
            require(
                `./routes/${filename}`
            );

        if (
            typeof router !==
            "function"
        ) {

            throw new Error(
                `./routes/${filename}.js does not export an Express router`
            );

        }

        app.use(
            routePath,
            router
        );

        console.log(
            `✅ ${routePath} loaded`
        );

        return true;

    } catch (error) {

        console.error(
            `❌ ${routePath} failed to load`
        );

        console.error(
            error.message
        );

        return false;
    }
}

/* =========================================================
   API ROUTES
   ========================================================= */

loadRoute(
    "auth",
    "/api/auth"
);

loadRoute(
    "users",
    "/api/users"
);

loadRoute(
    "wallet",
    "/api/wallet"
);

loadRoute(
    "transactions",
    "/api/transactions"
);

loadRoute(
    "projects",
    "/api/projects"
);

loadRoute(
    "bots",
    "/api/bots"
);

loadRoute(
    "deployments",
    "/api/deployments"
);

loadRoute(
    "domains",
    "/api/domains"
);

/*
   Optional routes.

   If you create these files later,
   simply uncomment them.
*/

// loadRoute("monitorings", "/api/monitorings");
// loadRoute("notifications", "/api/notifications");
// loadRoute("billing", "/api/billing");
// loadRoute("apiKeys", "/api/api-keys");

/* =========================================================
   INTASEND PAYMENT CONTROLLER
   ========================================================= */

let walletController = null;

try {

    walletController =
        require(
            "./controllers/walletController"
        );

    console.log(
        "✅ Wallet controller loaded"
    );

} catch (error) {

    console.error(
        "❌ Wallet controller failed to load"
    );

    console.error(
        error.message
    );
}

/* =========================================================
   INTASEND STK PUSH
   ========================================================= */

/*
   Primary endpoint:

   POST /api/wallet/deposit

   Expected body:

   {
       "amount": 100,
       "phone": "2547XXXXXXXX",
       "email": "user@example.com"
   }

   The wallet route should handle this endpoint.

   We also expose the compatibility endpoint below.
*/

if (
    walletController &&
    typeof walletController.deposit ===
        "function"
) {

    app.post(
        "/api/payment/stk",
        walletController.deposit
    );

    console.log(
        "✅ /api/payment/stk loaded"
    );

} else {

    console.warn(
        "⚠️ STK controller unavailable"
    );
}

/* =========================================================
   INTASEND WEBHOOK
   ========================================================= */

/*
   IntaSend sends payment status updates
   to this endpoint.

   IMPORTANT:

   Do not put JWT authentication
   on the webhook.
*/

if (
    walletController &&
    typeof walletController.intasendWebhook ===
        "function"
) {

    app.post(
        "/api/payment/intasend/webhook",
        walletController.intasendWebhook
    );

    console.log(
        "✅ IntaSend webhook loaded"
    );

} else {

    console.warn(
        "⚠️ IntaSend webhook unavailable"
    );
}

/* =========================================================
   OPTIONAL DIRECT PAYMENT STATUS ENDPOINT
   ========================================================= */

if (
    walletController &&
    typeof walletController.paymentStatus ===
        "function"
) {

    app.get(
        "/api/payment/status/:reference",
        walletController.paymentStatus
    );

    console.log(
        "✅ Payment status endpoint loaded"
    );
}

/* =========================================================
   FRONTEND ENTRY PAGE
   ========================================================= */

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

/* =========================================================
   EXPLICIT FRONTEND PAGE ROUTES
   ========================================================= */

/*
   These routes make the page structure explicit.

   Example:

   /pages/login
   /pages/login.html

   Both can work.

   Same for dashboard, register, wallet etc.
*/

/*
   Allowed frontend pages.

   Add new page names here when you create
   additional frontend files.
*/

const frontendPages = [

    "login",
    "register",
    "forgot-password",

    "dashboard",

    "bots",
    "deploy",
    "console",
    "monitoring",

    "wallet",
    "billing",
    "api-keys",
    "settings",

    "transactions",
    "profile",

    "notifications",
    "help"

];

frontendPages.forEach(
    (page) => {

        app.get(
            `/pages/${page}`,
            (req, res) => {

                const file =
                    path.join(
                        pagesPath,
                        `${page}.html`
                    );

                res.sendFile(
                    file,
                    (error) => {

                        if (error) {

                            console.error(
                                `❌ Page not found: ${file}`
                            );

                            if (
                                !res.headersSent
                            ) {

                                res.status(
                                    404
                                ).send(
                                    "Page not found"
                                );

                            }

                        }

                    }
                );

            }
        );

    }
);

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        const dbState =
            mongoose
                .connection
                .readyState;

        res.status(200).json({

            success: true,

            service:
                "Scorpio Host",

            status:
                "online",

            environment:
                NODE_ENV,

            database:
                dbState === 1
                    ? "connected"
                    : "disconnected",

            intasend:
                intasendService
                    ? "initialized"
                    : "unavailable",

            intasendMode:
                intasendService
                    ? (
                        intasendService.TEST_MODE
                            ? "sandbox"
                            : "live"
                    )
                    : null,

            uptime:
                process.uptime(),

            timestamp:
                new Date()
                    .toISOString()

        });

    }
);

/* =========================================================
   API INFORMATION
   ========================================================= */

app.get(
    "/api",
    (req, res) => {

        res.json({

            success: true,

            service:
                "Scorpio Host API",

            version:
                "1.0.0",

            status:
                "online",

            endpoints: {

                auth:
                    "/api/auth",

                users:
                    "/api/users",

                wallet:
                    "/api/wallet",

                transactions:
                    "/api/transactions",

                projects:
                    "/api/projects",

                bots:
                    "/api/bots",

                deployments:
                    "/api/deployments",

                domains:
                    "/api/domains",

                payment:
                    "/api/payment/stk",

                webhook:
                    "/api/payment/intasend/webhook",

                health:
                    "/api/health"

            }

        });

    }
);

/* =========================================================
   API 404
   ========================================================= */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API endpoint not found",

            method:
                req.method,

            path:
                req.originalUrl

        });

    }
);

/* =========================================================
   FRONTEND 404
   ========================================================= */

/*
   IMPORTANT:

   We intentionally DO NOT redirect
   unknown frontend pages to index.html.

   This fixes the problem where clicking:

   wallet.html
   bots.html
   deploy.html

   unexpectedly returned index.html.
*/

app.use(
    (req, res, next) => {

        if (
            req.method === "GET" &&
            !req.path.startsWith("/api")
        ) {

            return res
                .status(404)
                .send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1.0">

<title>404 — Scorpio Host</title>

<style>

*{
    box-sizing:border-box;
}

body{

    margin:0;

    min-height:100vh;

    display:flex;

    align-items:center;

    justify-content:center;

    background:
        radial-gradient(
            circle at 50% 20%,
            rgba(120,0,255,.22),
            transparent 40%
        ),
        linear-gradient(
            135deg,
            #050008,
            #12001d,
            #07000c
        );

    color:#fff;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

}

.container{

    width:90%;

    max-width:450px;

    padding:35px;

    text-align:center;

    border-radius:22px;

    border:
        1px solid
        rgba(190,90,255,.25);

    background:
        rgba(20,5,30,.75);

    backdrop-filter:
        blur(20px);

    box-shadow:
        0 20px 60px
        rgba(0,0,0,.5);

}

.icon{

    font-size:55px;

    color:#c47aff;

    text-shadow:
        0 0 20px
        #8c00ff;

}

h1{

    margin-top:15px;

    font-size:28px;

}

p{

    color:#9d8ca5;

    font-size:13px;

}

a{

    display:block;

    margin-top:22px;

    padding:13px;

    border-radius:11px;

    color:white;

    text-decoration:none;

    font-size:13px;

    font-weight:bold;

    background:
        linear-gradient(
            135deg,
            #7200ff,
            #b000ff
        );

}

</style>

</head>

<body>

<div class="container">

<div class="icon">♏</div>

<h1>404</h1>

<p>
The Scorpio Host page you're looking for
doesn't exist.
</p>

<a href="/">
Return to Scorpio Host
</a>

</div>

</body>

</html>
                `);

        }

        next();

    }
);

/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "❌ SERVER ERROR"
        );

        console.error(
            error
        );

        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }

        const status =
            error.status ||
            500;

        res.status(
            status
        ).json({

            success: false,

            message:
                NODE_ENV ===
                "production"

                    ? "Internal server error"

                    : error.message

        });

    }
);

/* =========================================================
   UNHANDLED PROMISES
   ========================================================= */

process.on(
    "unhandledRejection",
    (reason) => {

        console.error(
            "❌ UNHANDLED PROMISE REJECTION"
        );

        console.error(
            reason
        );

    }
);

/* =========================================================
   UNCAUGHT EXCEPTIONS
   ========================================================= */

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "❌ UNCAUGHT EXCEPTION"
        );

        console.error(
            error
        );

        process.exit(1);

    }
);

/* =========================================================
   START SERVER
   ========================================================= */

const server =
    app.listen(
        PORT,
        () => {

            console.log("");
            console.log(
                "=========================================="
            );

            console.log(
                "🦂 SCORPIO HOST"
            );

            console.log(
                "=========================================="
            );

            console.log(
                `🚀 Port: ${PORT}`
            );

            console.log(
                `🌐 Environment: ${NODE_ENV}`
            );

            console.log(
                `🌍 App URL: ${APP_URL}`
            );

            console.log(
                `💳 IntaSend: ${
                    intasendService &&
                    intasendService.TEST_MODE
                        ? "SANDBOX"
                        : "LIVE"
                }`
            );

            console.log(
                `📁 Public: ${publicPath}`
            );

            console.log(
                `📄 Pages: ${pagesPath}`
            );

            console.log(
                "=========================================="
            );

            console.log(
                "📌 Frontend:"
            );

            console.log(
                `   ${APP_URL}/`
            );

            console.log(
                `   ${APP_URL}/pages/login.html`
            );

            console.log(
                `   ${APP_URL}/pages/register.html`
            );

            console.log(
                `   ${APP_URL}/pages/dashboard.html`
            );

            console.log(
                "=========================================="
            );

            console.log(
                "🔌 API:"
            );

            console.log(
                `   ${APP_URL}/api`
            );

            console.log(
                `   ${APP_URL}/api/health`
            );

            console.log(
                `   ${APP_URL}/api/auth`
            );

            console.log(
                `   ${APP_URL}/api/wallet`
            );

            console.log(
                `   ${APP_URL}/api/payment/stk`
            );

            console.log(
                `   ${APP_URL}/api/payment/intasend/webhook`
            );

            console.log(
                "=========================================="
            );

            console.log("");

        }
    );

/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

async function shutdown(
    signal
) {

    console.log(
        `⚠️ ${signal} received`
    );

    console.log(
        "🛑 Shutting down Scorpio Host..."
    );

    server.close(
        async () => {

            try {

                await mongoose
                    .connection
                    .close();

                console.log(
                    "✅ MongoDB connection closed"
                );

                console.log(
                    "✅ Server stopped"
                );

                process.exit(0);

            } catch (error) {

                console.error(
                    "❌ Shutdown error"
                );

                console.error(
                    error
                );

                process.exit(1);

            }

        }
    );

}

/* =========================================================
   PROCESS SIGNALS
   ========================================================= */

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

/* =========================================================
   EXPORT APP
   ========================================================= */

module.exports = app;
     
