const express = require("express");
const router = express.Router();

const googleMaps = require("../controllers/googleMaps.controller");

/**
 * @swagger
 * tags:
 *   - name: GoogleMaps
 *     description: Google Maps Search & Detail APIs
 */

/**
 * @swagger
 * /api/maps/search:
 *   get:
 *     summary: Tìm kiếm địa điểm (Google Places Autocomplete)
 *     tags: [GoogleMaps]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm
 *     responses:
 *       200:
 *         description: Danh sách gợi ý địa điểm
 *       400:
 *         description: Lỗi request
 */
router.get("/search", googleMaps.search);


/**
 * @swagger
 * /api/maps/detail:
 *   get:
 *     summary: Lấy chi tiết tọa độ từ place_id
 *     tags: [GoogleMaps]
 *     parameters:
 *       - in: query
 *         name: place_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Google Place ID
 *     responses:
 *       200:
 *         description: Thông tin tọa độ (lat, lng, address)
 *       400:
 *         description: Lỗi request
 */
router.get("/detail", googleMaps.detail);

module.exports = router;
