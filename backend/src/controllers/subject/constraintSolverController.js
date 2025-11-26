const mongoose = require("mongoose");
const Schedule = require("../../models/subject/schedule");
const ScheduleConfig = require("../../models/subject/scheduleConfig");
const Class = require("../../models/class/class");
const Subject = require("../../models/subject/subject");
const Activity = require("../../models/subject/activity");
const TeachingAssignment = require("../../models/subject/teachingAssignment");
const ClassPeriods = require("../../models/class/classPeriods");

/**
 * Helper: Convert Map/Object config to plain object
 */
const getGradeConfig = (config, grade) => {
  if (!config || !config.gradeConfigs) {
    return null;
  }
  if (config.gradeConfigs instanceof Map) {
    return config.gradeConfigs.get(grade) || null;
  }
  return config.gradeConfigs[grade] || null;
};

const getSubjectConfig = (gradeConfig, subjectId) => {
  if (!gradeConfig || !gradeConfig.subjects) return null;
  const key = typeof subjectId === "string" ? subjectId : subjectId.toString();
  if (gradeConfig.subjects instanceof Map) {
    return gradeConfig.subjects.get(key) || null;
  }
  return gradeConfig.subjects[key] || null;
};

const toObjectId = (id) => {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
};

const getSubjectPeriodsPerWeek = ({
  subjectId,
  grade,
  classId,
  classPeriodsRecord,
  gradeConfig,
}) => {
  const subjectIdStr = subjectId.toString();
  // 1. ClassPeriods (ưu tiên nhất)
  if (classPeriodsRecord && classPeriodsRecord.subjectPeriods) {
    if (classPeriodsRecord.subjectPeriods instanceof Map) {
      const value = classPeriodsRecord.subjectPeriods.get(subjectIdStr);
      if (value) return value;
    } else if (typeof classPeriodsRecord.subjectPeriods === "object") {
      const value = classPeriodsRecord.subjectPeriods[subjectIdStr];
      if (value) return value;
    }
  }

  // 2. Grade config - class specific overrides
  if (gradeConfig) {
    const subjectConfig = getSubjectConfig(gradeConfig, subjectIdStr);
    if (subjectConfig) {
      if (subjectConfig.classPeriods) {
        const map =
          subjectConfig.classPeriods instanceof Map
            ? subjectConfig.classPeriods
            : new Map(Object.entries(subjectConfig.classPeriods));
        const value = map.get(classId.toString());
        if (value) return value;
      }
      if (subjectConfig.periodsPerWeek) {
        return subjectConfig.periodsPerWeek;
      }
    }
  }

  // 3. Fallback
  if (gradeConfig && gradeConfig.periodsPerWeek) {
    const defaultValue =
      gradeConfig.periodsPerWeek[subjectIdStr] ||
      gradeConfig.periodsPerWeek[subjectId];
    if (defaultValue) return defaultValue;
  }

  return 0;
};

const buildDaysFromConfig = (config) => {
  if (!config || !config.days) {
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  }
  if (config.days instanceof Map) {
    return Array.from(config.days.keys());
  }
  return Object.keys(config.days);
};

const getPeriodsForSession = (config, session, days) => {
  if (!config || !config.days) {
    // default 5 periods per session
    return {
      morning: 5,
      afternoon: 5,
    }[session] || 5;
  }
  const firstDay = days[0];
  const dayConfig =
    (config.days instanceof Map
      ? config.days.get(firstDay)
      : config.days[firstDay]) || {};
  if (session === "morning") {
    return dayConfig.morningPeriods || 5;
  }
  return dayConfig.afternoonPeriods || 5;
};

const getSessionRanges = (mainSession, days, config) => {
  const morningCount = getPeriodsForSession(config, "morning", days);
  const afternoonCount = getPeriodsForSession(config, "afternoon", days);
  const total = morningCount + afternoonCount;

  const mainStart = mainSession === "morning" ? 0 : morningCount;
  const mainEnd = mainSession === "morning" ? morningCount : total;
  const extraStart = mainSession === "morning" ? morningCount : 0;
  const extraEnd = mainSession === "morning" ? total : morningCount;

  return {
    morningCount,
    afternoonCount,
    total,
    mainStart,
    mainEnd,
    extraStart,
    extraEnd,
  };
};

