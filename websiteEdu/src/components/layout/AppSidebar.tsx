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
  SidebarRail,
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
  Mail,
  Trash2,
  Trophy,
  Edit,
  Clock,
  PanelLeft,
  ChevronLeft
} from "lucide-react";
// Logo sẽ lấy từ settings, không cần import fallback
import { useAuth } from "@/contexts/AuthContext";
import { usePublicSchoolInfo } from "@/hooks";
import { isBGH, isGVCN, isQLBM, isGVBM } from "@/utils/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

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
              { id: "subjects", title: "Môn học", url: `${prefix}/subjects`, icon: BookOpen },
              { id: "rooms", title: "Phòng học", url: `${prefix}/rooms`, icon: School },
            ],
          },
        ],
      },
      {
        label: "Giảng dạy",
        items: [
          {
            id: "teaching",
            title: "Giảng dạy",
            icon: Presentation,
            children: [
              { id: "assignment", title: "Phân công giảng dạy", url: `${prefix}/teachingAssignmentPage`, icon: Presentation },
              { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
              { id: "proposal-history", title: "Lịch sử đề xuất", url: `${prefix}/proposal-history`, icon: FileText },
              { id: "survey-dashboard", title: "Dashboard khảo sát", url: `${prefix}/survey-dashboard`, icon: BarChart3 },
            ],
          },
        ],
      },
      {
        label: "Học tập",
        items: [
          {
            id: "study",
            title: "Học tập",
            icon: BarChart3,
            children: [
              { id: "grades", title: "Điểm số", url: `${prefix}/grades`, icon: BarChart3 },
              { id: "conduct", title: "Hạnh kiểm", url: `${prefix}/conduct`, icon: ClipboardList },
            ],
          },
        ],
      },
      {
        label: "Kỳ thi",
        items: [
          {
            id: "exam",
            title: "Kỳ thi",
            icon: CalendarCheck2Icon,
            children: [
              { id: "exam-list", title: "Danh sách kỳ thi", url: `${prefix}/exam/exam-list`, icon: CalendarCheck2Icon },
              { id: "exam-schedule", title: "Lịch thi", url: `${prefix}/exam/schedule`, icon: Calendar },
              { id: "exam-dashboard", title: "DashBoard", url: `${prefix}/exam/exam-dashboard`, icon: Users },
            ],
          },
        ],
      },
      {
        label: "Giao tiếp",
        items: [
          { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
          { id: "send-email", title: "Gửi email hàng loạt", url: `${prefix}/send-email`, icon: Mail },
          { id: "email-stats", title: "Thống kê email", url: `${prefix}/email-stats`, icon: BarChart3 },
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
          { id: "students", title: "Học sinh", url: `${prefix}/students`, icon: Users },
          { id: "homeroom-grades", title: "Bảng điểm lớp CN", url: `${prefix}/homeroom-grades`, icon: FileText },
          { id: "attendance", title: "Điểm danh", url: `${prefix}/attendance`, icon: ClipboardList },
          { id: "conduct", title: "Hạnh kiểm", url: `${prefix}/conduct`, icon: ClipboardList },
        ],
      },
      {
        label: "Giảng dạy",
        items: [
          { id: "my-classes", title: "Lớp đang dạy", url: `${prefix}/my-classes`, icon: School },
          { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
          { id: "availability", title: "Lịch rảnh", url: `${prefix}/availability`, icon: Clock },
          { id: "grades", title: "Nhập điểm", url: `${prefix}/grades`, icon: BarChart3 },
          { id: "awards", title: "Danh hiệu / Khen thưởng", url: `${prefix}/awards`, icon: Trophy },
          { id: "survey-statistics", title: "Thống kê khảo sát", url: `${prefix}/survey-statistics`, icon: BarChart3 },
        ],
      },
      {
        label: "Kỳ thi",
        items: [
          { id: "supervisor-schedule", title: "Lịch coi thi", url: `${prefix}/exams/supervisor-schedule`, icon: Calendar },
          { id: "supervisor-rooms", title: "Phòng thi đảm nhận", url: `${prefix}/exams/supervisor-rooms`, icon: School },
          { id: "enter-exam-grades", title: "Nhập điểm thi", url: `${prefix}/exams/enter-grades`, icon: BarChart3 },
        ],
      },
      {
        label: "Giao tiếp",
        items: [
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
          { id: "availability", title: "Lịch rảnh", url: `${prefix}/availability`, icon: Clock },
          { id: "grades", title: "Nhập điểm", url: `${prefix}/grades`, icon: BarChart3 },
          { id: "awards", title: "Danh hiệu / Khen thưởng", url: `${prefix}/awards`, icon: Trophy },
          { id: "survey-statistics", title: "Thống kê khảo sát", url: `${prefix}/survey-statistics`, icon: BarChart3 },
        ],
      },
      {
        label: "Kỳ thi",
        items: [
          { id: "exams", title: "Danh sách kỳ thi", url: `${prefix}/exams`, icon: CalendarCheck2Icon },
          { id: "supervisor-schedule", title: "Lịch coi thi", url: `${prefix}/exams/supervisor-schedule`, icon: Calendar },
          { id: "supervisor-rooms", title: "Phòng thi đảm nhận", url: `${prefix}/exams/supervisor-rooms`, icon: School },
          { id: "enter-exam-grades", title: "Nhập điểm thi", url: `${prefix}/exams/enter-grades`, icon: BarChart3 },
        ],
      },
      {
        label: "Giao tiếp",
        items: [
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
          { id: "availability", title: "Lịch rảnh", url: `${prefix}/availability`, icon: Clock },
          { id: "grades", title: "Nhập điểm", url: `${prefix}/grades`, icon: BarChart3 },
          { id: "awards", title: "Danh hiệu / Khen thưởng", url: `${prefix}/awards`, icon: Trophy },
          { id: "survey-statistics", title: "Thống kê khảo sát", url: `${prefix}/survey-statistics`, icon: BarChart3 },
        ],
      },
      {
        label: "Kỳ thi",
        items: [
          {
            id: "exams",
            title: "Kỳ thi",
            icon: CalendarCheck2Icon,
            children: [
              { id: "supervisor-schedule", title: "Lịch coi thi", url: `${prefix}/exams/supervisor-schedule`, icon: Calendar },
              { id: "supervisor-rooms", title: "Phòng thi đảm nhận", url: `${prefix}/exams/supervisor-rooms`, icon: School },
              { id: "enter-exam-grades", title: "Nhập điểm thi", url: `${prefix}/exams/enter-grades`, icon: BarChart3 },
            ],
          },
        ],
      },
      {
        label: "Giao tiếp",
        items: [
          { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
        ],
      },
      {
        label: "Khác",
        items: [
          { id: "teaching-subjects", title: "Môn giảng dạy", url: `${prefix}/teaching-subjects`, icon: BookOpen },
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
                { id: "subjects", title: "Môn học", url: `${prefix}/subjects`, icon: BookOpen },
                { id: "rooms", title: "Phòng học", url: `${prefix}/rooms`, icon: School },
              ],
            },
            {
              id: "teaching",
              title: "Giảng dạy",
              icon: Presentation,
              children: [
                { id: "assignment", title: "Phân công giảng dạy", url: `${prefix}/teachingAssignmentPage`, icon: Presentation },
                { id: "proposal-history", title: "Lịch sử đề xuất", url: `${prefix}/proposal-history`, icon: FileText },
                { id: "schedule", title: "Thời khóa biểu", url: `${prefix}/schedule`, icon: Calendar },
                { id: "schedule-new", title: "Thời khóa biểu new", url: `${prefix}/scheduleNew`, icon: Calendar },
                { id: "availability", title: "Lịch trống giáo viên", url: `${prefix}/availability`, icon: CalendarCheck2Icon },
                { id: "class-periods", title: "Phân bổ số tiết theo lớp", url: `${prefix}/class-periods`, icon: BookOpen },
              ],
            },
            {
              id: "grades",
              title: "Điểm số",
              icon: BarChart3,
              children: [
                { id: "grades-list", title: "Bảng điểm", url: `${prefix}/grades`, icon: BarChart3 },
                { id: "conduct-admin", title: "Quản lý hạnh kiểm", url: `${prefix}/conduct`, icon: ClipboardList },
                { id: "attendance", title: "Điểm danh", url: `${prefix}/attendance`, icon: ClipboardList },
                { id: "grade-config", title: "Cấu hình điểm", url: `${prefix}/grade-config`, icon: Settings },
                { id: "init-grades", title: "Khởi tạo bảng điểm", url: `${prefix}/init-grades`, icon: Database },
              ],
            },
            {
              id: "exam",
              title: "Kỳ thi",
              icon: CalendarCheck2Icon,
              children: [
                { id: "exam-list", title: "Danh sách kỳ thi", url: `${prefix}/exam/exam-list`, icon: CalendarCheck2Icon },
                { id: "exam-schedule", title: "Lịch thi", url: `${prefix}/exam/schedule`, icon: Calendar },
                { id: "room-assignment", title: "Phân phòng thi", url: `${prefix}/exam/room-assignment`, icon: School },
                { id: "supervisor-assignment", title: "Phân công giám thị", url: `${prefix}/exam/supervisor-assignment`, icon: UserCheck },
                { id: "exam-grades-search", title: "Điểm thi", url: `${prefix}/exam/grades-search`, icon: BarChart3 },
                { id: "exam-dashboard", title: "DashBoard", url: `${prefix}/exam/exam-dashboard`, icon: Users },
              ],
            },
            {
              id: "surveys",
              title: "Khảo sát",
              icon: FileText,
              children: [
                { id: "survey-management", title: "Quản lý khảo sát", url: `${prefix}/surveyss`, icon: FileText },
                { id: "survey-dashboard", title: "Dashboard Khảo sát", url: `${prefix}/surveys/dashboard`, icon: BarChart3 },
                { id: "award-management", title: "Danh hiệu / Khen thưởng", url: `${prefix}/awards`, icon: Trophy },
              ],
            },
            {
              id: "communication",
              title: "Giao tiếp",
              icon: Mail,
              children: [
                { id: "notifications", title: "Thông báo", url: `${prefix}/notifications`, icon: Bell },
                { id: "send-email", title: "Gửi email hàng loạt", url: `${prefix}/send-email`, icon: Mail },
                { id: "email-history", title: "Lịch sử email", url: `${prefix}/email-history`, icon: Mail },
              ],
            },
          ],
        },
        {
          label: "Thống kê & Báo cáo",
          items: [
            { id: "statistics-dashboard", title: "Dashboard Thống kê", url: `${prefix}/statistics`, icon: BarChart3 },
            { id: "grades-stats", title: "Thống kê điểm số", url: `${prefix}/grades-statistics`, icon: BarChart3 },
            { id: "exam-dashboard", title: "Thống kê kỳ thi", url: `${prefix}/exam/exam-dashboard`, icon: PieChart },
            { id: "attendance-stats", title: "Thống kê điểm danh", url: `${prefix}/attendance`, icon: TrendingUp },
            { id: "survey-dashboard", title: "Dashboard Khảo sát", url: `${prefix}/surveys/dashboard`, icon: BarChart3 },
          ],
        },
        {
          label: "Giám sát",
          items: [
            { id: "audit-logs", title: "Log hoạt động", url: `${prefix}/audit-logs`, icon: Activity },
            { id: "trash", title: "Thùng rác", url: `${prefix}/trash`, icon: Trash2 },
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
    case "student":
      return [
        {
          label: "Điều hướng",
          items: [
            { id: "home", title: "Trang chủ", url: `${prefix}/home`, icon: Home },
          ],
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
                { id: "exam-grades-search", title: "Điểm thi", url: `${prefix}/exams/grades-search`, icon: BarChart3 },
              ],
            },
            { id: "surveys", title: "Khảo sát đánh giá", url: `${prefix}/surveys`, icon: FileText },
          ],
        },
        {
          label: "Giao tiếp",
          items: [
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
    default:
      return [
        {
          label: "Điều hướng",
          items: [{ id: "home", title: "Trang chủ", url: `${prefix}/home`, icon: Home }],
        },
      ];
  }
};

const getRoleTitle = (backendUser: any) => {
  if (!backendUser) return "";
  if (backendUser.role === "admin") return "Quản trị hệ thống";
  if (backendUser.role === "student") return "Học sinh";
  if (backendUser.role === "teacher") {
    if (isBGH(backendUser)) return "Ban Giám Hiệu";
    if (isGVCN(backendUser)) return "Giáo viên chủ nhiệm";
    if (isQLBM(backendUser)) return "Quản lý bộ môn";
    if (isGVBM(backendUser)) return "Giáo viên bộ môn";
    return "Giáo viên";
  }
  return "Người dùng";
};

const AppSidebar = () => {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { backendUser, logout } = useAuth();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const { info: schoolInfo, loading: schoolInfoLoading } = usePublicSchoolInfo();
  // Logo lấy từ settings, không dùng fallback
  const schoolLogo = schoolInfo.logoUrl;
  const roleTitle = backendUser ? getRoleTitle(backendUser) : "";
  const parentIconSize = collapsed ? "h-6 w-6" : "h-4 w-4";
  const childIconSize = collapsed ? "h-5 w-5" : "h-3.5 w-3.5";
  const parentButtonLayout = collapsed ? "justify-center" : "justify-between";
  const parentButtonPadding = collapsed ? "px-0 py-3" : "px-2 py-2";
  const parentContentLayout = collapsed ? "justify-center" : "justify-start gap-2";
  const parentContentWidth = collapsed ? "w-full" : "";

  if (!backendUser) return null;

  // Prefix
  const isBGHUser = backendUser.role === "teacher" && backendUser.teacherFlags?.isLeader === true;
  let prefix = `/${backendUser.role}`;
  if (backendUser.role === "teacher") {
    const isGVCN = backendUser.teacherFlags?.isHomeroom === true;
    const isQLBM = backendUser.teacherFlags?.isDepartmentHead === true;
    if (isBGHUser) prefix = "/bgh";
    else if (isGVCN) prefix = "/gvcn";
    else if (isQLBM) prefix = "/qlbm";
    else prefix = "/gvbm";
  }

  const settingsHref = backendUser.role === "admin" ? "/admin/settings" : isBGHUser ? "/bgh/settings" : null;

  // Memoize navigationGroups
  const navigationGroups = useMemo(() => {
    const groups = getNavigationGroups(backendUser, prefix);
    return groups.filter((group) => Array.isArray(group.items) && group.items.length > 0);
  }, [backendUser, prefix]);

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

  useEffect(() => {
    if (collapsed) {
      setOpenMenus({});
    }
  }, [collapsed]);

  const toggleMenu = (id: string) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isItemActive = (item: any) => {
    if ("children" in item) {
      // ✅ Chỉ active khi có child exact match hoặc sub-path của child
      // Ưu tiên child có url dài hơn (specific hơn) nếu nhiều child match
      return item.children.some((child: any) => {
        if (location.pathname === child.url) return true;
        if (location.pathname.startsWith(child.url + "/")) {
          // ✅ Kiểm tra xem có child nào khác có url dài hơn và cũng match không
          // Nếu có, thì pathname thuộc về child đó (specific hơn), không phải child hiện tại
          const hasMoreSpecificChild = item.children.some((otherChild: any) => 
            otherChild.url !== child.url && 
            otherChild.url.length > child.url.length &&
            location.pathname.startsWith(otherChild.url + "/")
          );
          return !hasMoreSpecificChild;
        }
        return false;
      });
    }
    return location.pathname === item.url || location.pathname.startsWith(item.url + "/");
  };

  return (
    <Sidebar collapsible="icon">
      {/* Sidebar Rail - Cho phép kéo ra/kéo vào */}
      <SidebarRail />
      
      {/* Header */}
      <SidebarHeader className="p-4 border-b border-border/60 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
        <div className={`flex flex-col items-center ${collapsed ? "gap-2" : "gap-3"}`}>
          {/* Nút toggle sidebar */}
          {!collapsed && (
            <div className="w-full flex justify-end mb-1">
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-md hover:bg-accent transition-colors"
                title="Thu gọn sidebar"
                aria-label="Thu gọn sidebar"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
          
          <div className="flex items-center justify-center">
            {schoolInfoLoading ? (
              <Skeleton className={`${collapsed ? "h-10 w-10" : "h-14 w-14"} rounded-xl`} />
            ) : schoolLogo ? (
              <div
                className={`flex items-center justify-center ${collapsed ? "h-10 w-10" : "h-14 w-14"} rounded-xl border border-border/70 bg-background shadow-sm overflow-hidden`}
              >
                <img src={schoolLogo} alt="Logo trường học" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div
                className={`flex items-center justify-center ${collapsed ? "h-10 w-10" : "h-14 w-14"} rounded-xl border border-border/70 bg-muted/50`}
              >
                <School className={`${collapsed ? "h-6 w-6" : "h-8 w-8"} text-muted-foreground`} />
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="w-full text-center">
              {schoolInfoLoading ? (
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold truncate" title={schoolInfo.name}>
                    {schoolInfo.name}
                  </p>
                  {schoolInfo.slogan ? (
                    <p className="text-xs text-muted-foreground truncate" title={schoolInfo.slogan}>
                      {schoolInfo.slogan}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="pb-6 px-1 space-y-1">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label} className="rounded-lg">
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isItemActive(item);

                  return (
                    <SidebarMenuItem key={item.id}>
                      {"children" in item ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleMenu(item.id)}
                            aria-expanded={openMenus[item.id] === true}
                            aria-controls={`${item.id}-submenu`}
                            className={`flex w-full items-center ${parentButtonLayout} ${parentButtonPadding} rounded-md transition-colors ${
                              active
                                ? "bg-primary/10 text-primary font-semibold"
                                : openMenus[item.id]
                                ? "bg-muted/50"
                                : "hover:bg-accent hover:text-accent-foreground"
                            }`}
                          >
                            <div className={`flex items-center ${parentContentLayout} ${parentContentWidth}`}>
                              <item.icon className={`${parentIconSize} ${active ? "text-primary" : "text-muted-foreground"}`} />
                              {!collapsed && <span>{item.title}</span>}
                            </div>
                            {!collapsed &&
                              (openMenus[item.id] ? (
                                <ChevronDown className="h-4 w-4 opacity-70" />
                              ) : (
                                <ChevronRight className="h-4 w-4 opacity-70" />
                              ))}
                          </button>

                          {openMenus[item.id] && !collapsed && (
                            <div id={`${item.id}-submenu`} className="ml-6 mt-1 space-y-1 border-l border-border/40 pl-3">
                              {item.children.map((child: any) => {
                                // ✅ Chỉ active khi exact match hoặc là sub-path của chính child đó
                                // Ưu tiên child có url dài hơn (specific hơn) nếu nhiều child match
                                let isActive = location.pathname === child.url;
                                if (!isActive && location.pathname.startsWith(child.url + "/")) {
                                  // ✅ Kiểm tra xem có child nào khác có url dài hơn và cũng match không
                                  const hasMoreSpecificChild = item.children.some((otherChild: any) =>
                                    otherChild.url !== child.url &&
                                    otherChild.url.length > child.url.length &&
                                    location.pathname.startsWith(otherChild.url + "/")
                                  );
                                  isActive = !hasMoreSpecificChild;
                                }
                                return (
                                  <NavLink
                                    key={child.id}
                                    to={child.url}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`flex items-center space-x-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                                      isActive ? "bg-primary/10 text-primary font-medium shadow-sm" : "hover:bg-accent hover:text-accent-foreground"
                                    }`}
                                  >
                                    <child.icon className={`${childIconSize} ${isActive ? "text-primary" : "text-muted-foreground"}`} />
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
                          aria-current={active ? "page" : undefined}
                          className={`group flex items-center ${parentContentLayout} rounded-md ${parentButtonPadding} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                            active ? "bg-primary/10 text-primary font-semibold shadow-sm" : "hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <item.icon className={`${parentIconSize} ${active ? "text-primary" : "text-muted-foreground"}`} />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-4 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {backendUser && (
              <button
                type="button"
                aria-label="Tùy chọn tài khoản"
                className={`w-full rounded-lg border border-border/60 bg-muted transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  collapsed ? "flex items-center justify-center p-2" : "px-3 py-2"
                }`}
              >
                {collapsed ? (
                  <UserCheck className="h-4 w-4 text-primary" />
                ) : (
                  <div className="flex items-center space-x-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium truncate">{backendUser.name}</p>
                      {roleTitle ? (
                        <p className="text-xs text-muted-foreground truncate">{roleTitle}</p>
                      ) : null}
                    </div>
                  </div>
                )}
              </button>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent side="right" align="end" className="w-64 py-3 px-2 rounded-lg shadow-lg space-y-1">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{backendUser.name}</p>
                {roleTitle ? <p className="text-xs leading-none text-muted-foreground">{roleTitle}</p> : null}
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

            {settingsHref && (
              <DropdownMenuItem asChild>
                <NavLink to={settingsHref} className="flex items-center space-x-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Cài đặt</span>
                </NavLink>
              </DropdownMenuItem>
            )}


            {/* Removed settings from footer for all roles */}

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
