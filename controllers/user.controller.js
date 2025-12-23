const User = require("../models/user.model");
const { ok, err } = require("../utils/response");
const crypto = require("crypto");
const mailer = require("../services/MailFacade"); // chỉnh path theo project của bạn
const Company = require("../models/company.model");
const Department = require("../models/department.model");
const pad2 = (n) => String(n).padStart(2, "0");
const toDateUTC = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const { pushToUsers } = require("../utils/pushNotification.util");
const dayNameFromYMD = (ymd) => {
  // ymd: "YYYY-MM-DD"
  const [Y, M, D] = ymd.split("-").map(Number);
  const dt = toDateUTC(Y, M, D);
  const dow = dt.getUTCDay(); // 0 Sun .. 6 Sat
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dow];
};

const timeToMinutes = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const ceilToUnit = (minutes, unit) => {
  if (!unit || unit <= 0) return minutes;
  return Math.ceil(minutes / unit) * unit;
};

const floorToUnit = (minutes, unit) => {
  if (!unit || unit <= 0) return minutes;
  return Math.floor(minutes / unit) * unit;
};

const isDateInRangeInclusive = (d, start, end) => {
  // all are "YYYY-MM-DD" ISO -> string compare works
  return start <= d && d <= end;
};

const buildMonthKey = (ymd) => ymd.slice(0, 7); // "YYYY-MM"
const buildYMD = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

/* =========================
   Core calculator per month
========================= */
function calcMonth({ user, company, year, month }) {
  const cfg = company?.attendance_config || {};
  const wh = cfg.working_hours || {};
  const lateRule = cfg.late_rule || {};
  const earlyRule = cfg.early_leave_rule || {};
  const otPolicy = cfg.overtime_policy || {};
  const salaryPolicy = cfg.salary_policy || {};

  const workingDaysCfg = wh.working_days || ["mon", "tue", "wed", "thu", "fri", "sat"];
  const holidays = wh.company_holidays || [];

  const startMin = timeToMinutes(wh.start_time || "08:00");
  const endMin = timeToMinutes(wh.end_time || "17:00");
  const breakStart = timeToMinutes(wh.break_start || "12:00");
  const breakEnd = timeToMinutes(wh.break_end || "13:00");
  const breakMinutes = Math.max(0, (breakEnd ?? 0) - (breakStart ?? 0));

  const allowLate = Number(lateRule.allow_minutes || "5");
  const lateDeductPerMinute = !!lateRule.deduct_per_minute;
  const lateUnit = Number(lateRule.unit_minutes || "15");
  const maxLateAsAbsent = Number(lateRule.max_late_as_absent_minutes || "240");

  const earlyDeductPerMinute = !!earlyRule.deduct_per_minute;
  const earlyUnit = Number(earlyRule.unit_minutes || "15");
  const maxEarlyAsAbsent = Number(earlyRule.max_early_as_absent_minutes || "240");

  const minOt = Number(otPolicy.min_ot_minutes || "30");
  const otRoundUnit = Number(otPolicy.round_to_minutes || "30");
  const rateWeekday = Number(otPolicy.weekday_rate || "1.5");
  const rateWeekend = Number(otPolicy.weekend_rate || "2.0");
  const rateHoliday = Number(otPolicy.holiday_rate || "3.0");

  const workdaysPerMonth = Number(salaryPolicy.workdays_per_month || "26");
  const hoursPerDay = Number(salaryPolicy.hours_per_day || "8");
  const minutesPerDay = hoursPerDay * 60;

  const baseSalary = Number(user.salary || 0);
  const salaryPerDay = workdaysPerMonth > 0 ? baseSalary / workdaysPerMonth : 0;
  const salaryPerMinute = minutesPerDay > 0 ? salaryPerDay / minutesPerDay : 0;

  // Index data for fast lookup
  const logsByDate = new Map();
  (user.attendance_logs || []).forEach((l) => {
    if (l?.date) logsByDate.set(l.date, l);
  });

  const complaintsByKey = new Map();
  (user.checkin_complaints || []).forEach((c) => {
    if (!c?.date || !c?.action) return;
    if (c.status !== "approved") return;
    complaintsByKey.set(`${c.date}_${c.action}`, c);
  });

  const approvedLeaves = (user.leave_requests || []).filter((lr) => lr?.status === "approved");

  const otByDate = new Map();
  (user.overtime_logs || []).forEach((o) => {
    if (!o?.date || o.status !== "approved") return;
    const prev = otByDate.get(o.date) || [];
    prev.push(o);
    otByDate.set(o.date, prev);
  });

  // Iterate days in month
  const dim = daysInMonth(year, month);
  const days = [];

  // Monthly totals
  let workingDays = 0;
  let unpaidDays = 0;

  let lateMinutesTotal = 0;
  let earlyMinutesTotal = 0;

  let otWeekdayMinutes = 0;
  let otWeekendMinutes = 0;
  let otHolidayMinutes = 0;

  let otPayTotal = 0;

  for (let d = 1; d <= dim; d++) {
    const ymd = buildYMD(year, month, d);
    const dayName = dayNameFromYMD(ymd);

    const isHoliday = holidays.includes(ymd);
    const isWorkingDay = workingDaysCfg.includes(dayName);
    const isOff = !isWorkingDay || isHoliday;

    // Leave cover? (full-day only)
    const leave = approvedLeaves.find((lr) =>
      lr?.start_date && lr?.end_date && isDateInRangeInclusive(ymd, lr.start_date, lr.end_date)
    );

    // Effective in/out with complaint override
    const log = logsByDate.get(ymd);
    const cinC = complaintsByKey.get(`${ymd}_check_in`);
    const coutC = complaintsByKey.get(`${ymd}_check_out`);

    const inTimeStr = cinC?.time ?? log?.check_in_time ?? null;
    const outTimeStr = coutC?.time ?? log?.check_out_time ?? null;

    const inMin = timeToMinutes(inTimeStr);
    const outMin = timeToMinutes(outTimeStr);
    const hasPunchPair = inMin != null && outMin != null;

    // OT minutes for the day (approved)
    const otLogs = otByDate.get(ymd) || [];
    let otMinutesRaw = 0;
    for (const o of otLogs) {
      const h = Number(o.hours || 0);
      otMinutesRaw += Math.max(0, h * 60);
    }
    let otMinutes = 0;
    if (otMinutesRaw >= minOt) {
      // OT rounding: floor to round_to_minutes
      otMinutes = floorToUnit(otMinutesRaw, otRoundUnit);
    }

    // classify OT rate and totals
    let otRate = rateWeekday;
    if (isHoliday) otRate = rateHoliday;
    else if (!isWorkingDay) otRate = rateWeekend;

    const otPay = otMinutes * salaryPerMinute * otRate;
    otPayTotal += otPay;

    if (otMinutes > 0) {
      if (isHoliday) otHolidayMinutes += otMinutes;
      else if (!isWorkingDay) otWeekendMinutes += otMinutes;
      else otWeekdayMinutes += otMinutes;
    }

    // Default day result
    let type = "off"; // off | holiday | work | paid_leave | unpaid_leave | absent
    let lateMinutes = 0;
    let earlyMinutes = 0;
    let penaltyMinutes = 0;
    let isOnlyOt = false;

    if (isHoliday) type = "holiday";
    else if (isOff) type = "off";

    // For OFF/Holiday: do not calculate late/early; only OT is relevant
    if (!isOff) {
      // Standard working day
      if (leave) {
        if (leave.type === "unpaid") {
          type = "unpaid_leave";
          unpaidDays += 1;
        } else {
          type = "paid_leave";
          workingDays += 1;
        }
      } else {
        // No leave, need attendance
        if (!hasPunchPair) {
          type = "absent";
          unpaidDays += 1;
        } else {
          type = "work";
          workingDays += 1;

          // late/early minutes
          lateMinutes = Math.max(0, inMin - startMin);
          if (lateMinutes <= allowLate) lateMinutes = 0;

          earlyMinutes = Math.max(0, endMin - outMin);

          // if too late/too early => absent
          if (lateMinutes >= maxLateAsAbsent || earlyMinutes >= maxEarlyAsAbsent) {
            type = "absent";
            // revert counted working day -> unpaid day
            workingDays -= 1;
            unpaidDays += 1;

            lateMinutes = 0;
            earlyMinutes = 0;
            penaltyMinutes = 0;
          } else {
            // penalty rounding
            const latePenalty = lateDeductPerMinute
              ? lateMinutes
              : ceilToUnit(lateMinutes, lateUnit);

            const earlyPenalty = earlyDeductPerMinute
              ? earlyMinutes
              : ceilToUnit(earlyMinutes, earlyUnit);

            penaltyMinutes = latePenalty + earlyPenalty;
            lateMinutesTotal += latePenalty;
            earlyMinutesTotal += earlyPenalty;
          }
        }
      }
    }

    // isOnlyOt: "chỉ có OT không đi làm"
    // => có OT minutes >0 và không có punch pair và không phải leave
    if (otMinutes > 0 && !hasPunchPair && !leave) {
      isOnlyOt = true;
    }

    days.push({
      date: ymd,
      type,
      check_in: inTimeStr,
      check_out: outTimeStr,
      late_minutes: lateMinutes,
      early_minutes: earlyMinutes,
      penalty_minutes: penaltyMinutes,
      ot_minutes: otMinutes,
      isOnlyOt,
    });
  }

  // Monthly deductions
  const deductionUnpaid = unpaidDays * salaryPerDay;
  const deductionMinutes = (lateMinutesTotal + earlyMinutesTotal) * salaryPerMinute;

  const netSalary = baseSalary - deductionUnpaid - deductionMinutes + otPayTotal;

  return {
    year,
    month,
    workingDays,
    unpaidDays,
    lateMinutes: lateMinutesTotal,
    earlyMinutes: earlyMinutesTotal,
    penaltyMinutes: lateMinutesTotal + earlyMinutesTotal,

    otWeekdayMinutes,
    otWeekendMinutes,
    otHolidayMinutes,

    grossSalary: baseSalary,
    netSalary: Math.round(netSalary), // tuỳ bạn: round / floor / keep decimal
    days,
  };
}

