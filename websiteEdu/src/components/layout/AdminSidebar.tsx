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
  Users,
  School,
  BookOpen,
  Calendar,
  ClipboardList,
  GraduationCap,
  Settings,
  User,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AdminSidebar() {
  const { state } = useSidebar();
  const { backendUser } = useAuth();
  const location = useLocation();
  const collapsed = state === "collapsed";

  if (!backendUser) return null;

  const prefix = `/${backendUser.role}`;

  const adminItems = [
    { title: "Dashboard", url: `${prefix}`, icon: Home },
    { title: "Quản lý học sinh", url: `${prefix}/students`, icon: Users },
    { title: "Quản lý lớp học", url: `${prefix}/classes`, icon: School },
    { title: "Quản lý môn học", url: `${prefix}/subjects`, icon: BookOpen },
    { title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
    { title: "Quản lý điểm", url: `${prefix}/grades`, icon: ClipboardList },
    { title: "Cấu hình điểm số", url: `${prefix}/grade-config`, icon: BarChart3 },
    { title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
    { title: "Cài đặt", url: `${prefix}/settings`, icon: Settings },
  ];

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quản trị</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
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
