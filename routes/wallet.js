"use strict";

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const walletController = require("../controllers/walletController");

/* =====================================================
   GET WALLET
   GET /api/wallet
===================================================== */

router.get(
    "/",
    auth,
    walletController.getWallet
);


/* =====================================================
   M-PESA STK PUSH
   POST /api/wallet/deposit

   Body:
   {
       "amount": 100,
       "phone_number": "0712345678"
   }

   The authentication middleware runs first,
   then the controller directly calls IntaSend.
===================================================== */

router.post(
    "/deposit",
    auth,
    walletController.deposit
);


/* =====================================================
   PAYMENT STATUS
   GET /api/wallet/payment/:reference
===================================================== */

router.get(
    "/payment/:reference",
    auth,
    walletController.paymentStatus
);


/* =====================================================
   TRANSACTION HISTORY
   GET /api/wallet/transactions
===================================================== */

router.get(
    "/transactions",
    auth,
    walletController.transactions
);


module.exports = router;
