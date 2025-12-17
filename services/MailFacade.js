require("dotenv").config();
const nodemailer = require("nodemailer");

class MailFacade {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
    });

    this.from = `"${process.env.MAIL_FROM_NAME || "MyApp"}" <${process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER}>`;
  }

  /**
   * Gửi mail đơn giản KHÔNG template
   * @param {Object} input
   *  - toList: string[]   danh sách email (bắt buộc)
   *  - subject: string    tiêu đề (bắt buộc)
   *  - html?: string      nội dung HTML (ít nhất phải có html hoặc text)
   *  - text?: string      nội dung text thuần
   *  - cc?: string[]      tùy chọn
   *  - bcc?: string[]     tùy chọn
   */
  async sendMail({ toList, subject, html, text, cc = [], bcc = [] }) {
    if (!Array.isArray(toList) || toList.length === 0) throw new Error("toList rỗng");
    if (!subject) throw new Error("subject rỗng");
    if (!html && !text) throw new Error("cần ít nhất html hoặc text");

    // gửi từng người để tách lỗi và không lộ danh sách
    const tasks = toList.map(to =>
      this.transporter.sendMail({
        from: this.from,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject,
        text: text || "",
        html: html || undefined
      })
    );

    const results = await Promise.allSettled(tasks);
    const summary = { total: results.length, ok: 0, fail: 0, detail: [] };
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        summary.ok++;
        summary.detail.push({ to: toList[i], ok: true, id: r.value.messageId });
      } else {
        summary.fail++;
        summary.detail.push({ to: toList[i], ok: false, error: r.reason?.message });
      }
    });

    return summary;
  }
}

module.exports = new MailFacade();
