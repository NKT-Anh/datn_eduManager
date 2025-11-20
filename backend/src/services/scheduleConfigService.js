const ScheduleConfig = require('../models/subject/scheduleConfig');

// ============================
// Pre-save middleware: auto calculate afternoon periods
// ============================
function setupPreSaveMiddleware() {
  ScheduleConfig.schema.pre("save", function (next) {
    if (this.days instanceof Map) {
      for (const [day, cfg] of this.days.entries()) {
        cfg.afternoonPeriods = Math.max(
          0,
          (cfg.totalPeriods || 0) - (cfg.morningPeriods || 0)
        );
      }
    }
    next();
  });
}

// ============================
// Validation middleware
// ============================
function setupValidationMiddleware() {
  ScheduleConfig.schema.path("days").validate(function (days) {
    for (const [day, cfg] of days.entries()) {
      if (cfg.morningPeriods > cfg.totalPeriods) {
        throw new Error(
          `Morning periods (${cfg.morningPeriods}) exceed total (${cfg.totalPeriods}) on ${day}`
        );
      }
    }
    return true;
  });
}

// ============================
// Method: Transform session "main"/"extra" → "morning"/"afternoon" theo khối
// ============================
function getEffectiveSession(config, subjectSession, grade) {
  // ✅ Ưu tiên sử dụng gradeConfigs (cấu trúc mới - mỗi khối có rules riêng)
  const gradeConfig = config.gradeConfigs?.get?.(grade) || config.gradeConfigs?.get?.(String(grade));
  let rule = gradeConfig?.rules;
  
  // ✅ Fallback về gradeSessionRules (backward compatibility)
  if (!rule && config.gradeSessionRules) {
    rule = config.gradeSessionRules.find(r => r.grade === grade || r.grade === String(grade));
  }
  
  if (!rule) return "morning"; // Default: morning

  if (subjectSession === "main") {
    // Buổi chính: trả về session của rule
    if (rule.session === "both") return "main"; // Nếu cả hai buổi, giữ "main"
    return rule.session; // "morning" hoặc "afternoon"
  }

  // extra = buổi ngược lại
  if (rule.session === "morning") return "afternoon";
  if (rule.session === "afternoon") return "morning";
  if (rule.session === "both") return "afternoon"; // Nếu cả hai buổi, extra → afternoon
  
  return "afternoon"; // Default fallback
}

// ============================
// Static: auto create config if missing
// ============================
async function getOrCreateConfig() {
  let cfg = await ScheduleConfig.findOne();
  if (!cfg) {
    cfg = await ScheduleConfig.create({
      days: new Map([
        ["Monday", { totalPeriods: 10, morningPeriods: 5 }],
        ["Tuesday", { totalPeriods: 10, morningPeriods: 5 }],
        ["Wednesday", { totalPeriods: 10, morningPeriods: 5 }],
        ["Thursday", { totalPeriods: 10, morningPeriods: 5 }],
        ["Friday", { totalPeriods: 10, morningPeriods: 5 }],
        ["Saturday", { totalPeriods: 10, morningPeriods: 5 }],
      ]),
    });
  }
  return cfg;
}

// ============================
// Initialize middleware
// ============================
setupPreSaveMiddleware();
setupValidationMiddleware();

module.exports = {
  getEffectiveSession,
  getOrCreateConfig,
  ScheduleConfig,
};