const createEmptyTimetable = (days, totalPeriods, restPeriods = []) => {
  const restMap = new Map();
  restPeriods.forEach((entry) => {
    if (!entry || !entry.day || typeof entry.period !== "number") return;
    if (!restMap.has(entry.day)) {
      restMap.set(entry.day, new Set());
    }
    restMap.get(entry.day).add(entry.period);
  });

  return days.map((day) => {
    const lockedSet = restMap.get(day) || new Set();
    return {
      day,
      periods: Array.from({ length: totalPeriods }).map((_, idx) => ({
        period: idx + 1,
        subject: "",
        teacher: "",
        teacherId: null,
        subjectId: null,
        locked: lockedSet.has(idx + 1),
      })),
    };
  });
};

const normalizeDayName = (day = "") => day.toLowerCase().slice(0, 3);

const placeActivitiesOnTimetable = ({
  timetable,
  days,
  sessionRanges,
  gradeConfig,
  classPeriodsRecord,
  classId,
  activitiesMap,
}) => {
  if (!gradeConfig || !Array.isArray(gradeConfig.activities)) return;

  const getActivityPeriods = (activityConfig) => {
    const activityIdStr = activityConfig.activityId?.toString();
    if (!activityIdStr) return 0;

    if (classPeriodsRecord && classPeriodsRecord.activityPeriods) {
      if (classPeriodsRecord.activityPeriods instanceof Map) {
        const value = classPeriodsRecord.activityPeriods.get(activityIdStr);
        if (value) return value;
      } else if (typeof classPeriodsRecord.activityPeriods === "object") {
        const value = classPeriodsRecord.activityPeriods[activityIdStr];
        if (value) return value;
      }
    }

    if (activityConfig.classPeriods) {
      const map =
        activityConfig.classPeriods instanceof Map
          ? activityConfig.classPeriods
          : new Map(Object.entries(activityConfig.classPeriods || {}));
      const value = map.get(classId.toString());
      if (value) return value;
    }

    return activityConfig.periodsPerWeek || 0;
  };

  gradeConfig.activities.forEach((activityConfig) => {
    if (!activityConfig?.activityId) return;
    const activityIdStr = activityConfig.activityId.toString();
    const activity = activitiesMap.get(activityIdStr);
    const activityName = activity?.name || activityConfig.name || "Hoạt động";

    const periodsPerWeek = getActivityPeriods(activityConfig);
    if (periodsPerWeek <= 0) return;

    const session = activityConfig.session === "extra" ? "extra" : "main";
    const targetStart = session === "extra" ? sessionRanges.extraStart : sessionRanges.mainStart;
    const targetEnd = session === "extra" ? sessionRanges.extraEnd : sessionRanges.mainEnd;

    const tryPlaceSlot = (dayIdx, periodIdx) => {
      if (
        dayIdx < 0 ||
        dayIdx >= timetable.length ||
        periodIdx < 0 ||
        periodIdx >= timetable[dayIdx].periods.length
      ) {
        return false;
      }
      const slot = timetable[dayIdx].periods[periodIdx];
      if (!slot || slot.subject || slot.locked) return false;
      slot.subject = activityName;
      slot.teacher = "";
      slot.locked = true;
      return true;
    };

    if (activityConfig.fixedSlots && activityConfig.fixedSlots.dayOfWeek && activityConfig.fixedSlots.period) {
      const dayIdx = days.findIndex(
        (day) => normalizeDayName(day) === normalizeDayName(activityConfig.fixedSlots.dayOfWeek)
      );
      const periodIdx = (activityConfig.fixedSlots.period || 1) - 1;
      if (tryPlaceSlot(dayIdx, periodIdx)) {
        console.log(
          `📌 Hoạt động ${activityName} (lớp ${classId}) cố định vào ${activityConfig.fixedSlots.dayOfWeek} tiết ${activityConfig.fixedSlots.period}`
        );
        return;
      }
      console.warn(
        `⚠️ Không thể xếp hoạt động cố định ${activityName} cho lớp ${classId} ở ${activityConfig.fixedSlots.dayOfWeek} tiết ${activityConfig.fixedSlots.period} (slot đã bị chiếm hoặc khóa)`
      );
    }

    let placed = 0;
    let attempts = 0;
    const maxAttempts = 500;
    while (placed < periodsPerWeek && attempts < maxAttempts) {
      attempts++;
      const dayIdx = Math.floor(Math.random() * days.length);
      const periodIdx =
        Math.floor(Math.random() * Math.max(1, targetEnd - targetStart)) + targetStart;
      if (tryPlaceSlot(dayIdx, periodIdx)) {
        placed++;
      }
    }

    if (placed < periodsPerWeek) {
      console.warn(
        `⚠️ Không thể xếp đủ hoạt động ${activityName}: ${placed}/${periodsPerWeek} tiết (class ${classId})`
      );
    } else {
      console.log(
        `📌 Hoạt động ${activityName} (lớp ${classId}) đã xếp đủ ${periodsPerWeek} tiết (session ${session})`
      );
    }
  });
};

