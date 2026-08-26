const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");


/* =====================================================
   INTASEND WEBHOOK
   POST /api/intasend/webhook
===================================================== */

async function webhook(req, res) {

    try {

        const payload = req.body || {};

        console.log("📩 IntaSend webhook received");

        console.log(
            JSON.stringify(
                payload,
                null,
                2
            )
        );


        /* =================================================
           CHALLENGE
        ================================================= */

        /*
         * IntaSend provides a challenge when configuring
         * webhooks. Store/configure the challenge in your
         * environment and validate it here.
         */

        const expectedChallenge =
            process.env.INTASEND_WEBHOOK_CHALLENGE;

        if (
            expectedChallenge &&
            payload.challenge &&
            payload.challenge !== expectedChallenge
        ) {

            console.warn(
                "⚠️ Invalid IntaSend webhook challenge"
            );

            return res.status(401).json({
                success: false,
                message: "Invalid webhook challenge."
            });

        }


        /* =================================================
           EXTRACT PAYMENT DATA
        ================================================= */

        const apiRef =
            payload.api_ref ||
            payload.apiRef ||
            payload.reference ||
            null;


        const state =
            String(
                payload.state ||
                payload.status ||
                ""
            ).toUpperCase();


        const amount =
            Number(
                payload.value ||
                payload.amount ||
                payload.paid_amount ||
                0
            );


        const providerReference =
            payload.invoice_id ||
            payload.transaction_id ||
            payload.provider_reference ||
            null;


        /* =================================================
           IGNORE UNKNOWN EVENTS
        ================================================= */

        if (!apiRef) {

            console.log(
                "ℹ️ Webhook has no api_ref/reference."
            );

            return res.status(200).json({
                success: true,
                message: "Webhook received."
            });

        }


        /* =================================================
           FIND TRANSACTION
        ================================================= */

        const transaction =
            await Transaction.findOne({
                reference: apiRef
            });


        /*
         * Some IntaSend responses may use api_ref as the
         * stored provider reference. Try apiRef as fallback.
         */

        const transactionByApiRef =
            transaction ||
            await Transaction.findOne({
                apiRef: apiRef
            });


        if (!transactionByApiRef) {

            console.warn(
                "⚠️ Transaction not found:",
                apiRef
            );

            /*
             * Return 200 so the webhook isn't repeatedly
             * retried for an event that isn't ours.
             */

            return res.status(200).json({
                success: true,
                message: "Transaction not found."
            });

        }


        const currentTransaction =
            transactionByApiRef;


        /* =================================================
           SAVE PROVIDER INFORMATION
        ================================================= */

        currentTransaction.providerData =
            payload;


        if (providerReference) {

            currentTransaction.providerReference =
                providerReference;

        }


        if (
            payload.invoice_id
        ) {

            currentTransaction.apiRef =
                payload.api_ref ||
                payload.apiRef ||
                currentTransaction.apiRef;

        }


        /* =================================================
           ALREADY COMPLETED
        ================================================= */

        /*
         * Webhooks can be retried. Never credit the wallet
         * twice if the same COMPLETE event arrives again.
         */

        if (
            currentTransaction.status ===
            "completed"
        ) {

            await currentTransaction.save();

            return res.status(200).json({

                success: true,

                message:
                    "Transaction already completed."

            });

        }


        /* =================================================
           PAYMENT SUCCESS
        ================================================= */

        if (
            state === "COMPLETE" ||
            state === "COMPLETED" ||
            state === "SUCCESS" ||
            state === "SUCCESSFUL"
        ) {

            /*
             * Verify the amount when IntaSend provides it.
             */

            if (
                amount > 0 &&
                Number(currentTransaction.amount) !==
                amount
            ) {

                console.error(
                    "❌ Payment amount mismatch",
                    {
                        expected:
                            currentTransaction.amount,

                        received:
                            amount,

                        reference:
                            apiRef
                    }
                );

                currentTransaction.status =
                    "failed";

                currentTransaction.description =
                    "Payment amount mismatch.";

                await currentTransaction.save();

                return res.status(400).json({

                    success: false,

                    message:
                        "Payment amount mismatch."

                });

            }


            /* ---------------------------------------------
               FIND / CREATE USER WALLET
            --------------------------------------------- */

            let wallet =
                await Wallet.findOne({
                    user:
                        currentTransaction.user
                });


            if (!wallet) {

                wallet =
                    await Wallet.create({

                        user:
                            currentTransaction.user,

                        balance:
                            0,

                        currency:
                            "KES",

                        totalDeposited:
                            0,

                        totalSpent:
                            0,

                        totalWithdrawn:
                            0,

                        status:
                            "active"

                    });

            }


            if (
                wallet.status !==
                "active"
            ) {

                console.error(
                    "❌ Wallet is not active:",
                    wallet._id
                );

                currentTransaction.status =
                    "failed";

                currentTransaction.description =
                    "Wallet is not active.";

                await currentTransaction.save();

                return res.status(403).json({

                    success: false,

                    message:
                        "Wallet is not active."

                });

            }


            /* ---------------------------------------------
               CREDIT WALLET
            --------------------------------------------- */

            wallet.balance +=
                Number(
                    currentTransaction.amount
                );


            wallet.totalDeposited +=
                Number(
                    currentTransaction.amount
                );


            await wallet.save();


            /* ---------------------------------------------
               COMPLETE TRANSACTION
            --------------------------------------------- */

            currentTransaction.status =
                "completed";


            currentTransaction.completedAt =
                new Date();


            await currentTransaction.save();


            console.log(
                "✅ Wallet credited successfully"
            );

            console.log(
                "User:",
                currentTransaction.user
            );

            console.log(
                "Amount:",
                currentTransaction.amount
            );

            console.log(
                "Reference:",
                currentTransaction.reference
            );


            return res.status(200).json({

                success: true,

                message:
                    "Payment completed and wallet credited."

            });

        }


        /* =================================================
           PAYMENT FAILED
        ================================================= */

        if (
            state === "FAILED" ||
            state === "CANCELLED" ||
            state === "CANCELED"
        ) {

            currentTransaction.status =
                "failed";


            currentTransaction.description =
                payload.failed_reason ||
                payload.failedReason ||
                "Payment failed.";


            await currentTransaction.save();


            console.log(
                "❌ IntaSend payment failed:",
                apiRef
            );


            return res.status(200).json({

                success: true,

                message:
                    "Failed payment recorded."

            });

        }


        /* =================================================
           PAYMENT STILL PROCESSING
        ================================================= */

        if (
            state === "PENDING" ||
            state === "PROCESSING"
        ) {

            currentTransaction.status =
                "processing";


            await currentTransaction.save();


            return res.status(200).json({

                success: true,

                message:
                    "Payment still processing."

            });

        }


        /* =================================================
           UNKNOWN STATE
        ================================================= */

        console.log(
            "ℹ️ Unhandled IntaSend state:",
            state
        );


        await currentTransaction.save();


        return res.status(200).json({

            success: true,

            message:
                "Webhook received."

        });


    } catch (error) {

        console.error(
            "❌ IntaSend webhook error:"
        );

        console.error(
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Webhook processing failed."

        });

    }

}


module.exports =
    webhook;
