// controllers/zalo.controller.js
// @ts-nocheck
require("dotenv").config();
const crypto = require("crypto");

// ---- axios shim (fix default export in CJS + TS type-check) ----
const axiosMod = require("axios");
/** @type {import('axios').AxiosStatic} */
const axios = axiosMod.default || axiosMod;
// ----------------------------------------------------------------

const {
  ZP_APP_ID,
  ZP_KEY1,
  ZP_KEY2,
  ZP_API_BASE = "https://sb-openapi.zalopay.vn", // ✅ sandbox openapi host
  ZP_REDIRECT_URL = "http://localhost:3000/api/zalo/bind-return",
  ZP_CALLBACK_URL = "http://localhost:3000/api/zalo/ipn",
} = process.env;

/* ---------------------------- helpers ---------------------------- */
const hmacSHA256 = (key, data) =>
  crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");

// app_trans_id: YYMMDD_rand6
function makeAppTransId() {
  const d = new Date();
  const yymmdd =
    String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
  return `${yymmdd}_${rand}`;
}

function upstreamError(err) {
  const status = err.response?.status;
  const data = err.response?.data;
  const msg = err.message;
  console.error("⛔ Upstream error:", { status, data, msg });
  return {
    success: false,
    message: data?.return_message || data?.message || msg,
    upstream: data,
    status,
  };
}

/* ============================ BINDING ============================ */
/**
 * Create binding (Auto-Debit / Tokenization)
 * Body:
 *  - userId (identifier)     : string
 *  - maxAmount               : number (0 = no limit, hoặc set ngưỡng)
 *  - bindingType(optional)   : "WALLET"|"CARD" (default: WALLET)
 *  - redirectDeepLink(opt)   : string (deep link app mobile)
 */
exports.createBinding = async (req, res) => {
  try {
    const {
      userId = "user_demo_001",
      maxAmount = 0,
      bindingType = "WALLET",
      redirectDeepLink,
    } = req.body || {};

    const app_trans_id = makeAppTransId();
    const req_date = Date.now();
    const identifier = String(userId);

    // binding_data là JSON string; có thể nhúng redirect cho web & deep-link cho mobile
    const bindingDataObj = {
      redirect_url: ZP_REDIRECT_URL,
      ...(redirectDeepLink ? { redirect_deep_link: redirectDeepLink } : {}),
    };
    const binding_data = JSON.stringify(bindingDataObj);

    // ⚠️ MAC input cho bind (theo spec tokenization):
    // mac_input = app_id | app_trans_id | binding_data | binding_type | identifier | max_amount | req_date
    const macInput = [
      ZP_APP_ID,
      app_trans_id,
      binding_data,
      bindingType,
      identifier,
      Number(maxAmount),
      req_date,
    ].join("|");
    const mac = hmacSHA256(ZP_KEY1, macInput);

    const payload = {
      app_id: Number(ZP_APP_ID),
      app_trans_id,
      binding_type: bindingType, // "WALLET" | "CARD"
      identifier,
      binding_data, // JSON string
      max_amount: Number(maxAmount),
      req_date,
      // Có thể để ở binding_data, nhưng nhiều merchant vẫn truyền song song:
      redirect_url: ZP_REDIRECT_URL,
      callback_url: ZP_CALLBACK_URL,
      mac,
    };

    const { data } = await axios.post(`${ZP_API_BASE}/v2/agreement/bind`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 20000,
    });

    console.log("🔗 [Binding RES]", data);
    return res.json({
      success: true,
      binding_url: data.binding_url || data.return_url || null,
      app_trans_id,
      raw: data,
    });
  } catch (err) {
    return res.status(500).json(upstreamError(err));
  }
};

/* ========================= PAY BY TOKEN ========================= */
/**
 * Pay by token
 * Body:
 *  - identifier : string (userId phía bạn)
 *  - zp_trans_token : string (từ bước create order agreement pay, nếu có)
 *  - pay_token : string (token công khai sau khi bind)
 *  - amount : number
 *  - description? : string
 *
 * ⚠️ MAC (theo spec):
 *  mac_input = app_id | identifier | zp_trans_token | pay_token | req_date
 *  (một số flow chỉ dùng pay_token + identifier; tuỳ tài liệu bạn nhận từ ZP)
 */
