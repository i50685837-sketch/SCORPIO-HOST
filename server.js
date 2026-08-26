require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

/*
=========================================================
                    SCORPIO HOST
              MAIN EXPRESS SERVER
=========================================================
*/

const app = express();

/*
=========================================================
                    CONFIGURATION
=========================================================
*/

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

const PUBLIC_DIR =
    path.join(__dirname, "public");

/*
=========================================================
                 STARTUP INFORMATION
=========================================================
*/

console.log("");
console.log("==============================================");
console.log("🦂 SCORPIO HOST");
console.log("==============================================");
console.log(`🚀 Environment: ${NODE_ENV}`);
console.log(`🌐 Port: ${PORT}`);
console.log(`📁 Public: ${PUBLIC_DIR}`);
console.log("==============================================");

/*
=========================================================
              REQUIRED ENVIRONMENT VARIABLES
=========================================================
*/

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

/*
=========================================================
                    INTASEND SERVICE
=========================================================
*/

let intasendService;

try {

    intasendService =
        require("./services/intasendService");

    console.log(
        `✅ IntaSend service loaded`
    );

    if (
        typeof intasendService.TEST_MODE !==
        "undefined"
    ) {

        console.log(
            `💳 IntaSend mode: ${
                intasendService.TEST_MODE
                    ? "SANDBOX"
                    : "LIVE"
            }`
        );

    }

} catch (error) {

    console.error(
        "❌ Unable to load IntaSend service"
    );

    console.error(error);

    process.exit(1);
}

/*
=========================================================
                    SECURITY
=========================================================
*/

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

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

/*
=========================================================
                    BODY PARSER
=========================================================
*/

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

/*
=========================================================
                    RATE LIMIT
=========================================================
*/

const apiLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,

        max: 300,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many API requests. Please try again later."
        }
    });

app.use(
    "/api",
    apiLimiter
);

const authLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,

        max: 50,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many authentication attempts."
        }
    });

app.use(
    "/api/auth",
    authLimiter
);

/*
=========================================================
                    REQUEST LOGGER
=========================================================
*/

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
                    `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
                );

            }
        );

        next();
    }
);

/*
=========================================================
                    DATABASE
=========================================================
*/

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

/*
=========================================================
                STATIC FRONTEND
=========================================================

IMPORTANT:

Your files are directly inside:

public/

NOT:

public/pages/
*/

app.use(
    express.static(
        PUBLIC_DIR,
        {
            extensions: ["html"]
        }
    )
);

/*
=========================================================
                    ROUTE LOADER
=========================================================
*/

function loadRoute(
    file,
    endpoint
) {

    try {

        const router =
            require(
                `./routes/${file}`
            );

        if (
            typeof router !==
            "function"
        ) {

            throw new Error(
                `./routes/${file}.js does not export an Express router`
            );
        }

        app.use(
            endpoint,
            router
        );

        console.log(
            `✅ ${endpoint}`
        );

        return true;

    } catch (error) {

        console.error(
            `❌ Failed: ${endpoint}`
        );

        console.error(
            error.message
        );

        return false;
    }
}

/*
=========================================================
                    API ROUTES
=========================================================
*/

/*
AUTH
*/

loadRoute(
    "auth",
    "/api/auth"
);

/*
USERS
*/

loadRoute(
    "users",
    "/api/users"
);

/*
WALLET
*/

loadRoute(
    "wallet",
    "/api/wallet"
);

/*
TRANSACTIONS
*/

loadRoute(
    "transactions",
    "/api/transactions"
);

/*
BOTS
*/

loadRoute(
    "bots",
    "/api/bots"
);

/*
DEPLOYMENTS
*/

loadRoute(
    "deployments",
    "/api/deployments"
);

/*
PROJECTS
*/

loadRoute(
    "projects",
    "/api/projects"
);

/*
DOMAINS
*/

loadRoute(
    "domains",
    "/api/domains"
);

/*
API KEYS
*/

loadRoute(
    "apiKeys",
    "/api/api-keys"
);

/*
MONITORING
*/

loadRoute(
    "monitorings",
    "/api/monitoring"
);

/*
=========================================================
             WALLET / INTASEND CONTROLLER
=========================================================
*/

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
        "❌ Wallet controller failed"
    );

    console.error(
        error.message
    );
}

/*
=========================================================
                 INTASEND STK ENDPOINT
=========================================================

Primary frontend endpoint:

POST /api/wallet/deposit

Compatibility endpoint:

POST /api/payment/stk
*/

if (
    walletController &&
    typeof walletController.deposit ===
        "function"
) {

    /*
       Compatibility endpoint.

       Existing frontend code using
       /api/payment/stk will still work.
    */

    app.post(
        "/api/payment/stk",
        walletController.deposit
    );

    console.log(
        "✅ POST /api/payment/stk"
    );
}

/*
=========================================================
                 INTASEND WEBHOOK
=========================================================

IntaSend calls this endpoint after
payment status changes.

NO JWT AUTH HERE.
=========================================================
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
        "✅ POST /api/payment/intasend/webhook"
    );
}

/*
=========================================================
                 PAYMENT STATUS
=========================================================
*/

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
        "✅ GET /api/payment/status/:reference"
    );
}

/*
=========================================================
                    HEALTH CHECK
=========================================================
*/

app.get(
    "/api/health",
    (req, res) => {

        const dbState =
            mongoose
                .connection
                .readyState;

        res.json({

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
                    ? "connected"
                    : "unavailable",

            intasendMode:
                intasendService &&
                typeof intasendService.TEST_MODE !==
                    "undefined"

                    ? (
                        intasendService.TEST_MODE
                            ? "sandbox"
                            : "live"
                    )

                    : "unknown",

            uptime:
                process.uptime(),

            timestamp:
                new Date().toISOString()
        });
    }
);

/*
=========================================================
                    API INFORMATION
=========================================================
*/

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

                health:
                    "GET /api/health",

                register:
                    "POST /api/auth/register",

                login:
                    "POST /api/auth/login",

                wallet:
                    "GET /api/wallet",

                deposit:
                    "POST /api/wallet/deposit",

                walletTransactions:
                    "GET /api/wallet/transactions",

                paymentStatus:
                    "GET /api/payment/status/:reference",

                stk:
                    "POST /api/payment/stk",

                webhook:
                    "POST /api/payment/intasend/webhook",

                bots:
                    "/api/bots",

                deployments:
                    "/api/deployments",

                projects:
                    "/api/projects",

                domains:
                    "/api/domains",

                apiKeys:
                    "/api/api-keys",

                monitoring:
                    "/api/monitoring"
            }

        });
    }
);

/*
=========================================================
                 FRONTEND ROOT
=========================================================
*/

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                PUBLIC_DIR,
                "index.html"
            )
        );
    }
);

/*
=========================================================
            FRONTEND PAGE FALLBACK
=========================================================

Because all HTML files are directly inside
public/, these work:

/login
/login.html

/register
/register.html

/dashboard
/dashboard.html

/wallet
/wallet.html

etc.
=========================================================
*/

const frontendPages = [

    "login",
    "register",
    "forgot-password",

    "dashboard",

    "my-bots",
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
            `/${page}`,
            (req, res) => {

                const file =
                    path.join(
                        PUBLIC_DIR,
                        `${page}.html`
                    );

                res.sendFile(
                    file,
                    (error) => {

                        if (error) {

                            res.status(
                                404
                            ).send(
                                "Page not found"
                            );
                        }
                    }
                );
            }
        );
    }
);

/*
=========================================================
                    API 404
=========================================================
*/

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API endpoint not found",

            method:
                req.method,

            endpoint:
                req.originalUrl
        });
    }
);

/*
=========================================================
                  FRONTEND 404
=========================================================
*/

app.use(
    (req, res) => {

        res.status(404).send(`
