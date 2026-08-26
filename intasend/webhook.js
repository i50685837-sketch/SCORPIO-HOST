/*
 * IntaSend sends payment collection events
 * to this endpoint whenever the payment state
 * changes.
 *
 * IMPORTANT:
 * Only credit the user's wallet when state
 * is COMPLETE.
 */

async function handleWebhook(req, res) {
  try {
    const payload = req.body;

    console.log(
      "📩 IntaSend webhook:",
      JSON.stringify(payload, null, 2)
    );

    /*
     * IntaSend collection webhooks contain
     * fields such as:
     *
     * invoice_id
     * state
     * value
     * currency
     * api_ref
     * challenge
     */

    const state = payload?.state;
    const invoiceId =
      payload?.invoice_id;
    const apiRef =
      payload?.api_ref;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Missing invoice_id"
      });
    }

    /*
     * Payment successful
     */
    if (state === "COMPLETE") {

      console.log(
        `✅ IntaSend payment COMPLETE: ${invoiceId}`
      );

      /*
       * TODO:
       *
       * 1. Find Transaction using apiRef
       * 2. Make sure it hasn't already been credited
       * 3. Verify the amount
       * 4. Credit the user's wallet
       * 5. Mark transaction as COMPLETE
       *
       * Do NOT simply trust a frontend request
       * to increase wallet balance.
       */

      /*
       * Example:
       *
       * await Transaction.findOneAndUpdate(
       *   { reference: apiRef },
       *   {
       *     status: "completed",
       *     providerReference: invoiceId
       *   }
       * );
       */
    }

    /*
     * Payment failed
     */
    if (state === "FAILED") {
      console.log(
        `❌ IntaSend payment FAILED: ${invoiceId}`
      );
    }

    /*
     * Payment still processing
     */
    if (state === "PROCESSING") {
      console.log(
        `⏳ IntaSend payment PROCESSING: ${invoiceId}`
      );
    }

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error(
      "❌ IntaSend webhook error:",
      error.message
    );

    return res.status(500).json({
      success: false
    });
  }
}


module.exports = {
  handleWebhook
};
