// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import LoginForm from "@/components/auth/LoginForm";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import AppLayout from "@/components/layout/AppLayout";

// 🏫 Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentsList from "./pages/admin/StudentsList";
import StudentDetail from "./pages/admin/StudentDetail";
import TeacherList from "./pages/admin/TeacherList";
import DepartmentList from "./pages/admin/DepartmentList";
import GradeClassPage from "./pages/admin/GradeClassPage";
import SubjectActivityPage from "./pages/admin/SubjectActivityPage";
import TeachingAssignmentPage from "./pages/admin/TeachingAssignmentPage";
import SchedulePage from "./pages/admin/SchedulePage";
import SchedulePageNew from "./pages/admin/SchedulePageNew";
import TeacherAvailabilityPage from "./pages/admin/TeacherAvailabilityPage";
import AdminAttendancePage from "./pages/admin/AdminAttendancePage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import SendBulkEmailPage from "./pages/admin/SendBulkEmailPage.tsx";
import EmailHistoryPage from "./pages/admin/EmailHistoryPage.tsx";
import PermissionManagementPage from "./pages/admin/PermissionManagementPage.tsx";
import RolePermissionsPage from "./pages/admin/RolePermissionsPage.tsx";
import RoomListPage from "./pages/admin/RoomListPage.tsx";
import BatchAccountPage from "./pages/admin/BatchAccountPage.tsx";
import SchoolYearPage from "./pages/admin/SchoolYearPage.tsx";
import GradeConfigPage from "./pages/grades/GradeConfigPage.tsx";
import AdminGradesPage from "./pages/admin/AdminGradesPage.tsx";
import GradesStatisticsPage from "./pages/admin/GradesStatisticsPage.tsx";
import StatisticsDashboardPage from "./pages/admin/StatisticsDashboardPage.tsx";
import InitGradeTablePage from "./pages/admin/InitGradeTablePage.tsx";
import AuditLogPage from "./pages/admin/AuditLogPage.tsx";
import TrashPage from "./pages/admin/TrashPage.tsx";
import ExamListPage from "./pages/admin/exam/ExamListPage.tsx";
import ExamDashboard from "./pages/admin/exam/ExamDashboard.tsx";
import SurveyManagementPage from "./pages/admin/SurveyManagementPage.tsx";
import AwardManagementPage from "./pages/admin/AwardManagementPage.tsx";
import ExamDetailPage from "./pages/admin/exam/ExamDetailPage.tsx";
import AllExamSchedulesPage from "./pages/admin/exam/allPage/AllExamSchedulesPage.tsx";
import ExamSchedulePage from "./pages/admin/exam/ExamSchedulePage.tsx";
import ExamGradesSearchPage from "./pages/admin/exam/ExamGradesSearchPage.tsx";
import ExamRoomAssignmentPage from "./pages/admin/exam/ExamRoomAssignmentPage.tsx";
import ExamSupervisorAssignmentPage from "./pages/admin/exam/ExamSupervisorAssignmentPage.tsx";
import ProposalHistoryPage from "./pages/admin/ProposalHistoryPage.tsx";
import ClassPeriodsPage from "./pages/admin/ClassPeriodsPage.tsx";
import BackupManagementPage from "./pages/admin/BackupManagementPage.tsx";
import HomeroomClassPage from "./pages/gvcn/HomeroomClassPage.tsx";
import HomeroomGradesPage from "./pages/gvcn/HomeroomGradesPage.tsx";
import HomeroomAttendancePage from "./pages/gvcn/HomeroomAttendancePage.tsx";
import HomeroomConductPage from "./pages/gvcn/HomeroomConductPage.tsx";
import HomeroomDashboard from "./pages/gvcn/HomeroomDashboard.tsx";

// 👩‍🏫 Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherEnterGradesPage from "./pages/teacher/TeacherEnterGradesPage";
import TeacherSchedulePage from "./pages/teacher/TeacherSchedulePage";
import MyClassesPage from "./pages/teacher/MyClassesPage";
import TeacherAwardsPage from "./pages/teacher/TeacherAwardsPage";
import TeacherSurveyStatisticsPage from "./pages/teacher/TeacherSurveyStatisticsPage";
import TeacherMyAvailabilityPage from "./pages/teacher/TeacherMyAvailabilityPage";

// 👨‍🏫 QLBM Pages
import ProposalsPage from "./pages/qlbm/ProposalsPage.tsx";
import DepartmentListPage from "./pages/qlbm/DepartmentListPage.tsx";
import DepartmentTeachersPage from "./pages/qlbm/DepartmentTeachersPage.tsx";
import TeachingAssignmentsPage from "./pages/qlbm/TeachingAssignmentsPage.tsx";
import DepartmentManagementDashboard from "./pages/qlbm/DepartmentManagementDashboard.tsx";

