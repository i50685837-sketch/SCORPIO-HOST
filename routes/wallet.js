const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const auth = require('../middleware/auth');

router.get('/balance', auth, walletController.getWalletBalance);
router.post('/withdraw', auth, walletController.requestWithdrawal);

module.exports = router;
