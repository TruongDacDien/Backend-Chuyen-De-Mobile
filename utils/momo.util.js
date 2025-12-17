const crypto = require("crypto");

exports.hmacSHA256 = (data, secret) =>
  crypto.createHmac("sha256", secret).update(data).digest("hex");

exports.buildCreateSignatureStr = (p) =>
  `accessKey=${p.accessKey}&amount=${p.amount}&extraData=${p.extraData}&ipnUrl=${p.ipnUrl}&orderId=${p.orderId}&orderInfo=${p.orderInfo}&partnerCode=${p.partnerCode}&redirectUrl=${p.redirectUrl}&requestId=${p.requestId}&requestType=${p.requestType}`;

exports.buildIpnSignatureStr = (b) =>
  `accessKey=${b.accessKey}&amount=${b.amount}&extraData=${b.extraData}&message=${b.message}&orderId=${b.orderId}&orderInfo=${b.orderInfo}&orderType=${b.orderType}&partnerCode=${b.partnerCode}&payType=${b.payType}&requestId=${b.requestId}&responseTime=${b.responseTime}&resultCode=${b.resultCode}&transId=${b.transId}`;
