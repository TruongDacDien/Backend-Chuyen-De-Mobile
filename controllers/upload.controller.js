require("dotenv").config();
const { v2: cloudinary } = require("cloudinary");
const multer = require("multer");

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer: nhận file vào RAM rồi stream lên Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Helper: URL -> public_id (bỏ v12345/ và extension)
function publicIdFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/upload/");
    if (parts.length < 2) return null;
    let tail = parts[1];                 // v1700.../folder/name.ext
    tail = tail.replace(/^v\d+\//, "");  // -> folder/name.ext
    const dot = tail.lastIndexOf(".");
    return dot !== -1 ? tail.slice(0, dot) : tail; // -> folder/name
  } catch {
    return null;
  }
}

const UploadController = {
  // POST /api/upload  (multipart/form-data; field: file; optional: folder)
  uploadSingle: [
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, message: "Thiếu file ở field 'file' (multipart/form-data)" });
        }
        const folder = req.body.folder || "uploads";

        // Stream buffer -> Cloudinary (resource_type: auto để nhận ảnh/video/pdf…)
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "auto", overwrite: false },
            (err, out) => (err ? reject(err) : resolve(out))
          );
          stream.end(req.file.buffer);
        });

        return res.json({
          success: true,
          url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type,
          bytes: result.bytes,
          format: result.format,
          width: result.width,
          height: result.height
        });
      } catch (e) {
        console.error("Upload error:", e);
        return res.status(500).json({ success: false, message: e.message });
      }
    }
  ],

  // DELETE /api/upload?url=<cloudinary_url>&type=image|video|raw
  deleteByUrl: async (req, res) => {
    try {
      const { url, type } = req.query;
      if (!url) return res.status(400).json({ success: false, message: "url is required" });

      const public_id = publicIdFromUrl(String(url));
      if (!public_id) return res.status(400).json({ success: false, message: "Invalid Cloudinary URL" });

      const resource_type = ["image","video","raw"].includes(String(type)) ? String(type) : "image";
      const result = await cloudinary.uploader.destroy(public_id, { resource_type });

      if (result.result === "not found") {
        return res.status(404).json({ success: false, message: "Asset not found", public_id });
      }
      return res.json({ success: true, public_id, resource_type, result: result.result });
    } catch (e) {
      console.error("Delete error:", e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }
};

module.exports = UploadController;