/* =========================
   Build list of months exist
========================= */
function extractMonthKeys(user) {
  const keys = new Set();

  (user.attendance_logs || []).forEach((l) => l?.date && keys.add(buildMonthKey(l.date)));
  (user.checkin_complaints || []).forEach((c) => c?.date && keys.add(buildMonthKey(c.date)));
  (user.overtime_logs || []).forEach((o) => o?.date && keys.add(buildMonthKey(o.date)));
  (user.leave_requests || []).forEach((lr) => {
    if (lr?.start_date) keys.add(buildMonthKey(lr.start_date));
    if (lr?.end_date) keys.add(buildMonthKey(lr.end_date));
  });

  return Array.from(keys).sort((a, b) => (a < b ? 1 : -1)); // desc
}


module.exports = {
  // ===================== GET ALL USERS =====================

  getMyTimesheetMonthsSummary: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select(
        "salary company_id attendance_logs checkin_complaints leave_requests overtime_logs"
      ).lean();

      if (!user?.company_id) return res.status(400).json({ error: "User chưa thuộc công ty nào" });

      const company = await Company.findById(user.company_id).select("attendance_config").lean();
      if (!company) return res.status(404).json({ error: "Company không tồn tại" });

      const monthKeys = extractMonthKeys(user);

      const results = monthKeys.map((k) => {
        const [yStr, mStr] = k.split("-");
        const year = Number(yStr);
        const month = Number(mStr);
        const mData = calcMonth({ user, company, year, month });

        // trả đúng field bạn cần
        return {
          year: mData.year,
          month: mData.month,
          workingDays: mData.workingDays,
          unpaidDays: mData.unpaidDays,
          lateMinutes: mData.lateMinutes,
          earlyMinutes: mData.earlyMinutes,
          penaltyMinutes: mData.penaltyMinutes,
          otWeekdayMinutes: mData.otWeekdayMinutes,
          otWeekendMinutes: mData.otWeekendMinutes,
          otHolidayMinutes: mData.otHolidayMinutes,
          netSalary: mData.netSalary,
        };
      });

      return res.json(results);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // ✅ 2) Month detail for ME (days)
  getMyMonthTimesheetDetail: async (req, res) => {
    try {
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({ error: "year/month không hợp lệ" });
      }

      const user = await User.findById(req.user.id).select(
        "salary company_id attendance_logs checkin_complaints leave_requests overtime_logs"
      ).lean();

      if (!user?.company_id) return res.status(400).json({ error: "User chưa thuộc công ty nào" });

      const company = await Company.findById(user.company_id).select("attendance_config name").lean();
      if (!company) return res.status(404).json({ error: "Company không tồn tại" });

      const mData = calcMonth({ user, company, year, month });

      // Summary + days detail
      return res.json({
        summary: {
          year: mData.year,
          month: mData.month,
          workingDays: mData.workingDays,
          unpaidDays: mData.unpaidDays,
          lateMinutes: mData.lateMinutes,
          earlyMinutes: mData.earlyMinutes,
          penaltyMinutes: mData.penaltyMinutes,
          otWeekdayMinutes: mData.otWeekdayMinutes,
          otWeekendMinutes: mData.otWeekendMinutes,
          otHolidayMinutes: mData.otHolidayMinutes,
          netSalary: mData.netSalary,
        },
        days: mData.days.map((d) => ({
          date: d.date,
          check_in: d.check_in,
          type: d.type,
          check_out: d.check_out,
          late_minutes: d.late_minutes,
          early_minutes: d.early_minutes,
          ot_minutes: d.ot_minutes,
          isonlyot: d.isOnlyOt,
        })),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // (OPTION) Summary by userId
  getUserTimesheetMonthsSummary: async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select(
        "salary company_id attendance_logs checkin_complaints leave_requests overtime_logs"
      ).lean();

      if (!user?.company_id) return res.status(400).json({ error: "User chưa thuộc công ty nào" });

      const company = await Company.findById(user.company_id).select("attendance_config").lean();
      if (!company) return res.status(404).json({ error: "Company không tồn tại" });

      const monthKeys = extractMonthKeys(user);

      const results = monthKeys.map((k) => {
        const [yStr, mStr] = k.split("-");
        const year = Number(yStr);
        const month = Number(mStr);
        const mData = calcMonth({ user, company, year, month });

        return {
          year: mData.year,
          month: mData.month,
          workingDays: mData.workingDays,
          unpaidDays: mData.unpaidDays,
          lateMinutes: mData.lateMinutes,
          earlyMinutes: mData.earlyMinutes,
          penaltyMinutes: mData.penaltyMinutes,
          otWeekdayMinutes: mData.otWeekdayMinutes,
          otWeekendMinutes: mData.otWeekendMinutes,
          otHolidayMinutes: mData.otHolidayMinutes,
          netSalary: mData.netSalary,
        };
      });

      return res.json(results);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // (OPTION) Detail by userId
  getUserMonthTimesheetDetail: async (req, res) => {
    try {
      const { userId } = req.params;
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({ error: "year/month không hợp lệ" });
      }

      const user = await User.findById(userId).select(
        "salary company_id attendance_logs checkin_complaints leave_requests overtime_logs"
      ).lean();

      if (!user?.company_id) return res.status(400).json({ error: "User chưa thuộc công ty nào" });

      const company = await Company.findById(user.company_id).select("attendance_config name").lean();
      if (!company) return res.status(404).json({ error: "Company không tồn tại" });

      const mData = calcMonth({ user, company, year, month });

      return res.json({
        summary: {
          year: mData.year,
          month: mData.month,
          workingDays: mData.workingDays,
          unpaidDays: mData.unpaidDays,
          lateMinutes: mData.lateMinutes,
          earlyMinutes: mData.earlyMinutes,
          penaltyMinutes: mData.penaltyMinutes,
          otWeekdayMinutes: mData.otWeekdayMinutes,
          otWeekendMinutes: mData.otWeekendMinutes,
          otHolidayMinutes: mData.otHolidayMinutes,
          netSalary: mData.netSalary,
        },
        days: mData.days.map((d) => ({
          date: d.date,
          check_in: d.check_in,
          type: d.type,
          check_out: d.check_out,
          late_minutes: d.late_minutes,
          early_minutes: d.early_minutes,
          ot_minutes: d.ot_minutes,
          isonlyot: d.isOnlyOt,
        })),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

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

  getMyChatList: async (req, res) => {
    try {
      const userId = String(req.user.id);

      const me = await User.findById(userId)
        .populate({
          path: "private_chats.peer_id",
          select: "full_name avatar online job_title employee_code",
        })
        .select("private_chats department_id");

      if (!me) return err(res, 404, "User not found");

      /* =========================
         PRIVATE CHAT (USER ↔ USER)
      ========================= */
      const privateChats = me.private_chats.map((chat) => ({
        id: chat.peer_id?._id,
        type: "user",

        name: chat.peer_id?.full_name || "",
        avatar: chat.peer_id?.avatar || "",
        online: chat.peer_id?.online || false,

        job_title: chat.peer_id?.job_title || "",
        employee_code: chat.peer_id?.employee_code || "",

        last_message: chat.last_message || "",
        last_time: chat.last_time || null,
        unread_count: chat.unread_count || 0,
      }));

      /* =========================
         GROUP CHAT (DEPARTMENT)
      ========================= */
      const departments = await Department.find({
        _id: me.department_id,
      })
        .select("name department_code group_chats users")
        .lean();

      const groupChats = [];

      for (const dept of departments) {
        const total = dept.users.length;

        const onlineCount = await User.countDocuments({
          _id: { $in: dept.users },
          online: true,
        });

        for (const g of dept.group_chats) {
          // 🔥 TÍNH UNREAD GROUP
          const unreadCount = (g.messages || []).filter(
            (m) =>
              String(m.sender_id) !== userId &&
              !m.seen_by?.some((u) => String(u) === userId)
          ).length;

          groupChats.push({
            id: g._id,
            type: "group",

            // ✅ department info
            department_id: dept._id,
            department_name: dept.name,
            department_code: dept.department_code,

            title: g.title || dept.name,

            total_members: total,
            online_members: onlineCount,

            last_message: g.last_message || "",
            last_time: g.last_time || null,

            // ✅ QUAN TRỌNG
            unread_count: unreadCount,
          });
        }
      }

      return ok(res, [...privateChats, ...groupChats]);
    } catch (e) {
      console.error("getMyChatList error:", e);
      return err(res, 500, "Lỗi khi lấy danh sách chat");
    }
  },


  /**
   * Lấy chi tiết chat riêng giữa tôi và 1 user khác
   */
  getChatDetail: async (req, res) => {
    try {
      const { peerId } = req.params;

      const me = await User.findById(req.user.id)
        .populate({
          path: "private_chats.peer_id",
          select: "full_name avatar online role employee_code job_title",
        })
        .select("private_chats");

      if (!me) return err(res, 404, "User not found");

      let chat = me.private_chats.find(
        (c) => String(c.peer_id?._id) === String(peerId)
      );

      /* =========================
         CHƯA CÓ CHAT → TẠO MỚI
      ========================= */
      if (!chat) {
        const peer = await User.findById(peerId).select(
          "full_name avatar online role employee_code job_title"
        );
        if (!peer) return err(res, 404, "Peer not found");

        chat = {
          peer_id: peer._id,
          peer_name: peer.full_name,
          peer_avatar: peer.avatar,
          messages: [],
          unread_count: 0,
          last_message: "",
          last_time: null,
        };

        me.private_chats.push(chat);
        await me.save();

        return ok(res, {
          peer: {
            id: peer._id,
            full_name: peer.full_name,
            avatar: peer.avatar,
            online: peer.online,
            role: peer.role,
            employee_code: peer.employee_code,
            job_title: peer.job_title,
          },
          messages: [],
          unread_count: 0,
          last_message: "",
          last_time: null,
        });
      }

      /* =========================
         ĐÃ CÓ CHAT
      ========================= */
      const peer = chat.peer_id;

      return ok(res, {
        peer: {
          id: peer?._id,
          full_name: peer?.full_name,
          avatar: peer?.avatar,
          online: peer?.online,
          role: peer?.role,
          employee_code: peer?.employee_code,
          job_title: peer?.job_title,
        },
        messages: chat.messages || [],
        unread_count: chat.unread_count || 0,
        last_message: chat.last_message || "",
        last_time: chat.last_time || null,
      });
    } catch (e) {
      console.error("getChatDetail error:", e);
      return err(res, 500, "Lỗi khi lấy chi tiết chat");
    }
  },


  /**
   * Lấy chi tiết chat nhóm
   */
  getGroupChatDetail: async (req, res) => {
    try {
      const { groupId } = req.params; // ⚠️ groupId = departmentId

      const department = await Department.findById(groupId)
        .populate('users', 'full_name avatar online')
        .lean();

      if (!department) {
        return err(res, 404, 'Department not found');
      }

      const group = department.group_chats?.[0];

      if (!group) {
        return err(res, 404, 'Group chat not found');
      }

      const members = Array.isArray(department.users)
        ? department.users.map(u => ({
          id: u._id,
          name: u.full_name,
          avatar: u.avatar || '',
          online: !!u.online,
        }))
        : [];

      return ok(res, {
        department: {
          id: department._id,
          name: department.name,
          department_code: department.department_code,
        },
        group: {
          id: group._id,
          last_message: group.last_message || '',
          last_time: group.last_time || null,
          messages: group.messages || [],
        },
        members,
      });
    } catch (e) {
      console.error('getGroupChatDetail error:', e);
      return err(res, 500, 'Lỗi khi lấy chi tiết group');
    }
  },


  /**
   * Gửi tin nhắn (user hoặc group)
   */
  sendMessage: async (req, res) => {
    try {
      const { type, id, text = "", image_urls = [] } = req.body;
      const senderId = req.user.id;
      const now = new Date();

      // message dùng chung
      const messageForMe = {
        from_me: true,
        text,
        image_urls,
        created_at: now,
        is_seen: false,
      };

      const messageForPeer = {
        from_me: false,
        text,
        image_urls,
        created_at: now,
        is_seen: false,
      };

      const lastMessage =
        text || (image_urls.length ? "📷 Hình ảnh" : "");

      /* =====================================================
       * PRIVATE CHAT (USER ↔ USER)
       * ===================================================== */
      if (type === "user") {
        const me = await User.findById(senderId);
        const peer = await User.findById(id);
        if (!peer) return err(res, 404, "Peer not found");

        /* -------- CHAT CỦA TÔI -------- */
        let chat = me.private_chats.find(
          (c) => String(c.peer_id) === String(peer._id)
        );

        if (!chat) {
          chat = {
            peer_id: peer._id,
            peer_name: peer.full_name,
            peer_avatar: peer.avatar,
            messages: [messageForMe], // ✅ message đầu tiên
            last_message: lastMessage,
            last_time: now,
            unread_count: 0,
          };
          me.private_chats.push(chat);
        } else {
          chat.messages.push(messageForMe);
          chat.last_message = lastMessage;
          chat.last_time = now;
        }

        await me.save();

        /* -------- CHAT CỦA NGƯỜI NHẬN -------- */
        let peerChat = peer.private_chats.find(
          (c) => String(c.peer_id) === String(me._id)
        );

        if (!peerChat) {
          peerChat = {
            peer_id: me._id,
            peer_name: me.full_name,
            peer_avatar: me.avatar,
            messages: [messageForPeer], // ✅ message đầu tiên
            last_message: lastMessage,
            last_time: now,
            unread_count: 1,
          };
          peer.private_chats.push(peerChat);
        } else {
          peerChat.messages.push(messageForPeer);
          peerChat.last_message = lastMessage;
          peerChat.last_time = now;
          peerChat.unread_count = (peerChat.unread_count || 0) + 1;
        }

        await peer.save();
        try {
          await pushToUsers({
            userIds: [peer._id],
            title: `💬 ${me.full_name}`,
            body: lastMessage,
            type: "ChatList",
            data: {
           
            },
          });
        } catch (e) {
          console.error("Push chat failed:", e.message);
        }


        /* -------- 🔥 PING TOÀN SERVER -------- */
        if (req.app.get("pingNsp")) {
          req.app.get("pingNsp").emit("pinguser", {
            type: "chat_update",
            from: senderId,
            to: id,
          });
        }

        return ok(res, "Đã gửi tin nhắn");
      }

      /* =====================================================
       * GROUP CHAT
       * ===================================================== */
      if (type === "group") {
        // 🔑 id lúc này chính là departmentId
        const department = await Department.findById(id);

        if (!department) {
          return err(res, 404, "Department not found");
        }

        // 🧩 Mỗi department chỉ có 1 group
        const group = department.group_chats?.[0];
        if (!group) {
          return err(res, 404, "Group not found in department");
        }

        const now = new Date();

        // 📩 Push message
        group.messages.push({
          sender_id: senderId,
          sender_name: req.user.full_name,
          sender_avatar: req.user.avatar,
          text: text || '',
          image_urls: image_urls || [],
          created_at: now,
          seen_by: [senderId],
        });

        // 🕒 Update last message
        group.last_message =
          text?.trim()
            ? text
            : image_urls?.length
              ? '📷 Hình ảnh'
              : '';

        group.last_time = now;

        await department.save();
        try {
          const receivers = department.users.filter(
            u => String(u) !== String(senderId)
          );

          await pushToUsers({
            userIds: receivers,
            title: `💬 ${req.user.full_name}`,
            body: group.last_message,
            type: "ChatList",
            data: { department_id: department._id },
          });
        } catch (e) {
          console.error("Push group chat failed:", e.message);
        }


        /* -------- 🔥 SOCKET: GROUP UPDATE -------- */
        const nsp = req.app.get("pingNsp");
        if (nsp) {
          nsp.emit("pinguser", {
            type: "group_chat_update",
            departmentId: department._id,
          });
        }

        return ok(res, {
          message: "Đã gửi tin nhắn nhóm",
          department_id: department._id,
        });
      }


      return err(res, 400, "Type không hợp lệ");
    } catch (e) {
      console.error("sendMessage error:", e);
      return err(res, 500, "Lỗi khi gửi tin nhắn");
    }
  },


  /**
   * Đánh dấu đã đọc (user hoặc group)
   */
  markSeen: async (req, res) => {
    try {
      const { type, id } = req.body; // id = peerId | departmentId
      const userId = String(req.user.id);

      /* =========================
         PRIVATE CHAT
      ========================= */
      if (type === "user") {
        const me = await User.findById(userId);

        if (me) {
          const chat = me.private_chats?.find(
            (c) => String(c.peer_id) === String(id)
          );

          if (chat) {
            chat.messages.forEach((m) => {
              m.is_seen = true;
            });
            chat.unread_count = 0;
            await me.save();
          }
        }

        // ✅ DÙ CÓ / KHÔNG CÓ CHAT → VẪN OK
        return ok(res, {
          success: true,
          type: "user",
          peer_id: id,
        });
      }

      /* =========================
         GROUP CHAT (BY DEPARTMENT ID)
      ========================= */
      if (type === "group") {
        const department = await Department.findById(id);

        if (department && department.group_chats?.[0]) {
          const group = department.group_chats[0];

          let updatedCount = 0;

          for (const m of group.messages) {
            const seenList = (m.seen_by || []).map(String);
            if (!seenList.includes(userId)) {
              m.seen_by.push(userId);
              updatedCount++;
            }
          }

          if (updatedCount > 0) {
            await department.save();
          }

          return ok(res, {
            success: true,
            type: "group",
            department_id: id,
            updated_count: updatedCount,
          });
        }

        // ❗ Không có group → vẫn OK
        return ok(res, {
          success: true,
          type: "group",
          department_id: id,
          updated_count: 0,
        });
      }

      // ❗ Type lạ → vẫn OK (fail-safe cho FE)
      return ok(res, {
        success: true,
        message: "No action",
      });
    } catch (e) {
      console.error("markSeen error:", e);

      // ❗ LỖI SERVER → VẪN OK (đúng yêu cầu bạn)
      return ok(res, {
        success: true,
        message: "Handled with error but marked as success",
      });
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

  // ===================== UPDATE USER (ADMIN) =====================
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

  createUserByAdmin: async (req, res) => {
    try {
      const {
        full_name,
        job_title,
        department_id,
        email,
        employee_code,
        isAdmin,     // ⭐ NHẬN TỪ FE
      } = req.body;

      // -------- VALIDATION --------
      if (!full_name || !email) {
        return err(res, 400, "Họ tên và email là bắt buộc");
      }

      if (!employee_code) {
        return err(res, 400, "Mã nhân viên là bắt buộc");
      }

      // Check email tồn tại
      const existedEmail = await User.findOne({ email, record_status: 1 });
      if (existedEmail) {
        return err(res, 400, "Email đã tồn tại trong hệ thống");
      }

      // Check employee_code
      const existedCode = await User.findOne({ employee_code, record_status: 1 });
      if (existedCode) {
        return err(res, 400, "Mã nhân viên đã tồn tại");
      }

      // Lấy công ty của admin hiện tại
      const admin = await User.findById(req.user.id).select("company_id email");
      if (!admin || !admin.company_id) {
        return err(res, 400, "Admin chưa thuộc công ty nên không thể tạo nhân viên");
      }

      // -------- HANDLE ROLE + JOB TITLE --------
      let finalRole = "user";
      let finalJobTitle = job_title || "";
      let finalDepartmentId = department_id || null;

      if (isAdmin === true) {
        finalRole = "admin";          // ⭐ SET ROLE ADMIN
        finalJobTitle = "admin";      // ⭐ JOBTITLE ADMIN
        finalDepartmentId = null;     // ⭐ ADMIN không thuộc phòng ban
      }

      // -------- RANDOM PASSWORD --------
      const rawPassword = crypto.randomBytes(6).toString("hex");

      // -------- TẠO USER --------
      const newUser = await User.create({
        email,
        password: rawPassword,
        full_name,
        employee_code,
        job_title: finalJobTitle,
        department_id: finalDepartmentId,
        company_id: admin.company_id,

        is_active: true,
        is_verified: true,
        verification_code: null,
        verification_expires: null,
        profile_approved: false,

        role: finalRole,      // ⭐ ROLE SAU KHI XỬ LÝ
      });

      // Lưu old password hash
      newUser.old_password = newUser.password;
      await newUser.save();

      // -------- SEND MAIL --------
      try {
        await mailer.sendMail({
          toList: [email],
          subject: "Tài khoản nhân viên đã được tạo",
          html: `
          <p>Xin chào <b>${full_name}</b>,</p>
          <p>Tài khoản của bạn đã được tạo thành công.</p>
          <p><b>Email đăng nhập:</b> ${email}</p>
          <p><b>Mã nhân viên:</b> ${employee_code}</p>
          <p><b>Vai trò:</b> ${finalRole.toUpperCase()}</p>
          <p><b>Mật khẩu:</b> ${rawPassword}</p>
          <p>Vui lòng đăng nhập và đổi mật khẩu ngay lần đầu sử dụng.</p>
        `,
        });
      } catch (mailErr) {
        console.error("Lỗi gửi email khi tạo nhân viên:", mailErr);
      }

      const userObj = newUser.toObject();
      delete userObj.password;

      return ok(res, { user: userObj }, "Tạo nhân viên thành công");
    } catch (e) {
      console.error("Lỗi createUserByAdmin:", e);
      return err(res, 400, e?.message || "Không thể tạo nhân viên");
    }
  },


  // ===================== GET USERS BY COMPANY =====================
  getUsersByCompany: async (req, res) => {
    try {
      const currentUser = await User.findById(req.user.id).select("company_id");

      if (!currentUser || !currentUser.company_id) {
        return err(res, 400, "Không xác định được công ty của người dùng");
      }

      const companyId = currentUser.company_id;

      // -----------------------------------------
      // 1️⃣ LẤY DATA ĐẦY ĐỦ ĐỂ KIỂM TRA PASSWORD
      // -----------------------------------------
      const usersWithPassword = await User.find({
        company_id: companyId,
        record_status: 1,
      })
        .select("+password +old_password")    // ⭐ LẤY HASH BÊN TRONG BACKEND
        .lean();

      // -----------------------------------------
      // 2️⃣ LẤY DATA TRẢ VỀ CLIENT (KHÔNG PASSWORD)
      // -----------------------------------------
      let users = await User.find({
        company_id: companyId,
        record_status: 1,
      })
        .select("-password -old_password")    // ⭐ KHÔNG TRẢ RA CLIENT
        .populate({ path: "department_id", select: "name department_code" })
        .populate({ path: "manager_id", select: "full_name email" })
        .lean();

      // -----------------------------------------
      // 3️⃣ GHÉP 2 DANH SÁCH ĐỂ LẤY passwordChangeStatus
      // -----------------------------------------
      users = users.map((u) => {
        const full = usersWithPassword.find(x => String(x._id) === String(u._id));

        let pwdStatus = "waiting_for_password_change";

        if (full?.old_password && full?.password !== full.old_password) {
          pwdStatus = "password_changed";
        }

        return {
          ...u,
          passwordChangeStatus: pwdStatus,
        };
      });

      return ok(res, { users }, "Lấy danh sách nhân viên theo công ty thành công");
    } catch (e) {
      console.error("Lỗi getUsersByCompany:", e);
      return err(res, 400, e?.message || "Không thể lấy danh sách nhân viên");
    }
  },



  // ===================== SELF UPDATE (USER) =====================
  updateMyProfile: async (req, res) => {
    try {
      // Các field cho phép cập nhật
      const allowed = [
        "full_name",
        "phone_number",
        "gender",
        "date_of_birth",
        "country_code",
        "state_code",
        "city_name",
        "full_address",
        "avatar",
        "face_image",   // ảnh chính diện
        "face_image2",  // ảnh nghiêng trái
        "face_image3",  // ảnh nghiêng phải
        "face_id",      // vector embedding 512-D (string hoặc JSON)
      ];

      const updates = {};

      allowed.forEach((key) => {
        if (req.body[key] !== undefined && req.body[key] !== null) {
          updates[key] = req.body[key];
        }
      });

      // Khi user tự cập nhật → phải duyệt lại
      updates.profile_approved = false;

      const updated = await User.findByIdAndUpdate(req.user.id, updates, {
        new: true,
      }).select("-password");

      return ok(res, { user: updated }, "Profile updated successfully");
    } catch (err) {
      console.error("updateMyProfile error:", err);
      return err(res, 400, err.message || "Update profile failed");
    }
  },

  approveUserProfile: async (req, res) => {
    try {
      const admin = await User.findById(req.user.id).select("company_id");
      if (!admin || !admin.company_id)
        return err(res, 403, "Bạn không thuộc công ty nào");

      const { status } = req.body; // "approved" | "rejected"
      if (!["approved", "rejected"].includes(status)) {
        return err(res, 400, "Trạng thái không hợp lệ");
      }

      const user = await User.findOne({
        _id: req.params.id,
        company_id: admin.company_id,
        record_status: 1,
      });

      if (!user) return err(res, 404, "User không tồn tại trong công ty bạn");

      user.profile_approved = status === "approved";
      await user.save();

      return ok(res, { user }, "Cập nhật trạng thái profile thành công");
    } catch (e) {
      console.error("approveUserProfile:", e);
      return err(res, 400, "Không thể cập nhật trạng thái profile");
    }
  },
  updateUserStatus: async (req, res) => {
    try {
      const admin = await User.findById(req.user.id).select("company_id");

      if (!admin || !admin.company_id)
        return err(res, 403, "Bạn không thuộc công ty nào");

      const { is_active } = req.body;

      const user = await User.findOneAndUpdate(
        {
          _id: req.params.id,
          company_id: admin.company_id,
          record_status: 1,
        },
        { is_active },
        { new: true }
      ).select("-password");

      if (!user)
        return err(res, 404, "User không tồn tại trong công ty bạn");

      return ok(res, { user }, "Cập nhật trạng thái user thành công");
    } catch (e) {
      console.error("updateUserStatus:", e);
      return err(res, 400, "Không thể cập nhật trạng thái user");
    }
  },
  updateUserByCompanyAdmin: async (req, res) => {
    try {
      const admin = await User.findById(req.user.id).select("company_id");

      if (!admin || !admin.company_id)
        return err(res, 403, "Không xác định được công ty của bạn");

      const allowedFields = [
        "full_name",
        "phone_number",
        "gender",
        "date_of_birth",
        "job_title",
        "department_id",
        "manager_id",
        "city_name",
        "full_address",
        "salary",
        "avatar",
      ];

      const updates = {};
      allowedFields.forEach(f => {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      });

      const updated = await User.findOneAndUpdate(
        {
          _id: req.params.id,
          company_id: admin.company_id,
          record_status: 1,
        },
        updates,
        { new: true }
      ).select("-password");

      if (!updated)
        return err(res, 404, "User không tồn tại trong công ty bạn");

      return ok(res, { user: updated }, "Update user thành công");
    } catch (e) {
      console.error("updateUserByCompanyAdmin:", e);
      return err(res, 400, "Không thể update user");
    }
  },
  getUserDetailByCompanyAdmin: async (req, res) => {
    try {
      const admin = await User.findById(req.user.id).select("company_id");

      if (!admin || !admin.company_id)
        return err(res, 403, "Bạn không thuộc công ty nào");

      const user = await User.findOne({
        _id: req.params.id,
        company_id: admin.company_id,
        record_status: 1,
      })
        .select("-password -old_password")
        .populate("department_id", "name department_code")
        .populate("manager_id", "full_name email");

      if (!user)
        return err(res, 404, "User không tồn tại trong công ty bạn");

      return ok(res, { user }, "Lấy thông tin nhân viên thành công");
    } catch (e) {
      console.error("getUserDetailByCompanyAdmin:", e);
      return err(res, 400, "Không thể lấy thông tin user");
    }
  },

};


// Haversine distance
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports.locationCheck = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) return err(res, 400, "Thiếu tọa độ");

    const user = await User.findById(req.user.id).select("company_id");

    if (!user || !user.company_id)
      return err(res, 400, "User chưa thuộc công ty nào");

    const company = await Company.findById(user.company_id).select(
      "checkin_location checkin_radius"
    );

    if (!company || !company.checkin_location)
      return err(res, 400, "Công ty chưa cấu hình điểm check-in");

    const { lat: officeLat, lng: officeLng } = company.checkin_location;
    const radius = company.checkin_radius ?? 100;

    const dist = distanceMeters(lat, lng, officeLat, officeLng);

    if (dist > radius) {
      return ok(res, {
        allowed: false,
        distance: dist,
        required_radius: radius,
      });
    }

    // Create 2-minute session token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 2 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      location_session_token: token,
      location_session_expires: expires,
    });

    return ok(res, {
      allowed: true,
      token,
      expires_at: expires,
      distance: dist,
    });
  } catch (e) {
    console.error(e);
    return err(res, 500, e.message);
  }
};

// Cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports.checkAttendance = async (req, res) => {
  try {
    const { type, face_id, image } = req.body;

    if (!["check_in", "check_out"].includes(type)) {
      return err(res, 400, "Loại check không hợp lệ");
    }

    const user = await User.findById(req.user.id).select(
      "+face_id +location_session_token +location_session_expires +attendance_logs"
    );

    if (!user) return err(res, 404, "Không tìm thấy user");
    if (!user.face_id) return err(res, 400, "User chưa đăng ký FaceID");

    // Check location token
    if (
      !user.location_session_token ||
      !user.location_session_expires ||
      user.location_session_expires < new Date()
    ) {
      return err(res, 403, "Bạn chưa xác thực vị trí");
    }

    // FACE VERIFY
    const dbVec = JSON.parse(user.face_id);
    const sim = cosineSimilarity(dbVec, face_id);
    if (sim < 0.45) {
      return err(res, 400, `Face không khớp (sim=${sim.toFixed(2)})`);
    }

    // ===== Attendance logic =====
    const today = new Date().toISOString().split("T")[0];
    const time = new Date().toTimeString().slice(0, 5);

    let logs = user.attendance_logs || [];
    let todayLog = logs.find(l => l.date === today);

    const calcTotalHours = (log) => {
      if (!log?.check_in_time || !log?.check_out_time) return null;
      const start = new Date(`${today}T${log.check_in_time}:00`);
      const end = new Date(`${today}T${log.check_out_time}:00`);
      return Math.round(((end - start) / 36e5) * 100) / 100;
    };

    // ===== CHECK IN =====
    if (type === "check_in") {
      if (todayLog?.check_in_time) {
        return err(res, 400, "Hôm nay đã check-in rồi");
      }

      if (!todayLog) {
        todayLog = {
          date: today,
          check_in_time: time,
          check_in_image: image,
        };
        logs.push(todayLog);
      } else {
        todayLog.check_in_time = time;
        todayLog.check_in_image = image;
      }

      const hours = calcTotalHours(todayLog);
      if (hours !== null) {
        todayLog.total_hours = hours;
      }
    }

    // ===== CHECK OUT =====
    if (type === "check_out") {
      if (todayLog?.check_out_time) {
        return err(res, 400, "Đã check-out rồi");
      }

      if (!todayLog) {
        todayLog = {
          date: today,
          check_out_time: time,
          check_out_image: image,
        };
        logs.push(todayLog);
      } else {
        todayLog.check_out_time = time;
        todayLog.check_out_image = image;
      }

      const hours = calcTotalHours(todayLog);
      if (hours !== null) {
        todayLog.total_hours = hours;
      }
    }

    // Clear location session
    user.location_session_token = null;
    user.location_session_expires = null;

    user.attendance_logs = logs;
    await user.save();

    return ok(res, {
      success: true,
      type,
      similarity: sim,
      log: todayLog,
    });
  } catch (e) {
    console.error(e);
    return err(res, 500, e.message);
  }
};


/* =========================
   Helpers
========================= */
function parseDateStr(d) {
  // d: "YYYY-MM-DD"
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function toDateStr(dt) {
  return dt.toISOString().slice(0, 10);
}

function addDaysUTC(dt, days) {
  const x = new Date(dt);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function weekdayKeyUTC(dt) {
  // JS: 0=Sun..6=Sat -> map to keys used by your config
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[dt.getUTCDay()];
}

function enumerateDatesInclusive(startStr, endStr) {
  const start = parseDateStr(startStr);
  const end = parseDateStr(endStr);
  if (end < start) return [];
  const out = [];
  for (let d = start; d <= end; d = addDaysUTC(d, 1)) out.push(toDateStr(d));
  return out;
}

function countWorkingDays(dateStrList, config) {
  const workingDays = config?.working_hours?.working_days || [
    "mon", "tue", "wed", "thu", "fri", "sat",
  ];
  const holidays = new Set(config?.working_hours?.company_holidays || []);

  let count = 0;
  for (const ds of dateStrList) {
    if (holidays.has(ds)) continue;
    const wk = weekdayKeyUTC(parseDateStr(ds));
    if (!workingDays.includes(wk)) continue;
    count += 1;
  }
  return count;
}

function sumApprovedAnnualDays(user, config) {
  // sum approved annual leave working-days (respect holidays & working_days)
  const approvedAnnual = (user.leave_requests || []).filter(
    (r) => r.type === "annual" && r.status === "approved"
  );

  let total = 0;
  for (const r of approvedAnnual) {
    const dates = enumerateDatesInclusive(r.start_date, r.end_date);
    total += countWorkingDays(dates, config);
  }
  return total;
}

function hasOverlapPendingOrApproved(user, start_date, end_date) {
  const newDates = new Set(enumerateDatesInclusive(start_date, end_date));
  const existing = (user.leave_requests || []).filter(
    (r) => r.status === "pending" || r.status === "approved"
  );

  for (const r of existing) {
    const dates = enumerateDatesInclusive(r.start_date, r.end_date);
    for (const d of dates) {
      if (newDates.has(d)) return true;
    }
  }
  return false;
}

/* =========================================================
   USER: CREATE LEAVE REQUEST
========================================================= */
module.exports.createLeaveRequest = async (req, res) => {
  try {
    const {
      type,
      start_date,
      end_date,
      day_type = "full", // full | half
      reason = "",
      evidence_images = [],
    } = req.body;

    if (!type || !start_date || !end_date)
      return err(res, 400, "Thiếu dữ liệu");

    const user = await User.findById(req.user.id).select(
      "company_id leave_requests record_status"
    );
    if (!user || user.record_status !== 1)
      return err(res, 404, "User không tồn tại");

    user.leave_requests.push({
      type,
      start_date,
      end_date,
      day_type,
      reason,
      evidence_images,
      status: "pending",
      admin_note: "",
      approved_by: null,
      approved_at: null,
      created_at: new Date(),
    });

    await user.save();
    try {
      const admins = await User.find({
        company_id: user.company_id,
        role: { $in: ["admin"] },
        record_status: 1,
      }).select("_id");

      await pushToUsers({
        userIds: admins.map(a => a._id),
        title: "📄 Đơn nghỉ phép mới",
        body: `Bạn có đơn nghỉ phép mới cần duyệt`,
        type: "LeaveRequests",
        data: { user_id: user },
      });
    } catch (e) {
      console.error("Push leave request failed:", e.message);
    }
    return ok(res, {}, "Tạo đơn nghỉ phép thành công");
  } catch (e) {
    return err(res, 500, e.message);
  }
};

/* =========================================================
   USER: GET MY LEAVE REQUESTS
========================================================= */
module.exports.getMyLeaveRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(`
        full_name
        email
        employee_code
        avatar
        job_title
        role
        department_id
        leave_requests
        record_status
      `)
      .populate("department_id", "name department_code")
      .lean();

    if (!user || user.record_status !== 1) {
      return err(res, 404, "User không tồn tại");
    }

    const result = [];

    for (const leave of user.leave_requests || []) {
      result.push({
        /* ================= USER INFO ================= */
        user: {
          user_id: user._id,
          full_name: user.full_name,
          email: user.email,
          employee_code: user.employee_code,
          avatar: user.avatar || null,
          job_title: user.job_title || null,
          role: user.role,
          department: user.department_id
            ? {
              id: user.department_id._id,
              name: user.department_id.name,
              code: user.department_id.department_code,
            }
            : null,
        },

        /* ================= LEAVE INFO ================= */
        leave: {
          leave_id: leave._id,
          type: leave.type, // annual | sick | unpaid
          start_date: leave.start_date,
          end_date: leave.end_date,
          day_type: leave.day_type,
          reason: leave.reason,
          evidence_images: leave.evidence_images || [],

          status: leave.status,
          admin_note: leave.admin_note || "",

          approved_by: leave.approved_by
            ? {
              user_id: leave.approved_by.user_id,
              full_name: leave.approved_by.full_name,
              avatar: leave.approved_by.avatar,
              role: leave.approved_by.role,
            }
            : null,

          approved_at: leave.approved_at,
          created_at: leave.created_at,
        },
      });
    }

    // newest first
    result.sort(
      (a, b) =>
        new Date(b.leave.created_at) -
        new Date(a.leave.created_at)
    );

    return ok(res, {
      leave_requests: result,
      total: result.length,
    });
  } catch (e) {
    console.error("getMyLeaveRequests:", e);
    return err(res, 500, e?.message || "Get my leave requests failed");
  }
};

/* =========================================================
   ADMIN: GET PENDING LEAVE REQUESTS
========================================================= */
module.exports.adminGetPendingLeaveRequests = async (req, res) => {
  const admin = await User.findById(req.user.id).select("company_id");
  const users = await User.find({ company_id: admin.company_id })
    .select("leave_requests full_name email employee_code");

  const result = [];
  users.forEach(u => {
    u.leave_requests.forEach(r => {
      if (r.status === "pending") {
        result.push({
          user_id: u._id,
          full_name: u.full_name,
          email: u.email,
          employee_code: u.employee_code,
          leave: r,
        });
      }
    });
  });

  return ok(res, { leave_requests: result });
};

/* =========================================================
   ADMIN: DECIDE LEAVE REQUEST
========================================================= */
module.exports.adminDecideLeaveRequest = async (req, res) => {
  try {
    const { userId, leaveId } = req.params;
    const { status, admin_note = "" } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return err(res, 400, "Status không hợp lệ");
    }

    /* ================= ADMIN ================= */
    const admin = await User.findById(req.user.id).select(
      "full_name avatar role company_id"
    );
    if (!admin) return err(res, 404, "Admin không tồn tại");

    /* ================= USER ================= */
    const user = await User.findOne({
      _id: userId,
      company_id: admin.company_id,
      record_status: 1,
    }).select(
      "leave_requests annual_leave_used paid_leave_used total_leave_used"
    );

    if (!user)
      return err(res, 404, "User không tồn tại trong công ty");

    /* ================= LEAVE ================= */
    const leave = user.leave_requests.id(leaveId);
    if (!leave) return err(res, 404, "Không tìm thấy đơn nghỉ");

    if (leave.status !== "pending") {
      return err(res, 400, "Đơn nghỉ đã được xử lý");
    }

    /* ================= CALC DAYS (FIX) ================= */
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);

    const diffDays =
      Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    let dayUsed = 0;

    if (diffDays === 1) {
      dayUsed = leave.day_type === "full" ? 1 : 0.5;
    } else {
      dayUsed = diffDays;
    }

    /* ================= APPROVE ================= */
    if (status === "approved") {
      // tổng nghỉ
      user.total_leave_used =
        Number(user.total_leave_used || 0) + dayUsed;

      // nghỉ có lương
      if (leave.type === "annual" || leave.type === "sick") {
        user.paid_leave_used =
          Number(user.paid_leave_used || 0) + dayUsed;
      }

      // phép năm
      if (leave.type === "annual") {
        user.annual_leave_used =
          Number(user.annual_leave_used || 0) + dayUsed;
      }

      leave.approved_at = new Date();
      leave.approved_by = {
        user_id: admin._id,
        full_name: admin.full_name,
        avatar: admin.avatar,
        role: admin.role,
      };
    }

    /* ================= REJECT ================= */
    if (status === "rejected") {
      leave.approved_at = new Date();
      leave.approved_by = {
        user_id: admin._id,
        full_name: admin.full_name,
        avatar: admin.avatar,
        role: admin.role,
      };
    }

    leave.status = status;
    leave.admin_note = admin_note;

    await user.save();
    try {
      await pushToUsers({
        userIds: [user._id],
        title:
          status === "approved"
            ? "✅ Đơn nghỉ phép được duyệt"
            : "❌ Đơn nghỉ phép bị từ chối",
        body: admin_note || "Vui lòng xem chi tiết",
        type: "LeaveRecord",
        data: { leave_id: leave._id },
      });
    } catch (e) {
      console.error("Push leave decision failed:", e.message);
    }

    return ok(
      res,
      {
        annual_leave_used: user.annual_leave_used,
        paid_leave_used: user.paid_leave_used,
        total_leave_used: user.total_leave_used,
      },
      "Đã xử lý đơn nghỉ phép"
    );
  } catch (e) {
    console.error("adminDecideLeaveRequest:", e);
    return err(res, 500, e?.message || "Decide leave failed");
  }
};


