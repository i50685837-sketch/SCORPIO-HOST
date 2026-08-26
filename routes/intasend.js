const express = require('express');
const router = express.Router();
const intasendController = require('../controllers/intasendController');
const auth = require('../middleware/auth');

router.post('/stk', auth, intasendController.initiateSTKPush);
router.get('/status/:invoiceId', auth, intasendController.checkPaymentStatus);
router.post('/webhook', intasendController.handleWebhook);

module.exports = router;
