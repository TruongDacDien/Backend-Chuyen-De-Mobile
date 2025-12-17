const { body, validationResult } = require("express-validator");
const MailFacade = require("../services/MailFacade");

// ✅ Validator mới: KHÔNG yêu cầu templateKey/params, yêu cầu html hoặc text
exports.bulkValidators = [
  body("to").isArray({ min: 1 }).withMessage("to phải là mảng email"),
  body("to.*").isEmail().withMessage("Email không hợp lệ"),
  body("subject").isString().notEmpty().withMessage("subject bắt buộc"),
  body("html").optional().isString(),
  body("text").optional().isString(),
  body().custom(b => !!b.html || !!b.text).withMessage("Cần ít nhất html hoặc text"),
  body("cc").optional().isArray(),
  body("bcc").optional().isArray(),
];

exports.sendBulk = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { to, cc = [], bcc = [], subject, html, text } = req.body;

  try {
    const result = await MailFacade.sendMail({
      toList: to,
      subject,
      html,
      text,
      cc,
      bcc
    });
    return res.json({ success: result.fail === 0, ...result });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
