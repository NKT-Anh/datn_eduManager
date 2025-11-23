import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { AIChatbox } from "@/components/ai/AIChatbox";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { isBGH, isGVCN, isQLBM, isGVBM } from "@/utils/permissions";

import AppSidebar from "./AppSidebar"; // 👈 chỉ cần 1 sidebar

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { backendUser, logout } = useAuth();

  if (!backendUser) return null; // chưa có user thì chưa render layout

  // Xác định title dựa trên role và teacherFlags
  const getRoleTitle = () => {
    if (backendUser.role === "admin") {
      return "Quản trị hệ thống";
    }
    if (backendUser.role === "student") {
      return "Học sinh";
    }
    if (backendUser.role === "teacher") {
      // Kiểm tra teacher flags để xác định role cụ thể
      if (isBGH(backendUser)) {
        return "Ban Giám Hiệu";
      }
      if (isGVCN(backendUser)) {
        return "Giáo viên chủ nhiệm";
      }
      if (isQLBM(backendUser)) {
        return "Quản lý bộ môn";
      }
      if (isGVBM(backendUser)) {
        return "Giáo viên bộ môn";
      }
      return "Giáo viên";
    }
    return "Hệ thống quản lý trường học";
  };

  const title = getRoleTitle();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar dùng chung cho mọi role */}
        <AppSidebar />

        <div className="flex-1 flex flex-col">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2" />
              <div>
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="text-sm text-muted-foreground">
                  Xin chào, {backendUser.name ?? "Người dùng"}!
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <NotificationBell />
              <Button variant="outline" size="sm" onClick={logout}>
                Đăng xuất
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto pb-40">{children}</main>
        </div>
        
        {/* AI Chatbox - hiển thị trên tất cả trang */}
        <AIChatbox />
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
