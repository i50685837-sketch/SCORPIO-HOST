require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

/* =====================================================
   CONFIG
===================================================== */

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;


/* =====================================================
   STARTUP
===================================================== */

console.log("");
console.log("========================================");
console.log("        SCORPIO HOST BACKEND");
console.log("========================================");


/* =====================================================
   MIDDLEWARE
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

const publicPath = path.join(
    __dirname,
    "public"
);

app.use(
    express.static(publicPath)
);


/* =====================================================
   MONGODB
===================================================== */

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
                "❌ MongoDB Connection Failed"
            );

            console.error(
                error.message
            );

        });

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

            database:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",

            timestamp:
                new Date().toISOString()

        });

    }
);


/* =====================================================
   API ROOT
===================================================== */

app.get(
    "/api",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Scorpio Host API is running.",

            endpoints: {

                health:
                    "GET /api/health",

                auth:
                    "Coming next",

                wallet:
                    "Coming next",

                intasend:
                    "Coming next"

            }

        });

    }
);


/* =====================================================
   HOME
===================================================== */

app.get(
    "/",
    (req, res) => {

        const indexFile =
            path.join(
                publicPath,
                "index.html"
            );

        res.sendFile(
            indexFile,
            (error) => {

                if (error) {

                    res.status(200).send(
                        `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Scorpio Host</title>
                        </head>
                        <body>
                            <h1>Scorpio Host Backend</h1>
                            <p>Server is running successfully.</p>
                        </body>
                        </html>
                        `
                    );

                }

            }
        );

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
                "API endpoint not found.",

            path:
                req.originalUrl

        });

    }
);


/* =====================================================
   FRONTEND FALLBACK
=====================================================

   Using app.use() instead of app.get("*")
   keeps this compatible with Express 5.

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

const server =
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
                `📡 PORT: ${PORT}`
            );

            console.log(
                `🌐 URL: http://localhost:${PORT}`
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

        /*
         * Give the process a moment to flush logs.
         */

        server.close(
            () => {
                process.exit(1);
            }
        );

    }
);
