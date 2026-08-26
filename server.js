require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

/* =====================================================
   CONFIGURATION
===================================================== */

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!MONGO_URI) {
    console.error("❌ MONGO_URI is missing");
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET is missing");
    process.exit(1);
}

if (!process.env.INTASEND_PUBLISHABLE_KEY) {
    console.error(
        "❌ INTASEND_PUBLISHABLE_KEY is missing"
    );
    process.exit(1);
}

if (!process.env.INTASEND_SECRET_KEY) {
    console.error(
        "❌ INTASEND_SECRET_KEY is missing"
    );
    process.exit(1);
}

/* =====================================================
   INTASEND INITIALIZATION CHECK
===================================================== */

let intasendService;

try {
    intasendService = require(
        "./services/intasendService"
    );

    console.log(
        `✅ IntaSend loaded - ${
            intasendService.TEST_MODE
                ? "SANDBOX"
                : "LIVE"
        }`
    );
} catch (error) {
    console.error(
        "❌ Failed to load IntaSend service"
    );
    console.error(error.message);
    process.exit(1);
}

/* =====================================================
   SECURITY
===================================================== */

app.disable("x-powered-by");

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
   BODY PARSING
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
   RATE LIMITING
===================================================== */

const apiLimiter = rateLimit({
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

app.use("/api", apiLimiter);

/* =====================================================
   REQUEST LOGGER
===================================================== */

app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
        const duration =
            Date.now() - start;

        console.log(
            `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
        );
    });

    next();
});

/* =====================================================
   STATIC FRONTEND
===================================================== */

const publicPath = path.join(
    __dirname,
    "public"
);

app.use(
    express.static(publicPath)
);

/* =====================================================
   DATABASE
===================================================== */

mongoose.set(
    "strictQuery",
    true
);

mongoose
    .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10000
    })
    .then(() => {
        console.log(
            "✅ MongoDB connected"
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
    });

/* =====================================================
   ROUTES
===================================================== */

function loadRoute(
    filename,
    routePath
) {
    try {
        const router = require(
            `./routes/${filename}`
        );

        app.use(
            routePath,
            router
        );

        console.log(
            `✅ ${routePath} loaded`
        );
    } catch (error) {
        console.error(
            `❌ ${routePath} failed to load`
        );

        console.error(
            error.message
        );

        /*
          Do not crash the entire application
          because an optional route is missing.
        */
    }
}

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

/* =====================================================
   INTASEND WEBHOOK
===================================================== */

/*
   IntaSend sends payment events here.

   IMPORTANT:
   This endpoint must NOT require JWT authentication.
*/

try {
    const walletController =
        require(
            "./controllers/walletController"
        );

    app.post(
        "/api/payment/intasend/webhook",
        walletController.intasendWebhook
    );

    console.log(
        "✅ IntaSend webhook loaded"
    );
} catch (error) {
    console.error(
        "❌ IntaSend webhook failed to load"
    );

    console.error(
        error.message
    );
}

/* =====================================================
   INTASEND DIRECT STK ENDPOINT
===================================================== */

/*
   Kept as a backend endpoint for compatibility.

   Normal dashboard deposits should use:

   POST /api/wallet/deposit

   which associates the transaction with
   the authenticated Scorpio user.
*/

try {
    const walletController =
        require(
            "./controllers/walletController"
        );

    app.post(
        "/api/payment/stk",
        walletController.deposit
    );

    console.log(
        "✅ IntaSend STK endpoint loaded"
    );
} catch (error) {
    console.error(
        "❌ IntaSend STK endpoint failed"
    );
}

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
    "/api/health",
    (req, res) => {
        res.status(200).json({
            success: true,

            service:
                "Scorpio Host",

            status:
                "online",

            environment:
                NODE_ENV,

            database:
                mongoose.connection
                    .readyState === 1
                    ? "connected"
                    : "disconnected",

            intasend:
                intasendService
                    ? "initialized"
                    : "unavailable",

            intasendMode:
                intasendService
                    ? intasendService.TEST_MODE
                        ? "sandbox"
                        : "live"
                    : null,

            uptime:
                process.uptime(),

            timestamp:
                new Date().toISOString()
        });
    }
);

/* =====================================================
   API 404
===================================================== */

app.use(
    "/api",
    (req, res) => {
        res.status(404).json({
            success: false,
            message:
                "API endpoint not found",
            path:
                req.originalUrl
        });
    }
);

/* =====================================================
   FRONTEND FALLBACK
===================================================== */

app.get(
    "*",
    (req, res, next) => {
        /*
          Don't send index.html for API requests.
        */

        if (
            req.path.startsWith(
                "/api"
            )
        ) {
            return next();
        }

        const indexPath =
            path.join(
                publicPath,
                "index.html"
            );

        res.sendFile(
            indexPath,
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
            "❌ Unhandled server error:"
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
            error.status ||
                500
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

/* =====================================================
   PROCESS ERROR HANDLERS
===================================================== */

process.on(
    "unhandledRejection",
    (reason) => {
        console.error(
            "❌ Unhandled Promise Rejection:"
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
            "❌ Uncaught Exception:"
        );

        console.error(
            error
        );

        process.exit(1);
    }
);

/* =====================================================
   START SERVER
===================================================== */

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
                `💳 IntaSend: ${
                    intasendService.TEST_MODE
                        ? "SANDBOX"
                        : "LIVE"
                }`
            );
            console.log(
                `🌍 APP_URL: ${
                    process.env.APP_URL ||
                    `http://localhost:${PORT}`
                }`
            );
            console.log(
                "=========================================="
            );
            console.log("");
        }
    );

/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */

async function shutdown(
    signal
) {
    console.log(
        `\n⚠️ ${signal} received. Shutting down...`
    );

    server.close(
        async () => {
            try {
                await mongoose.connection.close();

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
