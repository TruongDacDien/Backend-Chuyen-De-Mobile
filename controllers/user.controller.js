// controllers/user.controller.js
const User = require("../models/user.model");
const { ok, err } = require("../utils/response");

module.exports = {
  // ===================== GET ALL USERS =====================
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find({ record_status: 1 })
        .select("-password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status",
          populate: {
            path: "subscription_plan",
            model: "SubscriptionPlan",
          },
        });

      return ok(res, { users });
    } catch (e) {
      console.error("getAllUsers error:", e);
      return err(res, 400, e?.message || "Get users failed");
    }
  },

  // ===================== GET USER BY ID =====================
  getUserById: async (req, res) => {
    try {
      const user = await User.findOne({
        _id: req.params.id,
        record_status: 1,
      })
        .select("-password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status",
          populate: {
            path: "subscription_plan",
            model: "SubscriptionPlan",
          },
        });

      if (!user) return err(res, 404, "User not found");

      const userObj = user.toObject();
      const company = userObj.company_id || null;

      return ok(res, {
        user: {
          ...userObj,
          subscription_plan: company?.subscription_plan || null,
          subscription_status: company?.subscription_status || "unactive",
        },
      });
    } catch (e) {
      console.error("getUserById error:", e);
      return err(res, 400, e?.message || "Get user failed");
    }
  },

  // ===================== GET ME (CURRENT USER) =====================
  getMe: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return err(res, 401, "Unauthorized");

      const user = await User.findOne({
        _id: userId,
        record_status: 1,
      })
        .select("-password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status",
          populate: {
            path: "subscription_plan",
            model: "SubscriptionPlan",
          },
        });

      if (!user) return err(res, 404, "User not found");

      const userObj = user.toObject();
      const company = userObj.company_id || null;

      return ok(res, {
        user: {
          ...userObj,
          subscription_plan: company?.subscription_plan || null,
          subscription_status: company?.subscription_status || "unactive",
        },
      });
    } catch (e) {
      console.error("getMe error:", e);
      return err(res, 400, e?.message || "Get me failed");
    }
  },

  // ===================== UPDATE USER =====================
  updateUser: async (req, res) => {
    try {
      const updated = await User.findOneAndUpdate(
        { _id: req.params.id, record_status: 1 },
        req.body,
        { new: true }
      )
        .select("-password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status",
          populate: {
            path: "subscription_plan",
            model: "SubscriptionPlan",
          },
        });

      if (!updated) return err(res, 404, "User not found");

      const userObj = updated.toObject();
      const company = userObj.company_id || null;

      return ok(
        res,
        {
          user: {
            ...userObj,
            subscription_plan: company?.subscription_plan || null,
            subscription_status: company?.subscription_status || "unactive",
          },
        },
        "Update user success"
      );
    } catch (e) {
      console.error("updateUser error:", e);
      return err(res, 400, e?.message || "Update user failed");
    }
  },

  // ===================== DELETE USER =====================
  deleteUser: async (req, res) => {
    try {
      const deleted = await User.findOneAndUpdate(
        { _id: req.params.id, record_status: 1 },
        { record_status: 0 },
        { new: true }
      ).select("-password");

      if (!deleted) return err(res, 404, "User not found");

      return ok(res, { user: deleted }, "Deleted");
    } catch (e) {
      console.error("deleteUser error:", e);
      return err(res, 400, e?.message || "Delete user failed");
    }
  },
};
