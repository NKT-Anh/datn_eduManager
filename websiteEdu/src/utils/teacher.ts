export function getTeacherDepartmentId(teacher: any, activeYear?: string) {
  if (!teacher) return null;
  // Try yearRoles first when an activeYear is provided
  if (activeYear && Array.isArray(teacher.yearRoles)) {
    const yr = teacher.yearRoles.find((r: any) => String(r.schoolYear) === String(activeYear));
    if (yr && yr.departmentId) {
      return typeof yr.departmentId === 'object' && yr.departmentId !== null ? (yr.departmentId._id || yr.departmentId) : yr.departmentId;
    }
  }

  // Fallback to legacy top-level departmentId if present
  if (teacher.departmentId) {
    return typeof teacher.departmentId === 'object' && teacher.departmentId !== null ? (teacher.departmentId._id || teacher.departmentId) : teacher.departmentId;
  }

  return null;
}

export function getTeacherDepartmentName(teacher: any, departments: any[] = [], activeYear?: string) {
  const deptId = getTeacherDepartmentId(teacher, activeYear);
  if (!deptId) return "-";
  const dept = departments.find((d: any) => d._id === deptId || String(d._id) === String(deptId));
  return dept?.name || (typeof teacher.departmentId === 'object' && teacher.departmentId?.name) || (typeof teacher.departmentId === 'string' ? 'Chưa có tên' : '-');
}

export default {
  getTeacherDepartmentId,
  getTeacherDepartmentName,
};