/* =========================================================
   ADMIN: GET ALL LEAVE REQUESTS
========================================================= */
/* =========================================================
   ADMIN: GET ALL LEAVE REQUESTS (FULL FORMAT)
========================================================= */
module.exports.adminGetAllLeaveRequests = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select(
      "company_id record_status"
    );

    if (!admin || admin.record_status !== 1)
      return err(res, 404, "Admin không tồn tại");

    if (!admin.company_id)
      return err(res, 403, "Bạn không thuộc công ty nào");

    const statusFilter = req.query.status || "all";

    const users = await User.find({
      company_id: admin.company_id,
      record_status: 1,
    })
      .select(`
        full_name
        email
        employee_code
        avatar
        job_title
        role
        department_id
        leave_requests
      `)
      .populate("department_id", "name department_code")
      .lean();

    const result = [];

    for (const u of users) {
      for (const leave of u.leave_requests || []) {
        if (statusFilter !== "all" && leave.status !== statusFilter) continue;

        result.push({
          /* ================= USER INFO ================= */
          user: {
            user_id: u._id,
            full_name: u.full_name,
            email: u.email,
            employee_code: u.employee_code,
            avatar: u.avatar || null,
            job_title: u.job_title || null,
            role: u.role,
            department: u.department_id
              ? {
                id: u.department_id._id,
                name: u.department_id.name,
                code: u.department_id.department_code,
              }
              : null,
          },

          /* ================= LEAVE INFO ================= */
          leave: {
            leave_id: leave._id,
            type: leave.type, // annual | sick | unpaid
            start_date: leave.start_date,
            end_date: leave.end_date,
            day_type: leave.day_type,
            reason: leave.reason,
            evidence_images: leave.evidence_images || [],

            status: leave.status,
            admin_note: leave.admin_note || "",

            approved_by: leave.approved_by
              ? {
                user_id: leave.approved_by.user_id,
                full_name: leave.approved_by.full_name,
                avatar: leave.approved_by.avatar,
                role: leave.approved_by.role,
              }
              : null,

            approved_at: leave.approved_at,
            created_at: leave.created_at,
          },
        });
      }
    }

    // newest first
    result.sort(
      (a, b) =>
        new Date(b.leave.created_at) - new Date(a.leave.created_at)
    );

    return ok(res, {
      leave_requests: result,
      total: result.length,
    });
  } catch (e) {
    console.error("adminGetAllLeaveRequests:", e);
    return err(res, 500, e?.message || "Get all leave requests failed");
  }
};