<!DOCTYPE html>

<html>

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
            rgba(120,0,255,.25),
            transparent 40%
        ),
        linear-gradient(
            135deg,
            #050008,
            #12001d,
            #07000c
        );

    color:white;

    font-family:Arial,Helvetica,sans-serif;
}

.card{

    width:90%;

    max-width:430px;

    padding:35px;

    text-align:center;

    border-radius:22px;

    background:
        rgba(20,5,30,.75);

    border:
        1px solid
        rgba(190,90,255,.25);

    backdrop-filter:blur(20px);

    box-shadow:
        0 20px 60px
        rgba(0,0,0,.5);
}

.icon{

    font-size:55px;

    color:#d38aff;

    text-shadow:
        0 0 20px #8c00ff;
}

h1{

    margin:12px 0;

}

p{

    color:#9d8da5;

    font-size:13px;
}

a{

    display:block;

    margin-top:20px;

    padding:13px;

    border-radius:11px;

    color:white;

    text-decoration:none;

    font-weight:bold;

    font-size:13px;

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

<div class="card">

<div class="icon">♏</div>

<h1>404</h1>

<p>
Scorpio Host could not find this page.
</p>

<a href="/">
Return Home
</a>

</div>

</body>

</html>
        `);
    }
);

/*
=========================================================
                GLOBAL ERROR HANDLER
=========================================================
*/

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

        res.status(
            error.status || 500
        ).json({

            success: false,

            message:
                NODE_ENV === "production"
                    ? "Internal server error"
                    : error.message
        });
    }
);

/*
=========================================================
              UNHANDLED REJECTION
=========================================================
*/

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

/*
=========================================================
              UNCAUGHT EXCEPTION
=========================================================
*/

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

/*
=========================================================
                    START SERVER
=========================================================
*/

const server =
    app.listen(
        PORT,
        () => {

            console.log("");

            console.log(
                "=============================================="
            );

            console.log(
                "🦂 SCORPIO HOST IS RUNNING"
            );

            console.log(
                "=============================================="
            );

            console.log(
                `🚀 Port: ${PORT}`
            );

            console.log(
                `🌐 URL: ${APP_URL}`
            );

            console.log(
                `📁 Frontend: ${PUBLIC_DIR}`
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
                "=============================================="
            );

            console.log(
                "API:"
            );

            console.log(
                "GET  /api/health"
            );

            console.log(
                "GET  /api"
            );

            console.log(
                "POST /api/auth/register"
            );

            console.log(
                "POST /api/auth/login"
            );

            console.log(
                "GET  /api/wallet"
            );

            console.log(
                "POST /api/wallet/deposit"
            );

            console.log(
                "POST /api/payment/stk"
            );

            console.log(
                "POST /api/payment/intasend/webhook"
            );

            console.log(
                "=============================================="
            );
        }
    );

/*
=========================================================
                    GRACEFUL SHUTDOWN
=========================================================
*/

async function shutdown(
    signal
) {

    console.log(
        `\n⚠️ ${signal} received`
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

                process.exit(0);

            } catch (error) {

                console.error(
                    "❌ Shutdown error:",
                    error
                );

                process.exit(1);
            }
        }
    );
}

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

module.exports = app;
