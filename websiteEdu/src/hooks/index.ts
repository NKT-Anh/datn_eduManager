/**
 * Central export file for all hooks
 * Import hooks from here for better organization
 */

// Grades
export * from "./grades/useGrades";
export * from "./grades/useStudentGrades";

// Subjects
export * from "./subjects/useSubjects";
export * from "./subjects/useSubjectDetail";
export * from "./departments/useDepartments";

// Assignments
export * from "./assignments/useAssignments";

// Classes
export * from "./classes/useClasses";
// Note: useAutoAssignRooms and useAutoAssignHomeroomTeachers are exported from useClasses

// Teachers
export * from "./teachers/useTeachers";

// School Years
export * from "./schoolYear/useSchoolYears";

// Students
export * from "./auth/useStudents";
export * from "./auth/useProfile";

// Rooms
export * from "./useRooms";

// Exam Classes
export * from "./useExamClasses";

// Permissions
export * from "./usePermissions";

// Schedule Config
export * from "./schedule/useScheduleConfig";

// Activities
export * from "./activities/useActivities";

