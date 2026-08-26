const express =
    require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const walletController =
    require("../controllers/walletController");


/* ==========================================
   GET WALLET
   GET /api/wallet
========================================== */

router.get(
    "/",
    auth,
    walletController.getWallet
);


/* ==========================================
   DEPOSIT / STK
   POST /api/wallet/deposit
========================================== */

router.post(
    "/deposit",
    auth,
    walletController.deposit
);


/* ==========================================
   TRANSACTIONS
   GET /api/wallet/transactions
========================================== */

router.get(
    "/transactions",
    auth,
    walletController.transactions
);


/* ==========================================
   PAYMENT STATUS
   GET /api/wallet/payment/:reference
========================================== */

router.get(
    "/payment/:reference",
    auth,
    walletController.paymentStatus
);


module.exports =
    router;