/* =========================================================
   USER: CREATE CHECKIN COMPLAINT
========================================================= */
module.exports.createCheckinComplaint = async (req, res) => {
  try {
    const {
      date,
      type, // check_in | check_out
      expected_time,
      actual_time,
      reason,
      evidence_images = [],
    } = req.body;

    if (!date || !type)
      return err(res, 400, "Thiếu dữ liệu");

    const user = await User.findById(req.user.id).select(
      "checkin_complaints record_status company_id"
    );
    if (!user || user.record_status !== 1)
      return err(res, 404, "User không tồn tại");

    user.checkin_complaints.push({
      date,
      action: type,          // ✅ map đúng
      time: actual_time,     // ✅ map đúng
      reason,
      evidence_images,
      status: "pending",
      admin_note: "",
      approved_at: null,
      created_at: new Date(),
    });


    await user.save();
    try {
      const admins = await User.find({
        company_id: user.company_id,
        role: { $in: ["admin"] },
        record_status: 1,
      }).select("_id");
      console.log("COMPANY", user)
      await pushToUsers({
        userIds: admins.map(a => a._id),
        title: "⚠️ Khiếu nại chấm công",
        body: `Bạn có khiếu nại ngày ${date}`,
        type: "ComplaintRequests",
        data: { user_id: user._id },
      });
    } catch (e) {
      console.error("Push complaint failed:", e.message);
    }

    return ok(res, {}, "Gửi khiếu nại thành công");
  } catch (e) {
    return err(res, 500, e.message);
  }
};

