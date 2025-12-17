// @ts-nocheck
require("dotenv").config();

const axiosModule = require("axios");
/** @type {import('axios').AxiosStatic} */
const axios = axiosModule.default ? axiosModule.default : axiosModule;

module.exports = {
  /* ====================== AUTOCOMPLETE SEARCH ====================== */
  searchPlace: async (input) => {
    const url = "https://maps.googleapis.com/maps/api/place/autocomplete/json";

    const { data } = await axios.request({
      method: "get",
      url,
      params: {
        input,
        key: process.env.GOOGLE_MAPS_API_KEY,
        language: "vi",
        components: "country:vn",
      },
      timeout: 10000,
      transitional: { clarifyTimeoutError: true },
    });

    return data;
  },

  /* ====================== PLACE DETAIL → LẤY TỌA ĐỘ ====================== */
  getPlaceDetail: async (place_id) => {
    const url = "https://maps.googleapis.com/maps/api/place/details/json";

    const { data } = await axios.request({
      method: "get",
      url,
      params: {
        place_id,
        key: process.env.GOOGLE_MAPS_API_KEY,
        language: "vi",
      },
      timeout: 10000,
      transitional: { clarifyTimeoutError: true },
    });

    return data;
  },
};
