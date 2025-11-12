// utils/scheduleConflict.js
const checkScheduleConflict = async ({
  exam,
  grade,
  date,
  startTime,
  duration = 90,
  excludeId,
}) => {
  const [h, m] = startTime.split(":").map(Number);
  const newStart = dayjs(date).hour(h).minute(m);
  const newEnd = newStart.add(duration, "minute");

  const conflict = await ExamSchedule.findOne({
    exam,
    grade,
    date: {
      $gte: dayjs(date).startOf("day").toDate(),
      $lte: dayjs(date).endOf("day").toDate(),
    },
    ...(excludeId && { _id: { $ne: excludeId } }),
  }).lean();

  if (!conflict) return null;

  // Tính start/end của conflict
  let conflictStart, conflictEnd;

  if (conflict.startTime && conflict.endTime) {
    const [ch, cm] = conflict.startTime.split(":").map(Number);
    const [eh, em] = conflict.endTime.split(":").map(Number);
    conflictStart = dayjs(conflict.date).hour(ch).minute(cm);
    conflictEnd = dayjs(conflict.date).hour(eh).minute(em);
  } else if (conflict.startTime && conflict.duration) {
    // Dùng duration nếu endTime thiếu
    const [ch, cm] = conflict.startTime.split(":").map(Number);
    conflictStart = dayjs(conflict.date).hour(ch).minute(cm);
    conflictEnd = conflictStart.add(conflict.duration, "minute");
  } else {
    return null; // không đủ dữ liệu
  }

  // Kiểm tra giao nhau
  const hasConflict = conflictStart.isBefore(newEnd) && conflictEnd.isAfter(newStart);

  return hasConflict ? conflict : null;
};