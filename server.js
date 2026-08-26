require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

/* =====================================================
   CONFIG
===================================================== */

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const NODE_ENV = process.env.NODE_ENV || "development";

const publicPath = path.join(__dirname, "public");

/* =====================================================
   REQUIRED ENVIRONMENT VARIABLES
===================================================== */

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
   INTASEND SERVICE
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
        "❌ IntaSend service failed to load"
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
   RATE LIMIT
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
    const started = Date.now();

    res.on("finish", () => {
        const duration =
            Date.now() - started;

        console.log(
            `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
        );
    });

    next();
});

/* =====================================================
   STATIC FILES
===================================================== */

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
    }
);

/* =====================================================
   ROUTE LOADER
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

/* =====================================================
   API ROUTES
===================================================== */

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
   IntaSend calls this endpoint directly.

   DO NOT protect this route with JWT.
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
        "❌ IntaSend webhook failed"
    );

    console.error(
        error.message
    );
}

/* =====================================================
   INTASEND STK ENDPOINT
===================================================== */

try {
    const walletController =
        require(
            "./controllers/walletController"
        );

    /*
       Compatibility endpoint.

       Preferred endpoint:
       POST /api/wallet/deposit
    */

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

    console.error(
        error.message
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
            service: "Scorpio Host",
            status: "online",

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

/*
   IMPORTANT:

   Express 5 does NOT accept:

       app.get("*", ...)

   So we use a normal middleware instead.
*/

app.use(
    (req, res, next) => {
        if (
            req.method !== "GET" ||
            req.path.startsWith("/api")
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
                `🌍 ${
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
        `⚠️ ${signal} received. Shutting down...`
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