const getTeacherAvailability = (teacher, dayIdx, periodIdx) => {
  if (!teacher || !teacher.availableMatrix) return true;
  const matrix = teacher.availableMatrix;
  if (!Array.isArray(matrix)) return true;
  if (dayIdx < 0 || dayIdx >= matrix.length) return true;
  const dayRow = matrix[dayIdx];
  if (!Array.isArray(dayRow)) return true;
  if (periodIdx < 0 || periodIdx >= dayRow.length) return true;
  const value = dayRow[periodIdx];
  return value === true || value === undefined || value === null;
};

const makeSlotKey = (id, day, period) => `${id}_${day}_${period}`;

const buildVariablesForClass = ({
  classAssignments,
  classObj,
  classPeriodsRecord,
  gradeConfig,
  subjectMap,
  allowPairs = true,
}) => {
  const variables = [];

  classAssignments.forEach((assignment) => {
    if (!assignment.subjectId || !assignment.teacherId) return;
    const subjectIdStr = assignment.subjectId._id.toString();
    const subjectData = subjectMap.get(subjectIdStr);
    const subjectName = subjectData?.name || assignment.subjectId.name || "Môn học";

    const periodsPerWeek = getSubjectPeriodsPerWeek({
      subjectId: subjectIdStr,
      grade: classObj.grade,
      classId: classObj._id,
      classPeriodsRecord,
      gradeConfig,
    });

    if (periodsPerWeek <= 0) return;

    const subjectConfig = getSubjectConfig(gradeConfig, subjectIdStr) || {};
    const maxPerDay = subjectConfig.maxPerDay || subjectConfig.maxPeriodsPerDay || 2;
    const session = subjectConfig.session === "extra" ? "extra" : "main";
    const canPair = allowPairs && subjectConfig.allowConsecutive !== false;

    let remainingPeriods = periodsPerWeek;

    if (canPair && remainingPeriods >= 2) {
      const pairCount = Math.floor(remainingPeriods / 2);
      for (let i = 0; i < pairCount; i++) {
        variables.push({
          id: `${subjectIdStr}-pair-${i}-${classObj._id}`,
          subjectId: assignment.subjectId._id,
          subjectName,
          teacherId: assignment.teacherId._id,
          teacherName: assignment.teacherId.name || "Chưa rõ",
          teacher: assignment.teacherId,
          maxPerDay,
          session,
          length: 2,
        });
      }
      remainingPeriods -= pairCount * 2;
    }

    for (let i = 0; i < remainingPeriods; i++) {
      variables.push({
        id: `${subjectIdStr}-single-${i}-${classObj._id}`,
        subjectId: assignment.subjectId._id,
        subjectName,
        teacherId: assignment.teacherId._id,
        teacherName: assignment.teacherId.name || "Chưa rõ",
        teacher: assignment.teacherId,
        maxPerDay,
        session,
        length: 1,
      });
    }
  });

  return variables;
};

