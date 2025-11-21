const router = require("express").Router();
const UploadController = require("../controllers/upload.controller");

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: Upload file lên Cloudinary (upload_stream) & xóa bằng URL
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload 1 file (multipart/form-data, field "file")
 *     tags: [Upload]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               folder:
 *                 type: string
 *                 example: "uploads"
 *     responses:
 *       200:
 *         description: Uploaded
 *       400:
 *         description: No file
 *       500:
 *         description: Error
 */
router.post("/", UploadController.uploadSingle);

/**
 * @swagger
 * /api/upload:
 *   delete:
 *     summary: Xóa file theo URL Cloudinary
 *     tags: [Upload]
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema: { type: string }
 *         example: "https://res.cloudinary.com/<cloud>/image/upload/v1700000000/uploads/abc123.png"
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [image, video, raw]
 *         example: "image"
 *     responses:
 *       200:
 *         description: Deleted
 *       400:
 *         description: Invalid URL
 *       404:
 *         description: Not found
 */
router.delete("/", UploadController.deleteByUrl);

module.exports = router;
