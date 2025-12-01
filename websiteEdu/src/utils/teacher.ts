// ✅ CHỈ lấy departmentId từ yearRoles theo năm học, KHÔNG fallback về top-level
export function getTeacherDepartmentId(teacher: any, activeYear?: string) {
  if (!teacher) return null;
  
  // ✅ CHỈ lấy từ yearRoles khi có activeYear
  if (activeYear && Array.isArray(teacher.yearRoles)) {
    const yr = teacher.yearRoles.find((r: any) => String(r.schoolYear) === String(activeYear));
    if (yr && yr.departmentId) {
      return typeof yr.departmentId === 'object' && yr.departmentId !== null 
        ? (yr.departmentId._id || yr.departmentId) 
        : yr.departmentId;
    }
  }

  // ✅ KHÔNG fallback về top-level departmentId nữa - chỉ dùng yearRoles
  return null;
}

// ✅ Lấy yearRole theo năm học hiện tại (không fallback về top-level)
export function getYearRole(teacher: any, activeYear?: string) {
  if (!teacher || !Array.isArray(teacher.yearRoles)) return null;

  if (activeYear) {
    const yr = teacher.yearRoles.find(
      (r: any) => String(r.schoolYear) === String(activeYear)
    );
    return yr || null;
  }

  // Không ép fallback khi không có activeYear để tránh lấy sai năm học
  return null;
}

// ✅ Lấy tên tổ bộ môn theo năm học
// Ưu tiên yearRoles.departmentId; nếu không có, fallback theo Department.teacherIds/headTeacherId
export function getTeacherDepartmentName(
  teacher: any,
  departments: any[] = [],
  activeYear?: string
) {
  if (!teacher) return "-";

  // 1️⃣ Thử lấy theo yearRoles (chuẩn nhất)
  const deptIdFromYearRole = getTeacherDepartmentId(teacher, activeYear);
  let dept =
    deptIdFromYearRole &&
    departments.find(
      (d: any) =>
        String(d._id) === String(deptIdFromYearRole)
    );

  // 2️⃣ Nếu không có trong yearRoles, fallback: tìm trong danh sách departments theo teacherIds / headTeacherId
  if (!dept && departments && teacher._id) {
    const teacherIdStr = String(teacher._id);
    dept =
      departments.find((d: any) => {
        // headTeacherId
        const headId =
          typeof d.headTeacherId === "object" && d.headTeacherId !== null
            ? String(d.headTeacherId._id)
            : d.headTeacherId
            ? String(d.headTeacherId)
            : null;
        if (headId && headId === teacherIdStr) return true;

        // teacherIds array
        if (Array.isArray(d.teacherIds) && d.teacherIds.length > 0) {
          return d.teacherIds.some((tid: any) => {
            const idStr =
              typeof tid === "object" && tid !== null
                ? String(tid._id)
                : String(tid);
            return idStr === teacherIdStr;
          });
        }

        return false;
      }) || null;
  }

  return dept?.name || "-";
}

export default {
  getTeacherDepartmentId,
  getTeacherDepartmentName,
  getYearRole,
};

