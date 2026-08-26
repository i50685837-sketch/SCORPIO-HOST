const Wallet = require('../models/Wallet');
const Payment = require('../models/Payment');

// Get Wallet Balance & Transactions
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    const transactions = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type amount status createdAt invoiceId paymentMethod');

    return res.status(200).json({
      balance: wallet.balance,
      currency: wallet.currency,
      transactions
    });
  } catch (error) {
    console.error('Get Balance Error:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve wallet information' });
  }
};

// Initiate Withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { amount, phone } = req.body;

    const withdrawAmount = Number(amount);
    const MIN_WITHDRAWAL = 100;

    if (!withdrawAmount || withdrawAmount < MIN_WITHDRAWAL) {
      return res.status(400).json({ error: `Minimum withdrawal amount is KES ${MIN_WITHDRAWAL}` });
    }

    // Validate phone number
    let cleanedPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    if (cleanedPhone.startsWith('0')) cleanedPhone = '254' + cleanedPhone.slice(1);
    if (!/^254(7|1)\d{8}$/.test(cleanedPhone)) {
      return res.status(400).json({ error: 'Provide a valid M-Pesa phone number' });
    }

    // Atomic Balance Check and Deduction
    const wallet = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: withdrawAmount } },
      { $inc: { balance: -withdrawAmount } },
      { new: true }
    );

    if (!wallet) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Create withdrawal transaction request
    const withdrawalRef = `WTH-${Date.now()}`;
    const payment = await Payment.create({
      userId,
      amount: withdrawAmount,
      phone: cleanedPhone,
      provider: 'intasend',
      invoiceId: withdrawalRef,
      status: 'PENDING',
      paymentMethod: 'MPESA',
      type: 'WITHDRAWAL'
    });

    return res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted for processing',
      transaction: payment
    });
  } catch (error) {
    console.error('Withdrawal Error:', error.message);
    return res.status(500).json({ error: 'Failed to process withdrawal' });
  }
};
      