/* =========================================================
   USER: GET MY CHECKIN COMPLAINTS
========================================================= */
module.exports.getMyCheckinComplaints = async (req, res) => {
  const user = await User.findById(req.user.id).select("checkin_complaints");
  return ok(res, {
    checkin_complaints: user.checkin_complaints || [],
    total: user.checkin_complaints.length,
  });
};

/* =========================================================
   ADMIN: GET PENDING CHECKIN COMPLAINTS
========================================================= */
module.exports.adminGetPendingCheckinComplaints = async (req, res) => {
  const admin = await User.findById(req.user.id).select("company_id");

  const users = await User.find({ company_id: admin.company_id })
    .select("checkin_complaints full_name email employee_code");

  const result = [];
  users.forEach(u => {
    u.checkin_complaints.forEach(c => {
      if (c.status === "pending") {
        result.push({
          user_id: u._id,
          full_name: u.full_name,
          email: u.email,
          employee_code: u.employee_code,
          complaint: c,
        });
      }
    });
  });

  return ok(res, { checkin_complaints: result });
};

/* =========================================================
   ADMIN: DECIDE CHECKIN COMPLAINT
========================================================= */
module.exports.adminDecideCheckinComplaint = async (req, res) => {
  const { userId, complaintId } = req.params;
  const { status, admin_note = "" } = req.body;

  const admin = await User.findById(req.user.id);
  const user = await User.findById(userId);

  const c = user.checkin_complaints.id(complaintId);
  if (!c) return err(res, 404, "Không tìm thấy khiếu nại");

  c.status = status;
  c.admin_note = admin_note;
  c.approved_at = new Date();
  c.approved_by = {
    user_id: admin._id,
    full_name: admin.full_name,
    avatar: admin.avatar,
    role: admin.role,
  };

  await user.save();
  try {
    await pushToUsers({
      userIds: [user._id],
      title:
        status === "approved"
          ? "✅ Khiếu nại được chấp nhận"
          : "❌ Khiếu nại bị từ chối",
      body: admin_note || "Vui lòng xem chi tiết",
      type: "checkin_complaint_decision",
      data: { complaint_id: c._id },
    });
  } catch (e) {
    console.error("Push complaint decision failed:", e.message);
  }

  return ok(res, {}, "Đã xử lý khiếu nại");
};

