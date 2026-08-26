const {
  createStkPush,
  createCheckout,
  getPaymentStatus
} = require("./service");


/*
 * POST /api/intasend/stk
 */
async function stkPush(req, res) {
  try {
    const {
      amount,
      phoneNumber,
      email,
      firstName,
      lastName
    } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Amount and phone number are required"
      });
    }

    const apiRef =
      `SCORPIO-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;

    const payment = await createStkPush({
      amount,
      phoneNumber,
      email,
      firstName,
      lastName,
      apiRef
    });

    return res.json({
      success: true,
      message:
        "M-Pesa payment request sent",
      apiRef,
      payment
    });

  } catch (error) {
    console.error(
      "❌ IntaSend STK error:",
      error?.response?.data ||
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to initiate IntaSend payment",
      error:
        error?.response?.data ||
        error.message
    });
  }
}


/*
 * POST /api/intasend/checkout
 */
async function checkout(req, res) {
  try {
    const {
      amount,
      phoneNumber,
      email,
      firstName,
      lastName
    } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Amount is required"
      });
    }

    const host =
      process.env.APP_URL ||
      "http://localhost:5000";

    const redirectUrl =
      `${host}/wallet.html?payment=success`;

    const apiRef =
      `SCORPIO-${Date.now()}`;

    const payment = await createCheckout({
      amount,
      phoneNumber,
      email,
      firstName,
      lastName,
      apiRef,
      host,
      redirectUrl
    });

    return res.json({
      success: true,
      apiRef,
      payment
    });

  } catch (error) {
    console.error(
      "❌ IntaSend checkout error:",
      error?.response?.data ||
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create IntaSend checkout",
      error:
        error?.response?.data ||
        error.message
    });
  }
}


/*
 * GET /api/intasend/status/:invoiceId
 */
async function paymentStatus(req, res) {
  try {
    const { invoiceId } = req.params;

    const payment =
      await getPaymentStatus(invoiceId);

    return res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error(
      "❌ IntaSend status error:",
      error?.response?.data ||
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve payment status"
    });
  }
}


module.exports = {
  stkPush,
  checkout,
  paymentStatus
};
