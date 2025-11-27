import api from "./axiosInstance";
import { SchedulePayload } from "@/types/schedule";
import { teacherApi } from "./teacherApi";

export const scheduleApi = {
  getAllSchedules: async () => {
    const res = await api.get("/schedules");
    return res.data;
  },

  getScheduleByClass: async (classId: string | any, year: string, semester: string) => {
    // ✅ Đảm bảo classId là string
    const classIdStr = typeof classId === 'string' 
      ? classId 
      : (classId?._id?.toString() || classId?.toString() || String(classId));
    const res = await api.get(`/schedules/${classIdStr}/${year}/${semester}`);
    return res.data;
  },

  saveSchedule: async (payload: SchedulePayload) => {
    const res = await api.post("/schedules", payload);
    return res.data;
  },

  updateSchedule: async (id: string, payload: Partial<SchedulePayload>) => {
    const res = await api.put(`/schedules/${id}`, payload);
    return res.data;
  },

  deleteSchedule: async (id: string) => {
    const res = await api.delete(`/schedules/${id}`);
    return res.data;
  },
   deleteByGradeYearSemester: async (year: string, semester: string, grade: string) => {
  const res = await api.post("/schedules/delete-by-grade-year-semester", {
    year,
    semester,
    grade,
  });
  return res.data;
  
},
  getSchedulesByYearSemester: async (year: string, semester: string) => {
    const res = await api.get(`/schedules/year/${year}/semester/${semester}`);
    return res.data;
  },

  // 🆕 🧩 Lấy theo Khối + Năm + Học kỳ
  getSchedulesByGrade: async (grade: string, year: string, semester: string) => {
    const res = await api.get(`/schedules/grade/${grade}/year/${year}/semester/${semester}`);
    return res.data;
  },
  // 🆕 🧩 Lấy TKB theo giáo viên (theo teacherId để tránh trùng tên)
  getScheduleByTeacher: async (teacherId: string, year: string, semester: string) => {
    const res = await api.get(`/schedules/teacher/${teacherId}/${year}/${semester}`);
    return res.data;
  },
saveOrUpdateSchedule: async (payload: SchedulePayload) => {
  try {
    const { classId, year, semester, timetable } = payload;
    const isLocked = (payload as any).isLocked;

    if (!classId || !year || !semester || !timetable) {
      throw new Error('Thiếu thông tin bắt buộc: classId, year, semester, timetable');
    }

    // ✅ Kiểm tra nếu schedule đã khóa thì không cho phép lưu/xóa
    if (isLocked === true) {
      throw new Error('Thời khóa biểu đã được khóa. Không thể chỉnh sửa hoặc xóa.');
    }

    // ✅ Kiểm tra schedule hiện có có bị khóa không
    try {
      const classIdForCheck = typeof classId === 'string' 
        ? classId 
        : (classId as any)?._id?.toString() || String(classId);
      const existing = await scheduleApi.getScheduleByClass(classIdForCheck, year, semester);
      if (existing && existing.isLocked === true) {
        throw new Error('Thời khóa biểu đã được khóa. Không thể chỉnh sửa hoặc xóa. Vui lòng mở khóa trước khi chỉnh sửa.');
      }
    } catch (err: any) {
      // ✅ 404 là OK (chưa có schedule), nhưng nếu là lỗi khác thì throw
      if (err.response?.status !== 404 && err.message?.includes('khóa')) {
        throw err;
      }
    }

    // 1️⃣ Lấy toàn bộ TKB trong cùng năm học + học kỳ
    let allSchedules = [];
    try {
      allSchedules = await scheduleApi.getSchedulesByYearSemester(year, semester);
    } catch (err: any) {
      // Nếu lỗi 404 hoặc không tìm thấy, mảng rỗng là OK
      if (err.response?.status !== 404) {
        console.warn('⚠️ Không thể lấy danh sách lịch để kiểm tra trùng:', err);
      }
      allSchedules = [];
    }

    // ✅ Normalize classId để so sánh chính xác
    let currentClassIdStr: string;
    if (typeof classId === 'string') {
      currentClassIdStr = classId;
    } else if (classId && typeof classId === 'object' && '_id' in classId) {
      currentClassIdStr = (classId as any)._id?.toString() || String(classId);
    } else {
      currentClassIdStr = String(classId);
    }
    
    console.log('🔍 Current classId:', currentClassIdStr, 'Type:', typeof classId, 'Value:', classId);
    
    // ✅ Loại trừ schedule cũ của chính lớp đang được lưu khỏi allSchedules
    allSchedules = allSchedules.filter((schedule: any) => {
      let scheduleClassIdStr: string;
      if (typeof schedule.classId === 'string') {
        scheduleClassIdStr = schedule.classId;
      } else if (schedule.classId && typeof schedule.classId === 'object' && '_id' in schedule.classId) {
        scheduleClassIdStr = schedule.classId._id?.toString() || String(schedule.classId);
      } else {
        scheduleClassIdStr = String(schedule.classId);
      }
      
      const isSameClass = scheduleClassIdStr === currentClassIdStr;
      if (isSameClass) {
        console.log('⏭️ Bỏ qua schedule của chính lớp này:', scheduleClassIdStr, schedule.className);
      }
      return !isSameClass;
    });
    
    console.log('📋 Số lượng schedules cần kiểm tra:', allSchedules.length);

    // 🧩 Các tên giáo viên hoặc môn cần bỏ qua khi kiểm tra trùng
    const ignoreTeachers = ["Hoạt động", "Chào cờ", "Sinh hoạt", "Thể dục toàn trường"];
    const conflicts: { teacher: string; day: string; period: number; className: string }[] = [];

    // 2️⃣ Kiểm tra trùng giáo viên theo teacherId (CHỈ so sánh theo ID, không so sánh tên)
    console.log('📅 Timetable đang kiểm tra:', JSON.stringify(timetable, null, 2));
    
    for (const dayEntry of timetable) {
      console.log(`📆 Kiểm tra ngày: ${dayEntry.day}, số tiết: ${dayEntry.periods?.length || 0}`);
      
      for (const period of dayEntry.periods) {
        // ✅ CHỈ kiểm tra nếu có teacherId (bắt buộc phải có để so sánh chính xác)
        if (!period?.teacherId) {
          console.log(`⏭️ Bỏ qua tiết ${period.period} (${dayEntry.day}) - không có teacherId`);
          continue;
        }

        // ✅ Normalize teacherId để so sánh
        const currentTeacherIdStr = period.teacherId 
          ? (typeof period.teacherId === 'string' ? period.teacherId : (period.teacherId as any)?._id?.toString() || String(period.teacherId))
          : null;

        // 👉 Bỏ qua nếu là giáo viên/môn hoạt động chung (chỉ check theo tên nếu không có teacherId)
        if (!currentTeacherIdStr && period.teacher && ignoreTeachers.some(t => period.teacher.toLowerCase().includes(t.toLowerCase()))) {
          continue;
        }

        console.log(`🔍 Kiểm tra tiết ${period.period} (${dayEntry.day}): GV ${period.teacher} (ID: ${currentTeacherIdStr})`);

        for (const other of allSchedules) {
          // ✅ So sánh classId một cách chính xác (có thể là string hoặc object)
          let otherClassIdStr: string;
          if (typeof other.classId === 'string') {
            otherClassIdStr = other.classId;
          } else if (other.classId && typeof other.classId === 'object' && '_id' in other.classId) {
            otherClassIdStr = other.classId._id?.toString() || String(other.classId);
          } else {
            otherClassIdStr = String(other.classId);
          }
          
          // ✅ Bỏ qua chính lớp hiện tại (so sánh string để đảm bảo chính xác)
          if (otherClassIdStr === currentClassIdStr) {
            console.log('⏭️ Bỏ qua chính lớp hiện tại trong vòng lặp:', otherClassIdStr, other.className);
            continue; // bỏ qua chính lớp hiện tại
          }

          const otherDay = other.timetable.find((d: any) => d.day === dayEntry.day);
          if (!otherDay) continue;

          // ✅ Tìm period cùng tiết và cùng teacherId (CHỈ so sánh theo teacherId, không so sánh tên)
          const samePeriod = otherDay.periods.find((p: any) => {
            if (p.period !== period.period) return false;
            
            // ✅ CHỈ kiểm tra conflict nếu CẢ HAI đều có teacherId
            // Nếu một bên có teacherId và bên kia không có → không báo conflict (không thể so sánh chính xác)
            if (currentTeacherIdStr && p.teacherId) {
              const otherTeacherIdStr = typeof p.teacherId === 'string' 
                ? p.teacherId 
                : (p.teacherId as any)?._id?.toString() || String(p.teacherId);
              // ✅ So sánh teacherId - chỉ báo conflict nếu cùng một giáo viên (cùng ID)
              return otherTeacherIdStr === currentTeacherIdStr;
            }
            
            // ✅ Nếu một trong hai không có teacherId → không báo conflict
            // (vì không thể xác định chính xác có phải cùng giáo viên không)
            return false;
          });

          if (samePeriod) {
            console.log(`⚠️ PHÁT HIỆN TRÙNG: Tiết ${period.period} (${dayEntry.day}) - GV ${period.teacher} - Lớp ${other.className}`);
            conflicts.push({
              teacher: period.teacher || 'Chưa có tên',
              day: dayEntry.day,
              period: period.period,
              className: other.className,
            });
          }
        }
      }
    }

    // 3️⃣ Nếu có trùng -> báo lỗi
    if (conflicts.length > 0) {
      console.warn("❌ Trùng giáo viên:", conflicts);
      throw new Error(
        `Phát hiện trùng giáo viên:\n${conflicts
          .map(
            (c) =>
              `• GV ${c.teacher} trùng tiết ${c.period} (${c.day}) với lớp ${c.className}`
          )
          .join("\n")}`
      );
    }

    // 4️⃣ Kiểm tra lịch rảnh của giáo viên (availableMatrix)
    const availabilityErrors: { teacher: string; day: string; period: number }[] = [];
    const dayNameToIndex: Record<string, number> = {
      'Monday': 0, 'Thứ 2': 0, 'Thứ Hai': 0,
      'Tuesday': 1, 'Thứ 3': 1, 'Thứ Ba': 1,
      'Wednesday': 2, 'Thứ 4': 2, 'Thứ Tư': 2,
      'Thursday': 3, 'Thứ 5': 3, 'Thứ Năm': 3,
      'Friday': 4, 'Thứ 6': 4, 'Thứ Sáu': 4,
      'Saturday': 5, 'Thứ 7': 5, 'Thứ Bảy': 5,
    };

    // ✅ Lấy thông tin giáo viên đã được sử dụng trong timetable
    const teacherIdsSet = new Set<string>();
    for (const dayEntry of timetable) {
      for (const period of dayEntry.periods) {
        if (period?.teacherId) {
          const teacherIdStr = typeof period.teacherId === 'string' 
            ? period.teacherId 
            : (period.teacherId as any)?._id?.toString() || String(period.teacherId);
          if (teacherIdStr) {
            teacherIdsSet.add(teacherIdStr);
          }
        }
      }
    }

    // ✅ Lấy thông tin availableMatrix cho tất cả giáo viên
    const teachersMap = new Map<string, { name: string; availableMatrix?: boolean[][] }>();
    for (const teacherId of teacherIdsSet) {
      try {
        const teacher = await teacherApi.getById(teacherId);
        teachersMap.set(teacherId, {
          name: teacher.name || 'Chưa có tên',
          availableMatrix: teacher.availableMatrix
        });
      } catch (err: any) {
        console.warn(`⚠️ Không thể lấy thông tin giáo viên ${teacherId}:`, err);
        // Nếu không lấy được, vẫn tiếp tục (có thể giáo viên đã bị xóa)
      }
    }

    // ✅ Kiểm tra từng period trong timetable
    for (const dayEntry of timetable) {
      for (const period of dayEntry.periods) {
        if (!period?.teacherId || !period?.subject) continue;

        const teacherIdStr = typeof period.teacherId === 'string' 
          ? period.teacherId 
          : (period.teacherId as any)?._id?.toString() || String(period.teacherId);
        
        const teacherInfo = teachersMap.get(teacherIdStr);
        if (!teacherInfo) continue; // Bỏ qua nếu không lấy được thông tin giáo viên

        // ✅ Kiểm tra availableMatrix
        if (teacherInfo.availableMatrix && Array.isArray(teacherInfo.availableMatrix)) {
          const dayIndex = dayNameToIndex[dayEntry.day];
          const periodIndex = period.period - 1; // period là 1-based, cần chuyển sang 0-based

          // ✅ Kiểm tra dayIndex và periodIndex có hợp lệ không
          if (dayIndex !== undefined && dayIndex >= 0 && dayIndex < teacherInfo.availableMatrix.length) {
            const dayMatrix = teacherInfo.availableMatrix[dayIndex];
            if (Array.isArray(dayMatrix) && periodIndex >= 0 && periodIndex < dayMatrix.length) {
              const isAvailable = dayMatrix[periodIndex];
              
              // ✅ Nếu giáo viên không rảnh (isAvailable = false) → báo lỗi
              if (isAvailable === false) {
                availabilityErrors.push({
                  teacher: teacherInfo.name,
                  day: dayEntry.day,
                  period: period.period
                });
              }
            }
          }
        }
      }
    }

    // ✅ Nếu có giáo viên không rảnh -> báo lỗi
    if (availabilityErrors.length > 0) {
      console.warn("❌ Giáo viên không rảnh:", availabilityErrors);
      throw new Error(
        `Giáo viên hiện không có lịch rảnh vào:\n${availabilityErrors
          .map(
            (e) =>
              `• GV ${e.teacher} không rảnh vào tiết ${e.period} (${e.day})`
          )
          .join("\n")}\n\nVui lòng kiểm tra lịch rảnh của giáo viên trong trang "Quản lý lịch rảnh giáo viên".`
      );
    }

    // 5️⃣ Không trùng và giáo viên rảnh -> lưu như cũ
    let existing = null;
    try {
      existing = await scheduleApi.getScheduleByClass(classId, year, semester);
    } catch (err: any) {
      // 404 là bình thường nếu chưa có lịch
      if (err.response?.status !== 404) {
        console.warn('⚠️ Lỗi khi kiểm tra lịch hiện có:', err);
      }
      existing = null;
    }

    if (existing && existing._id) {
      const updated = await scheduleApi.updateSchedule(existing._id, payload);
      return { message: "✅ Đã cập nhật thời khóa biểu thành công!", data: updated };
    } else {
      const created = await scheduleApi.saveSchedule(payload);
      return { message: "✅ Đã tạo mới thời khóa biểu thành công!", data: created };
    }
  } catch (error: any) {
    console.error("❌ Lỗi khi lưu hoặc cập nhật thời khóa biểu:", error);
    
    // Nếu lỗi là do trùng giáo viên, throw lại để hiển thị message
    if (error.message && error.message.includes('trùng giáo viên')) {
      throw error;
    }
    
    // Các lỗi khác
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Không thể lưu thời khóa biểu. Vui lòng kiểm tra kết nối và thử lại.'
    );
  }
  },

  // ✅ Khóa/Mở khóa thời khóa biểu - Chỉ Admin
  lockSchedule: async (id: string, isLocked: boolean) => {
    const res = await api.patch(`/schedules/${id}/lock`, { isLocked });
    return res.data;
  },

  // ✅ Khóa tất cả lịch trong năm học + học kỳ - Chỉ Admin
  lockAllSchedules: async (year: string, semester: string, isLocked = true) => {
    const res = await api.post(`/schedules/lock-all`, { year, semester, isLocked });
    return res.data;
  },

};
