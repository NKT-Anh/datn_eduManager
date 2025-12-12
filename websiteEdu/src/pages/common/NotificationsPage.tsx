import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminOrBGH, isBGH, isGVCN, isGVBM, isQLBM } from "@/utils/permissions";
import axios from "axios";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useClasses } from "@/hooks";
import { assignmentApi } from "@/services/assignmentApi";
import { departmentManagementApi } from "@/services/departmentManagementApi";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
import { cn } from "@/lib/utils";
import { 
  Bell, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar as CalendarIconLucide,
  Filter,
  AlertCircle,
  CheckCircle,
  Info,
  BookOpen,
  Users,
  GraduationCap,
  Megaphone,
  Check,
  Eye,
  Clock,
  Search,
  X,
  User,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ArrowLeft as ArrowBack,
  Download,
  File,
  Paperclip,
  XCircle,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Cloud,
  CalendarIcon
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { uploadFileToCloudinary, formatFileSize, getFileIcon, getFileIconColor } from "@/services/cloudinary/cloudinaryFileUpload";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

// ✅ Các loại thông báo cho trường THPT
const NOTIFICATION_TYPES = {
  exam: { label: "Lịch kiểm tra / lịch thi", icon: Calendar, color: "bg-blue-100 text-blue-700 border-blue-300" },
  holiday: { label: "Nghỉ học", icon: Calendar, color: "bg-orange-100 text-orange-700 border-orange-300" },
  grade: { label: "Kết quả học tập", icon: CheckCircle, color: "bg-green-100 text-green-700 border-green-300" },
  rule: { label: "Quy định", icon: BookOpen, color: "bg-purple-100 text-purple-700 border-purple-300" },
  homeroom: { label: "GVCN gửi cho lớp", icon: Users, color: "bg-pink-100 text-pink-700 border-pink-300" },
  event: { label: "Sự kiện, ngoại khóa", icon: Megaphone, color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  admission: { label: "Tuyển sinh", icon: GraduationCap, color: "bg-teal-100 text-teal-700 border-teal-300" },
  system: { label: "Thông báo hệ thống", icon: Info, color: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  general: { label: "Chung chung", icon: Bell, color: "bg-gray-100 text-gray-700 border-gray-300" },
};

const RECIPIENT_TYPES = {
  all: "Tất cả",
  role: "Theo vai trò",
  class: "Theo lớp",
  user: "Người cụ thể",
};

const PRIORITY_LABELS = {
  high: { label: "Cao", color: "bg-red-100 text-red-700 border-red-300" },
  medium: { label: "Trung bình", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  low: { label: "Thấp", color: "bg-gray-100 text-gray-700 border-gray-300" },
};

interface Attachment {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
  uploadedAt?: string;
}

interface CreatedBy {
  _id: string;
  email?: string;
  role?: string;
  displayName?: string;
  linkedId?: {
    name?: string;
    avatarUrl?: string;
    gender?: string;
  };
}

interface Notification {
  _id: string;
  title: string;
  content: string;
  type: keyof typeof NOTIFICATION_TYPES;
  priority: keyof typeof PRIORITY_LABELS;
  startDate?: string;
  endDate?: string;
  recipientType: keyof typeof RECIPIENT_TYPES;
  recipientRole?: string;
  recipientId?: string;
  classId?: string;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean; // ✅ Field từ backend
  createdBy?: CreatedBy | string; // ✅ Thông tin người gửi
  attachments?: Attachment[]; // ✅ Tệp đính kèm
  sender?: string;
  senderDisplayName?: string;
}

/**
 * ✅ Notifications Page - Xem và quản lý thông báo cho trường THPT
 */
export default function NotificationsPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Lấy prefix route từ location
  const getRoutePrefix = () => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return '/admin';
    if (path.startsWith('/teacher')) return '/teacher';
    if (path.startsWith('/student')) return '/student';
    if (path.startsWith('/bgh')) return '/bgh';
    if (path.startsWith('/qlbm')) return '/qlbm';
    if (path.startsWith('/gvcn')) return '/gvcn';
    if (path.startsWith('/gvbm')) return '/gvbm';
    return '/admin';
  };
  
  const prefix = getRoutePrefix();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterReadStatus, setFilterReadStatus] = useState<string>("all"); // ✅ Filter cho học sinh
  const [searchTerm, setSearchTerm] = useState<string>(""); // ✅ Tìm kiếm
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // ✅ Đã chuyển sang NotificationDetailPage, không cần dialog view nữa
  // const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  // ✅ Không cần replies state nữa vì đã chuyển sang page riêng
  // const [replies, setReplies] = useState<any[]>([]);
  // const [replyContent, setReplyContent] = useState("");
  // const [loadingReplies, setLoadingReplies] = useState(false);
  // const [submittingReply, setSubmittingReply] = useState(false);
  
  // ✅ Kiểm tra quyền trước khi khởi tạo form
  const getDefaultRecipientType = (): keyof typeof RECIPIENT_TYPES => {
    if (backendUser?.role === 'admin' || (backendUser?.role === 'teacher' && backendUser?.teacherFlags?.isLeader)) {
      return "all";
    }
    if (backendUser?.role === 'teacher' && (backendUser?.teacherFlags?.isHomeroom || (!backendUser?.teacherFlags?.isLeader && !backendUser?.teacherFlags?.isDepartmentHead))) {
      return "class";
    }
    return "all";
  };

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "general" as keyof typeof NOTIFICATION_TYPES,
    priority: "medium" as keyof typeof PRIORITY_LABELS,
    startDate: "", // ✅ Ngày đăng = ngày bắt đầu hiển thị
    endDate: "",
    recipientType: getDefaultRecipientType(),
    recipientRole: "",
    recipientId: "",
    classId: "",
    attachments: [] as Attachment[], // ✅ Tệp đính kèm
  });
  
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<Array<{id: string, label: string, type: string}>>([]);
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const { classes } = useClasses();
  
  // ✅ State để lấy danh sách lớp đang dạy và giáo viên trong tổ
  const [teachingClassIds, setTeachingClassIds] = useState<string[]>([]);
  const [departmentTeachers, setDepartmentTeachers] = useState<any[]>([]);
  const { currentYearCode } = useCurrentAcademicYear();
  
  // Rich text editor states
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // ✅ Kiểm tra quyền theo bảng
  const isAdmin = backendUser?.role === 'admin';
  const isBGHUser = isBGH(backendUser);
  const isGVCNUser = isGVCN(backendUser);
  const isGVBMUser = isGVBM(backendUser);
  const isQLBMUser = isQLBM(backendUser);
  const isTeacher = backendUser?.role === 'teacher'; // ✅ Tất cả giáo viên
  const isStudent = backendUser?.role === 'student';
  
  // Quyền xem: Admin, BGH, GVCN, GVBM, QLBM, Học sinh (chỉ xem thông báo của mình)
  const canView = isAdmin || isBGHUser || isGVCNUser || isGVBMUser || isQLBMUser || isStudent;
  
  // ✅ Quyền tạo: Tất cả giáo viên (Admin, BGH, GVCN, GVBM, QLBM) - KHÔNG có học sinh
  const canCreate = isAdmin || isBGHUser || isTeacher;
  
  // Quyền sửa: Chỉ Admin
  const canUpdate = isAdmin;
  
  // Quyền gửi toàn trường: Chỉ Admin và BGH
  const canSendToAll = isAdmin || isBGHUser;
  
  // Quyền gửi theo role: Chỉ Admin và BGH
  const canSendByRole = isAdmin || isBGHUser;

  // Thêm state tab vào đầu NotificationsPage
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  useEffect(() => {
    if (canView) {
    fetchNotifications();
    }
  }, [canView]);
  
  // ✅ Kiểm tra edit từ state khi navigate từ detail page
  useEffect(() => {
    const state = location.state as { editNotificationId?: string } | null;
    if (state?.editNotificationId && !loading && backendUser?.idToken) {
      // Tìm trong danh sách notifications hiện có
      const notif = notifications.find(n => n._id === state.editNotificationId);
      if (notif) {
        openEditDialog(notif);
        // Clear state
        window.history.replaceState({}, document.title);
      } else {
        // Nếu không tìm thấy trong danh sách, fetch trực tiếp từ API
        const fetchNotificationForEdit = async () => {
          try {
            const token = backendUser.idToken;
            const response = await axios.get(`${API_BASE_URL}/notifications/${state.editNotificationId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.data) {
              openEditDialog(response.data.data);
              // Clear state
              window.history.replaceState({}, document.title);
            }
          } catch (error) {
            console.error("Lỗi khi fetch notification để edit:", error);
            toast({
              title: "Lỗi",
              description: "Không thể tải thông báo để chỉnh sửa",
              variant: "destructive",
            });
            // Clear state ngay cả khi lỗi
            window.history.replaceState({}, document.title);
          }
        };
        fetchNotificationForEdit();
      }
    }
  }, [notifications, location.state, backendUser?.idToken, loading]);


  useEffect(() => {
    filterNotifications();
  }, [notifications, filterType, filterPriority, filterReadStatus, searchTerm, tab]);

  // ✅ Fetch unread count cho học sinh
  useEffect(() => {
    if (isStudent) {
      fetchUnreadCount();
    }
  }, [isStudent]);
  
  // ✅ Lấy danh sách lớp đang dạy cho GVCN, GVBM, QLBM
  useEffect(() => {
    const fetchTeachingClasses = async () => {
      if (!backendUser || (!isGVCNUser && !isGVBMUser && !isQLBMUser)) {
        setTeachingClassIds([]);
        return;
      }
      
      try {
        // ✅ Lấy teacherId đúng cách
        let teacherId: string | undefined;
        if (backendUser.teacherId) {
          teacherId = typeof backendUser.teacherId === 'object' 
            ? (backendUser.teacherId as any)?._id 
            : backendUser.teacherId;
        }
        
        if (!teacherId || !currentYearCode) {
          console.log('⚠️ Không có teacherId hoặc currentYearCode:', { teacherId, currentYearCode });
          setTeachingClassIds([]);
          return;
        }
        
        console.log('🔍 Fetching teaching classes for teacher:', teacherId, 'year:', currentYearCode);
        
        const assignments = await assignmentApi.getByTeacher(teacherId, { year: currentYearCode });
        
        console.log('📚 Assignments received:', assignments?.length || 0, assignments);
        
        // Lấy danh sách classId từ assignments
        const classIds = (assignments || [])
          .map(a => {
            if (!a || !a.classId) return null;
            const classId = typeof a.classId === 'object' ? a.classId._id : a.classId;
            return classId ? String(classId) : null;
          })
          .filter(Boolean) as string[];
        
        const uniqueClassIds = [...new Set(classIds)];
        console.log('✅ Teaching class IDs:', uniqueClassIds);
        setTeachingClassIds(uniqueClassIds);
      } catch (error) {
        console.error('❌ Lỗi khi lấy danh sách lớp đang dạy:', error);
        setTeachingClassIds([]);
      }
    };
    
    fetchTeachingClasses();
  }, [backendUser, isGVCNUser, isGVBMUser, isQLBMUser, currentYearCode]);
  
  // ✅ Lấy danh sách giáo viên trong tổ cho QLBM
  useEffect(() => {
    const fetchDepartmentTeachers = async () => {
      if (!backendUser || !isQLBMUser || !currentYearCode) {
        setDepartmentTeachers([]);
        return;
      }
      
      try {
        const response = await departmentManagementApi.getTeachers({ year: currentYearCode });
        const teachers = response.teachers || [];
        console.log('👥 Department teachers received:', teachers.length, teachers);
        setDepartmentTeachers(teachers);
      } catch (error) {
        console.error('❌ Lỗi khi lấy danh sách giáo viên trong tổ:', error);
        setDepartmentTeachers([]);
      }
    };
    
    fetchDepartmentTeachers();
  }, [backendUser, isQLBMUser, currentYearCode]);

  const fetchNotifications = async () => {
    try {
      const token = backendUser?.idToken;
      const res = await axios.get(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data.data || []);
      // ✅ Cập nhật unread count cho học sinh
      if (isStudent) {
        const unread = (res.data.data || []).filter((n: Notification) => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể tải danh sách thông báo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const token = backendUser?.idToken;
      const res = await axios.get(`${API_BASE_URL}/notifications/unread/count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(res.data.unreadCount || 0);
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
    }
  };

  // Sửa filterNotifications để dùng state tab
  const filterNotifications = () => {
    let filtered = [...notifications];
    // Tách tab: Đã nhận vs Đã gửi
    if (tab === 'received') {
      filtered = filtered.filter(n => {
        if (isStudent) return n.recipientRole === 'student' || n.recipientType === 'all' || n.recipientId === backendUser?._id;
        if (isTeacher) return n.recipientRole === 'teacher' || n.recipientType === 'all' || n.recipientId === backendUser?._id;
        if (isQLBMUser) return n.recipientRole === 'department_head' || n.recipientType === 'all' || n.recipientId === backendUser?._id;
        return true;
      });
    } else {
      filtered = filtered.filter(n => {
        if (typeof n.createdBy === 'string') return n.createdBy === backendUser?._id;
        return n.createdBy?._id === backendUser?._id;
      });
    }
    // ✅ Tìm kiếm theo tiêu đề và nội dung
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(searchLower) ||
        n.content.toLowerCase().includes(searchLower)
      );
    }
    if (filterType !== "all") {
      filtered = filtered.filter(n => n.type === filterType);
    }
    if (filterPriority !== "all") {
      filtered = filtered.filter(n => n.priority === filterPriority);
    }

    // ✅ Filter theo trạng thái đọc (chỉ cho học sinh)
    if (isStudent && filterReadStatus !== "all") {
      if (filterReadStatus === "unread") {
        filtered = filtered.filter(n => !n.isRead);
      } else if (filterReadStatus === "read") {
        filtered = filtered.filter(n => n.isRead);
      }
    }
    
    setFilteredNotifications(filtered);
  };

  // ✅ Lấy tên người gửi với prefix theo role
  const getSenderName = (notification: Notification): string => {
    if (notification.senderDisplayName) return notification.senderDisplayName;
    if (notification.sender) return notification.sender;

    if (typeof notification.createdBy === 'string' || !notification.createdBy) {
      return 'Hệ thống';
    }

    const createdBy = notification.createdBy;
    if (createdBy.displayName) return createdBy.displayName;

    if (createdBy.role === 'admin') {
      return 'Ban Giám hiệu';
    }
    
    if (createdBy.role === 'teacher') {
      const name = createdBy.linkedId?.name;
      const gender = createdBy.linkedId?.gender;
      
      if (name) {
        if (gender === 'female' || gender === 'nữ') {
          return `Cô ${name}`;
        }
        if (gender === 'male' || gender === 'nam') {
          return `Thầy ${name}`;
        }
        const lower = name.toLowerCase();
        const maybeFemale = ['anh', 'lan', 'mai', 'linh', 'hương', 'huong', 'thu', 'hoa', 'ngọc', 'ngoc', 'như', 'nhu', 'phương', 'phuong', 'trang'];
        return maybeFemale.some((hint) => lower.includes(hint)) ? `Cô ${name}` : `Thầy ${name}`;
      }
      return createdBy.email || 'Giáo viên';
    }
    
    if (createdBy.linkedId?.name) {
      return createdBy.linkedId.name;
    }
    
    return createdBy.email || 'Hệ thống';
  };

  // ✅ Lấy avatar người gửi
  const getSenderAvatar = (notification: Notification): string | null => {
    if (typeof notification.createdBy === 'string') return null;
    const createdBy = notification.createdBy;
    if (!createdBy) return null;
    return createdBy.linkedId?.avatarUrl || null;
  };

  const handleCreate = async () => {
    try {
      // ✅ Debug log chi tiết
      console.log('🔍 Debug handleCreate - BGH:', {
        isBGHUser,
        isAdmin,
        isGVCNUser,
        isGVBMUser,
        isQLBMUser,
        recipientType: formData.recipientType,
        recipientRole: formData.recipientRole,
        selectedRecipients: selectedRecipients.length,
        canSendToAll,
        canSendByRole,
        backendUserRole: backendUser?.role,
        teacherFlags: backendUser?.teacherFlags
      });
      
      // ✅ Validation: Kiểm tra các field bắt buộc
      if (!formData.title.trim()) {
        toast({
          title: "Lỗi",
          description: "Vui lòng nhập tiêu đề thông báo",
          variant: "destructive",
        });
        return;
      }
      if (!formData.content.trim()) {
        toast({
          title: "Lỗi",
          description: "Vui lòng nhập nội dung thông báo",
          variant: "destructive",
        });
        return;
      }
      
      // ✅ Validation: BGH và Admin LUÔN được phép gửi all hoặc role
      // Kiểm tra BGH và Admin TRƯỚC, bỏ qua tất cả validation khác
      if (isBGHUser || isAdmin) {
        console.log('✅ BGH/Admin được phép gửi thông báo - bỏ qua validation');
        // BGH và Admin luôn được phép, không cần kiểm tra gì thêm
      } else {
        // Chỉ chặn GVCN/GVBM (KHÔNG phải BGH và KHÔNG phải Admin) khi gửi all hoặc role
        const isRestrictedUser = (isGVCNUser || isGVBMUser) && !isBGHUser && !isAdmin;
        console.log('🔍 Kiểm tra restricted user:', { isRestrictedUser, isGVCNUser, isGVBMUser });
        if (isRestrictedUser && (formData.recipientType === 'all' || formData.recipientType === 'role')) {
          console.log('❌ Chặn GVCN/GVBM gửi all/role');
          toast({
            title: "Lỗi",
            description: "Bạn không có quyền gửi thông báo toàn trường hoặc theo vai trò",
            variant: "destructive",
          });
          return;
        }
      }
      
      // ✅ Validation: Kiểm tra recipient
      if (formData.recipientType === 'role' && !formData.recipientRole) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn vai trò",
          variant: "destructive",
        });
        return;
      }
      if (formData.recipientType === 'user' && !formData.recipientId) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn người nhận",
          variant: "destructive",
        });
        return;
      }
      if (formData.recipientType === 'class' && !formData.classId) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn lớp học",
          variant: "destructive",
        });
        return;
      }
      if (formData.recipientType === 'all' && selectedRecipients.length === 0) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn người nhận",
          variant: "destructive",
        });
        return;
      }
      
      const token = backendUser?.idToken;
      const payload: any = {
        title: formData.title,
        content: formData.content,
        type: formData.type,
        priority: formData.priority,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        recipientType: formData.recipientType,
        attachments: formData.attachments, // ✅ Gửi attachments
      };
      
      // Chỉ thêm các field tương ứng với recipientType
      if (formData.recipientType === 'role') {
        payload.recipientRole = formData.recipientRole;
      } else if (formData.recipientType === 'user') {
        payload.recipientId = formData.recipientId;
      } else if (formData.recipientType === 'class') {
        payload.classId = formData.classId;
      }
      
      await axios.post(`${API_BASE_URL}/notifications`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      toast({
        title: "Thành công",
        description: "Đã tạo thông báo",
      });
      
      setIsCreateDialogOpen(false);
      resetForm();
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể tạo thông báo",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedNotification) return;
    
    try {
      // ✅ Validation: Chỉ chặn GVCN/GVBM (KHÔNG phải BGH và KHÔNG phải Admin) khi gửi all hoặc role
      const isRestrictedUser = (isGVCNUser || isGVBMUser) && !isBGHUser && !isAdmin;
      if (isRestrictedUser && (formData.recipientType === 'all' || formData.recipientType === 'role')) {
        toast({
          title: "Lỗi",
          description: "Bạn không có quyền gửi thông báo toàn trường hoặc theo vai trò",
          variant: "destructive",
        });
        return;
      }
      
      // ✅ Validation: Kiểm tra các field bắt buộc
      if (formData.recipientType === 'role' && !formData.recipientRole) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn vai trò",
          variant: "destructive",
        });
        return;
      }
      if (formData.recipientType === 'user' && !formData.recipientId) {
        toast({
          title: "Lỗi",
          description: "Vui lòng nhập ID người nhận",
          variant: "destructive",
        });
        return;
      }
      if (formData.recipientType === 'class' && !formData.classId) {
        toast({
          title: "Lỗi",
          description: "Vui lòng nhập ID lớp học",
          variant: "destructive",
        });
        return;
      }
      
      const token = backendUser?.idToken;
      const payload: any = {
        title: formData.title,
        content: formData.content,
        type: formData.type,
        priority: formData.priority,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        recipientType: formData.recipientType,
        attachments: formData.attachments, // ✅ Gửi attachments
      };
      
      // Chỉ thêm các field tương ứng với recipientType
      if (formData.recipientType === 'role') {
        payload.recipientRole = formData.recipientRole;
      } else if (formData.recipientType === 'user') {
        payload.recipientId = formData.recipientId;
      } else if (formData.recipientType === 'class') {
        payload.classId = formData.classId;
      }
      
      await axios.put(`${API_BASE_URL}/notifications/${selectedNotification._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      toast({
        title: "Thành công",
        description: "Đã cập nhật thông báo",
      });
      
      setIsEditDialogOpen(false);
      setSelectedNotification(null);
      resetForm();
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể cập nhật thông báo",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedNotification) return;
    
    try {
      const token = backendUser?.idToken;
      await axios.delete(`${API_BASE_URL}/notifications/${selectedNotification._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      toast({
        title: "Thành công",
        description: "Đã xóa thông báo",
      });
      
      setIsDeleteDialogOpen(false);
      setSelectedNotification(null);
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể xóa thông báo",
        variant: "destructive",
      });
    }
  };
  
  // ✅ Xử lý upload file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingFiles(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const { url, size } = await uploadFileToCloudinary(file);
        return {
          fileName: file.name,
          fileUrl: url,
          fileSize: size,
          fileType: file.type,
        };
      });
      
      const uploadedFiles = await Promise.all(uploadPromises);
      setFormData({
        ...formData,
        attachments: [...formData.attachments, ...uploadedFiles],
      });
      
      toast({
        title: "Thành công",
        description: `Đã tải lên ${uploadedFiles.length} tệp`,
      });
    } catch (error: any) {
      console.error("Lỗi upload file:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tải lên tệp",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(false);
      // Reset input
      e.target.value = '';
    }
  };
  
  // ✅ Xóa attachment
  const handleRemoveAttachment = (index: number) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      attachments: newAttachments,
    });
  };

  const openEditDialog = (notification: Notification) => {
    setSelectedNotification(notification);
    const recipientType = notification.recipientType || "all";
    const recipientRole = notification.recipientRole || "";
    
    // ✅ Khôi phục selectedRecipients dựa trên notification data
    let recipients: { id: string; label: string; type: string }[] = [];
    
    if (recipientType === 'all') {
      recipients = [{ id: 'all_school', label: 'Toàn trường', type: 'all' }];
    } else if (recipientType === 'role') {
      const roleMap: Record<string, { id: string; label: string }> = {
        'student': { id: 'all_students', label: 'Tất cả học sinh' },
        'teacher': { 
          id: isQLBMUser ? 'role_teachers_in_department' : 'all_teachers', 
          label: isQLBMUser ? 'Tất cả giáo viên trong tổ' : 'Tất cả giáo viên' 
        },
        'leader': { id: 'role_leader', label: 'Ban Giám Hiệu' },
        'department_head': { id: 'role_department_head', label: 'Quản lý bộ môn' },
        'homeroom_teacher': { id: 'role_homeroom_teacher', label: 'Giáo viên Chủ nhiệm' },
      };
      const roleInfo = roleMap[recipientRole];
      if (roleInfo) {
        recipients = [{ id: roleInfo.id, label: roleInfo.label, type: 'role' }];
      }
    } else if (recipientType === 'class' && notification.classId) {
      // TODO: Có thể lấy tên lớp từ classId nếu cần
      recipients = [{ id: String(notification.classId), label: `Lớp ${String(notification.classId)}`, type: 'class' }];
    } else if (recipientType === 'user' && notification.recipientId) {
      // TODO: Có thể lấy tên người dùng từ recipientId nếu cần
      recipients = [{ id: String(notification.recipientId), label: `Người dùng ${String(notification.recipientId)}`, type: 'user' }];
    }
    
    setFormData({
      title: notification.title,
      content: notification.content,
      type: notification.type || "general",
      priority: notification.priority || "medium",
      startDate: notification.startDate ? new Date(notification.startDate).toISOString().split('T')[0] : "",
      endDate: notification.endDate ? new Date(notification.endDate).toISOString().split('T')[0] : "",
      recipientType: recipientType,
      recipientRole: recipientRole,
      attachments: notification.attachments || [], // ✅ Load attachments
      recipientId: notification.recipientId || "",
      classId: notification.classId || "",
    });
    setSelectedRecipients(recipients);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (notification: Notification) => {
    setSelectedNotification(notification);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    // ✅ Set recipientType mặc định phù hợp với quyền
    let defaultRecipientType: keyof typeof RECIPIENT_TYPES = "all";
    if (isGVCNUser || isGVBMUser) {
      defaultRecipientType = "class"; // GVCN/GVBM mặc định là class
    }
    
    // ✅ Mặc định ngày đăng = hôm nay
    const today = new Date().toISOString().split('T')[0];
    
    setFormData({
      title: "",
      content: "",
      type: "general",
      priority: "medium",
      startDate: today, // ✅ Mặc định = hôm nay
      endDate: "",
      recipientType: defaultRecipientType,
      recipientRole: "",
      attachments: [], // ✅ Reset attachments
      recipientId: "",
      classId: "",
    });
    setSelectedRecipients([]);
    setIsBold(false);
    setIsItalic(false);
    setIsUnderline(false);
  };

  const getTypeConfig = (type: string) => {
    return NOTIFICATION_TYPES[type as keyof typeof NOTIFICATION_TYPES] || NOTIFICATION_TYPES.general;
  };

  const getPriorityConfig = (priority: string) => {
    return PRIORITY_LABELS[priority as keyof typeof PRIORITY_LABELS] || PRIORITY_LABELS.medium;
  };

  // ✅ Đánh dấu đã đọc (cho học sinh)
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const token = backendUser?.idToken;
      await axios.post(`${API_BASE_URL}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Cập nhật local state
      setNotifications(prev => prev.map(n => 
        n._id === notificationId ? { ...n, isRead: true } : n
      ));
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      toast({
        title: "Thành công",
        description: "Đã đánh dấu thông báo là đã đọc",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể đánh dấu đã đọc",
        variant: "destructive",
      });
    }
  };

  // ✅ Đánh dấu tất cả đã đọc (cho học sinh)
  const handleMarkAllAsRead = async () => {
    try {
      const token = backendUser?.idToken;
      await axios.post(`${API_BASE_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Cập nhật local state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      
      toast({
        title: "Thành công",
        description: "Đã đánh dấu tất cả thông báo là đã đọc",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể đánh dấu tất cả đã đọc",
        variant: "destructive",
      });
    }
  };

  // ✅ Mở dialog xem chi tiết (cho tất cả role)
  const openViewDialog = (notification: Notification) => {
    // ✅ Điều hướng đến trang chi tiết thay vì mở dialog
    navigate(`${prefix}/notifications/${notification._id}`);
  };

  // ✅ Các hàm fetchReplies, handleSubmitReply, canReply đã được chuyển sang NotificationDetailPage


  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
        </div>
      </div>
    );
  }

  // ✅ Title và description khác nhau theo role
  const getPageTitle = () => {
    if (isStudent) {
      return "Thông báo";
    }
    if (isAdmin || isBGHUser) {
      return "Quản lý thông báo";
    }
    if (isGVCNUser) {
      return "Thông báo lớp chủ nhiệm";
    }
    if (isGVBMUser) {
      return "Thông báo lớp dạy";
    }
    return "Thông báo";
  };

  const getPageDescription = () => {
    if (isStudent) {
      return "Xem các thông báo dành cho bạn";
    }
    if (isAdmin || isBGHUser) {
      return "Xem và quản lý tất cả thông báo hệ thống";
    }
    if (isGVCNUser) {
      return "Xem và tạo thông báo cho lớp chủ nhiệm";
    }
    if (isGVBMUser) {
      return "Xem và tạo thông báo cho lớp bạn đang dạy";
    }
    return "Xem thông báo hệ thống";
  };

  return (
    <div className="space-y-6">
      {/* Tabs: Đã nhận / Đã gửi */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('received')} className={`px-4 py-2 font-medium rounded-t ${tab === 'received' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>Đã nhận</button>
        <button onClick={() => setTab('sent')} className={`px-4 py-2 font-medium rounded-t ${tab === 'sent' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>Đã gửi</button>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{getPageTitle()}</h1>
            {isStudent && unreadCount > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                {unreadCount} chưa đọc
              </Badge>
            )}
        </div>
          <p className="text-muted-foreground">{getPageDescription()}</p>
        </div>
        <div className="flex items-center gap-2">
          {isStudent && unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Đánh dấu tất cả đã đọc
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Tạo thông báo
          </Button>
          )}
        </div>
      </div>

      {/* Header với Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-slate-900 dark:text-slate-50 text-3xl font-bold leading-tight tracking-[-0.033em]">
          Thông báo
        </h1>
        <div className="w-full sm:w-auto">
          <label className="relative block">
            <span className="sr-only">Tìm kiếm</span>
            <Search className="absolute inset-y-0 left-0 flex items-center pl-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
            <Input
              type="text"
              placeholder="Tìm kiếm theo tiêu đề, người gửi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block bg-white dark:bg-slate-900 w-full sm:w-72 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 pl-10 pr-3 shadow-sm focus:outline-none focus:border-primary focus:ring-primary focus:ring-1 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 py-2 border-t border-b border-slate-200 dark:border-slate-800 mb-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-type" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Loại:
          </Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger 
              id="filter-type"
              className="w-auto text-sm rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-primary/50 focus:border-primary"
            >
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {Object.entries(NOTIFICATION_TYPES).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isStudent && (
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-status" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Trạng thái:
            </Label>
            <Select value={filterReadStatus} onValueChange={setFilterReadStatus}>
              <SelectTrigger 
                id="filter-status"
                className="w-auto text-sm rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-primary/50 focus:border-primary"
              >
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="unread">Chưa đọc</SelectItem>
                <SelectItem value="read">Đã đọc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {!isStudent && (
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-priority" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Độ ưu tiên:
            </Label>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger 
                id="filter-priority"
                className="w-auto text-sm rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-primary/50 focus:border-primary"
              >
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Đang tải thông báo...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Không có thông báo nào</p>
            {searchTerm && (
              <p className="text-sm text-muted-foreground mt-2">
                Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredNotifications.map((notification) => {
            const isUnread = !notification.isRead;
            const senderName = getSenderName(notification);
            const createdAt = new Date(notification.createdAt);
            const relativeTime = formatDistanceToNow(createdAt, {
              addSuffix: true,
              locale: vi,
            });
            // Format: "lúc 19:35 16 tháng 11, 2025"
            const time = createdAt.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            const date = createdAt.toLocaleDateString("vi-VN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            const fullDateTime = `lúc ${time} ${date}`;
            
            // ✅ Xác định màu badge cho sender (giống HTML mẫu)
            const getSenderBadgeColor = (senderName: string, role?: string) => {
              if (senderName.includes('Ban Giám hiệu') || senderName.includes('BGH')) {
                return 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400';
              }
              if (senderName.includes('Đoàn trường') || senderName.includes('Đoàn')) {
                return 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400';
              }
              if (role === 'teacher' || senderName.includes('Cô') || senderName.includes('Thầy')) {
                return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
              }
              return 'bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400';
            };
            
            return (
              <div
                key={notification._id}
                onClick={() => openViewDialog(notification)}
                className={`block p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all duration-200 cursor-pointer ${
                  isUnread 
                    ? 'hover:border-primary dark:hover:border-primary' 
                    : 'hover:border-slate-300 dark:hover:border-slate-700 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Blue dot cho thông báo chưa đọc */}
                    {isUnread ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary mt-2 flex-shrink-0" title="Chưa đọc" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-transparent mt-2 flex-shrink-0" title="Đã đọc" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h2 className={`font-bold text-base text-slate-900 dark:text-slate-50 ${!isUnread ? 'font-medium text-slate-800 dark:text-slate-200' : ''}`}>
                        {notification.title}
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate max-w-md">
                        {notification.content.length > 80 
                          ? notification.content.substring(0, 80) + '...' 
                          : notification.content}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{relativeTime}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSenderBadgeColor(senderName, typeof notification.createdBy === 'object' ? notification.createdBy?.role : undefined)}`}>
                      Từ: {senderName}
                      </span>
                    </div>
                  </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Tạo và Gửi Thông Báo Mới</DialogTitle>
            <DialogDescription className="text-base">
              Điền các thông tin dưới đây để tạo thông báo và gửi đến các đối tượng liên quan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Tiêu đề thông báo */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Tiêu đề thông báo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ví dụ: Lịch nghỉ lễ 30/4 - 1/5"
                className="w-full"
              />
            </div>
            
            {/* Nội dung với Rich Text Editor */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm font-medium">
                Nội dung <span className="text-red-500">*</span>
              </Label>
              {/* Rich Text Editor Toolbar */}
              <div className="flex items-center gap-1 p-2 border border-slate-200 dark:border-slate-700 rounded-t-lg bg-slate-50 dark:bg-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const textarea = document.getElementById('content') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const selectedText = formData.content.substring(start, end);
                      const newText = formData.content.substring(0, start) + 
                        `<strong>${selectedText || 'bold'}</strong>` + 
                        formData.content.substring(end);
                      setFormData({ ...formData, content: newText });
                      setIsBold(!isBold);
                    }
                  }}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const textarea = document.getElementById('content') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const selectedText = formData.content.substring(start, end);
                      const newText = formData.content.substring(0, start) + 
                        `<em>${selectedText || 'italic'}</em>` + 
                        formData.content.substring(end);
                      setFormData({ ...formData, content: newText });
                      setIsItalic(!isItalic);
                    }
                  }}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const textarea = document.getElementById('content') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const selectedText = formData.content.substring(start, end);
                      const newText = formData.content.substring(0, start) + 
                        `<u>${selectedText || 'underline'}</u>` + 
                        formData.content.substring(end);
                      setFormData({ ...formData, content: newText });
                      setIsUnderline(!isUnderline);
                    }
                  }}
                >
                  <Underline className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const textarea = document.getElementById('content') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const newText = formData.content.substring(0, start) + 
                        '\n• ' + 
                        formData.content.substring(start);
                      setFormData({ ...formData, content: newText });
                    }
                  }}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const textarea = document.getElementById('content') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const newText = formData.content.substring(0, start) + 
                        '\n1. ' + 
                        formData.content.substring(start);
                      setFormData({ ...formData, content: newText });
                    }
                  }}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Link className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Nhập nội dung chi tiết tại đây..."
                rows={8}
                className="rounded-t-none resize-y"
              />
            </div>
            {/* Tệp đính kèm với Dropzone */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tệp đính kèm</Label>
              <div
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors bg-slate-50 dark:bg-slate-800"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                    setUploadingFiles(true);
                    try {
                      const uploadPromises = files.map(async (file) => {
                        const { url, size } = await uploadFileToCloudinary(file);
                        return {
                          fileName: file.name,
                          fileUrl: url,
                          fileSize: size,
                          fileType: file.type,
                        };
                      });
                      const uploadedFiles = await Promise.all(uploadPromises);
                      setFormData({
                        ...formData,
                        attachments: [...formData.attachments, ...uploadedFiles],
                      });
                      toast({
                        title: "Thành công",
                        description: `Đã tải lên ${uploadedFiles.length} tệp`,
                      });
                    } catch (error: any) {
                      toast({
                        title: "Lỗi",
                        description: error.message || "Không thể tải lên tệp",
                        variant: "destructive",
                      });
                    } finally {
                      setUploadingFiles(false);
                    }
                  }
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = '.png,.jpg,.pdf,.docx';
                  input.onchange = async (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files && files.length > 0) {
                      await handleFileUpload({ target: { files } } as any);
                    }
                  };
                  input.click();
                }}
              >
                <Cloud className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nhấn để chọn tệp hoặc kéo thả vào đây
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PNG, JPG, PDF, DOCX tối đa 10MB
                </p>
              </div>
              {formData.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                      <File className={`h-4 w-4 ${getFileIconColor(attachment.fileName)}`} />
                      <span className="text-sm truncate max-w-[200px]">{attachment.fileName}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAttachment(index);
                        }}
                        className="h-5 w-5"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Người nhận với Chips */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Người nhận <span className="text-red-500">*</span>
              </Label>
              <Popover open={recipientSearchOpen} onOpenChange={setRecipientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    <span className="text-slate-500">
                      {selectedRecipients.length > 0 
                        ? `${selectedRecipients.length} người nhận đã chọn`
                        : "Tìm kiếm và chọn Lớp, Khối, Giáo viên..."}
                    </span>
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Tìm kiếm lớp, khối, giáo viên..." 
                      value={recipientSearchTerm}
                      onValueChange={setRecipientSearchTerm}
                    />
                    <ScrollArea className="max-h-[400px]">
                    <CommandList>
                      <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>
                      {/* Chỉ hiển thị "Tất cả" và "Theo vai trò" nếu có quyền (Admin, BGH) */}
                      {(isAdmin || isBGHUser) && (
                        <CommandGroup heading="Gửi toàn trường">
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'all_students');
                              if (!exists) {
                                // Clear các recipient khác khi chọn "Tất cả học sinh"
                                const newFormData = { 
                                  ...formData, 
                                  recipientType: 'role' as const,
                                  recipientRole: 'student',
                                  classId: '',
                                  recipientId: ''
                                };
                                console.log('🔍 Chọn "Tất cả học sinh":', newFormData);
                                setSelectedRecipients([{ id: 'all_students', label: 'Tất cả học sinh', type: 'role' }]);
                                setFormData(newFormData);
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'all_students') ? "opacity-100" : "opacity-0")} />
                            Tất cả học sinh
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'all_teachers');
                              if (!exists) {
                                // Clear các recipient khác khi chọn "Tất cả giáo viên"
                                const newFormData = { 
                                  ...formData, 
                                  recipientType: 'role' as const,
                                  recipientRole: 'teacher',
                                  classId: '',
                                  recipientId: ''
                                };
                                console.log('🔍 Chọn "Tất cả giáo viên":', newFormData);
                                setSelectedRecipients([{ id: 'all_teachers', label: 'Tất cả giáo viên', type: 'role' }]);
                                setFormData(newFormData);
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'all_teachers') ? "opacity-100" : "opacity-0")} />
                            Tất cả giáo viên
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'all_school');
                              if (!exists) {
                                // Clear các recipient khác khi chọn "Toàn trường" - gửi cho tất cả (không cần recipientRole)
                                const newFormData = { 
                                  ...formData, 
                                  recipientType: 'all' as const,
                                  recipientRole: '',
                                  classId: '',
                                  recipientId: ''
                                };
                                console.log('🔍 Chọn "Toàn trường":', newFormData);
                                setSelectedRecipients([{ id: 'all_school', label: 'Toàn trường', type: 'all' }]);
                                setFormData(newFormData);
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'all_school') ? "opacity-100" : "opacity-0")} />
                            Toàn trường
                          </CommandItem>
                        </CommandGroup>
                      )}
                      {/* Chỉ hiển thị "Theo vai trò" nếu có quyền (Admin, BGH) */}
                      {(isAdmin || isBGHUser) && (
                        <CommandGroup heading="Theo vai trò">
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'role_teacher');
                              if (!exists) {
                                // Clear các recipient khác khi chọn vai trò
                                setSelectedRecipients([{ id: 'role_teacher', label: 'Tất cả giáo viên', type: 'role' }]);
                                setFormData({ 
                                  ...formData, 
                                  recipientType: 'role', 
                                  recipientRole: 'teacher',
                                  classId: '',
                                  recipientId: ''
                                });
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'role_teacher') ? "opacity-100" : "opacity-0")} />
                            Tất cả giáo viên
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'role_student');
                              if (!exists) {
                                setSelectedRecipients([{ id: 'role_student', label: 'Tất cả học sinh', type: 'role' }]);
                                setFormData({ 
                                  ...formData, 
                                  recipientType: 'role', 
                                  recipientRole: 'student',
                                  classId: '',
                                  recipientId: ''
                                });
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'role_student') ? "opacity-100" : "opacity-0")} />
                            Tất cả học sinh (theo vai trò)
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'role_leader');
                              if (!exists) {
                                setSelectedRecipients([{ id: 'role_leader', label: 'Ban Giám Hiệu', type: 'role' }]);
                                setFormData({ 
                                  ...formData, 
                                  recipientType: 'role', 
                                  recipientRole: 'leader',
                                  classId: '',
                                  recipientId: ''
                                });
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'role_leader') ? "opacity-100" : "opacity-0")} />
                            Ban Giám Hiệu
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'role_department_head');
                              if (!exists) {
                                setSelectedRecipients([{ id: 'role_department_head', label: 'Quản lý bộ môn', type: 'role' }]);
                                setFormData({ 
                                  ...formData, 
                                  recipientType: 'role', 
                                  recipientRole: 'department_head',
                                  classId: '',
                                  recipientId: ''
                                });
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'role_department_head') ? "opacity-100" : "opacity-0")} />
                            Quản lý bộ môn
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'role_homeroom_teacher');
                              if (!exists) {
                                setSelectedRecipients([{ id: 'role_homeroom_teacher', label: 'Giáo viên chủ nhiệm', type: 'role' }]);
                                setFormData({ 
                                  ...formData, 
                                  recipientType: 'role', 
                                  recipientRole: 'homeroom_teacher',
                                  classId: '',
                                  recipientId: ''
                                });
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'role_homeroom_teacher') ? "opacity-100" : "opacity-0")} />
                            Giáo viên chủ nhiệm
                          </CommandItem>
                        </CommandGroup>
                      )}
                      
                      {/* ✅ QLBM: Gửi cho tất cả giáo viên trong tổ */}
                      {isQLBMUser && (
                        <CommandGroup heading="Gửi cho tổ bộ môn">
                          <CommandItem
                            onSelect={() => {
                              const exists = selectedRecipients.find(r => r.id === 'role_teachers_in_department');
                              if (!exists) {
                                setSelectedRecipients([{ id: 'role_teachers_in_department', label: 'Tất cả giáo viên trong tổ', type: 'role' }]);
                                setFormData({ 
                                  ...formData, 
                                  recipientType: 'role', 
                                  recipientRole: 'teacher',
                                  classId: '',
                                  recipientId: ''
                                });
                              }
                              setRecipientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === 'role_teachers_in_department') ? "opacity-100" : "opacity-0")} />
                            Tất cả giáo viên trong tổ
                          </CommandItem>
                        </CommandGroup>
                      )}
                      
                      {/* Lớp học - Chỉ hiển thị lớp mà giáo viên có quyền */}
                      <CommandGroup heading="Lớp học">
                        {(() => {
                          const filteredClasses = classes
                            .map(c => {
                              // Thêm thông tin về loại lớp (đang dạy hoặc chủ nhiệm)
                              let classType: 'teaching' | 'homeroom' | 'both' | null = null;
                              
                              if (isGVCNUser) {
                                // Lấy danh sách lớp chủ nhiệm từ backendUser
                                const homeroomClassIds = (backendUser as any)?.homeroomClassIds || [];
                                const homeroomClassIdStrings = homeroomClassIds.map((hc: any) => {
                                  return typeof hc === 'string' ? String(hc) : String(hc._id || hc);
                                });
                                
                                // Kiểm tra lớp chủ nhiệm
                                const isHomeroomClass = homeroomClassIdStrings.includes(String(c._id));
                                
                                // Kiểm tra lớp đang dạy
                                const isTeachingClass = teachingClassIds.includes(String(c._id));
                                
                                if (isHomeroomClass && isTeachingClass) {
                                  classType = 'both';
                                } else if (isHomeroomClass) {
                                  classType = 'homeroom';
                                } else if (isTeachingClass) {
                                  classType = 'teaching';
                                }
                                
                                return { ...c, classType };
                              }
                              
                              return { ...c, classType };
                            })
                          .filter(c => {
                            // Filter theo search term
                            if (recipientSearchTerm && !c.className.toLowerCase().includes(recipientSearchTerm.toLowerCase())) {
                              return false;
                            }
                            
                            // ✅ Admin và BGH: Xem tất cả lớp
                            if (isAdmin || isBGHUser) {
                              return true;
                            }
                            
                              // ✅ GVCN: Xem lớp đang dạy + lớp chủ nhiệm
                            if (isGVCNUser) {
                                return c.classType !== null;
                            }
                            
                            // ✅ GVBM: Chỉ xem lớp đang dạy
                            if (isGVBMUser) {
                                // Hiển thị lớp đang dạy
                                return teachingClassIds.includes(String(c._id));
                              }
                              
                              // ✅ QLBM: Xem lớp đang dạy (như GVBM)
                              if (isQLBMUser) {
                                // Hiển thị lớp đang dạy
                                return teachingClassIds.includes(String(c._id));
                            }
                            
                      return false;
                            });
                          
                          // ✅ Debug log
                          if ((isGVCNUser || isGVBMUser || isQLBMUser) && filteredClasses.length === 0 && classes.length > 0) {
                            console.log('⚠️ Không tìm thấy lớp phù hợp:', {
                              role: isGVCNUser ? 'GVCN' : isGVBMUser ? 'GVBM' : 'QLBM',
                              totalClasses: classes.length,
                              teachingClassIds,
                              homeroomClassIds: isGVCNUser ? (backendUser as any)?.homeroomClassIds : null,
                              searchTerm: recipientSearchTerm
                            });
                          }
                          
                          return filteredClasses;
                        })()
                          .map((cls) => (
                            <CommandItem
                              key={cls._id}
                              onSelect={() => {
                                const exists = selectedRecipients.find(r => r.id === cls._id);
                                if (!exists) {
                                  setSelectedRecipients(prev => [...prev, { id: cls._id!, label: cls.className, type: 'class' }]);
                                  setFormData({ 
                                    ...formData, 
                                    recipientType: 'class', 
                                    classId: cls._id!,
                                    recipientRole: '',
                                    recipientId: ''
                                  });
                                }
                                setRecipientSearchOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === cls._id) ? "opacity-100" : "opacity-0")} />
                              <div className="flex items-center gap-2 flex-1">
                                <span>{cls.className}</span>
                                {/* ✅ Hiển thị badge phân biệt loại lớp cho GVCN */}
                                {isGVCNUser && cls.classType && (
                                  <div className="flex gap-1">
                                    {cls.classType === 'both' && (
                                      <>
                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                                          Lớp CN
                                        </Badge>
                                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                          Đang dạy
                                        </Badge>
                                      </>
                                    )}
                                    {cls.classType === 'homeroom' && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                                        Lớp CN
                                      </Badge>
                                    )}
                                    {cls.classType === 'teaching' && (
                                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                        Đang dạy
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                      
                      {/* ✅ QLBM: Hiển thị giáo viên trong tổ bộ môn */}
                      {isQLBMUser && departmentTeachers.length > 0 && (
                        <CommandGroup heading="Giáo viên trong tổ">
                          {departmentTeachers
                            .filter((teacher: any) => {
                              // Filter theo search term
                              if (recipientSearchTerm && !teacher.name?.toLowerCase().includes(recipientSearchTerm.toLowerCase())) {
                                return false;
                              }
                              return true;
                            })
                            .map((teacher: any) => {
                              const teacherAccountId = teacher.accountId?._id || teacher.accountId;
                              if (!teacherAccountId) return null;
                              
                              return (
                                <CommandItem
                                  key={teacher._id}
                                  onSelect={() => {
                                    const exists = selectedRecipients.find(r => r.id === teacherAccountId);
                                    if (!exists) {
                                      setSelectedRecipients(prev => [...prev, { 
                                        id: teacherAccountId, 
                                        label: teacher.name || 'Giáo viên', 
                                        type: 'user' 
                                      }]);
                                      setFormData({ 
                                        ...formData, 
                                        recipientType: 'user', 
                                        recipientId: teacherAccountId,
                                        classId: '',
                                        recipientRole: ''
                                      });
                                    }
                                    setRecipientSearchOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", selectedRecipients.find(r => r.id === teacherAccountId) ? "opacity-100" : "opacity-0")} />
                                  {teacher.name || 'Giáo viên'}
                                  {teacher.isDepartmentHead && (
                                    <Badge variant="outline" className="ml-2 text-xs">QLBM</Badge>
                                  )}
                                  {teacher.isHomeroom && (
                                    <Badge variant="outline" className="ml-2 text-xs">GVCN</Badge>
                                  )}
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      )}
                    </CommandList>
                    </ScrollArea>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedRecipients.map((recipient) => (
                    <Badge
                      key={recipient.id}
                      variant="secondary"
                      className="px-3 py-1 flex items-center gap-2"
                    >
                      {recipient.label}
                        <Button
                          variant="ghost"
                          size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => {
                          const newRecipients = selectedRecipients.filter(r => r.id !== recipient.id);
                          setSelectedRecipients(newRecipients);
                          if (newRecipients.length === 0) {
                            setFormData({ 
                              ...formData, 
                              recipientType: getDefaultRecipientType(), 
                              classId: "", 
                              recipientRole: "",
                              recipientId: ""
                            });
                          } else {
                            // Cập nhật formData dựa trên recipient còn lại
                            const remainingRecipient = newRecipients[0];
                            if (remainingRecipient.type === 'all') {
                              // "Toàn trường" - recipientType = 'all', không cần recipientRole
                              setFormData({ 
                                ...formData, 
                                recipientType: 'all',
                                recipientRole: '',
                                classId: "",
                                recipientId: ""
                              });
                            } else if (remainingRecipient.type === 'role') {
                              // Xác định recipientRole dựa trên id
                              const roleMap: Record<string, string> = {
                                'all_students': 'student',
                                'all_teachers': 'teacher',
                                'role_teacher': 'teacher',
                                'role_teachers_in_department': 'teacher', // QLBM: Gửi cho tất cả giáo viên trong tổ
                                'role_student': 'student',
                                'role_leader': 'leader',
                                'role_department_head': 'department_head',
                                'role_homeroom_teacher': 'homeroom_teacher',
                              };
                              setFormData({ 
                                ...formData, 
                                recipientType: 'role',
                                recipientRole: roleMap[remainingRecipient.id] || '',
                                classId: "",
                                recipientId: ""
                              });
                            } else if (remainingRecipient.type === 'class') {
                              setFormData({ 
                                ...formData, 
                                recipientType: 'class',
                                classId: remainingRecipient.id,
                                recipientRole: "",
                                recipientId: ""
                              });
                            } else if (remainingRecipient.type === 'user') {
                              setFormData({ 
                                ...formData, 
                                recipientType: 'user',
                                recipientId: remainingRecipient.id,
                                recipientRole: "",
                                classId: ""
                              });
                            }
                          }
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                    ))}
                  </div>
                )}
              </div>
            
            {/* Loại thông báo và Độ ưu tiên */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Loại thông báo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as keyof typeof NOTIFICATION_TYPES })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại thông báo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTIFICATION_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Độ ưu tiên</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value as keyof typeof PRIORITY_LABELS })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn độ ưu tiên" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Chọn ngày (lịch tiếng Việt) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ngày bắt đầu (tùy chọn)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      {formData.startDate ?
                        format(new Date(formData.startDate), "dd/MM/yyyy", { locale: vi }) :
                        "Chọn ngày bắt đầu"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <Calendar
                      mode="single"
                      selected={formData.startDate ? new Date(formData.startDate) : undefined}
                      onSelect={date => {
                        setFormData({ ...formData, startDate: date ? date.toISOString().split('T')[0] : "" });
                      }}
                      locale={vi}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Ngày kết thúc (tùy chọn)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      {formData.endDate ?
                        format(new Date(formData.endDate), "dd/MM/yyyy", { locale: vi }) :
                        "Chọn ngày kết thúc"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <Calendar
                      mode="single"
                      selected={formData.endDate ? new Date(formData.endDate) : undefined}
                      onSelect={date => {
                        setFormData({ ...formData, endDate: date ? date.toISOString().split('T')[0] : "" });
                      }}
                      locale={vi}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              Hủy
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={
                !formData.title.trim() || 
                !formData.content.trim() || 
                uploadingFiles || 
                (selectedRecipients.length === 0 && formData.recipientType !== 'all' && formData.recipientType !== 'role' && formData.recipientType !== 'class' && formData.recipientType !== 'user')
              }
            >
              {uploadingFiles ? "Đang tải lên..." : "Gửi thông báo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông báo</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin thông báo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tiêu đề *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nhập tiêu đề thông báo"
              />
                    </div>
            <div>
              <Label>Nội dung *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Nhập nội dung thông báo"
                rows={6}
              />
                </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Loại thông báo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as keyof typeof NOTIFICATION_TYPES })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTIFICATION_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Độ ưu tiên</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value as keyof typeof PRIORITY_LABELS })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Chọn ngày (lịch tiếng Việt) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ngày bắt đầu (tùy chọn)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      {formData.startDate ?
                        format(new Date(formData.startDate), "dd/MM/yyyy", { locale: vi }) :
                        "Chọn ngày bắt đầu"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <Calendar
                      mode="single"
                      selected={formData.startDate ? new Date(formData.startDate) : undefined}
                      onSelect={date => {
                        setFormData({ ...formData, startDate: date ? date.toISOString().split('T')[0] : "" });
                      }}
                      locale={vi}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Ngày kết thúc (tùy chọn)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      {formData.endDate ?
                        format(new Date(formData.endDate), "dd/MM/yyyy", { locale: vi }) :
                        "Chọn ngày kết thúc"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <Calendar
                      mode="single"
                      selected={formData.endDate ? new Date(formData.endDate) : undefined}
                      onSelect={date => {
                        setFormData({ ...formData, endDate: date ? date.toISOString().split('T')[0] : "" });
                      }}
                      locale={vi}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label>Gửi đến</Label>
              <Select
                value={formData.recipientType}
                onValueChange={(value) => {
                  const newRecipientType = value as keyof typeof RECIPIENT_TYPES;
                  // ✅ Đảm bảo GVCN/GVBM (KHÔNG phải BGH) không thể chọn all hoặc role
                  if (!isBGHUser && !isAdmin && (isGVCNUser || isGVBMUser) && (newRecipientType === 'all' || newRecipientType === 'role')) {
                    // Tự động chuyển về class nếu cố chọn all/role
                    setFormData({ ...formData, recipientType: 'class', recipientRole: "", recipientId: "", classId: "" });
                  } else {
                    setFormData({ ...formData, recipientType: newRecipientType, recipientRole: "", recipientId: "", classId: "" });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECIPIENT_TYPES)
                    .filter(([key]) => {
                      // Admin và BGH: Có thể chọn tất cả
                      if (canSendToAll) return true;
                      // GVCN và GVBM: Chỉ được chọn class và user
                      if (isGVCNUser || isGVBMUser) {
                        return key === 'class' || key === 'user';
                      }
                      return false;
                    })
                    .map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {formData.recipientType === 'role' && (
              <div>
                <Label>Vai trò</Label>
                <Select
                  value={formData.recipientRole}
                  onValueChange={(value) => setFormData({ ...formData, recipientRole: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Học sinh</SelectItem>
                    <SelectItem value="teacher">Giáo viên</SelectItem>
                    <SelectItem value="parent">Phụ huynh</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="leader">Ban Giám Hiệu</SelectItem>
                    <SelectItem value="department_head">Quản lý bộ môn</SelectItem>
                    <SelectItem value="homeroom_teacher">Giáo viên chủ nhiệm</SelectItem>
                  </SelectContent>
                </Select>
        </div>
      )}
            {formData.recipientType === 'user' && (
              <div>
                <Label>ID người nhận</Label>
                <Input
                  value={formData.recipientId}
                  onChange={(e) => setFormData({ ...formData, recipientId: e.target.value })}
                  placeholder="Nhập ID tài khoản"
                />
    </div>
            )}
            {formData.recipientType === 'class' && (
              <div>
                <Label>ID lớp học</Label>
                <Input
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  placeholder="Nhập ID lớp học"
                />
              </div>
            )}
            
            {/* ✅ Tệp đính kèm */}
            <div>
              <Label>Tệp đính kèm</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                    className="flex-1"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                  {uploadingFiles && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  )}
                </div>
                {formData.attachments.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {formData.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <File className={`h-4 w-4 ${getFileIconColor(attachment.fileName)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                          {attachment.fileSize && (
                            <p className="text-xs text-slate-500">{formatFileSize(attachment.fileSize)}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAttachment(index)}
                          className="h-8 w-8"
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setSelectedNotification(null);
              resetForm();
            }}>
              Hủy
            </Button>
            <Button onClick={handleEdit} disabled={!formData.title || !formData.content || uploadingFiles}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ View Dialog đã được chuyển sang NotificationDetailPage */}

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa thông báo "{selectedNotification?.title}"? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