/**
 * Domain builder for MRV
 */
const buildDomainForVariable = ({
  variable,
  timetable,
  days,
  sessionRanges,
  teacherSlotMap,
  roomSlotMap,
  classRoomId,
  perDaySubjectCount,
}) => {
  const domain = [];
  const { subjectName, teacherId, teacher, session, maxPerDay } = variable;
  const slotsNeeded = variable.length && variable.length > 0 ? variable.length : 1;
  const targetStart = session === "extra" ? sessionRanges.extraStart : sessionRanges.mainStart;
  const targetEnd = session === "extra" ? sessionRanges.extraEnd : sessionRanges.mainEnd;

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const dayEntry = timetable[dayIdx];
    if (!dayEntry) continue;

    const subjectCountMap = perDaySubjectCount.get(dayEntry.day) || new Map();
    const currentCount = subjectCountMap.get(subjectName) || 0;
    if (currentCount + slotsNeeded > maxPerDay) continue;

    for (let periodIdx = targetStart; periodIdx <= targetEnd - slotsNeeded; periodIdx++) {
      const slot = dayEntry.periods[periodIdx];
      if (!slot || slot.subject || slot.locked) continue;
      if (!getTeacherAvailability(teacher, dayIdx, periodIdx)) continue;

      const positions = [];
      let conflictFound = false;
      for (let offset = 0; offset < slotsNeeded; offset++) {
        const checkingIdx = periodIdx + offset;
        const checkingSlot = dayEntry.periods[checkingIdx];
        if (!checkingSlot || checkingSlot.subject || checkingSlot.locked) {
          conflictFound = true;
          break;
        }
        if (!getTeacherAvailability(teacher, dayIdx, checkingIdx)) {
          conflictFound = true;
          break;
        }
        if (teacherId) {
          const key = makeSlotKey(teacherId.toString(), dayEntry.day, checkingSlot.period);
          if (teacherSlotMap.has(key)) {
            conflictFound = true;
            break;
          }
        }
        if (classRoomId) {
          const roomKey = makeSlotKey(classRoomId, dayEntry.day, checkingSlot.period);
          if (roomSlotMap.has(roomKey)) {
            conflictFound = true;
            break;
          }
        }
        positions.push(checkingIdx);
      }
      if (conflictFound) continue;

      domain.push({
        dayIdx,
        day: dayEntry.day,
        positions,
      });
    }
  }

  return domain;
};

