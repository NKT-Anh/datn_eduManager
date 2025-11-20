// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import LoginForm from "@/components/auth/LoginForm";
import AppLayout from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// 🏫 Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentsList from "./pages/admin/StudentsList";
import StudentDetail from "./pages/admin/StudentDetail";
import TeacherList from "./pages/admin/TeacherList";
import DepartmentsList from "./pages/admin/DepartmentList";
import GradeClassPage from "./pages/admin/GradeClassPage";
import SubjectActivityPage from "./pages/admin/SubjectActivityPage";
import TeachingAssignmentPage from "./pages/admin/TeachingAssignmentPage";
import SchedulePage from "./pages/admin/SchedulePage";
import SchedulePageNew from "./pages/admin/SchedulePageNew";
import ClassPeriodsPage from "./pages/admin/ClassPeriodsPage";
import TeacherAvailabilityPage from "./pages/admin/TeacherAvailabilityPage";
import AdminAttendancePage from "./pages/admin/AdminAttendancePage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import RoomListPage from "./pages/admin/RoomListPage";
import BatchAccountPage from "./pages/admin/BatchAccountPage";
import PermissionManagementPage from "./pages/admin/PermissionManagementPage";
import SchoolYearPage from "./pages/admin/SchoolYearPage";
import GradeConfigPage from "./pages/grades/GradeConfigPage";
import GradesSummaryPage from "./pages/grades/GradesSummaryPage";
import InitGradeTablePage from "./pages/admin/InitGradeTablePage";
import ExamListPage from "./pages/admin/exam/ExamListPage";
import ExamDashboard from "./pages/admin/exam/ExamDashboard";
import ExamDetailPage from "./pages/admin/exam/ExamDetailPage";
import AllExamSchedulesPage from "./pages/admin/exam/allPage/AllExamSchedulesPage";

// 👩‍🏫 Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherEnterGradesPage from "./pages/teacher/TeacherEnterGradesPage";
import TeacherSchedulePage from "./pages/teacher/TeacherSchedulePage";
import TeacherTakeAttendancePage from "./pages/teacher/TeacherTakeAttendancePage";
import MyClassesPage from "./pages/teacher/MyClassesPage";
import DepartmentTeachersPage from "./pages/teacher/DepartmentTeachersPage";

// 👨‍🎓 Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentGradesPage from "./pages/student/StudentGradesPage";
import StudentSchedulePage from "./pages/student/StudentSchedulePage";
import StudentAttendancePage from "./pages/student/StudentAttendancePage";

// 🧪 Exam Pages (admin or others)
import ExamForm from "./pages/admin/exam/ExamForm";

// 👨‍🏫 Teacher Exam Pages
import SupervisorSchedule from "./pages/teacher/exams/SupervisorSchedule";
import SupervisorRooms from "./pages/teacher/exams/SupervisorRooms";

// 👩‍🎓 Student Exam Pages
import StudentSchedule from "./pages/student/exams/StudentSchedule";
import ExamRoom from "./pages/student/exams/ExamRoom";

// 🧭 Common Pages
import NotFound from "./pages/NotFound";

// 🏛️ BGH Pages
import BGHDashboard from "./pages/bgh/BGHDashboard";
import BGHStudentsList from "./pages/bgh/BGHStudentsList";
import BGHIncidentsPage from "./pages/bgh/BGHIncidentsPage";

// 📚 QLBM Pages (sẽ tạo sau)
// 👨‍🏫 GVCN Pages (sẽ tạo sau)
// 👩‍🏫 GVBM Pages (sẽ tạo sau)

// 📋 Common Feature Pages
import ConductPage from "./pages/common/ConductPage";
import NotificationsPage from "./pages/common/NotificationsPage";
import NotificationDetailPage from "./pages/common/NotificationDetailPage";

// 👩‍🎓 Student Feature Pages
import StudentIncidentsPage from "./pages/student/StudentIncidentsPage";
import TeachingAssignmentsPage from "@/pages/qlbm/TeachingAssignmentsPage";