// 🏛️ BGH Pages
import BGHDashboard from "./pages/bgh/BGHDashboard.tsx";
import BGHStudentsList from "./pages/bgh/BGHStudentsList.tsx";
import BGHGradesPage from "./pages/bgh/BGHGradesPage.tsx";
import BGHAttendancePage from "./pages/bgh/BGHAttendancePage.tsx";
import BGHConductApprovalPage from "./pages/bgh/BGHConductApprovalPage.tsx";
import EmailStatsPage from "./pages/bgh/EmailStatsPage.tsx";
import BGHSurveyDashboardPage from "./pages/bgh/BGHSurveyDashboardPage.tsx";
import ConductPage from "./pages/common/ConductPage.tsx";
import StudentConductPage from "./pages/student/StudentConductPage.tsx";

// 👨‍🎓 Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentGradesPage from "./pages/student/StudentGradesPage";
import StudentSchedulePage from "./pages/student/StudentSchedulePage";
import StudentAttendancePage from "./pages/student/StudentAttendancePage";
import StudentSurveyPage from "./pages/student/StudentSurveyPage";

// // 🧪 Exam Pages (admin or others)
// import ExamList from "./pages/examss/ExamList";
// import ExamForm from "./pages/examss/ExamForm";
// import ExamDetail from "./pages/examss/ExamDetail";
// import RoomAssignments from "./pages/examss/RoomAssignments";

// 👨‍🏫 Teacher Exam Pages
import SupervisorSchedule from "./pages/teacher/exams/SupervisorSchedule";
import SupervisorRooms from "./pages/teacher/exams/SupervisorRooms";
import TeacherExamGradePage from "./pages/teacher/exams/TeacherExamGradePage";

// 👩‍🎓 Student Exam Pages
import StudentExamSchedulePage from "./pages/student/StudentExamSchedulePage";
import StudentExamGradesSearchPage from "./pages/student/StudentExamGradesSearchPage";

