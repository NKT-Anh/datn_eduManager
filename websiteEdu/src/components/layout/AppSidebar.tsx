import { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  Shield,
  Database,
  Bell,
  FileText,
  AlertCircle,
  TrendingUp,
  PieChart,
  Activity,
} from "lucide-react";
import logoSchool from "@/assets/logo_school.png";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ✅ Hàm helper tạo navigationGroups dựa trên role/flagss
const getNavigationGroups = (backendUser: any, prefix: string) => {
  const isBGH = backendUser.role === "teacher" && backendUser.teacherFlags?.isLeader;
  const isGVCN = backendUser.role === "teacher" && backendUser.teacherFlags?.isHomeroom;
  const isQLBM = backendUser.role === "teacher" && backendUser.teacherFlags?.isDepartmentHead;
  const isGVBM =
    backendUser.role === "teacher" &&
    !backendUser.teacherFlags?.isLeader &&
    !backendUser.teacherFlags?.isHomeroom &&
    !backendUser.teacherFlags?.isDepartmentHead;

  if (isBGH) {
    return [
      {
        label: "Điều hướng",
        items: [{ id: "home", title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
      },
      {
        label: "Thông tin",
        items: [
          {
            id: "users",
            title: "Người dùng",
            icon: Users,
            children: [
              { id: "students", title: "Học sinh", url: `${prefix}/students`, icon: Users },
              { id: "teachers", title: "Giáo viên", url: `${prefix}/teachers`, icon: UsersRound },
            ],
          },
          {
            id: "school",
            title: "Cơ sở",
            icon: School,
            children: [
              { id: "school-years", title: "Năm học", url: `${prefix}/school-years`, icon: Calendar },
              { id: "classes", title: "Lớp học", url: `${prefix}/classes`, icon: School },
              { id: "rooms", title: "Phòng học", url: `${prefix}/rooms`, icon: School },
              { id: "subjects", title: "Môn học", url: `${prefix}/subjects`, icon: BookOpen },
            ],
          },
          {
            id: "teaching",
            title: "Giảng dạy",
            icon: Presentation,
            children: [
              { id: "proposal-history", title: "Lịch sử đề xuất", url: `${prefix}/proposal-history`, icon: FileText },
              { id: "assignment", title: "Phân công giảng dạy", url: `${prefix}/teachingAssignmentPage`, icon: Presentation },
              { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
            ],
          },
          {
            id: "study",
            title: "Học tập",
            icon: BarChart3,
            children: [
              { id: "grades", title: "Điểm số", url: `${prefix}/grades`, icon: BarChart3 },
              { id: "conduct", title: "Hạnh kiểm", url: `${prefix}/conduct`, icon: ClipboardList },
            ],
          },
          {
            id: "exam",
            title: "Kỳ thi",
            icon: CalendarCheck2Icon,
            children: [
              { id: "exam-list", title: "Danh sách kỳ thi", url: `${prefix}/exam/exam-list`, icon: CalendarCheck2Icon },
              { id: "exam-dashboard", title: "DashBoard", url: `${prefix}/exam/exam-dashboard`, icon: Users },
              { id: "exam-schedule", title: "Lịch thi", url: `${prefix}/exam/schedule`, icon: Calendar },
            ],
          },
        ],
      },
      {
        label: "Khác",
        items: [
          { id: "incidents", title: "Sự cố", url: `${prefix}/incidents`, icon: UserCheck },
          { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          { id: "profile", title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
          { id: "settings", title: "Cài đặt", url: `${prefix}/settings`, icon: Settings },
        ],
      },
    ];
  }

  if (isGVCN) {
    return [
      {
        label: "Điều hướng",
        items: [{ id: "home", title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
      },
      {
        label: "Lớp chủ nhiệm",
        items: [
          { id: "homeroom-class", title: "Thông tin lớp", url: `${prefix}/homeroom-class`, icon: School },
          { id: "homeroom-grades", title: "Bảng điểm lớp CN", url: `${prefix}/homeroom-grades`, icon: FileText },
          { id: "attendance", title: "Điểm danh", url: `${prefix}/attendance`, icon: ClipboardList },
          { id: "students", title: "Học sinh", url: `${prefix}/students`, icon: Users },
          { id: "conduct", title: "Hạnh kiểm", url: `${prefix}/conduct`, icon: ClipboardList },
        ],
      },
      {
        label: "Giảng dạy",
        items: [
          { id: "my-classes", title: "Lớp đang dạy", url: `${prefix}/my-classes`, icon: School },
          { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
          { id: "schedule-weekly", title: "Lịch theo tuần", url: `${prefix}/schedule-weekly`, icon: Calendar },
          { id: "grades", title: "Nhập điểm", url: `${prefix}/grades`, icon: BarChart3 },
        ],
      },
      {
        label: "Kỳ thi",
        items: [
          { id: "exams", title: "Danh sách kỳ thi", url: `${prefix}/exams`, icon: CalendarCheck2Icon },
        ],
      },
      {
        label: "Khác",
        items: [
          { id: "incidents", title: "Sự cố", url: `${prefix}/incidents`, icon: UserCheck },
          { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          { id: "profile", title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
          { id: "settings", title: "Cài đặt", url: `${prefix}/settings`, icon: Settings },
        ],
      },
    ];
  }

  if (isQLBM) {
    return [
      {
        label: "Điều hướng",
        items: [{ id: "home", title: "Trang chủ", url: `${prefix}/dashboard`, icon: Home }],
      },
      {
        label: "Quản lý Bộ Môn",
        items: [
          { id: "departments", title: "Danh sách tổ bộ môn", url: `${prefix}/departments`, icon: BookOpen },
          { id: "teachers", title: "Danh sách giáo viên trong Tổ", url: `${prefix}/teachers`, icon: UsersRound },
          { id: "proposals", title: "Đề xuất phân công", url: `${prefix}/proposals`, icon: ClipboardList },
          { id: "teaching-assignments", title: "Xem phân công", url: `${prefix}/teaching-assignments`, icon: Presentation },
        ],
      },
      {
        label: "Giảng dạy",
        items: [
          { id: "my-classes", title: "Lớp đang dạy", url: `${prefix}/my-classes`, icon: School },
          { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
          { id: "schedule-weekly", title: "Lịch theo tuần", url: `${prefix}/schedule-weekly`, icon: Calendar },
          { id: "grades", title: "Nhập điểm", url: `${prefix}/grades`, icon: BarChart3 },
        ],
      },
      {
        label: "Kỳ thi",
        items: [
          { id: "exams", title: "Danh sách kỳ thi", url: `${prefix}/exams`, icon: CalendarCheck2Icon },
        ],
      },
      {
        label: "Khác",
        items: [
          { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          { id: "profile", title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
          { id: "settings", title: "Cài đặt", url: `${prefix}/settings`, icon: Settings },
        ],
      },
    ];
  }

  if (isGVBM) {
    return [
      {
        label: "Điều hướng",
        items: [{ id: "home", title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
      },
      {
        label: "Giảng dạy",
        items: [
          { id: "my-classes", title: "Lớp đang dạy", url: `${prefix}/my-classes`, icon: School },
          { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
          { id: "schedule-weekly", title: "Lịch theo tuần", url: `${prefix}/schedule-weekly`, icon: Calendar },
          { id: "grades", title: "Nhập điểm", url: `${prefix}/grades`, icon: BarChart3 },
          {
            id: "exams",
            title: "Kỳ thi",
            icon: CalendarCheck2Icon,
            children: [
              { id: "supervisor-schedule", title: "Lịch coi thi", url: `${prefix}/exams/supervisor-schedule`, icon: Calendar },
              { id: "supervisor-rooms", title: "Phòng thi đảm nhận", url: `${prefix}/exams/supervisor-rooms`, icon: School },
            ],
          },
        ],
      },
      {
        label: "Khác",
        items: [
          { id: "teaching-subjects", title: "Môn giảng dạy", url: `${prefix}/teaching-subjects`, icon: BookOpen },
          { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          { id: "profile", title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
        ],
      },
    ];
  }

  // fallback admin/student
  switch (backendUser.role) {
    case "admin":
      return [
        {
          label: "Điều hướng",
          items: [{ id: "home", title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
        },
        {
          label: "Quản lý",
          items: [
            {
              id: "users",
              title: "Người dùng",
              icon: Users,
              children: [
                { id: "students", title: "Học sinh", url: `${prefix}/students`, icon: Users },
                { id: "teachers", title: "Giáo viên", url: `${prefix}/teachers`, icon: UsersRound },
                { id: "departments", title: "Tổ bộ môn", url: `${prefix}/departments`, icon: Users },
                { id: "batch", title: "Tạo tài khoản", url: `${prefix}/batch`, icon: Users },
                { id: "permissions", title: "Phân quyền", url: `${prefix}/permissions`, icon: Shield },
                { id: "role-permissions", title: "Phân quyền hệ thống", url: `${prefix}/role-permissions`, icon: Shield },
              ],
            },
            {
              id: "school",
              title: "Cơ sở",
              icon: School,
              children: [
                { id: "school-years", title: "Năm học", url: `${prefix}/school-years`, icon: Calendar },
                { id: "classes", title: "Lớp học", url: `${prefix}/classes`, icon: School },
                { id: "rooms", title: "Phòng học", url: `${prefix}/rooms`, icon: School },
                { id: "subjects", title: "Môn học", url: `${prefix}/subjects`, icon: BookOpen },
              ],
            },
            {
              id: "exam",
              title: "Kỳ thi",
              icon: CalendarCheck2Icon,
              children: [
                { id: "exam-list", title: "Danh sách kỳ thi", url: `${prefix}/exam/exam-list`, icon: CalendarCheck2Icon },
                { id: "exam-dashboard", title: "DashBoard", url: `${prefix}/exam/exam-dashboard`, icon: Users },
                { id: "exam-schedule", title: "Lịch thi", url: `${prefix}/exam/schedule`, icon: Calendar },
                { id: "room-assignment", title: "Phân phòng thi", url: `${prefix}/exam/room-assignment`, icon: School },
                { id: "supervisor-assignment", title: "Phân công giám thị", url: `${prefix}/exam/supervisor-assignment`, icon: UserCheck },
              ],
            },
          ],
        },
        {
          label: "Hệ thống",
          items: [
            {
              id: "teaching",
              title: "Giảng dạy",
              icon: Presentation,
              children: [
                { id: "proposal-history", title: "Lịch sử đề xuất", url: `${prefix}/proposal-history`, icon: FileText },
                { id: "assignment", title: "Phân công giảng dạy", url: `${prefix}/teachingAssignmentPage`, icon: Presentation },
                { id: "availability", title: "Lịch trống giáo viên", url: `${prefix}/availability`, icon: CalendarCheck2Icon },
                { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
                { id: "schedule-new", title: "Thời khóa biểu new", url: `${prefix}/scheduleNew`, icon: Calendar },
                { id: "class-periods", title: "Phân bổ số tiết theo lớp", url: `${prefix}/class-periods`, icon: BookOpen },
              ],
            },
            {
              id: "grades",
              title: "Điểm số",
              icon: BarChart3,
              children: [
                { id: "grades-list", title: "Bảng điểm", url: `${prefix}/grades`, icon: BarChart3 },
                { id: "init-grades", title: "Khởi tạo bảng điểm", url: `${prefix}/init-grades`, icon: Database },
                { id: "grade-config", title: "Cấu hình điểm số", url: `${prefix}/grade-config`, icon: Settings },
              ],
            },
            { id: "attendance", title: "Điểm danh", url: `${prefix}/attendance`, icon: ClipboardList },
          ],
        },
        {
          label: "Thống kê & Báo cáo",
          items: [
            { id: "statistics-dashboard", title: "Dashboard Thống kê", url: `${prefix}/statistics`, icon: BarChart3 },
            { id: "grades-stats", title: "Thống kê điểm số", url: `${prefix}/grades-statistics`, icon: BarChart3 },
            { id: "exam-dashboard", title: "Thống kê kỳ thi", url: `${prefix}/exam/exam-dashboard`, icon: PieChart },
            { id: "attendance-stats", title: "Thống kê điểm danh", url: `${prefix}/attendance`, icon: TrendingUp },
          ],
        },
        {
          label: "Giám sát",
          items: [
            { id: "audit-logs", title: "Log hoạt động", url: `${prefix}/audit-logs`, icon: Activity },
          ],
        },
        {
          label: "Khác",
          items: [
            { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
          ],
        },


      ];
    case "student":
      return [
        {
          label: "Điều hướng",
          items: [{ id: "home", title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
        },
        {
          label: "Học tập",
          items: [
            { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
            { id: "grades", title: "Điểm số", url: `${prefix}/grades`, icon: BarChart3 },
            { id: "conduct", title: "Hạnh kiểm", url: `${prefix}/conduct`, icon: ClipboardList },
            { id: "attendance", title: "Điểm danh", url: `${prefix}/attendance`, icon: ClipboardList },
            {
              id: "exams",
              title: "Kỳ thi",
              icon: CalendarCheck2Icon,
              children: [
                { id: "student-schedule", title: "Lịch thi", url: `${prefix}/exams/student-schedule`, icon: Calendar },
                { id: "exam-room", title: "Phòng thi", url: `${prefix}/exams/exam-room`, icon: School },
              ],
            },
          ],
        },
        {
          label: "Khác",
          items: [
            { id: "incidents", title: "Sự cố", url: `${prefix}/incidents`, icon: UserCheck },
            { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
          ],
        },
        {
          label: "Cá nhân",
          items: [
            { id: "profile", title: "Hồ sơ", url: `${prefix}/profile`, icon: User },
            { id: "settings", title: "Cài đặt", url: `${prefix}/settings`, icon: Settings },
          ],
        },
      ];
    default:
      return [];
  }
};

const AppSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { backendUser, logout } = useAuth();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  if (!backendUser) return null;

  // Prefix
  let prefix = `/${backendUser.role}`;
  if (backendUser.role === "teacher") {
    const isBGH = backendUser.teacherFlags?.isLeader === true;
    const isGVCN = backendUser.teacherFlags?.isHomeroom === true;
    const isQLBM = backendUser.teacherFlags?.isDepartmentHead === true;
    if (isBGH) prefix = "/bgh";
    else if (isGVCN) prefix = "/gvcn";
    else if (isQLBM) prefix = "/qlbm";
    else prefix = "/gvbm";
  }

  // Memoize navigationGroups
  const navigationGroups = useMemo(() => getNavigationGroups(backendUser, prefix), [backendUser, prefix]);

  // Auto mở submenu nếu active
  useEffect(() => {
    const newOpenMenus: Record<string, boolean> = {};
    navigationGroups.forEach((group) => {
      group.items.forEach((item) => {
        if ("children" in item) {
          const hasActiveChild = item.children.some((child: any) =>
            location.pathname === child.url || location.pathname.startsWith(child.url + "/")
          );
          if (hasActiveChild) newOpenMenus[item.id] = true;
        }
      });
    });
    setOpenMenus((prev) => ({ ...prev, ...newOpenMenus }));
  }, [location.pathname, navigationGroups]);

  const toggleMenu = (id: string) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isItemActive = (item: any) => {
    if ("children" in item) return item.children.some((child: any) => location.pathname === child.url || location.pathname.startsWith(child.url + "/"));
    return location.pathname === item.url || location.pathname.startsWith(item.url + "/");
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <SidebarHeader className="p-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg overflow-hidden bg-white">
            <img src={logoSchool} alt="Logo trường học" className="w-full h-full object-contain" />
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
      <SidebarContent className="pb-8">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    {"children" in item ? (
                      <div key={`${item.id}-wrapper`}>
                        <button
                          onClick={() => toggleMenu(item.id)}
                          className={`flex items-center justify-between w-full px-2 py-2 rounded-md transition-colors ${
                            isItemActive(item)
                              ? "bg-primary/10 text-primary font-semibold"
                              : openMenus[item.id]
                              ? "bg-muted/50"
                              : "hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <item.icon className={`h-4 w-4 ${isItemActive(item) ? "text-primary" : ""}`} />
                            {!collapsed && <span>{item.title}</span>}
                          </div>
                          {!collapsed &&
                            (openMenus[item.id] ? <ChevronDown className="h-4 w-4 opacity-70" /> : <ChevronRight className="h-4 w-4 opacity-70" />)}
                        </button>

                        {openMenus[item.id] && !collapsed && (
                          <div className="ml-6 mt-1 space-y-1">
                            {item.children.map((child: any) => {
                              const isActive = location.pathname === child.url || location.pathname.startsWith(child.url + "/");
                              return (
                                <NavLink
                                  key={child.id}
                                  to={child.url}
                                  className={`flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                                    isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent hover:text-accent-foreground"
                                  }`}
                                >
                                  <child.icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
                                  <span>{child.title}</span>
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <NavLink
                        to={item.url}
                        className={({ isActive }) => {
                          const active = isActive || location.pathname.startsWith(item.url + "/");
                          return `flex items-center space-x-2 px-2 py-2 rounded-md transition-colors ${
                            active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent hover:text-accent-foreground"
                          }`;
                        }}
                      >
                        <item.icon className={`h-4 w-4 ${isItemActive(item) ? "text-primary" : ""}`} />
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

            <DropdownMenuItem onClick={logout} className="flex items-center space-x-2 cursor-pointer">
              <LogOut className="h-4 w-4 text-red-500" />
              <span className="text-red-500">Đăng xuất</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
