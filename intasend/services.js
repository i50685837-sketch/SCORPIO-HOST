const IntaSend = require("intasend-node");


/* =====================================================
   CONFIG
===================================================== */

const publishableKey =
    process.env.INTASEND_PUBLISHABLE_KEY;

const secretKey =
    process.env.INTASEND_SECRET_KEY;


/*
 * INTASEND_TEST=true
 * for sandbox.
 *
 * INTASEND_TEST=false
 * for live.
 */

const isTest =
    String(
        process.env.INTASEND_TEST ?? "true"
    ).toLowerCase() === "true";


if (!publishableKey) {

    console.warn(
        "⚠️ INTASEND_PUBLISHABLE_KEY is missing"
    );

}


if (!secretKey) {

    console.warn(
        "⚠️ INTASEND_SECRET_KEY is missing"
    );

}


/* =====================================================
   INTASEND CLIENT
===================================================== */

const intasend =
    new IntaSend(
        publishableKey,
        secretKey,
        isTest
    );


/* =====================================================
   COLLECTION
===================================================== */

const collection =
    intasend.collection();


/* =====================================================
   M-PESA STK PUSH
===================================================== */

async function initiateMpesaSTK({
    amount,
    phoneNumber,
    reference,
    email,
    name
}) {

    if (
        !amount ||
        Number(amount) <= 0
    ) {

        throw new Error(
            "Invalid payment amount."
        );

    }


    if (!phoneNumber) {

        throw new Error(
            "M-Pesa phone number is required."
        );

    }


    if (!email) {

        throw new Error(
            "Customer email is required."
        );

    }


    /*
     * IntaSend expects the customer's name
     * as first_name / last_name.
     */

    const fullName =
        String(
            name || "Scorpio Customer"
        ).trim();


    const nameParts =
        fullName.split(/\s+/);


    const firstName =
        nameParts.shift() ||
        "Scorpio";


    const lastName =
        nameParts.join(" ") ||
        "Customer";


    const payload = {

        first_name:
            firstName,

        last_name:
            lastName,

        email:
            email,

        /*
         * Public HTTPS URL of your deployed app.
         *
         * Example:
         * https://your-app.onrender.com
         */

        host:
            process.env.APP_URL,

        amount:
            Number(amount),

        phone_number:
            phoneNumber,

        api_ref:
            reference

    };


    console.log(
        "📱 Sending IntaSend STK request..."
    );

    console.log(
        "Amount:",
        payload.amount
    );

    console.log(
        "Phone:",
        payload.phone_number
    );

    console.log(
        "Reference:",
        payload.api_ref
    );


    try {

        const response =
            await collection
                .mpesaStkPush(
                    payload
                );


        console.log(
            "✅ IntaSend STK response:"
        );

        console.log(
            JSON.stringify(
                response,
                null,
                2
            )
        );


        return response;


    } catch (error) {

        console.error(
            "❌ IntaSend STK request failed:"
        );


        if (error?.response) {

            console.error(
                error.response
            );

        }


        console.error(
            error.message ||
            error
        );


        throw new Error(
            error.message ||
            "IntaSend STK request failed."
        );

    }

}


/* =====================================================
   EXPORT
===================================================== */

module.exports = {

    initiateMpesaSTK

};