/* =========================================================
   ADMIN: GET ALL CHECKIN COMPLAINTS
========================================================= */

/* =========================================================
   ADMIN: GET ALL CHECK-IN COMPLAINTS (FULL FORMAT)
========================================================= */
module.exports.adminGetAllCheckinComplaints = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select(
      "company_id record_status"
    );

    if (!admin || admin.record_status !== 1)
      return err(res, 404, "Admin không tồn tại");

    if (!admin.company_id)
      return err(res, 403, "Bạn không thuộc công ty nào");

    const statusFilter = req.query.status || "all";

    const users = await User.find({
      company_id: admin.company_id,
      record_status: 1,
    })
      .select(`
        full_name
        email
        employee_code
        avatar
        job_title
        role
        department_id
        checkin_complaints
      `)
      .populate("department_id", "name department_code")
      .lean();

    const result = [];

    for (const u of users) {
      for (const c of u.checkin_complaints || []) {
        if (statusFilter !== "all" && c.status !== statusFilter) continue;

        result.push({
          /* ================= USER ================= */
          user: {
            user_id: u._id,
            full_name: u.full_name,
            email: u.email,
            employee_code: u.employee_code,
            avatar: u.avatar || null,
            job_title: u.job_title || null,
            role: u.role,
            department: u.department_id
              ? {
                id: u.department_id._id,
                name: u.department_id.name,
                code: u.department_id.department_code,
              }
              : null,
          },

          /* ================= COMPLAINT ================= */
          complaint: {
            complaint_id: c._id,

            date: c.date,
            action: c.action,           // ✅ check_in | check_out
            time: c.time,               // ✅ unified time

            reason: c.reason,
            evidence_images: c.evidence_images || [],

            status: c.status,
            admin_note: c.admin_note || "",

            approved_at: c.approved_at || null,
            created_at: c.created_at,
          },
        });
      }
    }

    // newest first
    result.sort(
      (a, b) =>
        new Date(b.complaint.created_at) -
        new Date(a.complaint.created_at)
    );

    return ok(res, {
      checkin_complaints: result,
      total: result.length,
    });
  } catch (e) {
    console.error("adminGetAllCheckinComplaints:", e);
    return err(res, 500, e?.message || "Get all checkin complaints failed");
  }
};



