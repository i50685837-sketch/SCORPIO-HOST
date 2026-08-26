require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

/* =========================================================
   🦂 SCORPIO HOST
   MAIN SERVER
========================================================= */

const app = express();

/* =========================================================
   CONFIG
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

const INTASEND_TEST_MODE =
    String(process.env.INTASEND_TEST_MODE).toLowerCase() === "true";

const APP_URL =
    process.env.APP_URL ||
    `http://localhost:${PORT}`;

const PUBLIC_DIR =
    path.join(__dirname, "public");

const PAGES_DIR =
    path.join(PUBLIC_DIR, "pages");

/* =========================================================
   STARTUP
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
   INTASEND SERVICE
========================================================= */

let intasendService;

try {

    intasendService =
        require("./services/intasendService");

    console.log(
        "✅ IntaSend service loaded"
    );

} catch (error) {

    console.error(
        "❌ Unable to load services/intasendService.js"
    );

    console.error(error);

    process.exit(1);
}

/* =========================================================
   WALLET CONTROLLER
========================================================= */

let walletController;

try {

    walletController =
        require("./controllers/walletController");

    console.log(
        "✅ Wallet controller loaded"
    );

} catch (error) {

    console.error(
        "❌ Unable to load controllers/walletController.js"
    );

    console.error(error);

    process.exit(1);
}

/* =========================================================
   SECURITY
========================================================= */

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

/* =========================================================
   CORS
========================================================= */

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
   BODY PARSER
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
   GLOBAL API RATE LIMIT
========================================================= */

const apiLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,

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

/* =========================================================
   AUTH RATE LIMIT
========================================================= */

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

/* =========================================================
   REQUEST LOGGER
========================================================= */

app.use(
    (req, res, next) => {

        const start =
            Date.now();

        res.on(
            "finish",
            () => {

                const time =
                    Date.now() - start;

                console.log(
                    `${req.method} ${req.originalUrl} ${res.statusCode} ${time}ms`
                );

            }
        );

        next();
    }
);

/* =========================================================
   STATIC FRONTEND
========================================================= */

app.use(
    express.static(
        PUBLIC_DIR,
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
    "error",
    (error) => {

        console.error(
            "❌ MongoDB error:",
            error.message
        );

    }
);

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
    file,
    route
) {

    try {

        const router =
            require(`./routes/${file}`);

        if (
            typeof router !==
            "function"
        ) {

            throw new Error(
                `${file} does not export an Express router`
            );

        }

        app.use(
            route,
            router
        );

        console.log(
            `✅ ${route} loaded`
        );

        return true;

    } catch (error) {

        console.error(
            `⚠️ ${route} failed to load`
        );

        console.error(
            error.message
        );

        return false;
    }
}

/* =========================================================
   AUTH
========================================================= */

loadRoute(
    "auth",
    "/api/auth"
);

/* =========================================================
   USERS
========================================================= */

loadRoute(
    "users",
    "/api/users"
);

/* =========================================================
   WALLET
========================================================= */

loadRoute(
    "wallet",
    "/api/wallet"
);

/* =========================================================
   TRANSACTIONS
========================================================= */

loadRoute(
    "transactions",
    "/api/transactions"
);

/* =========================================================
   PROJECTS
========================================================= */

loadRoute(
    "projects",
    "/api/projects"
);

/* =========================================================
   BOTS
========================================================= */

loadRoute(
    "bots",
    "/api/bots"
);

/* =========================================================
   DEPLOYMENTS
========================================================= */

loadRoute(
    "deployments",
    "/api/deployments"
);

/* =========================================================
   DOMAINS
========================================================= */

loadRoute(
    "domains",
    "/api/domains"
);

/* =========================================================
   INTASEND STK PUSH
========================================================= */

/*
   POST

   /api/payment/stk

   Body:

   {
      "amount": 100,
      "phone_number": "2547XXXXXXXX"
   }

   Authentication:

   Authorization: Bearer JWT_TOKEN

   The wallet controller creates the
   pending transaction before requesting
   IntaSend.

*/

app.post(
    "/api/payment/stk",
    walletController.deposit
);

console.log(
    "✅ POST /api/payment/stk loaded"
);