/* =========================================================
   ⚙️ Query Client
========================================================= */
const queryClient = new QueryClient();

/* =========================================================
   ⚙️ Route Config theo Role
========================================================= */
const routesConfig: Record<string, { path: string; element: JSX.Element }[]> = {
  admin: [
    { path: "/admin/home", element: <AdminDashboard /> },
    { path: "/admin/students", element: <StudentsList /> },
    { path: "/admin/students/:id", element: <StudentDetail /> },
    { path: "/admin/teachers", element: <TeacherList /> },
    { path: "/admin/departments", element: <DepartmentsList /> },
    { path: "/admin/permissions", element: <PermissionManagementPage /> },
    { path: "/admin/school-years", element: <SchoolYearPage /> },
    { path: "/admin/classes", element: <GradeClassPage /> },
    { path: "/admin/subjects", element: <SubjectActivityPage /> },
    { path: "/admin/teachingAssignmentPage", element: <TeachingAssignmentPage /> },
    { path: "/admin/schedule", element: <SchedulePage /> },
    { path: "/admin/scheduleNew", element: <SchedulePageNew /> },
    { path: "/admin/class-periods", element: <ClassPeriodsPage /> },
    { path: "/admin/availability", element: <TeacherAvailabilityPage /> },
    { path: "/admin/attendance", element: <AdminAttendancePage /> },
    { path: "/admin/rooms", element: <RoomListPage /> },
    { path: "/admin/profile", element: <ProfilePage /> },
    { path: "/admin/settings", element: <SettingsPage /> },
    { path: "/admin/batch", element: <BatchAccountPage /> },
    { path: "/admin/grade-config", element: <GradeConfigPage /> },
    { path: "/admin/grades", element: <GradesSummaryPage /> },
    { path: "/admin/init-grades", element: <InitGradeTablePage /> },
    { path: "/admin/exam/exam-list", element: <ExamListPage /> },
    { path: "/admin/exam/new", element: <ExamForm /> },
    { path: "/admin/exam/:examId", element: <ExamDetailPage /> },
    { path: "/admin/exam/exam-dashboard", element: <ExamDashboard /> },
    { path: "/admin/exam/schedule", element: <AllExamSchedulesPage /> },
    { path: "/admin/notifications", element: <NotificationsPage /> },
    { path: "/admin/notifications/:id", element: <NotificationDetailPage /> },
  ],
  teacher: [
    { path: "/teacher/home", element: <TeacherDashboard /> },
    { path: "/teacher/my-classes", element: <MyClassesPage /> },
    { path: "/teacher/schedule", element: <TeacherSchedulePage /> },
    { path: "/teacher/grades", element: <TeacherEnterGradesPage /> },
    { path: "/teacher/attendance", element: <TeacherTakeAttendancePage /> },
    { path: "/teacher/notifications", element: <NotificationsPage /> },
    { path: "/teacher/notifications/:id", element: <NotificationDetailPage /> },
    { path: "/teacher/profile", element: <ProfilePage /> },
    { path: "/teacher/settings", element: <SettingsPage /> },
    { path: "/teacher/exams/supervisor-schedule", element: <SupervisorSchedule /> },
    { path: "/teacher/exams/supervisor-rooms", element: <SupervisorRooms /> },
  ],
  student: [
    { path: "/student/home", element: <StudentDashboard /> },
    { path: "/student/schedule", element: <StudentSchedulePage /> },
    { path: "/student/grades", element: <StudentGradesPage /> },
    { path: "/student/conduct", element: <ConductPage /> },
    { path: "/student/exams/student-schedule", element: <StudentSchedule /> },
    { path: "/student/exams/exam-room", element: <ExamRoom /> },
    { path: "/student/incidents", element: <StudentIncidentsPage /> },
    { path: "/student/notifications", element: <NotificationsPage /> },
    { path: "/student/notifications/:id", element: <NotificationDetailPage /> },
    { path: "/student/profile", element: <ProfilePage /> },
    { path: "/student/settings", element: <SettingsPage /> },
  ],
      // 🏛️ Ban Giám Hiệu (BGH) - Xem tất cả (chỉ truy cập được nếu có flag isLeader)
      bgh: [
        { path: "/bgh/home", element: <ProtectedRoute requireFlags={{ isLeader: true }}><BGHDashboard /></ProtectedRoute> },
        { path: "/bgh/school-years", element: <ProtectedRoute requireFlags={{ isLeader: true }}><SchoolYearPage /></ProtectedRoute> },
        { path: "/bgh/students", element: <ProtectedRoute requireFlags={{ isLeader: true }}><BGHStudentsList /></ProtectedRoute> },
        { path: "/bgh/students/:id", element: <ProtectedRoute requireFlags={{ isLeader: true }}><StudentDetail /></ProtectedRoute> },
        { path: "/bgh/teachers", element: <ProtectedRoute requireFlags={{ isLeader: true }}><TeacherList /></ProtectedRoute> },
        { path: "/bgh/classes", element: <ProtectedRoute requireFlags={{ isLeader: true }}><GradeClassPage /></ProtectedRoute> },
        { path: "/bgh/subjects", element: <ProtectedRoute requireFlags={{ isLeader: true }}><SubjectActivityPage /></ProtectedRoute> },
        { path: "/bgh/teachingAssignmentPage", element: <ProtectedRoute requireFlags={{ isLeader: true }}><TeachingAssignmentPage /></ProtectedRoute> },
        { path: "/bgh/schedule", element: <ProtectedRoute requireFlags={{ isLeader: true }}><SchedulePage /></ProtectedRoute> },
        { path: "/bgh/grades", element: <ProtectedRoute requireFlags={{ isLeader: true }}><GradesSummaryPage /></ProtectedRoute> },
        { path: "/bgh/conduct", element: <ProtectedRoute requireFlags={{ isLeader: true }}><ConductPage /></ProtectedRoute> },
        { path: "/bgh/exam/exam-list", element: <ProtectedRoute requireFlags={{ isLeader: true }}><ExamListPage /></ProtectedRoute> },
        { path: "/bgh/exam/:examId", element: <ProtectedRoute requireFlags={{ isLeader: true }}><ExamDetailPage /></ProtectedRoute> },
        { path: "/bgh/exam/exam-dashboard", element: <ProtectedRoute requireFlags={{ isLeader: true }}><ExamDashboard /></ProtectedRoute> },
        { path: "/bgh/exam/schedule", element: <ProtectedRoute requireFlags={{ isLeader: true }}><AllExamSchedulesPage /></ProtectedRoute> },
        { path: "/bgh/rooms", element: <ProtectedRoute requireFlags={{ isLeader: true }}><RoomListPage /></ProtectedRoute> },
        { path: "/bgh/incidents", element: <ProtectedRoute requireFlags={{ isLeader: true }}><BGHIncidentsPage /></ProtectedRoute> },
        { path: "/bgh/notifications", element: <ProtectedRoute requireFlags={{ isLeader: true }}><NotificationsPage /></ProtectedRoute> },
        { path: "/bgh/notifications/:id", element: <ProtectedRoute requireFlags={{ isLeader: true }}><NotificationDetailPage /></ProtectedRoute> },
        { path: "/bgh/profile", element: <ProtectedRoute requireFlags={{ isLeader: true }}><ProfilePage /></ProtectedRoute> },
        { path: "/bgh/settings", element: <ProtectedRoute requireFlags={{ isLeader: true }}><SettingsPage /></ProtectedRoute> },
      ],
  // 📚 Quản lý bộ môn (QLBM) - Xem bộ môn (chỉ truy cập được nếu có flag isDepartmentHead)
  qlbm: [
    { path: "/qlbm/home", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><TeacherDashboard /></ProtectedRoute> },
    { path: "/qlbm/teachers", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><DepartmentTeachersPage /></ProtectedRoute> },
    { path: "/qlbm/subjects", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><SubjectActivityPage /></ProtectedRoute> },
    { path: "/qlbm/teaching-assignments", element: <TeachingAssignmentsPage /> },
    { path: "/qlbm/schedule", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><SchedulePage /></ProtectedRoute> },
    { path: "/qlbm/grades", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><GradesSummaryPage /></ProtectedRoute> },
    { path: "/qlbm/exam/exam-list", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><ExamListPage /></ProtectedRoute> },
    { path: "/qlbm/exam/:examId", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><ExamDetailPage /></ProtectedRoute> },
    { path: "/qlbm/notifications", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><NotificationsPage /></ProtectedRoute> },
    { path: "/qlbm/notifications/:id", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><NotificationDetailPage /></ProtectedRoute> },
    { path: "/qlbm/profile", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><ProfilePage /></ProtectedRoute> },
    { path: "/qlbm/settings", element: <ProtectedRoute requireFlags={{ isDepartmentHead: true }}><SettingsPage /></ProtectedRoute> },
  ],
  // 👨‍🏫 Giáo viên chủ nhiệm (GVCN) - Lớp chủ nhiệm (chỉ truy cập được nếu có flag isHomeroom)
  gvcn: [
    { path: "/gvcn/home", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><TeacherDashboard /></ProtectedRoute> },
    { path: "/gvcn/my-classes", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><MyClassesPage /></ProtectedRoute> },
    { path: "/gvcn/students", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><StudentsList /></ProtectedRoute> },
    { path: "/gvcn/students/:id", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><StudentDetail /></ProtectedRoute> },
    { path: "/gvcn/schedule", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><TeacherSchedulePage /></ProtectedRoute> },
    { path: "/gvcn/grades", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><GradesSummaryPage /></ProtectedRoute> },
    { path: "/gvcn/conduct", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><ConductPage /></ProtectedRoute> },
    { path: "/gvcn/exam/exam-list", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><ExamListPage /></ProtectedRoute> },
    { path: "/gvcn/exam/:examId", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><ExamDetailPage /></ProtectedRoute> },
    { path: "/gvcn/incidents", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><BGHIncidentsPage /></ProtectedRoute> },
    { path: "/gvcn/notifications", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><NotificationsPage /></ProtectedRoute> },
    { path: "/gvcn/notifications/:id", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><NotificationDetailPage /></ProtectedRoute> },
    { path: "/gvcn/profile", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><ProfilePage /></ProtectedRoute> },
    { path: "/gvcn/settings", element: <ProtectedRoute requireFlags={{ isHomeroom: true }}><SettingsPage /></ProtectedRoute> },
  ],
  // 👩‍🏫 Giáo viên bộ môn (GVBM) - Lớp đang dạy (teacher không có flags đặc biệt)
  gvbm: [
    { path: "/gvbm/home", element: <ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute> },
    { path: "/gvbm/my-classes", element: <ProtectedRoute allowedRoles={['teacher']}><MyClassesPage /></ProtectedRoute> },
    { path: "/gvbm/students", element: <ProtectedRoute allowedRoles={['teacher']}><StudentsList /></ProtectedRoute> },
    { path: "/gvbm/subjects", element: <ProtectedRoute allowedRoles={['teacher']}><SubjectActivityPage /></ProtectedRoute> },
    { path: "/gvbm/schedule", element: <ProtectedRoute allowedRoles={['teacher']}><TeacherSchedulePage /></ProtectedRoute> },
    { path: "/gvbm/grades", element: <ProtectedRoute allowedRoles={['teacher']}><TeacherEnterGradesPage /></ProtectedRoute> },
    { path: "/gvbm/exam/exam-list", element: <ProtectedRoute allowedRoles={['teacher']}><ExamListPage /></ProtectedRoute> },
    { path: "/gvbm/exam/:examId", element: <ProtectedRoute allowedRoles={['teacher']}><ExamDetailPage /></ProtectedRoute> },
    { path: "/gvbm/exams/supervisor-schedule", element: <ProtectedRoute allowedRoles={['teacher']}><SupervisorSchedule /></ProtectedRoute> },
    { path: "/gvbm/exams/supervisor-rooms", element: <ProtectedRoute allowedRoles={['teacher']}><SupervisorRooms /></ProtectedRoute> },
    { path: "/gvbm/notifications", element: <ProtectedRoute allowedRoles={['teacher']}><NotificationsPage /></ProtectedRoute> },
    { path: "/gvbm/notifications/:id", element: <ProtectedRoute allowedRoles={['teacher']}><NotificationDetailPage /></ProtectedRoute> },
    { path: "/gvbm/profile", element: <ProtectedRoute allowedRoles={['teacher']}><ProfilePage /></ProtectedRoute> },
    { path: "/gvbm/settings", element: <ProtectedRoute allowedRoles={['teacher']}><SettingsPage /></ProtectedRoute> },
  ],
};