/* =========================================================
   USER: CREATE OVERTIME REQUEST
========================================================= */
module.exports.createOvertimeRequest = async (req, res) => {
  try {
    const {
      date,
      start_time = null, // ✅ NEW
      hours,
      reason = "",
      evidence_images = [],
    } = req.body;

    /* ===== VALIDATE ===== */
    if (!date || hours === undefined) {
      return err(res, 400, "Thiếu date/hours");
    }

    const hrs = Number(hours);
    if (!Number.isFinite(hrs) || hrs <= 0) {
      return err(res, 400, "hours không hợp lệ");
    }

    if (start_time && !/^\d{2}:\d{2}$/.test(start_time)) {
      return err(res, 400, "start_time không đúng định dạng HH:mm");
    }

    /* ===== GET USER ===== */
    const user = await User.findById(req.user.id).select(
      "company_id overtime_logs record_status"
    );
    if (!user || user.record_status !== 1) {
      return err(res, 404, "User không tồn tại");
    }
    if (!user.company_id) {
      return err(res, 400, "User chưa thuộc công ty");
    }

    /* ===== GET COMPANY CONFIG ===== */
    const company = await Company.findById(user.company_id).select(
      "attendance_config"
    );
    const config = company?.attendance_config;
    if (!config) {
      return err(res, 400, "Company chưa cấu hình attendance");
    }

    /* ===== POLICY: MIN OT ===== */
    const minMinutes = Number(config?.overtime_policy?.min_ot_minutes || 0);
    if (hrs * 60 < minMinutes) {
      return err(res, 400, `OT tối thiểu ${minMinutes} phút`);
    }

    /* ===== BLOCK DUPLICATE DATE ===== */
    const existed = (user.overtime_logs || []).some(
      (o) =>
        o.date === date &&
        (o.status === "pending" || o.status === "approved")
    );
    if (existed) {
      return err(res, 400, "Đã có phiếu OT cho ngày này");
    }

    /* ===== PUSH OT ===== */
    user.overtime_logs.push({
      date,
      start_time, // ✅ LƯU START TIME
      hours: hrs,
      reason,
      evidence_images,

      status: "pending",
      admin_note: "",

      approved_by: {
        user_id: null,
        full_name: null,
        avatar: null,
        role: null,
      },

      approved_at: null,
      created_at: new Date(),
    });

    await user.save();

    try {
      const admins = await User.find({
        company_id: user.company_id,
        role: { $in: ["admin"] },
        record_status: 1,
      }).select("_id");

      await pushToUsers({
        userIds: admins.map(a => a._id),
        title: "⏱️ Yêu cầu OT mới",
        body: `Bạn có yêu cầu OT ngày ${date}`,
        type: "OTRequest",
        data: { user_id: user._id },
      });
    } catch (e) {
      console.error("Push OT request failed:", e.message);
    }

    return ok(res, {}, "Tạo phiếu OT thành công");
  } catch (e) {
    console.error("createOvertimeRequest:", e);
    return err(res, 500, e?.message || "Create overtime failed");
  }
};

/* =========================================================
   USER: GET MY OVERTIME REQUESTS
========================================================= */
module.exports.getMyOvertimeRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(`
        full_name
        email
        employee_code
        avatar
        job_title
        role
        department_id
        overtime_logs
        record_status
      `)
      .populate("department_id", "name department_code")
      .lean();

    if (!user || user.record_status !== 1) {
      return err(res, 404, "User không tồn tại");
    }

    const result = [];

    for (const ot of user.overtime_logs || []) {
      result.push({
        /* ================= USER INFO ================= */
        user: {
          user_id: user._id,
          full_name: user.full_name,
          email: user.email,
          employee_code: user.employee_code,
          avatar: user.avatar || null,
          job_title: user.job_title || null,
          role: user.role,
          department: user.department_id
            ? {
              id: user.department_id._id,
              name: user.department_id.name,
              code: user.department_id.department_code,
            }
            : null,
        },

        /* ================= OT INFO ================= */
        ot: {
          ot_id: ot._id,
          date: ot.date,
          start_time: ot.start_time || null,
          hours: ot.hours,
          reason: ot.reason,
          evidence_images: ot.evidence_images || [],

          status: ot.status,
          admin_note: ot.admin_note || "",

          approved_by: ot.approved_by
            ? {
              user_id: ot.approved_by.user_id,
              full_name: ot.approved_by.full_name,
              avatar: ot.approved_by.avatar,
              role: ot.approved_by.role,
            }
            : null,

          approved_at: ot.approved_at,
          created_at: ot.created_at,
        },
      });
    }

    // newest first
    result.sort(
      (a, b) => new Date(b.ot.created_at) - new Date(a.ot.created_at),
    );

    return ok(res, {
      overtime_requests: result,
      total: result.length,
    });
  } catch (e) {
    console.error("getMyOvertimeRequests:", e);
    return err(res, 500, e?.message || "Get overtime logs failed");
  }
};