/* =========================================================
   INTASEND WEBHOOK
========================================================= */

/*
   IntaSend calls this endpoint after
   payment status changes.

   DO NOT add JWT authentication here.

   URL:

   /api/payment/intasend/webhook
*/

app.post(
    "/api/payment/intasend/webhook",
    walletController.intasendWebhook
);

console.log(
    "✅ POST /api/payment/intasend/webhook loaded"
);

/* =========================================================
   PAYMENT STATUS
========================================================= */

/*
   GET

   /api/payment/status/:reference

   Requires JWT.
*/

app.get(
    "/api/payment/status/:reference",
    walletController.paymentStatus
);

console.log(
    "✅ GET /api/payment/status/:reference loaded"
);

/* =========================================================
   PAYMENT STATUS ALIAS
========================================================= */

app.get(
    "/api/wallet/payment/:reference",
    walletController.paymentStatus
);

/* =========================================================
   TRANSACTION HISTORY ALIAS
========================================================= */

app.get(
    "/api/wallet/transactions",
    walletController.transactions
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        const dbConnected =
            mongoose.connection.readyState === 1;

        res.status(200).json({

            success: true,

            service:
                "Scorpio Host",

            status:
                "online",

            environment:
                NODE_ENV,

            database:
                dbConnected
                    ? "connected"
                    : "disconnected",

            intasend:
                "initialized",

            intasendMode:
                INTASEND_TEST_MODE
                    ? "sandbox"
                    : "live",

            uptime:
                Math.floor(
                    process.uptime()
                ),

            timestamp:
                new Date().toISOString()

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

                health:
                    "GET /api/health",

                auth:
                    "/api/auth",

                users:
                    "/api/users",

                wallet:
                    "/api/wallet",

                walletDeposit:
                    "POST /api/wallet/deposit",

                paymentSTK:
                    "POST /api/payment/stk",

                paymentStatus:
                    "GET /api/payment/status/:reference",

                webhook:
                    "POST /api/payment/intasend/webhook",

                transactions:
                    "GET /api/wallet/transactions",

                bots:
                    "/api/bots",

                projects:
                    "/api/projects",

                deployments:
                    "/api/deployments",

                domains:
                    "/api/domains",

                usersAPI:
                    "/api/users"

            }

        });

    }
);

/* =========================================================
   FRONTEND ROOT
========================================================= */

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

/* =========================================================
   FRONTEND PAGES
========================================================= */

const frontendPages = [

    "login",
    "register",
    "forgot-password",

    "dashboard",

    "bots",
    "my-bots",

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
                        PAGES_DIR,
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
   DIRECT HTML PAGE SUPPORT
========================================================= */

/*
   This supports:

   /login.html
   /register.html
   /dashboard.html
   /wallet.html
   /my-bots.html

   when those files are inside:

   public/pages/
*/

frontendPages.forEach(
    (page) => {

        app.get(
            `/${page}.html`,
            (req, res) => {

                res.sendFile(
                    path.join(
                        PAGES_DIR,
                        `${page}.html`
                    ),
                    (error) => {

                        if (
                            error &&
                            !res.headersSent
                        ) {

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

app.use(
    (req, res) => {

        if (
            req.method === "GET"
        ) {

            return res
                .status(404)
                .send(`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

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

font-family:Arial,sans-serif;

color:white;

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

}

.box{

width:90%;

max-width:430px;

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

.logo{

font-size:50px;

color:#c47aff;

text-shadow:
0 0 20px #8c00ff;

}

h1{

font-size:30px;

margin:15px 0 8px;

}

p{

font-size:13px;

color:#9d8ca5;

line-height:1.6;

}

a{

display:block;

margin-top:22px;

padding:13px;

border-radius:11px;

text-decoration:none;

color:white;

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

<div class="box">

<div class="logo">♏</div>

<h1>404</h1>

<p>
The Scorpio Host page could not be found.
</p>

<a href="/">
Return to Scorpio Host
</a>

</div>

</body>

</html>
                `);

        }

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

/* =========================================================
   PROCESS ERROR HANDLERS
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
                "🦂 SCORPIO HOST IS RUNNING"
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

  
