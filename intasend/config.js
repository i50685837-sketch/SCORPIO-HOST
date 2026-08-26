require("dotenv").config();

const IntaSend = require("intasend-node");


const publishableKey =
    process.env.INTASEND_PUBLISHABLE_KEY;

const secretKey =
    process.env.INTASEND_SECRET_KEY;

const testMode =
    String(
        process.env.INTASEND_TEST_MODE || "true"
    ).toLowerCase() === "true";


if (!publishableKey) {
    console.warn(
        "⚠️ INTASEND_PUBLISHABLE_KEY is missing."
    );
}

if (!secretKey) {
    console.warn(
        "⚠️ INTASEND_SECRET_KEY is missing."
    );
}


let intasend = null;


if (
    publishableKey &&
    secretKey
) {

    try {

        intasend =
            new IntaSend(
                publishableKey,
                secretKey,
                testMode
            );

        console.log(
            `✅ IntaSend initialized (${testMode ? "SANDBOX" : "LIVE"})`
        );

    } catch (error) {

        console.error(
            "❌ Failed to initialize IntaSend:",
            error.message
        );

    }

}


module.exports = {
    intasend,
    testMode
};