const solveClassWithBacktracking = ({
  classObj,
  buildTimetable,
  buildVariables,
  days,
  sessionRanges,
  teacherSlotMap,
  roomSlotMap,
  classRoomId,
}) => {
  const perDaySubjectCount = new Map();
  days.forEach((day) => perDaySubjectCount.set(day, new Map()));

  const assignToSlot = (variable, position, timetable) => {
    const positions = position.positions || [position.periodIdx];
    const dayEntry = timetable[position.dayIdx];
    const subjectCountMap = perDaySubjectCount.get(dayEntry.day);
    const teacherKeys = [];
    const roomKeys = [];

    positions.forEach((periodIdx) => {
      const slot = dayEntry.periods[periodIdx];
      slot.subject = variable.subjectName;
      slot.subjectId = variable.subjectId;
      slot.teacher = variable.teacherName;
      slot.teacherId = variable.teacherId;

      if (variable.teacherId) {
        const teacherKey = makeSlotKey(
          variable.teacherId.toString(),
          dayEntry.day,
          slot.period
        );
        teacherSlotMap.set(teacherKey, {
          className: classObj.className,
          classId: classObj._id,
        });
        teacherKeys.push(teacherKey);
      }

      if (classRoomId) {
        const roomKey = makeSlotKey(classRoomId, dayEntry.day, slot.period);
        roomSlotMap.set(roomKey, {
          className: classObj.className,
          classId: classObj._id,
        });
        roomKeys.push(roomKey);
      }
    });

    subjectCountMap.set(
      variable.subjectName,
      (subjectCountMap.get(variable.subjectName) || 0) + positions.length
    );

    return { teacherKeys, roomKeys };
  };

  const removeAssignment = (variable, position, keys, timetable) => {
    const positions = position.positions || [position.periodIdx];
    const dayEntry = timetable[position.dayIdx];

    positions.forEach((periodIdx) => {
      const slot = dayEntry.periods[periodIdx];
      slot.subject = "";
      slot.subjectId = null;
      slot.teacher = "";
      slot.teacherId = null;
    });

    const subjectCountMap = perDaySubjectCount.get(dayEntry.day);
    subjectCountMap.set(
      variable.subjectName,
      Math.max((subjectCountMap.get(variable.subjectName) || positions.length) - positions.length, 0)
    );

    (keys.teacherKeys || []).forEach((key) => teacherSlotMap.delete(key));
    (keys.roomKeys || []).forEach((key) => roomSlotMap.delete(key));
  };

  const forwardCheck = (remaining, cache) => {
    for (const variable of remaining) {
      const cached = cache.get(variable.id);
      if (!cached) {
        return false;
      }
      if (cached.length === 0) {
        return false;
      }
    }
    return true;
  };

  let iterations = 0;
  const maxIterations = 200000;

  const backtrack = (pendingVars, timetable) => {
    iterations += 1;
    if (iterations > maxIterations) {
      return false;
    }
    if (pendingVars.length === 0) {
      return true;
    }

    let bestVar = null;
    let bestDomain = null;
    const domainCache = new Map();

    for (const variable of pendingVars) {
      const domain = buildDomainForVariable({
        variable,
        timetable,
        days,
        sessionRanges,
        teacherSlotMap,
        roomSlotMap,
        classRoomId,
        perDaySubjectCount,
      });
      domainCache.set(variable.id, domain);

      if (domain.length === 0) {
        return false;
      }

      if (!bestVar || domain.length < bestDomain.length) {
        bestVar = variable;
        bestDomain = domain;
        if (domain.length === 1) break;
      }
    }

    if (!bestVar || !bestDomain || bestDomain.length === 0) {
      return false;
    }

    const shuffledDomain = [...bestDomain].sort(() => Math.random() - 0.5);

    for (const position of shuffledDomain) {
      const keys = assignToSlot(bestVar, position, timetable);
      const remaining = pendingVars.filter((v) => v.id !== bestVar.id);

      if (forwardCheck(remaining, domainCache)) {
        if (backtrack(remaining, timetable)) {
          return true;
        }
      }

      removeAssignment(bestVar, position, keys, timetable);
    }

    return false;
  };

  const timetable = buildTimetable();
  const variables = buildVariables();
  if (!Array.isArray(variables) || variables.length === 0) {
    return {
      success: false,
      timetable: null,
      stats: { iterations: 0 },
      maxIterations,
    };
  }
  const success = backtrack(variables, timetable);

  return {
    success,
    timetable: success
      ? timetable.map((dayEntry) => ({
          day: dayEntry.day,
          periods: dayEntry.periods.map((slot) => ({
            period: slot.period,
            subject: slot.subject,
            teacher: slot.teacher,
            teacherId: slot.teacherId,
            subjectId: slot.subjectId,
          })),
        }))
      : null,
    stats: {
      iterations,
    },
    maxIterations,
  };
};

