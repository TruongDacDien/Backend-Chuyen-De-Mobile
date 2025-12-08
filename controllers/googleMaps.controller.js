const { ok, err } = require("../utils/response");
const mapService = require("../services/googleMaps");

module.exports = {
  // ================= SEARCH LOCATION =================
  search: async (req, res) => {
    try {
      const q = req.query.q;
      if (!q) return err(res, 400, "Thiếu tham số q");

      const data = await mapService.searchPlace(q);

      return ok(res, {
        predictions: data.predictions || [],
      });
    } catch (e) {
      console.error("Google search error:", e);
      return err(res, 500, "Không thể tìm kiếm vị trí");
    }
  },

  // ================= GET PLACE DETAIL =================
  detail: async (req, res) => {
    try {
      const place_id = req.query.place_id;
      if (!place_id) return err(res, 400, "Thiếu place_id");

      const data = await mapService.getPlaceDetail(place_id);

      const loc = data?.result?.geometry?.location;
      if (!loc) return err(res, 404, "Không tìm thấy tọa độ");

      return ok(res, {
        lat: loc.lat,
        lng: loc.lng,
        address: data?.result?.formatted_address || "",
      });
    } catch (e) {
      console.error("Google detail error:", e);
      return err(res, 500, "Không thể lấy chi tiết vị trí");
    }
  },
};