// controllers/zalo.controller.js (chỉ thay exports.payByToken)
exports.payByToken = async (req, res) => {
  try {
    const { identifier, pay_token, amount, description } = req.body || {};
    if (!identifier || !pay_token || !amount) {
      return res.status(400).json({ success: false, message: "identifier, pay_token, amount are required" });
    }

    const app_id = Number(process.env.ZP_APP_ID);
    const key1 = process.env.ZP_KEY1;
    const API_BASE = process.env.ZP_API_BASE || "https://sb-openapi.zalopay.vn";

    // 1) CREATE ORDER -> lấy zp_trans_token
    const app_trans_id = makeAppTransId();           // yyMMdd_rand6
    const app_time = Date.now();
    const embed_data = "{}";
    const item = "[]";
    const app_user = identifier;
    const createMacInput = `${app_id}|${app_trans_id}|${app_user}|${amount}|${app_time}|${embed_data}|${item}`;
    const createMac = hmacSHA256(key1, createMacInput);

    const createPayload = {
      app_id,
      app_user,
      app_time,
      amount: Number(amount),
      app_trans_id,
      embed_data,
      item,
      description: description || `Recurring charge for ${identifier}`,
      callback_url: process.env.ZP_CALLBACK_URL || "",
      mac: createMac
    };

    const createRes = await axios.post(`${API_BASE}/v2/create`, createPayload, {
      headers: { "Content-Type": "application/json" }, timeout: 15000
    });
    if (createRes.data?.return_code !== 1) {
      return res.status(400).json({ success: false, step: "create", raw: createRes.data });
    }
    const zp_trans_token = createRes.data.zp_trans_token; // ← token đơn hàng dùng cho agreement pay
    // 2) AGREEMENT PAY
    const req_date = Date.now();
    const payMacInput = `${app_id}|${identifier}|${zp_trans_token}|${pay_token}|${req_date}`;
    const mac = hmacSHA256(key1, payMacInput);

    const payPayload = {
      app_id,
      identifier,
      zp_trans_token,
      pay_token,
      req_date,
      mac
    };

    const payRes = await axios.post(`${API_BASE}/v2/agreement/pay`, payPayload, {
      headers: { "Content-Type": "application/json" }, timeout: 15000
    });

    return res.json({ success: payRes.data?.return_code === 1, raw: { create: createRes.data, pay: payRes.data } });
  } catch (e) {
    console.error("❌ payByToken fatal:", e.response?.data || e.message);
    return res.status(500).json({ success: false, message: e.message, upstream: e.response?.data });
  }
};


/* ========================== QUERY TOKEN ========================== */
/**
 * Query binding / token
 * Body:
 *  - app_trans_id? : string (nếu bạn muốn query theo app_trans_id)
 *  - req_date?     : number (ms) - mặc định now()
 *
 * ⚠️ Spec (một biến thể):
 *  mac_input = app_id | app_trans_id | req_date
 */
exports.queryToken = async (req, res) => {
  try {
    const app_trans_id = req.body?.app_trans_id || makeAppTransId();
    const req_date = req.body?.req_date || Date.now();

    const macInput = [ZP_APP_ID, app_trans_id, req_date].join("|");
    const mac = hmacSHA256(ZP_KEY1, macInput);

    const payload = {
      app_id: Number(ZP_APP_ID),
      app_trans_id,
      req_date,
      mac,
    };

    const { data } = await axios.post(`${ZP_API_BASE}/v2/agreement/query`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    console.log("🔎 [QueryToken RES]", data);
    return res.json({ success: true, raw: data });
  } catch (err) {
    return res.status(500).json(upstreamError(err));
  }
};

/* ============================= UNBIND ============================ */
/**
 * Unbind
 * Body:
 *  - identifier : string
 *  - binding_id : string
 *
 * ⚠️ Spec (biến thể phổ biến):
 *  mac_input = app_id | app_trans_id | binding_id | req_date
 *  (một số tài liệu cũ yêu cầu `identifier` trong payload – mình vẫn truyền kèm)
 */
exports.unbind = async (req, res) => {
  try {
    const { identifier, binding_id } = req.body || {};
    if (!identifier || !binding_id) {
      return res
        .status(400)
        .json({ success: false, message: "identifier & binding_id are required" });
    }

    const app_trans_id = makeAppTransId();
    const req_date = Date.now();

    const macInput = [ZP_APP_ID, app_trans_id, binding_id, req_date].join("|");
    const mac = hmacSHA256(ZP_KEY1, macInput);

    const payload = {
      app_id: Number(ZP_APP_ID),
      app_trans_id,
      identifier,
      binding_id,
      req_date,
      mac,
    };

    const { data } = await axios.post(`${ZP_API_BASE}/v2/agreement/unbind`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    console.log("🗑️  [Unbind RES]", data);
    return res.json({ success: true, raw: data });
  } catch (err) {
    return res.status(500).json(upstreamError(err));
  }
};

/* ============================== IPN ============================== */
/**
 * Webhook/IPN từ ZaloPay:
 *  - Verify bằng KEY2 (callback data)
 *  - Tuỳ API, mac_input khác nhau. Ở đây demo: JSON.stringify(body.data) với thứ tự field chuẩn,
 *    hoặc chuỗi đã quy định trong tài liệu sản phẩm của bạn.
 */
exports.ipn = async (req, res) => {
  try {
    const body = req.body || {};
    const recv_mac = body.mac || "";

    // Ví dụ kiểm tra mac đơn giản: stringify clone (loại mac)
    const clone = { ...body };
    delete clone.mac;
    const macInput = JSON.stringify(clone);
    const mac = hmacSHA256(ZP_KEY2, macInput);

    if (mac !== recv_mac) {
      console.log("⚠️  IPN invalid MAC");
      return res.json({ return_code: -1, return_message: "invalid mac" });
    }

    console.log("🔔 [IPN OK]", body);
    // TODO: cập nhật DB theo body.status, amount, trans_id ...
    return res.json({ return_code: 1, return_message: "ok" });
  } catch (err) {
    console.error("❌ IPN Error:", err.message);
    return res.json({ return_code: 0, return_message: "error" }); // cho phép ZP retry
  }
};

/* ============================ RETURN PAGE ============================ */
exports.bindReturn = async (req, res) => {
  console.log("✅ [BIND RETURN] query:", req.query);
  res.send(
    `<h3>Binding Return</h3><pre>${JSON.stringify(req.query, null, 2)}</pre>`
  );
};
