const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");


/* =====================================================
   INTASEND WEBHOOK
===================================================== */

exports.handleWebhook = async (req, res) => {

    try {

        const payload = req.body || {};

        console.log("");
        console.log("========================================");
        console.log("📩 INTASEND WEBHOOK RECEIVED");
        console.log("========================================");
        console.log(
            JSON.stringify(payload, null, 2)
        );


        /* ---------------------------------------------
           BASIC PAYMENT INFORMATION
        --------------------------------------------- */

        const state =
            String(
                payload.state ||
                payload.status ||
                ""
            ).toUpperCase();


        const apiRef =
            payload.api_ref ||
            payload.apiRef ||
            null;


        const invoiceId =
            payload.invoice_id ||
            payload.invoiceId ||
            payload.id ||
            null;


        const amount =
            Number(
                payload.value ||
                payload.amount ||
                0
            );


        /* ---------------------------------------------
           FIND TRANSACTION
        --------------------------------------------- */

        let transaction = null;


        if (apiRef) {

            transaction =
                await Transaction.findOne({
                    apiRef: apiRef
                });

        }


        /*
         * Some IntaSend responses may identify the
         * payment by provider invoice instead.
         */

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
                "❌ Transaction not found."
            );

            /*
             * We acknowledge the webhook so that a
             * provider does not repeatedly retry an
             * unknown transaction forever.
             *
             * No wallet is credited.
             */

            return res.status(200).json({

                success: true,

                processed: false,

                message:
                    "Transaction not found."

            });

        }


        /* ---------------------------------------------
           VERIFY AMOUNT
        --------------------------------------------- */

        if (
            amount > 0 &&
            Number(transaction.amount) !== amount
        ) {

            console.error(
                "❌ Payment amount mismatch."
            );

            console.error(
                "Expected:",
                transaction.amount
            );

            console.error(
                "Received:",
                amount
            );


            return res.status(400).json({

                success: false,

                message:
                    "Payment amount mismatch."

            });

        }


        /* ---------------------------------------------
           SAVE PROVIDER DATA
        --------------------------------------------- */

        transaction.providerData =
            payload;


        if (invoiceId) {

            transaction.providerReference =
                invoiceId;

        }


        /* =================================================
           SUCCESSFUL PAYMENT
        ================================================= */

        if (
            state === "COMPLETE" ||
            state === "COMPLETED" ||
            state === "SUCCESS"
        ) {

            /*
             * IMPORTANT:
             *
             * If this transaction was already completed,
             * do NOT credit the wallet again.
             */

            if (
                transaction.status ===
                "completed"
            ) {

                console.log(
                    "ℹ️ Transaction already completed."
                );

                return res.status(200).json({

                    success: true,

                    processed: false,

                    message:
                        "Transaction already processed."

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
                    "❌ Wallet not found for transaction."
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Wallet not found."

                });

            }


            /* -----------------------------------------
               CHECK WALLET STATUS
            ----------------------------------------- */

            if (
                wallet.status !== "active"
            ) {

                console.error(
                    "❌ Wallet is not active."
                );

                return res.status(400).json({

                    success: false,

                    message:
                        "Wallet is not active."

                });

            }


            /* -----------------------------------------
               CREDIT WALLET
            ----------------------------------------- */

            wallet.balance +=
                Number(
                    transaction.amount
                );


            wallet.totalDeposited +=
                Number(
                    transaction.amount
                );


            /* -----------------------------------------
               MARK TRANSACTION COMPLETE
            ----------------------------------------- */

            transaction.status =
                "completed";


            transaction.completedAt =
                new Date();


            await wallet.save();

            await transaction.save();


            console.log(
                "✅ PAYMENT COMPLETED"
            );

            console.log(
                "Transaction:",
                transaction.reference
            );

            console.log(
                "Amount:",
                transaction.amount
            );

            console.log(
                "New balance:",
                wallet.balance
            );


            return res.status(200).json({

                success: true,

                processed: true,

                message:
                    "Payment processed successfully."

            });

        }


        /* =================================================
           FAILED PAYMENT
        ================================================= */

        if (
            state === "FAILED" ||
            state === "CANCELLED" ||
            state === "CANCELED"
        ) {

            /*
             * Don't overwrite an already completed
             * transaction with a later failed event.
             */

            if (
                transaction.status !==
                "completed"
            ) {

                transaction.status =
                    "failed";

                transaction.completedAt =
                    null;

                await transaction.save();

            }


            console.log(
                "❌ PAYMENT FAILED"
            );


            return res.status(200).json({

                success: true,

                processed: true,

                message:
                    "Payment marked as failed."

            });

        }


        /* =================================================
           PROCESSING / PENDING
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


            console.log(
                "⏳ PAYMENT STILL PROCESSING"
            );


            return res.status(200).json({

                success: true,

                processed: false,

                message:
                    "Payment is still processing."

            });

        }


        /* =================================================
           UNKNOWN STATUS
        ================================================= */

        console.log(
            "ℹ️ Unknown IntaSend payment state:",
            state
        );


        await transaction.save();


        return res.status(200).json({

            success: true,

            processed: false,

            message:
                "Webhook received."

        });


    } catch (error) {

        console.error("");
        console.error(
            "🔥 INTASEND WEBHOOK ERROR"
        );

        console.error(
            error?.response?.data ||
            error.message ||
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Webhook processing failed."

        });

    }

};