// 🧭 Common Pages
import NotFound from "./pages/NotFound.tsx";
import NotificationsPage from "./pages/common/NotificationsPage.tsx";
import StudentNotificationsPage from "./pages/student/StudentNotificationsPage";
import NotificationDetailPage from "./pages/common/NotificationDetailPage.tsx";
import StudentNotificationDetailPage from "./pages/student/StudentNotificationDetailPage";
// Incidents pages removed per request
import AdminConductPage from "./pages/admin/AdminConductPage";

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
    { path: "/admin/departments", element: <DepartmentList /> },
    { path: "/admin/classes", element: <GradeClassPage /> },
    { path: "/admin/subjects", element: <SubjectActivityPage /> },
    { path: "/admin/teachingAssignmentPage", element: <TeachingAssignmentPage /> },
    { path: "/admin/schedule", element: <SchedulePage /> },
    { path: "/admin/scheduleNew", element: <SchedulePageNew /> },
    { path: "/admin/availability", element: <TeacherAvailabilityPage /> },
    { path: "/admin/class-periods", element: <ClassPeriodsPage /> },
    { path: "/admin/attendance", element: <AdminAttendancePage /> },
    { path: "/admin/rooms", element: <RoomListPage /> },
    { path: "/admin/profile", element: <ProfilePage /> },
    { path: "/admin/settings", element: <SettingsPage /> },
    { path: "/admin/send-email", element: <SendBulkEmailPage /> },
    { path: "/admin/email-history", element: <EmailHistoryPage /> },
    { path: "/admin/batch", element: <BatchAccountPage /> },
    { path: "/admin/grade-config", element: <GradeConfigPage /> },
    { path: "/admin/permissions", element: <PermissionManagementPage /> },
    { path: "/admin/role-permissions", element: <RolePermissionsPage /> },
    { path: "/admin/school-years", element: <SchoolYearPage /> },
    { path: "/admin/proposal-history", element: <ProposalHistoryPage /> },
    { path: "/admin/grades", element: <AdminGradesPage /> },
    { path: "/admin/grades-statistics", element: <GradesStatisticsPage /> },
    { path: "/admin/statistics", element: <StatisticsDashboardPage /> },
    { path: "/admin/audit-logs", element: <AuditLogPage /> },
    { path: "/admin/init-grades", element: <InitGradeTablePage /> },
    { path: "/admin/backup", element: <BackupManagementPage /> },
    { path: "/admin/surveyss", element: <SurveyManagementPage /> },
    { path: "/admin/surveys/dashboard", element: <BGHSurveyDashboardPage /> },
    { path: "/admin/awards", element: <AwardManagementPage /> },
    { path: "/admin/exam/exam-list", element: <ExamListPage /> },
    // { path: "/admin/exam/new", element: <ExamForm /> },
    { path: "/admin/exam/:examId", element: <ExamDetailPage /> },
    { path: "/admin/exam/exam-dashboard", element: <ExamDashboard /> },
    { path: "/admin/exam/schedule", element: <ExamSchedulePage /> },
    { path: "/admin/exam/grades-search", element: <ExamGradesSearchPage /> },
    { path: "/admin/exam/room-assignment", element: <ExamRoomAssignmentPage /> },
    { path: "/admin/exam/supervisor-assignment", element: <ExamSupervisorAssignmentPage /> },
    { path: "/admin/notifications", element: <NotificationsPage /> },
    { path: "/admin/notifications/:id", element: <NotificationDetailPage /> },
    { path: "/admin/conduct", element: <AdminConductPage /> },
    { path: "/admin/trash", element: <TrashPage /> },
    // { path: "/admin/exam/room-assignments", element: <RoomAssignments /> },
    // { path: "/admin/exam/schedule", element: <AllExamSchedulesPage /> },
  ],
  teacher: [
    { path: "/teacher/home", element: <TeacherDashboard /> },
    { path: "/teacher/my-classes", element: <MyClassesPage /> },
    { path: "/teacher/schedule", element: <TeacherSchedulePage /> },
    { path: "/teacher/availability", element: <TeacherMyAvailabilityPage /> },
    { path: "/teacher/grades", element: <TeacherEnterGradesPage /> },
    { path: "/teacher/awards", element: <TeacherAwardsPage /> },
    { path: "/teacher/survey-statistics", element: <TeacherSurveyStatisticsPage /> },
    { path: "/teacher/profile", element: <ProfilePage /> },
    { path: "/teacher/exams/supervisor-schedule", element: <SupervisorSchedule /> },
    { path: "/teacher/exams/supervisor-rooms", element: <SupervisorRooms /> },
    { path: "/teacher/exams/enter-grades", element: <TeacherExamGradePage /> },
  ],
  student: [
    { path: "/student/home", element: <StudentDashboard /> },
    { path: "/student/schedule", element: <StudentSchedulePage /> },
    { path: "/student/grades", element: <StudentGradesPage /> },
    { path: "/student/attendance", element: <StudentAttendancePage /> },
    { path: "/student/surveys", element: <StudentSurveyPage /> },
    { path: "/student/conduct", element: <StudentConductPage /> },
    { path: "/student/notifications", element: <StudentNotificationsPage /> },
    { path: "/student/notifications/:id", element: <StudentNotificationDetailPage /> },
    { path: "/student/profile", element: <ProfilePage /> },
    { path: "/student/exams/student-schedule", element: <StudentExamSchedulePage /> },
    { path: "/student/exams/grades-search", element: <StudentExamGradesSearchPage /> },
  ],
  // QLBM (Trưởng bộ môn) - sử dụng lại một số pages từ teacher
  qlbm: [
    { path: "/qlbm/dashboard", element: <DepartmentManagementDashboard /> },
    { path: "/qlbm/home", element: <DepartmentManagementDashboard /> },
    { path: "/qlbm/departments", element: <DepartmentListPage /> },
    { path: "/qlbm/teachers", element: <DepartmentTeachersPage /> },
    { path: "/qlbm/proposals", element: <ProposalsPage /> },
    { path: "/qlbm/teaching-assignments", element: <TeachingAssignmentsPage /> },
    { path: "/qlbm/my-classes", element: <MyClassesPage /> },
    { path: "/qlbm/schedule", element: <TeacherSchedulePage /> },
    { path: "/qlbm/availability", element: <TeacherMyAvailabilityPage /> },
    { path: "/qlbm/grades", element: <TeacherEnterGradesPage /> },
    { path: "/qlbm/exams", element: <ExamListPage /> },
    { path: "/qlbm/exams/supervisor-schedule", element: <SupervisorSchedule /> },
    { path: "/qlbm/exams/supervisor-rooms", element: <SupervisorRooms /> },
    { path: "/qlbm/exams/enter-grades", element: <TeacherExamGradePage /> },
    { path: "/qlbm/awards", element: <TeacherAwardsPage /> },
    { path: "/qlbm/survey-statistics", element: <TeacherSurveyStatisticsPage /> },
    { path: "/qlbm/profile", element: <ProfilePage /> },
  ],
  // GVCN (Giáo viên chủ nhiệm) - sử dụng lại pages từ teacher
  gvcn: [
    { path: "/gvcn/home", element: <HomeroomDashboard /> },
    { path: "/gvcn/homeroom-class", element: <HomeroomClassPage /> },
    { path: "/gvcn/students/:id", element: <StudentDetail /> },
    { path: "/gvcn/homeroom-grades", element: <HomeroomGradesPage /> },
    { path: "/gvcn/attendance", element: <HomeroomAttendancePage /> },
    { path: "/gvcn/my-classes", element: <MyClassesPage /> },
    { path: "/gvcn/schedule", element: <TeacherSchedulePage /> },
    { path: "/gvcn/availability", element: <TeacherMyAvailabilityPage /> },
    { path: "/gvcn/grades", element: <TeacherEnterGradesPage /> },
    { path: "/gvcn/awards", element: <TeacherAwardsPage /> },
    { path: "/gvcn/survey-statistics", element: <TeacherSurveyStatisticsPage /> },
    { path: "/gvcn/conduct", element: <HomeroomConductPage /> },
    { path: "/gvcn/exams/supervisor-schedule", element: <SupervisorSchedule /> },
    { path: "/gvcn/exams/supervisor-rooms", element: <SupervisorRooms /> },
    { path: "/gvcn/exams/enter-grades", element: <TeacherExamGradePage /> },
    { path: "/gvcn/notifications", element: <NotificationsPage /> },
    { path: "/gvcn/notifications/:id", element: <NotificationDetailPage /> },
    { path: "/gvcn/profile", element: <ProfilePage /> },
  ],
  // GVBM (Giáo viên bộ môn) - sử dụng lại pages từ teacher
  gvbm: [
    { path: "/gvbm/home", element: <TeacherDashboard /> },
    { path: "/gvbm/my-classes", element: <MyClassesPage /> },
    { path: "/gvbm/teaching-subjects", element: <MyClassesPage /> },
    { path: "/gvbm/schedule", element: <TeacherSchedulePage /> },
    { path: "/gvbm/schedule-weekly", element: <TeacherSchedulePage /> },
    { path: "/gvbm/availability", element: <TeacherMyAvailabilityPage /> },
    { path: "/gvbm/grades", element: <TeacherEnterGradesPage /> },
    { path: "/gvbm/awards", element: <TeacherAwardsPage /> },
    { path: "/gvbm/survey-statistics", element: <TeacherSurveyStatisticsPage /> },
    { path: "/gvbm/exams", element: <ExamListPage /> },
    { path: "/gvbm/exams/supervisor-schedule", element: <SupervisorSchedule /> },
    { path: "/gvbm/exams/supervisor-rooms", element: <SupervisorRooms /> },
    { path: "/gvbm/exams/enter-grades", element: <TeacherExamGradePage /> },
    { path: "/gvbm/notifications", element: <NotificationsPage /> },
    { path: "/gvbm/notifications/:id", element: <NotificationDetailPage /> },
    { path: "/gvbm/profile", element: <ProfilePage /> },
  ],
  // BGH (Ban giám hiệu)
  bgh: [
    { path: "/bgh/home", element: <BGHDashboard /> },
    { path: "/bgh/students", element: <BGHStudentsList /> },
    { path: "/bgh/students/:id", element: <StudentDetail /> },
    { path: "/bgh/teachers", element: <TeacherList /> },
    { path: "/bgh/grades", element: <BGHGradesPage /> },
    { path: "/bgh/attendance", element: <BGHAttendancePage /> },
    { path: "/bgh/conduct", element: <BGHConductApprovalPage /> },
    { path: "/bgh/school-years", element: <SchoolYearPage /> },
    { path: "/bgh/classes", element: <GradeClassPage /> },
    { path: "/bgh/rooms", element: <RoomListPage /> },
    { path: "/bgh/subjects", element: <SubjectActivityPage /> },
    { path: "/bgh/proposal-history", element: <ProposalHistoryPage /> },
    { path: "/bgh/teachingAssignmentPage", element: <TeachingAssignmentPage /> },
    { path: "/bgh/schedule", element: <SchedulePage /> },
    { path: "/bgh/exam/exam-list", element: <ExamListPage /> },
    { path: "/bgh/exam/:examId", element: <ExamDetailPage /> },
    { path: "/bgh/exam/exam-dashboard", element: <ExamDashboard /> },
    { path: "/bgh/exam/schedule", element: <ExamSchedulePage /> },
    { path: "/bgh/notifications", element: <NotificationsPage /> },
    { path: "/bgh/notifications/:id", element: <NotificationDetailPage /> },
    { path: "/bgh/profile", element: <ProfilePage /> },
    { path: "/bgh/settings", element: <SettingsPage /> },
    { path: "/bgh/send-email", element: <SendBulkEmailPage /> },
    { path: "/bgh/email-stats", element: <EmailStatsPage /> },
    { path: "/bgh/survey-dashboard", element: <BGHSurveyDashboardPage /> },
  ],
};

