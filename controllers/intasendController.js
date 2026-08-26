const axios = require('axios');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');

// Helper to format Kenyan phone numbers to 2547XXXXXXXX or 2541XXXXXXXX
const formatPhone = (phone) => {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
};

// Helper: Idempotent Wallet Crediting
const processSuccessfulPayment = async (invoiceId, rawData = {}) => {
  // Atomically update payment status ONLY if it's currently PENDING
  const payment = await Payment.findOneAndUpdate(
    { invoiceId, status: 'PENDING' },
    { status: 'SUCCESS', rawProviderResponse: rawData },
    { new: true }
  );

  if (!payment) {
    // Payment was already processed, failed, or does not exist
    return false;
  }

  // Credit user's wallet atomically
  await Wallet.findOneAndUpdate(
    { userId: payment.userId },
    { $inc: { balance: payment.amount } },
    { upsert: true, new: true }
  );

  return true;
};

// Initiate STK Push
exports.initiateSTKPush = async (req, res) => {
  try {
    const { amount, phone } = req.body;
    const userId = req.user.id || req.user._id;

    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Minimum deposit amount is KES 50' });
    }

    const formattedPhone = formatPhone(phone);
    if (!/^254(7|1)\d{8}$/.test(formattedPhone)) {
      return res.status(400).json({ error: 'Invalid Kenyan M-Pesa phone number' });
    }

    const baseUrl = process.env.INTASEND_BASE_URL || 'https://sandbox.intasend.com';

    // Call IntaSend M-Pesa STK Push API
    const response = await axios.post(
      `${baseUrl}/api/v1/payment/mpesa-stk-push/`,
      {
        amount: Number(amount),
        phone_number: formattedPhone,
        api_ref: `SCH-${Date.now()}`
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;
    const invoiceId = data.invoice?.invoice_id || data.id || data.tracking_id;

    if (!invoiceId) {
      return res.status(500).json({ error: 'Failed to retrieve transaction reference from payment gateway' });
    }

    // Record pending payment in DB
    const payment = await Payment.create({
      userId,
      amount: Number(amount),
      phone: formattedPhone,
      provider: 'intasend',
      invoiceId,
      status: 'PENDING',
      paymentMethod: 'MPESA',
      type: 'DEPOSIT',
      rawProviderResponse: data
    });

    return res.status(200).json({
      success: true,
      message: 'STK Push sent to device',
      invoiceId: payment.invoiceId
    });
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    return res.status(500).json({
      error: error.response?.data?.errors?.[0]?.message || 'Failed to initiate M-Pesa payment'
    });
  }
};

// Check Payment Status
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const payment = await Payment.findOne({ invoiceId });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // If already finalized, return current DB state
    if (payment.status !== 'PENDING') {
      return res.json({ status: payment.status, amount: payment.amount });
    }

    // Poll IntaSend API for live status
    const baseUrl = process.env.INTASEND_BASE_URL || 'https://sandbox.intasend.com';
    const response = await axios.post(
      `${baseUrl}/api/v1/payment/status/`,
      { invoice_id: invoiceId },
      {
        headers: {
          Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const state = response.data?.invoice?.state;

    if (state === 'COMPLETE') {
      await processSuccessfulPayment(invoiceId, response.data);
      return res.json({ status: 'SUCCESS', amount: payment.amount });
    } else if (['FAILED', 'DECLINED'].includes(state)) {
      payment.status = 'FAILED';
      payment.rawProviderResponse = response.data;
      await payment.save();
      return res.json({ status: 'FAILED' });
    } else if (state === 'CANCELLED') {
      payment.status = 'CANCELLED';
      payment.rawProviderResponse = response.data;
      await payment.save();
      return res.json({ status: 'CANCELLED' });
    }

    return res.json({ status: 'PENDING' });
  } catch (error) {
    console.error('Status Check Error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Error querying transaction status' });
  }
};

// IntaSend Webhook
exports.handleWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const { invoice_id, state, challenge, secret } = payload;

    // Optional webhook verification if secret configured
    if (process.env.INTASEND_WEBHOOK_SECRET && secret !== process.env.INTASEND_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook signature/secret' });
    }

    // Handle challenge handshake if requested by IntaSend
    if (challenge) {
      return res.json({ challenge });
    }

    if (invoice_id && state === 'COMPLETE') {
      await processSuccessfulPayment(invoice_id, payload);
    } else if (invoice_id && ['FAILED', 'DECLINED'].includes(state)) {
      await Payment.findOneAndUpdate({ invoiceId: invoice_id, status: 'PENDING' }, { status: 'FAILED', rawProviderResponse: payload });
    }

    return res.status(200).json({ status: 'acknowledged' });
  } catch (error) {
    console.error('Webhook Error:', error.message);
    return res.status(500).json({ error: 'Internal webhook error' });
  }
};
                       
