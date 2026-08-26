const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");

/*
 * IntaSend webhook challenge.
 *
 * Set the SAME value in your Render environment
 * and in the IntaSend webhook configuration.
 */
const WEBHOOK_CHALLENGE =
    process.env.INTASEND_WEBHOOK_CHALLENGE;


/* =====================================================
   INTASEND COLLECTION WEBHOOK
   POST /api/intasend/webhook
===================================================== */

exports.handleWebhook = async (req, res) => {

    try {

        const payload = req.body || {};

        console.log(
            "📩 IntaSend webhook received"
        );


        /* ---------------------------------------------
           CHALLENGE VALIDATION
        --------------------------------------------- */

        if (
            WEBHOOK_CHALLENGE &&
            payload.challenge !== WEBHOOK_CHALLENGE
        ) {

            console.error(
                "❌ Invalid IntaSend webhook challenge"
            );

            return res.status(401).json({
                success: false,
                message: "Invalid webhook challenge."
            });

        }


        /* ---------------------------------------------
           INTASEND COLLECTION FIELDS
        --------------------------------------------- */

        const state =
            String(
                payload.state || ""
            ).toUpperCase();

        const apiRef =
            payload.api_ref || null;

        const invoiceId =
            payload.invoice_id || null;

        const amount =
            Number(
                payload.value || 0
            );


        if (!apiRef && !invoiceId) {

            return res.status(400).json({
                success: false,
                message:
                    "Missing IntaSend transaction reference."
            });

        }


        /* ---------------------------------------------
           FIND OUR TRANSACTION
        --------------------------------------------- */

        let transaction = null;


        if (apiRef) {

            transaction =
                await Transaction.findOne({
                    apiRef
                });

        }


        if (
            !transaction &&
            invoiceId
        ) {

            transaction =
                await Transaction.findOne({
                    providerReference:
                        invoiceId
                });

        }


        if (!transaction) {

            console.error(
                "❌ Scorpio transaction not found:",
                apiRef || invoiceId
            );

            /*
             * Nothing should be credited when we cannot
             * identify the transaction.
             */

            return res.status(200).json({
                success: true,
                processed: false,
                message:
                    "Transaction not found."
            });

        }


        /* ---------------------------------------------
           AMOUNT CHECK
        --------------------------------------------- */

        if (
            amount > 0 &&
            Number(transaction.amount) !== amount
        ) {

            console.error(
                "❌ Amount mismatch"
            );

            return res.status(400).json({
                success: false,
                message:
                    "Transaction amount mismatch."
            });

        }


        /* ---------------------------------------------
           SAVE PROVIDER RESPONSE
        --------------------------------------------- */

        transaction.providerData =
            payload;

        if (invoiceId) {

            transaction.providerReference =
                invoiceId;

        }


        /* =================================================
           SUCCESS
        ================================================= */

        if (state === "COMPLETE") {

            /*
             * Idempotency:
             * IntaSend can send state-change events more
             * than once. Never credit an already completed
             * transaction again.
             */

            if (
                transaction.status ===
                "completed"
            ) {

                return res.status(200).json({
                    success: true,
                    processed: false,
                    message:
                        "Transaction already completed."
                });

            }


            /* -----------------------------------------
               FIND WALLET
            ----------------------------------------- */

            const wallet =
                await Wallet.findOne({
                    user:
                        transaction.user
                });


            if (!wallet) {

                console.error(
                    "❌ Wallet not found:",
                    transaction.user
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Wallet not found."
                });

            }


            if (
                wallet.status !== "active"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Wallet is not active."
                });

            }


            /* -----------------------------------------
               CREDIT WALLET
            ----------------------------------------- */

            wallet.balance =
                Number(wallet.balance) +
                Number(transaction.amount);

            wallet.totalDeposited =
                Number(wallet.totalDeposited) +
                Number(transaction.amount);


            /* -----------------------------------------
               COMPLETE TRANSACTION
            ----------------------------------------- */

            transaction.status =
                "completed";

            transaction.completedAt =
                new Date();


            await wallet.save();

            await transaction.save();


            console.log(
                "✅ Wallet credited:",
                transaction.amount,
                transaction.currency
            );


            return res.status(200).json({
                success: true,
                processed: true,
                message:
                    "Payment completed and wallet credited."
            });

        }


        /* =================================================
           PROCESSING
        ================================================= */

        if (
            state === "PROCESSING" ||
            state === "PENDING"
        ) {

            if (
                transaction.status !==
                "completed"
            ) {

                transaction.status =
                    "processing";

                await transaction.save();

            }


            return res.status(200).json({
                success: true,
                processed: false,
                message:
                    "Payment still processing."
            });

        }


        /* =================================================
           FAILED
        ================================================= */

        if (state === "FAILED") {

            /*
             * Never turn a completed payment back into
             * failed.
             */

            if (
                transaction.status !==
                "completed"
            ) {

                transaction.status =
                    "failed";

                await transaction.save();

            }


            console.log(
                "❌ IntaSend payment failed:",
                payload.failed_reason || "Unknown reason"
            );


            return res.status(200).json({
                success: true,
                processed: true,
                message:
                    "Payment marked as failed."
            });

        }


        /* =================================================
           UNKNOWN STATE
        ================================================= */

        await transaction.save();

        return res.status(200).json({
            success: true,
            processed: false,
            message:
                "Webhook received."
        });


    } catch (error) {

        console.error(
            "🔥 IntaSend webhook error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Webhook processing failed."
        });

    }

};