/* =========================================================
   ⚙️ Component điều hướng theo role
========================================================= */
const AppContent = () => {
  const { backendUser, loading } = useAuth();

  if (loading) return <div className="text-center p-8">⏳ Đang tải dữ liệu...</div>;

  // Nếu chưa đăng nhập, hiển thị login
  if (!backendUser) {
    return (
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  // ✅ Nếu đã đăng nhập, hiển thị layout với routes theo role và flags
  // Kiểm tra flags để xác định routes đúng cho BGH, GVCN, QLBM, GVBM
  let roleRoutes: { path: string; element: JSX.Element }[] = [];
  
  if (backendUser.role === 'admin') {
    // ✅ Admin được truy cập mọi nơi: merge admin routes + BGH routes
    const adminRoutes = routesConfig['admin'] || [];
    const bghRoutes = routesConfig['bgh'] || [];
    // Merge và loại bỏ duplicate paths
    const allRoutes = [...adminRoutes, ...bghRoutes];
    const uniqueRoutes = allRoutes.filter((route, index, self) => 
      index === self.findIndex(r => r.path === route.path)
    );
    roleRoutes = uniqueRoutes;
  } else if (backendUser.role === 'teacher') {
    // Kiểm tra flags của teacher để xác định routes phù hợp
    const isBGH = backendUser.teacherFlags?.isLeader === true;
    const isGVCN = backendUser.teacherFlags?.isHomeroom === true;
    const isQLBM = backendUser.teacherFlags?.isDepartmentHead === true;
    
    // ✅ Ưu tiên: BGH > GVCN > QLBM > GVBM
    // Nếu user có nhiều flags, ưu tiên BGH cao nhất
    if (isBGH) {
      // BGH: dùng routes của bgh (đã được bảo vệ bởi ProtectedRoute)
      roleRoutes = routesConfig['bgh'] || [];
    } else if (isGVCN) {
      // GVCN: dùng routes của gvcn (đã được bảo vệ bởi ProtectedRoute)
      roleRoutes = routesConfig['gvcn'] || [];
    } else if (isQLBM) {
      // QLBM: dùng routes của qlbm (đã được bảo vệ bởi ProtectedRoute)
      roleRoutes = routesConfig['qlbm'] || [];
    } else {
      // GVBM: dùng routes của gvbm (teacher không có flags đặc biệt)
      roleRoutes = routesConfig['gvbm'] || [];
    }
  } else {
    // Các role khác (student) dùng routes theo role
    roleRoutes = routesConfig[backendUser.role] || [];
  }

  return (
    <AppLayout>
      <Routes>
        {roleRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}

        {/* Redirect root → route đầu tiên theo role */}
        <Route path="/" element={<Navigate to={roleRoutes[0]?.path || "/login"} />} />
        <Route path="/login" element={<Navigate to={roleRoutes[0]?.path || "/"} />} />

        {/* Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

/* =========================================================
   ⚙️ App chính
========================================================= */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
