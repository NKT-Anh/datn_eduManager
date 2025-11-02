import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import { useAuth } from "@/contexts/AuthContext";

import AppSidebar from "./AppSidebar"; // 👈 chỉ cần 1 sidebar

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { backendUser, logout } = useAuth();

  if (!backendUser) return null; // chưa có user thì chưa render layout

  // Map role → title
  const roleTitles: Record<string, string> = {
    admin: "Quản trị hệ thống",
    teacher: "Giáo viên",
    student: "Học sinh",
  };

  const title = roleTitles[backendUser.role] ?? "Hệ thống quản lý trường học";

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
            <div>
              <Button variant="outline" size="sm" onClick={logout}>
                Đăng xuất
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
