const { ScheduleConfig, getOrCreateConfig } = require('../../services/scheduleConfigService');

// ✅ [GET] /api/scheduleConfig
exports.getScheduleConfig = async (req, res) => {
  try {
    const config = await ScheduleConfig.findOne();
    if (!config) {
      return res.json(null);
    }

    // ✅ Convert Map sang Object để frontend dễ xử lý
    const configObj = config.toObject();
    
    // ✅ Convert days: Map -> Object
    if (configObj.days instanceof Map) {
      const daysObj = {};
      for (const [dayKey, dayData] of configObj.days.entries()) {
        daysObj[dayKey] = dayData;
      }
      configObj.days = daysObj;
    }

    // ✅ Convert gradeConfigs: Map -> Object (cấu trúc mới)
    if (configObj.gradeConfigs instanceof Map) {
      const gradeConfigsObj = {};
      for (const [grade, gradeConfig] of configObj.gradeConfigs.entries()) {
        const normalized = {};
        
        // Convert subjects Map -> Object
        if (gradeConfig.subjects instanceof Map) {
          const subjectsObj = {};
          for (const [subjectId, subjectData] of gradeConfig.subjects.entries()) {
            const normalizedSubject = {
              periodsPerWeek: subjectData.periodsPerWeek || 4,
              session: subjectData.session || "main",
              maxPeriodsPerDay: subjectData.maxPeriodsPerDay ?? 2,
              allowConsecutive: subjectData.allowConsecutive ?? true,
            };
            // ✅ Xử lý fixedSlots (format: { dayOfWeek, periods: [1, 2] })
            if (subjectData.fixedSlots && typeof subjectData.fixedSlots === 'object') {
              normalizedSubject.fixedSlots = subjectData.fixedSlots;
            }
            subjectsObj[subjectId] = normalizedSubject;
          }
          normalized.subjects = subjectsObj;
        } else {
          normalized.subjects = gradeConfig.subjects || {};
        }
        
        // Convert activities array
        if (Array.isArray(gradeConfig.activities)) {
          normalized.activities = gradeConfig.activities.map((activity) => {
            const normalizedAct = {
              activityId: activity.activityId ? (activity.activityId.toString ? activity.activityId.toString() : String(activity.activityId)) : null,
              periodsPerWeek: activity.periodsPerWeek ?? 0, // ✅ Default 0
              session: activity.session || "main",
              isPermanent: activity.isPermanent || false,
              // ✅ allowConsecutive sẽ được set trong gradeConfigs[grade] nếu có
            };
            
            // ✅ Xử lý fixedSlots (format: { dayOfWeek, period })
            if (activity.fixedSlots && typeof activity.fixedSlots === 'object') {
              normalizedAct.fixedSlots = activity.fixedSlots;
            }
            
            if (activity.startDate) {
              normalizedAct.startDate = activity.startDate instanceof Date 
                ? activity.startDate.toISOString().split('T')[0] 
                : activity.startDate;
            }
            if (activity.endDate) {
              normalizedAct.endDate = activity.endDate instanceof Date 
                ? activity.endDate.toISOString().split('T')[0] 
                : activity.endDate;
            }
            return normalizedAct;
          });
        } else {
          normalized.activities = gradeConfig.activities || [];
        }
        
        // Rules (giữ nguyên)
        normalized.rules = gradeConfig.rules || null;
        
        // ✅ Convert restPeriods (giữ nguyên format: [{ day: string, period: number }])
        if (Array.isArray(gradeConfig.restPeriods)) {
          normalized.restPeriods = gradeConfig.restPeriods;
        } else {
          normalized.restPeriods = [];
        }
        
        gradeConfigsObj[grade] = normalized;
      }
      configObj.gradeConfigs = gradeConfigsObj;
    }

    res.json(configObj);
  } catch (error) {
    console.error("❌ [getScheduleConfig] Lỗi khi lấy cấu hình thời khóa biểu:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: "Lỗi khi lấy cấu hình thời khóa biểu",
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ✅ Helper: Kiểm tra conflict giữa các fixedSlots
function validateFixedSlotsConflicts(activities) {
  const conflicts = [];
  const fixedSlotsMap = new Map(); // Map<"day-period", {activityId, activityName}>
  
  if (!Array.isArray(activities)) return conflicts;
  
  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    
    // ✅ Xử lý format mới: fixedSlots là object { dayOfWeek, period }
    if (activity.fixedSlots && typeof activity.fixedSlots === 'object' && !Array.isArray(activity.fixedSlots)) {
      const fixedSlots = activity.fixedSlots;
      if (fixedSlots.dayOfWeek && typeof fixedSlots.period === 'number') {
        // Format mới: { dayOfWeek, period }
        const slotKey = `${fixedSlots.dayOfWeek}-${fixedSlots.period}`;
        
        let activityName = 'Unknown';
        let activityId = null;
        if (activity.activityId) {
          if (typeof activity.activityId === 'object') {
            activityName = activity.activityId.name || activity.activityId._id?.toString() || 'Unknown';
            activityId = activity.activityId._id || activity.activityId;
          } else {
            activityName = activity.activityId.toString();
            activityId = activity.activityId;
          }
        }
        if (!activityId) {
          activityName = `Activity #${i + 1}`;
          activityId = `activity_${i}`;
        }
        
        if (fixedSlotsMap.has(slotKey)) {
          const existing = fixedSlotsMap.get(slotKey);
          conflicts.push({
            day: fixedSlots.dayOfWeek,
            period: fixedSlots.period,
            slotKey: slotKey,
            activity1: {
              id: existing.activityId,
              name: existing.activityName
            },
            activity2: {
              id: activityId,
              name: activityName
            }
          });
        } else {
          fixedSlotsMap.set(slotKey, {
            activityId: activityId,
            activityName: activityName
          });
        }
      }
    }
    
    // ✅ Legacy: fixedSlots là array (backward compatibility)
    if (activity.fixedSlots && Array.isArray(activity.fixedSlots)) {
      let activityName = 'Unknown';
      let activityId = null;
      if (activity.activityId) {
        if (typeof activity.activityId === 'object') {
          activityName = activity.activityId.name || activity.activityId._id?.toString() || 'Unknown';
          activityId = activity.activityId._id || activity.activityId;
        } else {
          activityName = activity.activityId.toString();
          activityId = activity.activityId;
        }
      }
      if (!activityId) {
        activityName = `Activity #${i + 1}`;
        activityId = `activity_${i}`;
      }
      
      for (const fixedSlot of activity.fixedSlots) {
        if (!fixedSlot.day || !Array.isArray(fixedSlot.periods)) continue;
        for (const periodNum of fixedSlot.periods) {
          const slotKey = `${fixedSlot.day}-${periodNum}`;
          if (fixedSlotsMap.has(slotKey)) {
            const existing = fixedSlotsMap.get(slotKey);
            conflicts.push({
              day: fixedSlot.day,
              period: periodNum,
              slotKey: slotKey,
              activity1: {
                id: existing.activityId,
                name: existing.activityName
              },
              activity2: {
                id: activityId,
                name: activityName
              }
            });
          } else {
            fixedSlotsMap.set(slotKey, {
              activityId: activityId,
              activityName: activityName
            });
          }
        }
      }
    }
  }
  
  return conflicts;
}

// ✅ [POST] /api/scheduleConfig
// Upsert toàn bộ config
exports.upsertScheduleConfig = async (req, res) => {
  try {
    console.log("📩 Body nhận được:", JSON.stringify(req.body, null, 2));
    console.log("📩 Body type:", typeof req.body);
    console.log("📩 Body keys:", Object.keys(req.body || {}));

    const data = req.body;
    
    // ✅ Validate data tồn tại
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ 
        message: "Dữ liệu không hợp lệ", 
        error: "Body phải là một object" 
      });
    }
    
    // ✅ Kiểm tra conflict fixedSlots trong gradeConfigs
    if (data.gradeConfigs && typeof data.gradeConfigs === 'object') {
      const gradeConfigsObj = data.gradeConfigs instanceof Map 
        ? Object.fromEntries(data.gradeConfigs) 
        : data.gradeConfigs;
      
      for (const [grade, gradeConfig] of Object.entries(gradeConfigsObj)) {
        if (gradeConfig.activities && Array.isArray(gradeConfig.activities)) {
          const conflicts = validateFixedSlotsConflicts(gradeConfig.activities);
          if (conflicts.length > 0) {
            console.warn(`⚠️ CONFLICT FIXED SLOTS trong gradeConfigs[${grade}]:`);
            for (const conflict of conflicts) {
              console.warn(`  - ${conflict.day} tiết ${conflict.period}: "${conflict.activity1.name}" và "${conflict.activity2.name}" trùng nhau`);
            }
            return res.status(400).json({
              error: `Có conflict giữa các fixedSlots trong khối ${grade}`,
              grade: grade,
              conflicts: conflicts,
              message: `Phát hiện ${conflicts.length} conflict giữa các hoạt động có fixedSlots trùng nhau trong khối ${grade}. Vui lòng kiểm tra lại.`
            });
          }
        }
      }
    }

    // ✅ Normalize days: Convert từ Object sang Map
    if (data.days && typeof data.days === 'object' && !(data.days instanceof Map)) {
      const daysMap = new Map();
      for (const [dayKey, dayData] of Object.entries(data.days)) {
        daysMap.set(dayKey, dayData);
      }
      data.days = daysMap;
    }

    // ✅ Normalize gradeConfigs: Convert từ Object sang Map (cấu trúc mới) - CHỈ LẤY "10", "11", "12"
    if (data.gradeConfigs && typeof data.gradeConfigs === 'object' && !(data.gradeConfigs instanceof Map) && !Array.isArray(data.gradeConfigs)) {
      const gradeConfigsMap = new Map();
      const mongoose = require('mongoose');
      const VALID_GRADES = ["10", "11", "12"];
      
      // ✅ DỌN DẸP: CHỈ LẤY keys "10", "11", "12"
      const allKeys = Object.keys(data.gradeConfigs);
      const invalidKeys = allKeys.filter(k => !VALID_GRADES.includes(k));
      if (invalidKeys.length > 0) {
        console.log(`🧹 [Backend] Đã xóa các keys không hợp lệ trong gradeConfigs:`, invalidKeys);
      }
      
      for (const [grade, gradeConfig] of Object.entries(data.gradeConfigs)) {
        // ✅ CHỈ XỬ LÝ "10", "11", "12"
        if (!VALID_GRADES.includes(grade)) {
          console.warn(`⚠️ Bỏ qua gradeConfig key không hợp lệ: ${grade}`);
          continue;
        }
        
        // Skip nếu gradeConfig là null hoặc undefined
        if (!gradeConfig || typeof gradeConfig !== 'object') {
          console.warn(`⚠️ gradeConfig cho khối ${grade} không hợp lệ, bỏ qua`);
          continue;
        }
        const normalized = {};
        
        // Convert subjects Object -> Map
        if (gradeConfig.subjects && typeof gradeConfig.subjects === 'object' && !(gradeConfig.subjects instanceof Map)) {
          const subjectsMap = new Map();
          for (const [subjectId, subjectData] of Object.entries(gradeConfig.subjects)) {
            const normalizedSubject = {
              periodsPerWeek: subjectData.periodsPerWeek ?? 0, // ✅ Default 0
              session: subjectData.session || "main",
              maxPeriodsPerDay: subjectData.maxPeriodsPerDay ?? 0, // ✅ Default 0
              allowConsecutive: subjectData.allowConsecutive ?? false, // ✅ Default false
            };
            
            // ✅ Xử lý fixedSlots (format: { dayOfWeek, periods: [1, 2] })
            if (subjectData.fixedSlots && typeof subjectData.fixedSlots === 'object') {
              if (subjectData.fixedSlots.dayOfWeek && Array.isArray(subjectData.fixedSlots.periods)) {
                normalizedSubject.fixedSlots = {
                  dayOfWeek: subjectData.fixedSlots.dayOfWeek,
                  periods: subjectData.fixedSlots.periods,
                };
              }
            }
            
            subjectsMap.set(subjectId, normalizedSubject);
          }
          normalized.subjects = subjectsMap;
        } else {
          normalized.subjects = gradeConfig.subjects || new Map();
        }
        
        // Normalize activities array
        if (Array.isArray(gradeConfig.activities)) {
          normalized.activities = gradeConfig.activities
            .filter((activity) => {
              // ✅ Filter bỏ các activity không có activityId
              if (!activity || !activity.activityId) {
                console.warn(`⚠️ Activity trong gradeConfigs[${grade}] thiếu activityId, bỏ qua`);
                return false;
              }
              return true;
            })
            .map((activity, idx) => {
            // ✅ Validate và convert activityId
            let activityId = activity.activityId;
            // Convert string sang ObjectId nếu cần
            if (typeof activityId === 'string') {
              if (!mongoose.Types.ObjectId.isValid(activityId)) {
                throw new Error(`Invalid activityId format: ${activityId} in grade ${grade}`);
              }
              activityId = new mongoose.Types.ObjectId(activityId);
            } else if (activityId && activityId._id) {
              // Nếu là object có _id, lấy _id
              activityId = typeof activityId._id === 'string' 
                ? new mongoose.Types.ObjectId(activityId._id)
                : activityId._id;
            }
            
            const normalizedAct = {
              activityId: activityId,
              periodsPerWeek: activity.periodsPerWeek ?? 0, // ✅ Default 0
              session: activity.session || "main",
              isPermanent: activity.isPermanent || false,
            };

            // Convert startDate và endDate
            if (normalizedAct.isPermanent) {
              normalizedAct.startDate = null;
              normalizedAct.endDate = null;
            } else {
              normalizedAct.startDate = activity.startDate ? new Date(activity.startDate) : null;
              normalizedAct.endDate = activity.endDate ? new Date(activity.endDate) : null;
            }

            // ✅ Xử lý fixedSlots (format: { dayOfWeek, period })
            if (activity.fixedSlots && typeof activity.fixedSlots === 'object') {
              if (activity.fixedSlots.dayOfWeek && typeof activity.fixedSlots.period === 'number') {
                normalizedAct.fixedSlots = {
                  dayOfWeek: activity.fixedSlots.dayOfWeek,
                  period: activity.fixedSlots.period,
                };
              }
            }
            
            // Legacy: dayOfWeek, timeSlot (backward compatibility)
            if (activity.dayOfWeek) normalizedAct.dayOfWeek = activity.dayOfWeek;
            if (activity.timeSlot) normalizedAct.timeSlot = activity.timeSlot;

            return normalizedAct;
          });
        } else {
          normalized.activities = gradeConfig.activities || [];
        }
        
        // Rules (giữ nguyên, nhưng đảm bảo có grade và session)
        if (gradeConfig.rules && typeof gradeConfig.rules === 'object' && gradeConfig.rules !== null) {
          // ✅ Validate rules có đầy đủ field required
          if (!gradeConfig.rules.session) {
            console.warn(`⚠️ Rules cho khối ${grade} thiếu session, set mặc định "morning"`);
          }
          normalized.rules = {
            grade: gradeConfig.rules.grade || grade,
            session: gradeConfig.rules.session || "morning",
          };
        } else {
          normalized.rules = null;
        }
        
        // ✅ Xử lý restPeriods (format: [{ day: string, period: number }])
        if (Array.isArray(gradeConfig.restPeriods)) {
          // ✅ Validate và filter restPeriods
          normalized.restPeriods = gradeConfig.restPeriods.filter((r) => {
            return r && typeof r === 'object' && typeof r.day === 'string' && typeof r.period === 'number';
          });
        } else {
          normalized.restPeriods = [];
        }
        
        gradeConfigsMap.set(grade, normalized);
      }
      data.gradeConfigs = gradeConfigsMap;
    }

    let config = await ScheduleConfig.findOne();
    if (config) {
      console.log("🟡 Đã có config, cập nhật...");
      // ✅ Cập nhật từng field một cách cẩn thận
      if (data.days !== undefined) {
        console.log("📝 Cập nhật days:", data.days instanceof Map ? data.days.size : Object.keys(data.days).length, "ngày");
        config.days = data.days;
      }
      if (data.defaultStartTimeMorning !== undefined) config.defaultStartTimeMorning = data.defaultStartTimeMorning;
      if (data.defaultStartTimeAfternoon !== undefined) config.defaultStartTimeAfternoon = data.defaultStartTimeAfternoon;
      if (data.minutesPerPeriod !== undefined) config.minutesPerPeriod = data.minutesPerPeriod;
      if (data.defaultBreakMinutes !== undefined) config.defaultBreakMinutes = data.defaultBreakMinutes;
      if (data.specialBreaks !== undefined) config.specialBreaks = data.specialBreaks;
      
      // ✅ Cập nhật gradeConfigs (cấu trúc mới)
      if (data.gradeConfigs !== undefined) {
        console.log("📝 Cập nhật gradeConfigs:", data.gradeConfigs instanceof Map ? data.gradeConfigs.size : Object.keys(data.gradeConfigs).length, "khối");
        config.gradeConfigs = data.gradeConfigs;
      }
      
      console.log("💾 Đang lưu config...");
      await config.save();
      console.log("✅ Đã lưu config thành công");
    } else {
      console.log("🟢 Chưa có config, tạo mới...");
      config = await ScheduleConfig.create(data);
      console.log("✅ Đã tạo config mới thành công");
    }

    res.status(200).json({ message: "Đã lưu cấu hình thành công", config });
  } catch (err) {
    console.error("🔥 [ScheduleConfig] Lỗi khi lưu cấu hình:");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    if (err.errors) {
      console.error("Validation errors:", JSON.stringify(err.errors, null, 2));
    }
    if (err.name === 'ValidationError') {
      // Mongoose validation error
      const validationErrors = {};
      for (const field in err.errors) {
        validationErrors[field] = err.errors[field].message;
      }
      return res.status(400).json({ 
        message: "Lỗi validation dữ liệu", 
        error: err.message,
        validationErrors: validationErrors
      });
    }
    res.status(500).json({ 
      message: "Lỗi khi lưu cấu hình", 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};


// ✅ [PATCH] /api/scheduleConfig/day/:day
exports.updateDayConfig = async (req, res) => {
  try {
    const { day } = req.params;
    const { totalPeriods, morningPeriods } = req.body;

    let config = await ScheduleConfig.findOne();
    if (!config) config = await ScheduleConfig.create({});

    const currentDay = config.days.get(day) || {};
    const newConfig = {
      ...currentDay,
      totalPeriods: totalPeriods ?? currentDay.totalPeriods,
      morningPeriods: morningPeriods ?? currentDay.morningPeriods,
    };

    newConfig.afternoonPeriods = Math.max(0, newConfig.totalPeriods - newConfig.morningPeriods);

    config.days.set(day, newConfig);
    await config.save();

    res.status(200).json({
      message: `Đã cập nhật lịch cho thứ ${day}`,
      day: day,
      config: config.days.get(day),
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi cập nhật ngày", error: err.message });
  }
};

