const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const walletController = require("../controllers/walletController");

/*
=========================================================
GET WALLET
GET /api/wallet
=========================================================
*/

router.get(
    "/",
    auth,
    walletController.getWallet
);

/*
=========================================================
M-PESA / INTASEND STK PUSH
POST /api/wallet/deposit

Body:
{
    "amount": 100,
    "phone_number": "2547XXXXXXXX"
}
=========================================================
*/

router.post(
    "/deposit",
    auth,
    walletController.deposit
);

/*
=========================================================
PAYMENT STATUS
GET /api/wallet/payment/:reference
=========================================================
*/

router.get(
    "/payment/:reference",
    auth,
    walletController.paymentStatus
);

/*
=========================================================
WALLET TRANSACTIONS
GET /api/wallet/transactions
=========================================================
*/

router.get(
    "/transactions",
    auth,
    walletController.transactions
);

module.exports = router;
