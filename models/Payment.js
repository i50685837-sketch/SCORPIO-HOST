const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    provider: {
      type: String,
      default: "intasend",
      lowercase: true,
      enum: ["intasend"]
    },

    invoiceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    paymentMethod: {
      type: String,
      default: "mpesa",
      lowercase: true,
      enum: ["mpesa"]
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
        "EXPIRED"
      ],
      default: "PENDING",
      index: true
    },

    description: {
      type: String,
      default: "M-Pesa wallet deposit"
    },

    currency: {
      type: String,
      default: "KES"
    },

    reference: {
      type: String,
      default: null,
      index: true
    },

    failureReason: {
      type: String,
      default: null
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    processedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

/*
 * Prevent a payment from being credited twice.
 * The controller should check status before
 * changing the wallet balance.
 */

paymentSchema.index({
  userId: 1,
  createdAt: -1
});

paymentSchema.index({
  status: 1,
  createdAt: -1
});

module.exports = mongoose.model("Payment", paymentSchema);
