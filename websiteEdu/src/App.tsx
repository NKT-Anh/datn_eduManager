import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

import LoginForm from "@/components/auth/LoginForm";
import AppLayout from "@/components/layout/AppLayout";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentsList from "./pages/admin/StudentsList";
import StudentDetail from "./pages/admin/StudentDetail";
import TeachingAssignmentPage from "./pages/admin/TeachingAssignmentPage";
import SubjectActivityPage from "./pages/admin/SubjectActivityPage";
import TeacherAvailabilityPage from "./pages/admin/TeacherAvailabilityPage";
// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import BatchAccountPage from "./pages/admin/BatchAccountPage";
// Shared Pages
import ClassesPage from "./pages/admin/ClassesPage";
import SubjectsPage from "./pages/admin/SubjectsPage";
import GradeClassPage from "./pages/admin/GradeClassPage";
// Common Pages
import GradesPage from "./pages/GradesPage";
import AttendancePage from "./pages/AttendancePage";
import ProfilePage from "./pages/ProfilePage";
import MyClassesPage from "./pages/MyClassesPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import TeacherList from "./pages/admin/TeacherList";
import SchedulePage from "./pages/admin/SchedulePage";
import SchedulePageNew from "./pages/admin/SchedulePageNew";
import GradeConfigPage from "./pages/grades/GradeConfigPage";
import GradesSummaryPage from "./pages/grades/GradesSummaryPage";
import TeacherEnterGradesPage from "./pages/teacher/TeacherEnterGradesPage";
const queryClient = new QueryClient();

// 📌 Cấu hình routes cho từng role
const routesConfig: Record<
  string,
  { path: string; element: JSX.Element }[]
> = {
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
    { path: "/admin/attendance", element: <AttendancePage /> },
    { path: "/admin/profile", element: <ProfilePage /> },
    { path: "/admin/settings", element: <SettingsPage /> },
     { path: "/admin/batch", element: <BatchAccountPage /> },
     {path: "/admin/grade-config", element: <GradeConfigPage /> },
     {path: "/admin/grades", element: <GradesSummaryPage /> },
  ],
  teacher: [
    { path: "/teacher/home", element: <TeacherDashboard /> },
    { path: "/teacher/my-classes", element: <MyClassesPage /> },
    { path: "/teacher/schedule", element: <SchedulePage /> },
    { path: "/teacher/grades", element: <TeacherEnterGradesPage /> },
    { path: "/teacher/attendance", element: <AttendancePage /> },
    { path: "/teacher/profile", element: <ProfilePage /> },
    { path: "/teacher/settings", element: <SettingsPage /> },
  ],
  student: [
    { path: "/student/home", element: <StudentDashboard /> },
    { path: "/student/schedule", element: <SchedulePage /> },
    { path: "/student/grades", element: <GradesPage /> },
    { path: "/student/profile", element: <ProfilePage /> },
    { path: "/student/settings", element: <SettingsPage /> },
  ],
};

const AppContent = () => {
  const { backendUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // TODO: thay bằng spinner UI
  }

  if (!backendUser) {
    return <LoginForm />;
  }

  const roleRoutes = routesConfig[backendUser.role] ?? [];

  return (
    <AppLayout>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        {roleRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
        {/* Not found */}
         <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