/* =========================================================
   ⚙️ Component điều hướng theo role
========================================================= */
const AppContent = () => {
  const { backendUser, loading } = useAuth();

  // ✅ Expose token to window for easy API testing
  const token = backendUser?.idToken || null;
  if (typeof window !== 'undefined') {
    (window as any).__backendToken = token;
  }

  if (loading) return <div className="text-center p-8">⏳ Đang tải dữ liệu...</div>;

  // Public routes - không cần đăng nhập
  if (!backendUser) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Protected routes - cần đăng nhập
  // ✅ Xác định route prefix dựa trên role và teacherFlags
  let routeKey = backendUser.role;
  if (backendUser.role === 'teacher') {
    // Kiểm tra teacherFlags để xác định loại giáo viên
    if (backendUser.teacherFlags?.isLeader) {
      routeKey = 'bgh';
    } else if (backendUser.teacherFlags?.isHomeroom) {
      routeKey = 'gvcn';
    } else if (backendUser.teacherFlags?.isDepartmentHead) {
      routeKey = 'qlbm';
    } else {
      routeKey = 'gvbm';
    }
  }

  const roleRoutes = routesConfig[routeKey] || routesConfig[backendUser.role] || [];

  // ✅ Xác định route home theo role
  let homeRoute = '/login';
  if (routeKey === 'admin') {
    homeRoute = '/admin/home';
  } else if (routeKey === 'student') {
    homeRoute = '/student/home';
  } else if (routeKey === 'bgh') {
    homeRoute = '/bgh/home';
  } else if (routeKey === 'gvcn') {
    homeRoute = '/gvcn/home';
  } else if (routeKey === 'qlbm') {
    homeRoute = '/qlbm/home';
  } else if (routeKey === 'gvbm') {
    homeRoute = '/gvbm/home';
  } else if (routeKey === 'teacher') {
    homeRoute = '/teacher/home';
  }

  return (
    <AppLayout>
      <Routes>
        {roleRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}

        {/* ✅ Redirect /login về home nếu đã đăng nhập */}
        <Route path="/login" element={<Navigate to={homeRoute} replace />} />
        <Route path="/forgot-password" element={<Navigate to={homeRoute} replace />} />

        {/* Redirect root → /role/home */}
        <Route path="/" element={<Navigate to={homeRoute} replace />} />

        {/* Dev helper route: show current token */}
        <Route
          path="/dev/token"
          element={
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-2">Current Token</h2>
              <pre className="bg-muted p-3 rounded break-all">
                {backendUser?.idToken || 'No token'}
              </pre>
              <p className="mt-2 text-sm text-muted-foreground">
                Also available at <code>window.__backendToken</code>
              </p>
            </div>
          }
        />

        {/* Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

/* =========================================================
   ⚙️ Component điều hướng theo role (Legacy - giữ lại để tham khảo)
========================================================= */
const AppContentLegacy = () => {
  const { backendUser, loading } = useAuth();

  if (loading) return <div className="text-center p-8">⏳ Đang tải dữ liệu...</div>;

  if (!backendUser) return <LoginForm />;

  // ✅ Xác định route prefix dựa trên role và teacherFlags
  let routeKey = backendUser.role;
  if (backendUser.role === 'teacher') {
    // Kiểm tra teacherFlags để xác định loại giáo viên
    if (backendUser.teacherFlags?.isLeader) {
      routeKey = 'bgh';
    } else if (backendUser.teacherFlags?.isHomeroom) {
      routeKey = 'gvcn';
    } else if (backendUser.teacherFlags?.isDepartmentHead) {
      routeKey = 'qlbm';
    } else {
      routeKey = 'gvbm';
    }
  }

  const roleRoutes = routesConfig[routeKey] || routesConfig[backendUser.role] || [];

  return (
    <AppLayout>
      <Routes>
        {roleRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}

        {/* Redirect root → route đầu tiên theo role */}
        <Route path="/" element={<Navigate to={roleRoutes[0]?.path || "/login"} />} />

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
