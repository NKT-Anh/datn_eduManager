import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  Calendar,
  ClipboardList,
  User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function StudentSidebar() {
  const { state } = useSidebar();
  const { backendUser } = useAuth();
  const location = useLocation();
  const collapsed = state === "collapsed";

  if (!backendUser) return null;

  const prefix = `/${backendUser.role}`;

  const studentItems = [
    { title: "Dashboard", url: `${prefix}`, icon: Home },
    { title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
    { title: "Xem điểm", url: `${prefix}/grades`, icon: ClipboardList },
    { title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
  ];

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Học sinh</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
