// utils/response.js
function ok(res, data = {}, message) {
  return res.json({
    success: true,
    error: null,
    ...(message ? { message } : {}),
    data,
  });
}

function err(res, status = 400, message = "Bad request") {
  return res.status(status).json({
    success: false,
    error: message,
  });
}

module.exports = { ok, err };