exports.solveWithBacktracking = async (req, res) => {
  try {
    const { grades, year, semester } = req.body;

    if (!year || !semester) {
      return res.status(400).json({
        message: "Thiếu tham số: year và semester là bắt buộc",
      });
    }

    let targetGrades = grades;
    if (!Array.isArray(targetGrades) || targetGrades.length === 0) {
      return res.status(400).json({
        message: "Vui lòng chọn ít nhất 1 khối để tạo lịch.",
      });
    }

    const config = await ScheduleConfig.findOne();
    if (!config) {
      return res.status(400).json({ message: "Chưa có cấu hình thời khóa biểu." });
    }

    const classes = await Class.find({
      year,
      grade: { $in: targetGrades },
    }).populate("roomId");

    if (classes.length === 0) {
      return res.status(404).json({
        message: `Không tìm thấy lớp nào cho khối ${targetGrades.join(", ")} năm học ${year}`,
      });
    }

    const classIds = classes.map((cls) => cls._id.toString());
    const classIdSet = new Set(classIds);

    const subjects = await Subject.find({ isActive: { $ne: false } }).lean();
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));

    const assignments = await TeachingAssignment.find({ year, semester })
      .populate("teacherId", "name availableMatrix")
      .populate("subjectId", "name")
      .populate("classId", "className classCode grade roomId")
      .lean();

    const classAssignmentsMap = new Map();
    assignments.forEach((assignment) => {
      if (!assignment.classId) return;
      const clsId = assignment.classId._id.toString();
      if (!classIdSet.has(clsId)) return;
      if (!classAssignmentsMap.has(clsId)) {
        classAssignmentsMap.set(clsId, []);
      }
      classAssignmentsMap.get(clsId).push(assignment);
    });

    const activities = await Activity.find({ isActive: true }).lean();
    const activitiesMap = new Map(activities.map((activity) => [activity._id.toString(), activity]));

    const classPeriodsRecords = await ClassPeriods.find({
      year,
      semester,
      classId: { $in: classIds },
    }).lean();
    const classPeriodsMap = new Map(
      classPeriodsRecords.map((record) => [record.classId.toString(), record])
    );

    const classesSameYear = await Class.find({ year }).lean();
    const classRoomMap = new Map(
      classesSameYear.map((cls) => [cls._id.toString(), cls.roomId ? cls.roomId.toString() : null])
    );

    const existingSchedules = await Schedule.find({ year, semester }).lean();
    const teacherSlotMap = new Map();
    const roomSlotMap = new Map();

    existingSchedules.forEach((schedule) => {
      const classIdStr = schedule.classId?.toString();
      if (!classIdStr) return;
      const roomId = classRoomMap.get(classIdStr);
      const shouldRespect = !classIdSet.has(classIdStr);

      if (!shouldRespect) {
        return;
      }

      schedule.timetable.forEach((dayEntry) => {
        dayEntry.periods.forEach((slot) => {
          if (slot.teacherId) {
            const key = makeSlotKey(slot.teacherId.toString(), dayEntry.day, slot.period);
            teacherSlotMap.set(key, {
              className: schedule.className,
              classId: schedule.classId,
            });
          }
          if (roomId) {
            const roomKey = makeSlotKey(roomId, dayEntry.day, slot.period);
            roomSlotMap.set(roomKey, {
              className: schedule.className,
              classId: schedule.classId,
            });
          }
        });
      });
    });

    const results = [];
    const errors = [];

    for (const classObj of classes) {
      const gradeConfig = getGradeConfig(config, classObj.grade);
      if (!gradeConfig) {
        errors.push({
          className: classObj.className,
          error: `Không tìm thấy cấu hình cho khối ${classObj.grade}`,
        });
        continue;
      }

      const classAssignments = classAssignmentsMap.get(classObj._id.toString()) || [];
      if (classAssignments.length === 0) {
        errors.push({
          className: classObj.className,
          error: "Lớp chưa có phân công giảng dạy.",
        });
        continue;
      }

      const classPeriodsRecord = classPeriodsMap.get(classObj._id.toString());

      const days = buildDaysFromConfig(config);
      let mainSession = "morning";
      if (gradeConfig?.rules?.session === "afternoon") {
        mainSession = "afternoon";
      } else if (gradeConfig?.rules?.session === "both") {
        mainSession = "morning";
      }
      const sessionRanges = getSessionRanges(mainSession, days, config);

      const buildTimetable = () => {
        const timetable = createEmptyTimetable(
          days,
          sessionRanges.total,
          gradeConfig.restPeriods || []
        );

        placeActivitiesOnTimetable({
          timetable,
          days,
          sessionRanges,
          gradeConfig,
          classPeriodsRecord,
          classId: classObj._id,
          activitiesMap,
        });

        return timetable;
      };

      const buildVariables = (allowPairs) =>
        buildVariablesForClass({
          classAssignments,
          classObj,
          classPeriodsRecord,
          gradeConfig,
          subjectMap,
          allowPairs,
        });

      const attemptSolve = (allowPairs) =>
        solveClassWithBacktracking({
          classObj,
          buildTimetable,
          buildVariables: () => buildVariables(allowPairs),
          days,
          sessionRanges,
          teacherSlotMap,
          roomSlotMap,
          classRoomId: classObj.roomId ? classObj.roomId.toString() : null,
        });

      let result = attemptSolve(true);

      if (!result.success) {
        console.warn(
          `⚠️ Solver không thể xếp lớp ${classObj.className} khi ưu tiên tiết liền kề. Thử lại với cấu hình linh hoạt hơn...`
        );
        result = attemptSolve(false);
      }

      if (!result.success) {
        const iterations = result.stats?.iterations ?? 0;
        const limit = result.maxIterations ?? 0;
        const reason =
          limit > 0 && iterations >= limit
            ? `Thuật toán vượt quá giới hạn ${limit} bước cho lớp ${classObj.className}`
            : `Thuật toán Backtracking không tìm được lời giải cho lớp ${classObj.className}`;
        console.warn(`⚠️ ${reason} (iterations=${iterations})`);
        errors.push({
          className: classObj.className,
          error: reason,
        });
        continue;
      }
      const solvedTable = result.timetable;
      const stats = result.stats || { iterations: 0 };
      console.log(
        `✅ Solver Backtracking thành công lớp ${classObj.className} (iterations=${result.stats.iterations})`
      );

      results.push({
        classId: classObj._id,
        className: classObj.className,
        timetable: solvedTable,
        stats,
      });
    }

    if (results.length === 0) {
      return res.status(400).json({
        message: "Không thể tạo lịch bằng thuật toán Backtracking.",
        errors,
      });
    }

    const savedSchedules = [];
    for (const scheduleData of results) {
      try {
        await Schedule.deleteMany({
          classId: scheduleData.classId,
          year,
          semester,
        });

        const newSchedule = new Schedule({
          classId: scheduleData.classId,
          className: scheduleData.className,
          year,
          semester,
          timetable: scheduleData.timetable,
          isLocked: false,
        });

        await newSchedule.save();
        console.log(`💾 Đã lưu TKB Backtracking cho lớp ${scheduleData.className}`);
        savedSchedules.push(scheduleData);
      } catch (err) {
        console.error(`❌ Lỗi lưu lịch Backtracking cho lớp ${scheduleData.className}:`, err);
        errors.push({
          className: scheduleData.className,
          error: err.message || "Không thể lưu thời khóa biểu (xung đột giáo viên/phòng).",
        });
      }
    }

    if (savedSchedules.length === 0) {
      return res.status(400).json({
        message: "Không thể lưu bất kỳ thời khóa biểu nào sau khi giải Backtracking.",
        errors,
      });
    }

    return res.json({
      message: `Đã tạo thời khóa biểu bằng thuật toán Backtracking cho ${savedSchedules.length}/${classes.length} lớp`,
      algorithm: "CSP Backtracking (MRV + Forward Checking)",
      success: savedSchedules.length,
      failed: errors.length,
      total: classes.length,
      results: savedSchedules.map((item) => ({
        classId: item.classId,
        className: item.className,
        stats: item.stats,
      })),
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("❌ Lỗi Constraint Solver Backtracking:", error);
    return res.status(500).json({
      message: "Lỗi server khi chạy thuật toán Backtracking.",
      error: error.message,
    });
  }
};


