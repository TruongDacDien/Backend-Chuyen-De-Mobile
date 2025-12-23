const mongoose = require("mongoose");
const admin = require("../services/notification/firebase");
const User = require("../models/user.model");

/**
 * Push notification cho nhiều user
 */
async function pushToUsers({
  userIds = [],
  title,
  body,
  type = "system",
  data = {},
}) {
  console.log("🚀 [PUSH] Start pushToUsers");
  console.log("👉 Payload:", { userIds, title, body, type, data });

  if (!userIds.length) {
    console.log("⚠️ [PUSH] No userIds provided → abort");
    return;
  }

  const objectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));
  console.log("🔎 [PUSH] Mongo ObjectIds:", objectIds);

  /* ======================================================
     1️⃣ LƯU NOTIFICATION VÀO USER
  ====================================================== */
  const notification = {
    title,
    body,
    type,
    data,
    created_at: new Date(),
    is_read: false,
  };

  const updateResult = await User.updateMany(
    { _id: { $in: objectIds } },
    {
      $push: {
        notifications: {
          $each: [notification],
          $slice: -100,
        },
      },
    }
  );

  console.log("💾 [PUSH] Save notification result:", {
    matched: updateResult.matchedCount,
    modified: updateResult.modifiedCount,
  });

  /* ======================================================
     2️⃣ LẤY DEVICE TOKEN
  ====================================================== */
  const users = await User.find({ _id: { $in: objectIds } })
    .select("devices email")
    .lean();

  console.log(`📱 [PUSH] Found ${users.length} users`);

  const tokens = [];
  const tokenMap = []; // debug xem token thuộc user nào

  users.forEach((user) => {
    console.log(
      `👤 [PUSH] User ${user.email || user._id} devices:`,
      user.devices?.length || 0
    );

    user.devices
      ?.filter((d) => d.is_active && d.fcm_token)
      .forEach((d) => {
        tokens.push(d.fcm_token);
        tokenMap.push({
          userId: user._id,
          device_id: d.device_id,
          fcm_token: d.fcm_token,
        });
      });
  });

  console.log("📦 [PUSH] Valid FCM tokens:", tokens.length);
  console.log("🧩 [PUSH] Token map:", tokenMap);

  if (!tokens.length) {
    console.log("⚠️ [PUSH] No active tokens → skip FCM");
    return;
  }

  /* ======================================================
     3️⃣ CHUẨN HÓA DATA
  ====================================================== */
  const fcmData = Object.entries({ type, ...data }).reduce(
    (acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    },
    {}
  );

  console.log("📨 [PUSH] FCM data payload:", fcmData);

  /* ======================================================
     4️⃣ GỬI FCM
  ====================================================== */
  console.log("🚀 [PUSH] Sending FCM multicast...");

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: fcmData,
  });

  console.log("📬 [PUSH] FCM result:", {
    success: res.successCount,
    failure: res.failureCount,
  });

  /* ======================================================
     5️⃣ LOG ERROR TOKEN (RẤT QUAN TRỌNG)
  ====================================================== */
  res.responses.forEach((r, i) => {
    if (!r.success) {
      console.log("❌ [PUSH] Token failed:", {
        token: tokens[i],
        error: r.error?.message,
        code: r.error?.code,
      });
    }
  });

  console.log("✅ [PUSH] Done pushToUsers");

  return {
    success: res.successCount,
    failed: res.failureCount,
  };
}

module.exports = {
  pushToUsers,
};
