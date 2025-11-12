import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  GraduationCap,
  Home,
  Users,
  BookOpen,
  Calendar,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  User,
  UserCheck,
  School,
  UsersRound,
  Presentation,
  CalendarCheck2Icon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AppSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { backendUser, logout } = useAuth();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  if (!backendUser) return null;
  const prefix = `/${backendUser.role}`;

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  // 🔰 Phân quyền hiển thị sidebar
  const navigationGroups = (() => {
    switch (backendUser.role) {
      case "admin":
        return [
          {
            label: "Điều hướng",
            items: [{ title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
          },
          {
            label: "Quản lý",
            items: [
              { title: "Học sinh", url: `${prefix}/students`, icon: Users },
              { title: "Giáo viên", url: `${prefix}/teachers`, icon: UsersRound },
              { title: "Lớp học", url: `${prefix}/classes`, icon: School },
              { title: "Phòng học", url: `${prefix}/rooms`, icon: School },
              { title: "Môn học", url: `${prefix}/subjects`, icon: BookOpen },
              { title: "Tạo tài khoản", url: `${prefix}/batch`, icon: Users },
              {
                title: "Kỳ thi",
                icon: CalendarCheck2Icon,
                children: [
                  { title: "Danh sách kỳ thi", url: `${prefix}/exam/exam-list`, icon: CalendarCheck2Icon },
                  { title: "DashBoard", url: `${prefix}/exam/exam-dashboard`, icon: Users },
                  { title: "Lịch thi", url: `${prefix}/exam/schedule`, icon: Calendar },
                  { title: "Phân phòng thi", url: `${prefix}/exam/room-assignment`, icon: School },
                  { title: "Phân công giám thị", url: `${prefix}/exam/supervisor-assignment`, icon: UserCheck },
                ],
              },
            ],
          },
          {
            label: "Hệ thống",
            items: [
              { title: "Lịch trống giáo viên", url: `${prefix}/availability`, icon: CalendarCheck2Icon },
              { title: "Phân công giảng dạy", url: `${prefix}/teachingAssignmentPage`, icon: Presentation },
              { title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
              { title: "Thời khóa biểu new", url: `${prefix}/scheduleNew`, icon: Calendar },
              { title: "Điểm số", url: `${prefix}/grades`, icon: BarChart3 },
              { title: "Điểm danh", url: `${prefix}/attendance`, icon: ClipboardList },
              { title: "Cấu hình điểm số", url: `${prefix}/grade-config`, icon: Settings },
            ],
          },
        ];

      case "teacher":
        return [
          {
            label: "Điều hướng",
            items: [{ title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
          },
          {
            label: "Lớp học",
            items: [
              { title: "Lớp của tôi", url: `${prefix}/my-classes`, icon: School },
              { title: "Nhập điểm", url: `${prefix}/grades`, icon: BarChart3 },
              { title: "Điểm danh", url: `${prefix}/attendance`, icon: ClipboardList },
            ],
          },
          {
            label: "Cá nhân",
            items: [
              { title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
              { title: "Cài đặt", url: `${prefix}/settings`, icon: Settings },
            ],
          },
        ];

      case "student":
        return [
          {
            label: "Điều hướng",
            items: [{ title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
          },
          {
            label: "Học tập",
            items: [
              { title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
              { title: "Điểm số", url: `${prefix}/grades`, icon: BarChart3 },
              { title: "Điểm danh", url: `${prefix}/attendance`, icon: ClipboardList },
            ],
          },
          {
            label: "Cá nhân",
            items: [
              { title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
              { title: "Cài đặt", url: `${prefix}/settings`, icon: Settings },
            ],
          },
        ];

      default:
        return [];
    }
  })();

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <SidebarHeader className="p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-lg font-semibold">EduManage</h2>
              <p className="text-xs text-muted-foreground">Quản lý trường học</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {"children" in item ? (
                      <>
                        <button
                          onClick={() => toggleMenu(item.title)}
                          className={`flex items-center justify-between w-full px-2 py-2 rounded-md transition-colors ${
                            openMenus[item.title]
                              ? "bg-primary/10 text-primary font-semibold"
                              : "hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <item.icon className="h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </div>
                          {!collapsed &&
                            (openMenus[item.title] ? (
                              <ChevronDown className="h-4 w-4 opacity-70" />
                            ) : (
                              <ChevronRight className="h-4 w-4 opacity-70" />
                            ))}
                        </button>

                        {openMenus[item.title] && !collapsed && (
                          <div className="ml-6 mt-1 space-y-1">
                            {item.children.map((child) => (
                              <NavLink
                                key={child.title}
                                to={child.url}
                                className={({ isActive }) =>
                                  `flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                                    isActive
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "hover:bg-accent hover:text-accent-foreground"
                                  }`
                                }
                              >
                                <child.icon className="h-3.5 w-3.5" />
                                <span>{child.title}</span>
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          `flex items-center space-x-2 px-2 py-2 rounded-md transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "hover:bg-accent hover:text-accent-foreground"
                          }`
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-4 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {!collapsed && backendUser && (
              <div className="px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition">
                <div className="flex items-center space-x-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{backendUser.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{backendUser.role}</p>
                  </div>
                </div>
              </div>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent side="right" align="end" className="w-64 py-3 px-2 rounded-lg shadow-lg space-y-1">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{backendUser.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{backendUser.email}</p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <NavLink to={`${prefix}/profile`} className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Hồ sơ</span>
              </NavLink>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <NavLink to={`${prefix}/settings`} className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Cài đặt</span>
              </NavLink>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={logout} className="text-red-600 flex items-center space-x-2">
              <LogOut className="h-4 w-4" />
              <span>Đăng xuất</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
