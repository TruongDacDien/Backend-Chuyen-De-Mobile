// @ts-nocheck
// controllers/momo.controller.js
require("dotenv").config();

// ✅ Fix tương thích CJS/ESM + TS typecheck:
const axiosModule = require("axios");
/** @type {import('axios').AxiosStatic} */

const axios = axiosModule.default ? axiosModule.default : axiosModule;

const Order = require("../models/order.model");
const { hmacSHA256, buildCreateSignatureStr, buildIpnSignatureStr } = require("../utils/momo.util");

/* ===== Helpers ===== */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ${name} is missing`);
  return v;
}
function toVndInt(x) {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return Math.round(n); // VND là số nguyên
}

/* ===== TẠO ĐƠN THANH TOÁN ===== */
exports.createPayment = async (req, res) => {
  try {
    const { amount, orderInfo = "Thanh toán MoMo", extraData = "" } = req.body || {};
    const vnd = toVndInt(amount);
    if (!vnd) return res.status(400).json({ success: false, message: "amount invalid (VND integer)" });

    const partnerCode = requireEnv("MOMO_PARTNER_CODE");
    const accessKey   = requireEnv("MOMO_ACCESS_KEY");
    const secretKey   = requireEnv("MOMO_SECRET_KEY");
    const endpoint    = requireEnv("MOMO_CREATE_ENDPOINT");
    const redirectUrl = requireEnv("MOMO_REDIRECT_URL");
    const ipnUrl      = requireEnv("MOMO_IPN_URL");

    const orderId     = (req.body.orderId && String(req.body.orderId)) || `M${Date.now()}`;
    const requestId   = `${partnerCode}-${Date.now()}`;
    const requestType = "captureWallet";

    const rawSignature = buildCreateSignatureStr({
      accessKey,
      amount: vnd,
      extraData,
      ipnUrl,
      orderId,
      orderInfo,
      partnerCode,
      redirectUrl,
      requestId,
      requestType,
    });
    const signature = hmacSHA256(rawSignature, secretKey);

    const payload = {
      partnerCode,
      accessKey,
      requestId,
      amount: vnd,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      lang: "vi",
      signature,
    };

    // ✅ Không dùng create(), không gọi axios(...). Dùng axios.request().
    const { data } = await axios.request({
      method: "post",
      url: endpoint,
      headers: { "Content-Type": "application/json" },
      data: payload,
      timeout: 15000,
      transitional: { clarifyTimeoutError: true },
    });

    await Order.create({
      orderId,
      amount: vnd,
      orderInfo,
      status: "Pending",
      resultCode: data?.resultCode,
      message: data?.message,
      rawCreateResponse: data,
    });

    return res.json({
      success: true,
      orderId,
      payUrl: data?.payUrl || null,
      deeplink: data?.deeplink || null,
      resultCode: data?.resultCode,
      message: data?.message,
    });
  } catch (e) {
    console.error("❌ createPayment error:", e.response?.data || e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
};

/* ===== IPN CALLBACK ===== */
exports.ipnHandler = async (req, res) => {
  try {
    const body = req.body || {};
    const raw = buildIpnSignatureStr({
      accessKey: requireEnv("MOMO_ACCESS_KEY"),
      amount: body.amount,
      extraData: body.extraData || "",
      message: body.message || "",
      orderId: body.orderId,
      orderInfo: body.orderInfo || "",
      orderType: body.orderType || "",
      partnerCode: body.partnerCode,
      payType: body.payType || "",
      requestId: body.requestId,
      responseTime: body.responseTime,
      resultCode: body.resultCode,
      transId: body.transId,
    });
    const serverSig = hmacSHA256(raw, requireEnv("MOMO_SECRET_KEY"));

    if (serverSig !== body.signature) {
      console.warn("⚠️ IPN signature mismatch");
      return res.json({ resultCode: 1, message: "Invalid signature" });
    }

    const order = await Order.findOne({ orderId: body.orderId });
    if (!order) {
      console.warn("⚠️ IPN received but order not found:", body.orderId);
      return res.json({ resultCode: 0, message: "ok" });
    }

    order.status     = Number(body.resultCode) === 0 ? "Succeeded" : "Failed";
    order.resultCode = body.resultCode;
    order.message    = body.message;
    order.transId    = String(body.transId || "");
    order.rawIpn     = body;
    await order.save();

    console.log(`✅ Updated order ${order.orderId} -> ${order.status}`);
    return res.json({ resultCode: 0, message: "ok" });
  } catch (e) {
    console.error("❌ IPN error:", e.message);
    return res.json({ resultCode: 0, message: "ok" }); // tránh retry spam
  }
};

/* ===== LẤY TRẠNG THÁI ===== */
exports.getStatus = async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  return res.json({
    success: true,
    orderId: order.orderId,
    status: order.status,
    resultCode: order.resultCode,
    message: order.message,
    transId: order.transId || null,
  });
};

/* ===== RETURN PAGE (optional) ===== */
exports.returnPage = async (req, res) => {
  const order = await Order.findOne({ orderId: req.query.orderId });
  res.send(
    `<h3>MoMo return</h3>
     <p>Order: ${req.query.orderId}</p>
     <p>Status: ${order?.status || "N/A"}</p>`
  );
};
