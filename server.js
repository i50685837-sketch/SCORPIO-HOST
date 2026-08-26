/* =========================================================
   🦂 SCORPIO HOST
   MAIN SERVER
   ========================================================= */

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");

const app = express();


/* =========================================================
   CONFIG
========================================================= */

const PORT =
    process.env.PORT || 5000;

const MONGO_URI =
    process.env.MONGO_URI;

const JWT_SECRET =
    process.env.JWT_SECRET;

const NODE_ENV =
    process.env.NODE_ENV || "development";


/* =========================================================
   STARTUP CHECKS
========================================================= */

console.log("");
console.log("==============================================");
console.log("🦂 SCORPIO HOST");
console.log("==============================================");
console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`🚀 Port: ${PORT}`);
console.log("==============================================");


if (!MONGO_URI) {

    console.error(
        "❌ MONGO_URI is missing."
    );

    process.exit(1);
}


if (!JWT_SECRET) {

    console.error(
        "❌ JWT_SECRET is missing."
    );

    process.exit(1);
}


/* =========================================================
   SECURITY
========================================================= */

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    })
);


/* =========================================================
   CORS
========================================================= */

app.use(
    cors({
        origin: true,
        credentials: true
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
   REQUEST LOGGER
========================================================= */

app.use(
    (req, res, next) => {

        const start =
            Date.now();

        res.on(
            "finish",
            () => {

                const duration =
                    Date.now() - start;

                console.log(
                    `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
                );

            }
        );

        next();
    }
);


/* =========================================================
   DATABASE
========================================================= */

mongoose.set(
    "strictQuery",
    true
);

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


/* =========================================================
   FRONTEND DIRECTORIES
========================================================= */

const PUBLIC_DIR =
    path.join(
        __dirname,
        "public"
    );


const PAGES_DIR =
    path.join(
        __dirname,
        "pages"
    );


/* =========================================================
   STATIC FILES
========================================================= */

if (
    fs.existsSync(PUBLIC_DIR)
) {

    app.use(
        express.static(
            PUBLIC_DIR
        )
    );

    console.log(
        "✅ public/ loaded"
    );

}


if (
    fs.existsSync(PAGES_DIR)
) {

    app.use(
        "/pages",
        express.static(
            PAGES_DIR
        )
    );

    console.log(
        "✅ pages/ loaded"
    );

}


/* =========================================================
   AUTH ROUTES
========================================================= */

try {

    const authRoutes =
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
        "❌ Failed to load auth routes:"
    );

    console.error(
        error.message
    );

}


/* =========================================================
   WALLET ROUTES
========================================================= */

try {

    const walletRoutes =
        require("./routes/wallet");

    app.use(
        "/api/wallet",
        walletRoutes
    );

    console.log(
        "✅ Wallet routes loaded"
    );

} catch (error) {

    console.log(
        "ℹ️ Wallet routes not installed yet."
    );

}


/* =========================================================
   INTASEND ROUTES
========================================================= */

try {

    const intasendRoutes =
        require("./intasend/routes");

    app.use(
        "/api/intasend",
        intasendRoutes
    );

    console.log(
        "✅ IntaSend routes loaded"
    );

} catch (error) {

    console.log(
        "ℹ️ IntaSend routes not installed yet."
    );

}


/* =========================================================
   API ROOT
========================================================= */

app.get(
    "/api",
    (req, res) => {

        res.status(200).json({

            success: true,

            name:
                "Scorpio Host API",

            version:
                "1.0.0",

            status:
                "online",

            endpoints: {

                auth:
                    "/api/auth",

                register:
                    "POST /api/auth/register",

                login:
                    "POST /api/auth/login",

                wallet:
                    "/api/wallet",

                intasend:
                    "/api/intasend"

            }

        });

    }
);


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({

            success: true,

            service:
                "Scorpio Host",

            status:
                "healthy",

            database:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",

            uptime:
                process.uptime(),

            timestamp:
                new Date().toISOString()

        });

    }
);


/* =========================================================
   FRONTEND PAGE HELPER
========================================================= */

function sendPage(
    fileName,
    res
) {

    const publicFile =
        path.join(
            PUBLIC_DIR,
            fileName
        );


    const pagesFile =
        path.join(
            PAGES_DIR,
            fileName
        );


    if (
        fs.existsSync(
            publicFile
        )
    ) {

        return res.sendFile(
            publicFile
        );

    }


    if (
        fs.existsSync(
            pagesFile
        )
    ) {

        return res.sendFile(
            pagesFile
        );

    }


    return res.status(404).send(
        `
        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width,initial-scale=1"
            >

            <title>Scorpio Host</title>

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
                }

                .box {
                    text-align: center;
                }

                h1 {
                    color: #a855f7;
                    font-size: 60px;
                }

            </style>

        </head>

        <body>

            <div class="box">

                <h1>404</h1>

                <p>
                    Page not found.
                </p>

            </div>

        </body>

        </html>
        `
    );

}


/* =========================================================
   MAIN PAGES
========================================================= */

app.get(
    "/",
    (req, res) => {

        sendPage(
            "index.html",
            res
        );

    }
);


app.get(
    "/index.html",
    (req, res) => {

        sendPage(
            "index.html",
            res
        );

    }
);


/* =========================================================
   LOGIN
========================================================= */

app.get(
    "/login",
    (req, res) => {

        sendPage(
            "login.html",
            res
        );

    }
);


app.get(
    "/login.html",
    (req, res) => {

        sendPage(
            "login.html",
            res
        );

    }
);


/* =========================================================
   REGISTER
========================================================= */

app.get(
    "/register",
    (req, res) => {

        sendPage(
            "register.html",
            res
        );

    }
);


app.get(
    "/register.html",
    (req, res) => {

        sendPage(
            "register.html",
            res
        );

    }
);


/* =========================================================
   DASHBOARD
========================================================= */

app.get(
    "/dashboard",
    (req, res) => {

        sendPage(
            "dashboard.html",
            res
        );

    }
);


app.get(
    "/dashboard.html",
    (req, res) => {

        sendPage(
            "dashboard.html",
            res
        );

    }
);


/* =========================================================
   WALLET
========================================================= */

app.get(
    "/wallet",
    (req, res) => {

        sendPage(
            "wallet.html",
            res
        );

    }
);


app.get(
    "/wallet.html",
    (req, res) => {

        sendPage(
            "wallet.html",
            res
        );

    }
);


/* =========================================================
   FUTURE SCORPIO HOST PAGES
   We can create these HTML files later.
========================================================= */

const futurePages = [

    "projects",
    "bots",
    "deployments",
    "domains",
    "transactions",
    "monitoring",
    "profile",
    "settings"

];


futurePages.forEach(
    (page) => {

        app.get(
            `/${page}`,
            (req, res) => {

                sendPage(
                    `${page}.html`,
                    res
                );

            }
        );


        app.get(
            `/${page}.html`,
            (req, res) => {

                sendPage(
                    `${page}.html`,
                    res
                );

            }
        );

    }
);


/* =========================================================
   API 404
   Express 5 compatible.
   DO NOT USE "*".
========================================================= */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API endpoint not found.",

            method:
                req.method,

            path:
                req.originalUrl

        });

    }
);


/* =========================================================
   GENERAL 404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).send(
            `
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
                    }

                    .box {
                        text-align: center;
                    }

                    h1 {
                        font-size: 70px;
                        color: #a855f7;
                        margin: 0;
                    }

                    a {
                        display: inline-block;
                        margin-top: 15px;
                        padding: 12px 20px;
                        border-radius: 10px;
                        background: #9333ea;
                        color: white;
                        text-decoration: none;
                    }

                </style>

            </head>

            <body>

                <div class="box">

                    <h1>404</h1>

                    <p>
                        Page not found.
                    </p>

                    <a href="/">
                        Back Home
                    </a>

                </div>

            </body>

            </html>
            `
        );

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
            "❌ Server error:",
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
                    ? "Internal server error."
                    : error.message

        });

    }
);


/* =========================================================
   START SERVER
========================================================= */

const server =
    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            console.log("");
            console.log(
                "=============================================="
            );

            console.log(
                "🦂 SCORPIO HOST SERVER ONLINE"
            );

            console.log(
                "=============================================="
            );

            console.log(
                `🚀 Port: ${PORT}`
            );

            console.log(
                `🌐 Environment: ${NODE_ENV}`
            );

            console.log(
                "🔐 Login: /login.html"
            );

            console.log(
                "📝 Register: /register.html"
            );

            console.log(
                "📊 Dashboard: /dashboard.html"
            );

            console.log(
                "💰 Wallet: /wallet.html"
            );

            console.log(
                "🔌 API: /api"
            );

            console.log(
                "❤️ Health: /health"
            );

            console.log(
                "=============================================="
            );

        }
);


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(
    signal
) {

    console.log(
        `⚠️ ${signal} received.`
    );


    server.close(
        async () => {

            try {

                await mongoose.connection.close();

                console.log(
                    "✅ MongoDB connection closed."
                );

                process.exit(0);

            } catch (error) {

                console.error(
                    "❌ Shutdown error:",
                    error.message
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


/* =========================================================
   UNHANDLED ERRORS
========================================================= */

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
