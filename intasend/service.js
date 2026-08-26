const { intasend } = require("./config");

function normalizePhone(phone) {
  if (!phone) return null;

  let value = String(phone).replace(/\s+/g, "");

  if (value.startsWith("+254")) {
    value = value.substring(1);
  }

  if (value.startsWith("07") || value.startsWith("01")) {
    value = "254" + value.substring(1);
  }

  return value;
}

/*
 * Start M-Pesa STK Push
 */
async function createStkPush({
  amount,
  phoneNumber,
  email,
  firstName = "Scorpio",
  lastName = "Host",
  apiRef
}) {
  if (!amount || Number(amount) <= 0) {
    throw new Error("Invalid payment amount");
  }

  const phone = normalizePhone(phoneNumber);

  if (!phone) {
    throw new Error("Phone number is required");
  }

  const collection = intasend.collection();

  const response = await collection.mpesaStkPush({
    first_name: firstName,
    last_name: lastName,
    email: email || "",
    amount: Number(amount),
    phone_number: phone,
    api_ref:
      apiRef ||
      `SCORPIO-${Date.now()}`
  });

  return response;
}


/*
 * Create IntaSend checkout
 * Useful if you want the customer to open
 * an IntaSend-hosted payment page.
 */
async function createCheckout({
  amount,
  phoneNumber,
  email,
  firstName = "Scorpio",
  lastName = "Host",
  apiRef,
  host,
  redirectUrl
}) {
  const collection = intasend.collection();

  const response = await collection.charge({
    first_name: firstName,
    last_name: lastName,
    email: email || "",
    phone_number: normalizePhone(phoneNumber),
    host,
    amount: Number(amount),
    currency: "KES",
    api_ref:
      apiRef ||
      `SCORPIO-${Date.now()}`,
    redirect_url: redirectUrl,
    method: "M-PESA"
  });

  return response;
}


/*
 * Check payment status
 */
async function getPaymentStatus(invoiceId) {
  if (!invoiceId) {
    throw new Error("invoiceId is required");
  }

  const collection = intasend.collection();

  const response =
    await collection.status(invoiceId);

  return response;
}


module.exports = {
  normalizePhone,
  createStkPush,
  createCheckout,
  getPaymentStatus
};
