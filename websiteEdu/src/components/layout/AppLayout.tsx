import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { AIChatbox } from "@/components/ai/AIChatbox";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { usePublicSchoolInfo } from "@/hooks/usePublicSchoolInfo";

import AppSidebar from "./AppSidebar"; // 👈 chỉ cần 1 sidebar

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { backendUser, logout } = useAuth();
  const { info: schoolInfo } = usePublicSchoolInfo();

  if (!backendUser) return null; // chưa có user thì chưa render layout

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar dùng chung cho mọi role */}
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-50 h-16 flex items-center justify-between px-6 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="p-2" />
            </div>
            <div className="flex flex-col items-center space-y-0.5 text-center">
              <p className="text-sm font-semibold text-foreground">
                {schoolInfo.name}
              </p>
              {schoolInfo.slogan ? (
                <p className="text-xs text-muted-foreground" title={schoolInfo.slogan}>
                  {schoolInfo.slogan}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
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
