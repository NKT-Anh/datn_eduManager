// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import LoginForm from "@/components/auth/LoginForm";
import AppLayout from "@/components/layout/AppLayout";

// 🏫 Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentsList from "./pages/admin/StudentsList";
import StudentDetail from "./pages/admin/StudentDetail";
import TeacherList from "./pages/admin/TeacherList";
import GradeClassPage from "./pages/admin/GradeClassPage";
import SubjectActivityPage from "./pages/admin/SubjectActivityPage";
import TeachingAssignmentPage from "./pages/admin/TeachingAssignmentPage";
import SchedulePage from "./pages/admin/SchedulePage";
import SchedulePageNew from "./pages/admin/SchedulePageNew";
import TeacherAvailabilityPage from "./pages/admin/TeacherAvailabilityPage";
import AdminAttendancePage from "./pages/admin/AdminAttendancePage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import RoomListPage from "./pages/admin/RoomListPage";
import BatchAccountPage from "./pages/admin/BatchAccountPage";
import GradeConfigPage from "./pages/grades/GradeConfigPage";
import GradesSummaryPage from "./pages/grades/GradesSummaryPage";
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

// 👨‍🎓 Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentGradesPage from "./pages/student/StudentGradesPage";
import StudentSchedulePage from "./pages/student/StudentSchedulePage";
import StudentAttendancePage from "./pages/student/StudentAttendancePage";

// 🧪 Exam Pages (admin or others)
import ExamList from "./pages/examss/ExamList";
import ExamForm from "./pages/examss/ExamForm";
import ExamDetail from "./pages/examss/ExamDetail";
import RoomAssignments from "./pages/examss/RoomAssignments";

// 👨‍🏫 Teacher Exam Pages
import SupervisorSchedule from "./pages/teacher/exams/SupervisorSchedule";
import SupervisorRooms from "./pages/teacher/exams/SupervisorRooms";

// 👩‍🎓 Student Exam Pages
import StudentSchedule from "./pages/student/exams/StudentSchedule";
import ExamRoom from "./pages/student/exams/ExamRoom";

// 🧭 Common Pages
import NotFound from "./pages/NotFound";

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
    { path: "/admin/classes", element: <GradeClassPage /> },
    { path: "/admin/subjects", element: <SubjectActivityPage /> },
    { path: "/admin/teachingAssignmentPage", element: <TeachingAssignmentPage /> },
    { path: "/admin/schedule", element: <SchedulePage /> },
    { path: "/admin/scheduleNew", element: <SchedulePageNew /> },
    { path: "/admin/availability", element: <TeacherAvailabilityPage /> },
    { path: "/admin/attendance", element: <AdminAttendancePage /> },
    { path: "/admin/rooms", element: <RoomListPage /> },
    { path: "/admin/profile", element: <ProfilePage /> },
    { path: "/admin/settings", element: <SettingsPage /> },
    { path: "/admin/batch", element: <BatchAccountPage /> },
    { path: "/admin/grade-config", element: <GradeConfigPage /> },
    { path: "/admin/grades", element: <GradesSummaryPage /> },
    { path: "/admin/exam/exam-list", element: <ExamListPage /> },
    { path: "/admin/exam/new", element: <ExamForm /> },
    { path: "/admin/exam/:examId", element: <ExamDetailPage /> },
    { path: "/admin/exam/exam-dashboard", element: <ExamDashboard /> },
    { path: "/admin/exam/room-assignments", element: <RoomAssignments /> },
    { path: "/admin/exam/schedule", element: <AllExamSchedulesPage /> },
  ],
  teacher: [
    { path: "/teacher/home", element: <TeacherDashboard /> },
    { path: "/teacher/my-classes", element: <MyClassesPage /> },
    { path: "/teacher/schedule", element: <TeacherSchedulePage /> },
    { path: "/teacher/grades", element: <TeacherEnterGradesPage /> },
    { path: "/teacher/attendance", element: <TeacherTakeAttendancePage /> },
    { path: "/teacher/profile", element: <ProfilePage /> },
    { path: "/teacher/settings", element: <SettingsPage /> },
    { path: "/teacher/exams/supervisor-schedule", element: <SupervisorSchedule /> },
    { path: "/teacher/exams/supervisor-rooms", element: <SupervisorRooms /> },
  ],
  student: [
    { path: "/student/home", element: <StudentDashboard /> },
    { path: "/student/schedule", element: <StudentSchedulePage /> },
    { path: "/student/grades", element: <StudentGradesPage /> },
    { path: "/student/attendance", element: <StudentAttendancePage /> },
    { path: "/student/profile", element: <ProfilePage /> },
    { path: "/student/settings", element: <SettingsPage /> },
    { path: "/student/exams/student-schedule", element: <StudentSchedule /> },
    { path: "/student/exams/exam-room", element: <ExamRoom /> },
  ],
};

/* =========================================================
   ⚙️ Component điều hướng theo role
========================================================= */
const AppContent = () => {
  const { backendUser, loading } = useAuth();

  if (loading) return <div className="text-center p-8">⏳ Đang tải dữ liệu...</div>;

  if (!backendUser) return <LoginForm />;

  const roleRoutes = routesConfig[backendUser.role] || [];

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