/* =========================================================
   ADMIN: LIST PENDING REQUESTS
========================================================= */
module.exports.adminGetPendingRequests = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select(
      "company_id role record_status"
    );
    if (!admin || admin.record_status !== 1) {
      return err(res, 404, "Admin không tồn tại");
    }
    if (!admin.company_id) {
      return err(res, 403, "Bạn không thuộc công ty nào");
    }

    const type = req.query.type || "all";

    const users = await User.find({
      company_id: admin.company_id,
      record_status: 1,
    })
      .select("full_name email employee_code leave_requests overtime_logs")
      .lean();

    const leave = [];
    const overtime = [];

    for (const u of users) {
      if (type === "all" || type === "leave") {
        for (const r of u.leave_requests || []) {
          if (r.status === "pending") {
            leave.push({
              user_id: u._id,
              full_name: u.full_name,
              email: u.email,
              employee_code: u.employee_code,
              request: r,
            });
          }
        }
      }

      if (type === "all" || type === "overtime") {
        for (const o of u.overtime_logs || []) {
          if (o.status === "pending") {
            overtime.push({
              user_id: u._id,
              full_name: u.full_name,
              email: u.email,
              employee_code: u.employee_code,
              request: o,
            });
          }
        }
      }
    }

    leave.sort(
      (a, b) => new Date(b.request.created_at) - new Date(a.request.created_at)
    );
    overtime.sort(
      (a, b) => new Date(b.request.created_at) - new Date(a.request.created_at)
    );

    return ok(res, {
      pending_leave: leave,
      pending_overtime: overtime,
    });
  } catch (e) {
    console.error("adminGetPendingRequests:", e);
    return err(res, 500, e?.message || "Get pending requests failed");
  }
};

/* =========================================================
   ADMIN: APPROVE / REJECT OVERTIME
========================================================= */
module.exports.adminDecideOvertimeRequest = async (req, res) => {
  try {
    const { userId, otId } = req.params;
    const { status, admin_note = "" } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return err(res, 400, "status không hợp lệ");
    }

    const admin = await User.findById(req.user.id).select(
      "company_id full_name avatar role record_status"
    );
    if (!admin || admin.record_status !== 1) {
      return err(res, 404, "Admin không tồn tại");
    }
    if (!admin.company_id) {
      return err(res, 403, "Bạn không thuộc công ty nào");
    }

    const user = await User.findOne({
      _id: userId,
      company_id: admin.company_id,
      record_status: 1,
    }).select("overtime_logs company_id");

    if (!user) {
      return err(res, 404, "User không tồn tại trong công ty bạn");
    }

    const company = await Company.findById(user.company_id).select(
      "attendance_config"
    );
    const config = company?.attendance_config;
    if (!config) {
      return err(res, 400, "Company chưa cấu hình attendance");
    }

    const ot = user.overtime_logs.id(otId);
    if (!ot) {
      return err(res, 404, "Phiếu OT không tồn tại");
    }

    if (ot.status !== "pending") {
      return err(res, 400, "Phiếu OT đã được xử lý");
    }

    const minMinutes = Number(config?.overtime_policy?.min_ot_minutes || 0);
    if (status === "approved" && ot.hours * 60 < minMinutes) {
      return err(res, 400, `OT tối thiểu ${minMinutes} phút`);
    }

    ot.status = status;
    ot.admin_note = admin_note;
    ot.approved_at = new Date();
    ot.approved_by = {
      user_id: admin._id,
      full_name: admin.full_name,
      avatar: admin.avatar,
      role: admin.role,
    };

    await user.save();
    try {
      await pushToUsers({
        userIds: [user._id],
        title:
          status === "approved"
            ? "✅ OT được duyệt"
            : "❌ OT bị từ chối",
        body: admin_note || "Vui lòng xem chi tiết",
        type: "OTRecord",
        data: { ot_id: ot._id },
      });
    } catch (e) {
      console.error("Push OT decision failed:", e.message);
    }

    return ok(res, {}, "Cập nhật phiếu OT thành công");
  } catch (e) {
    console.error("adminDecideOvertimeRequest:", e);
    return err(res, 500, e?.message || "Decide overtime failed");
  }
};
module.exports.adminGetAllOvertimeRequests = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select(
      "company_id record_status"
    );

    if (!admin || admin.record_status !== 1)
      return err(res, 404, "Admin không tồn tại");

    if (!admin.company_id)
      return err(res, 403, "Bạn không thuộc công ty nào");

    const statusFilter = req.query.status || "all";

    const users = await User.find({
      company_id: admin.company_id,
      record_status: 1,
    })
      .select(
        `
        full_name
        email
        employee_code
        avatar
        job_title
        role
        department_id
        overtime_logs
        `
      )
      .populate("department_id", "name department_code")
      .lean();

    const result = [];

    for (const u of users) {
      for (const ot of u.overtime_logs || []) {
        if (statusFilter !== "all" && ot.status !== statusFilter) continue;

        result.push({
          /* ================= USER INFO ================= */
          user: {
            user_id: u._id,
            full_name: u.full_name,
            email: u.email,
            employee_code: u.employee_code,
            avatar: u.avatar || null,
            job_title: u.job_title || null,
            role: u.role,
            department: u.department_id
              ? {
                id: u.department_id._id,
                name: u.department_id.name,
                code: u.department_id.department_code,
              }
              : null,
          },

          /* ================= OT INFO ================= */
          ot: {
            ot_id: ot._id,
            date: ot.date,
            start_time: ot.start_time || null,
            hours: ot.hours,
            reason: ot.reason,
            evidence_images: ot.evidence_images || [],

            status: ot.status,
            admin_note: ot.admin_note || "",

            approved_by: ot.approved_by
              ? {
                user_id: ot.approved_by.user_id,
                full_name: ot.approved_by.full_name,
                avatar: ot.approved_by.avatar,
                role: ot.approved_by.role,
              }
              : null,

            approved_at: ot.approved_at,
            created_at: ot.created_at,
          },
        });
      }
    }

    // newest first
    result.sort(
      (a, b) => new Date(b.ot.created_at) - new Date(a.ot.created_at)
    );

    return ok(res, {
      overtime_requests: result,
      total: result.length,
    });
  } catch (e) {
    console.error("adminGetAllOvertimeRequests:", e);
    return err(res, 500, e?.message || "Get all overtime failed");
  }
};


module.exports.addOrUpdateDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      device_id,
      fcm_token,
      platform,
      device_name,
      app_version,
    } = req.body;

    if (!device_id || !fcm_token || !platform) {
      return res.status(400).json({ error: "Missing device_id / fcm_token / platform" });
    }

    // 1️⃣ đảm bảo device chỉ thuộc 1 user
    await User.updateMany(
      { "devices.device_id": device_id },
      { $pull: { devices: { device_id } } }
    );

    // 2️⃣ update nếu đã tồn tại
    const updated = await User.updateOne(
      { _id: userId, "devices.device_id": device_id },
      {
        $set: {
          "devices.$.fcm_token": fcm_token,
          "devices.$.platform": platform,
          "devices.$.device_name": device_name,
          "devices.$.app_version": app_version,
          "devices.$.is_active": true,
          "devices.$.last_login": new Date(),
        },
      }
    );

    // 3️⃣ chưa có thì push mới
    if (updated.matchedCount === 0) {
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            devices: {
              device_id,
              fcm_token,
              platform,
              device_name,
              app_version,
              is_active: true,
              last_login: new Date(),
              created_at: new Date(),
            },
          },
        }
      );
    }

    return res.json({ message: "Device registered" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports.removeDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;

    await User.updateOne(
      { _id: userId },
      { $pull: { devices: { device_id: deviceId } } }
    );

    return res.json({ message: "Device removed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
// GET /me/notifications?page=1&limit=20
module.exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 1000);

    const user = await User.findById(userId)
      .select("notifications")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const notifications = user.notifications || [];

    // sort mới -> cũ
    notifications.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    const total = notifications.length;
    const unread_count = notifications.filter(n => !n.is_read).length;

    const start = (page - 1) * limit;
    const end = start + limit;

    const data = notifications.slice(start, end);

    return res.json({
      page,
      limit,
      total,
      unread_count,
      data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
// PATCH /me/notifications/seen-all
module.exports.seenAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "notifications.$[].is_read": true,
          "notifications.$[].read_at": new Date(),
        },
      }
    );

    return res.json({ message: "All notifications marked as read" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
