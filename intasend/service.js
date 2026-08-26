const { intasend } = require("./config");


/* =====================================================
   M-PESA STK PUSH
===================================================== */

async function sendMpesaStk({
    amount,
    phoneNumber,
    email,
    firstName = "Scorpio",
    lastName = "Host",
    apiRef,
    host
}) {

    if (!intasend) {
        throw new Error(
            "IntaSend is not configured."
        );
    }

    const numericAmount = Number(amount);

    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
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

    const collection =
        intasend.collection();

    const response =
        await collection.mpesaStkPush({

            first_name: firstName,

            last_name: lastName,

            email:
                email ||
                "customer@example.com",

            host:
                host ||
                process.env.APP_URL ||
                "",

            amount:
                numericAmount,

            phone_number:
                phoneNumber,

            api_ref:
                apiRef

        });

    return response;
}


/* =====================================================
   PAYMENT STATUS
===================================================== */

async function getPaymentStatus(
    invoiceId
) {

    if (!intasend) {
        throw new Error(
            "IntaSend is not configured."
        );
    }

    if (!invoiceId) {
        throw new Error(
            "Invoice ID is required."
        );
    }

    const collection =
        intasend.collection();

    const response =
        await collection.status(
            invoiceId
        );

    return response;
}


/* =====================================================
   EXPORT
===================================================== */

module.exports = {
    sendMpesaStk,
    getPaymentStatus
};
