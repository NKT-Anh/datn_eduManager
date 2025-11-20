import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isBGH } from "@/utils/permissions";
import axios from "axios";
import { 
  ChevronLeft,
  ChevronRight,
  ArrowLeft as ArrowBack,
  Download,
  File,
  User,
  Clock,
  Check,
  ArrowRight,
  Edit,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { uploadFileToCloudinary, formatFileSize, getFileIconColor } from "@/services/cloudinary/cloudinaryFileUpload";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

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
  type?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  recipientType?: string;
  recipientRole?: string;
  recipientId?: string;
  classId?: string;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean;
  createdBy?: CreatedBy | string;
  attachments?: Attachment[];
}

interface Reply {
  _id: string;
  content: string;
  createdAt: string;
  accountId: {
    role?: string;
    linkedId?: {
      name?: string;
      avatarUrl?: string;
      gender?: string;
    };
  };
}

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { backendUser } = useAuth();
  const idToken = backendUser?.idToken;
  const { toast } = useToast();
  
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  
  const isStudent = backendUser?.role === 'student';
  const isBGHUser = isBGH(backendUser);
  const isAdmin = backendUser?.role === 'admin';
  
  // ✅ Chỉ Admin và BGH mới xem được thông tin ngày chi tiết
  const canViewDateDetails = isAdmin || isBGHUser;
  
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
  
  // Fetch notification detail
  useEffect(() => {
    if (!id) return;
    
    const fetchNotification = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/notifications/${id}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        setNotification(response.data.data);
        
        // Auto mark as read for students
        if (isStudent && !response.data.data.isRead) {
          await axios.post(
            `${API_BASE_URL}/notifications/${id}/read`,
            {},
            { headers: { Authorization: `Bearer ${idToken}` } }
          );
          setNotification(prev => prev ? { ...prev, isRead: true } : null);
        }
      } catch (error: any) {
        console.error("Lỗi tải thông báo:", error);
        toast({
          title: "Lỗi",
          description: error.response?.data?.error || "Không thể tải thông báo",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotification();
    fetchReplies();
    fetchAllNotifications();
  }, [id, idToken]);
  
  // Fetch all notifications for prev/next navigation
  const fetchAllNotifications = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setAllNotifications(response.data.data || []);
    } catch (error) {
      console.error("Lỗi tải danh sách thông báo:", error);
    }
  };
  
  // Fetch replies
  const fetchReplies = async () => {
    if (!id) return;
    try {
      setLoadingReplies(true);
      const response = await axios.get(`${API_BASE_URL}/notifications/replies/${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setReplies(response.data.data || []);
    } catch (error) {
      console.error("Lỗi tải phản hồi:", error);
    } finally {
      setLoadingReplies(false);
    }
  };
  
  // Get sender name - Ưu tiên tên người tạo, không dùng "Hệ thống"
  const getSenderName = (notif: Notification): string => {
    if (typeof notif.createdBy === 'string') {
      // Nếu createdBy là string (ID), không có thông tin -> dùng email hoặc "Hệ thống"
      return 'Hệ thống';
    }
    
    const createdBy = notif.createdBy;
    if (!createdBy) return 'Hệ thống';
    
    // ✅ Ưu tiên lấy tên từ linkedId
    const name = createdBy.linkedId?.name;
    const gender = createdBy.linkedId?.gender;
    
    if (createdBy.role === 'admin') {
      // Admin: dùng tên nếu có, không thì dùng email, cuối cùng mới dùng "Ban Giám hiệu"
      if (name) return name;
      if (createdBy.email) return createdBy.email;
      return 'Ban Giám hiệu';
    }
    
    if (createdBy.role === 'teacher') {
      if (name) {
        // Phân biệt giới tính để thêm Cô/Thầy
        if (gender === 'female' || gender === 'nữ') {
          return `Cô ${name}`;
        } else if (gender === 'male' || gender === 'nam') {
          return `Thầy ${name}`;
        } else {
          // Fallback: đoán từ tên nếu không có gender
          const isFemale = name.toLowerCase().includes('anh') || 
                          name.toLowerCase().includes('lan') ||
                          name.toLowerCase().includes('mai') ||
                          name.toLowerCase().includes('linh') ||
                          name.toLowerCase().includes('hương') ||
                          name.toLowerCase().includes('thu') ||
                          name.toLowerCase().includes('hoa');
          return isFemale ? `Cô ${name}` : `Thầy ${name}`;
        }
      }
      // Nếu không có tên, dùng email
      if (createdBy.email) return createdBy.email;
      return 'Giáo viên';
    }
    
    // ✅ Các role khác: ưu tiên tên, sau đó email
    if (name) {
      return name;
    }
    if (createdBy.email) {
      return createdBy.email;
    }
    
    // Chỉ khi không có cả tên và email mới dùng "Hệ thống"
    return 'Hệ thống';
  };
  
  // Get sender avatar
  const getSenderAvatar = (notif: Notification): string | null => {
    if (typeof notif.createdBy === 'string') return null;
    return notif.createdBy?.linkedId?.avatarUrl || null;
  };
  
  // Format full date time
  const formatFullDateTime = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString('vi-VN', { month: 'long' });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${month.charAt(0).toUpperCase() + month.slice(1)}, ${year} - ${time}`;
  };
  
  // ✅ Format ngày đăng theo format: "Thứ Hai, 28/10/2024, 09:30"
  const formatPublicationDate = (date: Date) => {
    const dayOfWeek = format(date, 'EEEE', { locale: vi });
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${day}/${month}/${year}, ${time}`;
  };
  
  // ✅ Lấy label cho recipient
  const getRecipientLabels = (notif: Notification): string[] => {
    const labels: string[] = [];
    
    if (notif.recipientType === 'all') {
      labels.push('Toàn trường');
    } else if (notif.recipientType === 'role') {
      const roleMap: Record<string, string> = {
        'student': 'Học sinh',
        'teacher': 'Giáo viên',
        'leader': 'Ban Giám Hiệu',
        'department_head': 'Quản lý bộ môn',
        'homeroom_teacher': 'Giáo viên Chủ nhiệm',
      };
      if (notif.recipientRole) {
        labels.push(roleMap[notif.recipientRole] || notif.recipientRole);
      }
    } else if (notif.recipientType === 'class') {
      // TODO: Có thể lấy tên lớp từ classId nếu cần
      labels.push('Theo lớp');
    } else if (notif.recipientType === 'user') {
      labels.push('Người cụ thể');
    }
    
    return labels;
  };
  
  // ✅ Lấy position/role của người gửi
  const getSenderPosition = (notif: Notification): string => {
    if (typeof notif.createdBy === 'string') return '';
    const createdBy = notif.createdBy;
    if (!createdBy) return '';
    
    if (createdBy.role === 'admin') {
      return 'Hiệu trưởng';
    }
    
    if (createdBy.role === 'teacher') {
      // Có thể kiểm tra teacherFlags nếu có
      return 'Giáo viên';
    }
    
    return '';
  };
  
  // Check if can reply
  const canReply = (notif: Notification): boolean => {
    if (!notif.endDate) return true;
    return new Date(notif.endDate) >= new Date();
  };
  
  // Submit reply
  const handleSubmitReply = async () => {
    if (!notification || !replyContent.trim()) return;
    
    if (!canReply(notification)) {
      toast({
        title: "Lỗi",
        description: "Thông báo đã hết hạn, không thể phản hồi",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSubmittingReply(true);
      await axios.post(
        `${API_BASE_URL}/notifications/replies/${notification._id}`,
        { content: replyContent },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      
      setReplyContent("");
      fetchReplies();
      toast({
        title: "Thành công",
        description: "Đã gửi phản hồi",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể gửi phản hồi",
        variant: "destructive",
      });
    } finally {
      setSubmittingReply(false);
    }
  };
  
  // Mark as read
  const handleMarkAsRead = async () => {
    if (!notification) return;
    
    try {
      await axios.post(
        `${API_BASE_URL}/notifications/${notification._id}/read`,
        {},
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      setNotification(prev => prev ? { ...prev, isRead: true } : null);
      toast({
        title: "Thành công",
        description: "Đã đánh dấu đã đọc",
      });
    } catch (error) {
      console.error("Lỗi đánh dấu đã đọc:", error);
    }
  };
  
  // Get prev/next notifications
  const currentIndex = allNotifications.findIndex(n => n._id === notification?._id);
  const prevNotification = currentIndex > 0 ? allNotifications[currentIndex - 1] : null;
  const nextNotification = currentIndex < allNotifications.length - 1 ? allNotifications[currentIndex + 1] : null;
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!notification) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Không tìm thấy thông báo</h1>
        <Button onClick={() => navigate(`${prefix}/notifications`)}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }
  
  const senderName = getSenderName(notification);
  const senderAvatar = getSenderAvatar(notification);
  const senderPosition = getSenderPosition(notification);
  const createdAt = new Date(notification.createdAt);
  const publicationDate = notification.startDate ? new Date(notification.startDate) : createdAt;
  const formattedPublicationDate = formatPublicationDate(publicationDate);
  const recipientLabels = getRecipientLabels(notification);
  
  // ✅ Quyền chỉnh sửa/xóa
  const canEdit = isAdmin;
  const canDelete = isAdmin;
  
  // ✅ Hàm xử lý edit/delete
  const handleEdit = () => {
    // Navigate về trang notifications và mở dialog edit
    navigate(`${prefix}/notifications`, { 
      state: { editNotificationId: notification._id } 
    });
  };
  
  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/notifications/${notification._id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      toast({
        title: "Thành công",
        description: "Đã xóa thông báo",
      });
      navigate(`${prefix}/notifications`);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể xóa thông báo",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="flex-1 p-6 lg:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumbs and Back Button */}
          <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <a 
                className="hover:text-primary transition-colors cursor-pointer" 
                onClick={() => navigate(`${prefix}/home`)}
              >
                Trang chủ
              </a>
              <span>/</span>
              <a 
                className="hover:text-primary transition-colors cursor-pointer" 
                onClick={() => navigate(`${prefix}/notifications`)}
              >
                Thông báo
              </a>
              <span>/</span>
              <span className="text-slate-900 dark:text-slate-50 font-medium truncate max-w-xs">
                {notification.title.length > 30 
                  ? notification.title.substring(0, 30) + '...' 
                  : notification.title}
              </span>
            </div>
            <Button 
              onClick={() => navigate(`${prefix}/notifications`)}
              className="flex items-center gap-2 min-w-[84px] cursor-pointer justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors"
            >
              <ArrowBack className="h-4 w-4" />
              <span className="truncate">Quay lại danh sách</span>
            </Button>
          </div>
          
          {/* Main Content - Single Column Layout */}
          <div className="bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-xl border border-slate-200 dark:border-slate-800">
            {/* Header với Title và Action Buttons */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
              <h1 className="text-3xl lg:text-4xl font-black leading-tight tracking-[-0.03em] text-slate-900 dark:text-slate-50 flex-1">
                {notification.title}
              </h1>
              {(canEdit || canDelete) && (
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button
                      variant="outline"
                      onClick={handleEdit}
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Chỉnh sửa
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Xóa
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {/* Thông tin người gửi và ngày đăng */}
            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
              {/* Avatar */}
              {senderAvatar ? (
                <img
                  src={senderAvatar}
                  alt={senderName}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <User className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                </div>
              )}
              
              {/* Thông tin */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    {senderName}
                  </p>
                  {senderPosition && (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      ({senderPosition})
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  {formattedPublicationDate}
                </p>
                
                {/* Gửi đến */}
                {recipientLabels.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Gửi đến:
                    </span>
                    {recipientLabels.map((label, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs px-2 py-1"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Tệp đính kèm - Hiển thị trước nội dung */}
            {notification.attachments && notification.attachments.length > 0 && (
              <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-50">
                  Tệp đính kèm ({notification.attachments.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {notification.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <File className={`h-5 w-5 ${getFileIconColor(attachment.fileName)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
                          {attachment.fileName}
                        </p>
                        {attachment.fileSize && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatFileSize(attachment.fileSize)}
                          </p>
                        )}
                      </div>
                      <a
                        href={attachment.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full hover:bg-primary/20 text-primary transition-colors"
                        title="Tải xuống"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
              
            {/* Nội dung thông báo */}
            <div className="prose prose-base max-w-none text-slate-900 dark:text-slate-50 dark:prose-invert mb-8">
              <div className="text-base leading-relaxed whitespace-pre-wrap">
                {notification.content}
              </div>
            </div>
              
              {/* Phần phản hồi */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-8 mt-8">
                <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-50">Phản hồi</h3>
                
                {/* Danh sách phản hồi */}
                {loadingReplies ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : replies.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {replies.map((reply) => {
                      const isStudentReply = reply.accountId?.role === 'student';
                      const isTeacherReply = reply.accountId?.role === 'teacher';
                      
                      let replySenderName = 'Người dùng';
                      if (reply.accountId?.linkedId?.name) {
                        if (isTeacherReply) {
                          const gender = reply.accountId.linkedId.gender;
                          replySenderName = (gender === 'female' || gender === 'nữ')
                            ? `Cô ${reply.accountId.linkedId.name}`
                            : `Thầy ${reply.accountId.linkedId.name}`;
                        } else if (isStudentReply) {
                          replySenderName = reply.accountId.linkedId.name;
                        } else {
                          replySenderName = reply.accountId.linkedId.name;
                        }
                      }
                      
                      const replySenderAvatar = reply.accountId?.linkedId?.avatarUrl || null;
                      
                      return (
                        <div 
                          key={reply._id} 
                          className={`flex gap-3 p-3 rounded-lg ${
                            isStudentReply 
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800' 
                              : isTeacherReply
                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800'
                              : 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
                          }`}
                        >
                          {replySenderAvatar ? (
                            <img
                              src={replySenderAvatar}
                              alt={replySenderName}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isStudentReply 
                                ? 'bg-blue-200 dark:bg-blue-800' 
                                : isTeacherReply
                                ? 'bg-green-200 dark:bg-green-800'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}>
                              <User className={`h-4 w-4 ${
                                isStudentReply 
                                  ? 'text-blue-600 dark:text-blue-400' 
                                  : isTeacherReply
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-sm font-medium ${
                                isStudentReply 
                                  ? 'text-blue-700 dark:text-blue-300' 
                                  : isTeacherReply
                                  ? 'text-green-700 dark:text-green-300'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {replySenderName}
                              </p>
                              {isStudentReply && (
                                <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                                  Học sinh
                                </Badge>
                              )}
                              {isTeacherReply && (
                                <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                                  Giáo viên
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                                {formatDistanceToNow(new Date(reply.createdAt), {
                                  addSuffix: true,
                                  locale: vi,
                                })}
                              </span>
                            </div>
                            <p className={`text-sm whitespace-pre-wrap ${
                              isStudentReply 
                                ? 'text-blue-800 dark:text-blue-200' 
                                : isTeacherReply
                                ? 'text-green-800 dark:text-green-200'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {reply.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Form phản hồi */}
                {canReply(notification) ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Textarea
                        placeholder="Viết phản hồi..."
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            if (replyContent.trim() && !submittingReply) {
                              handleSubmitReply();
                            }
                          }
                        }}
                        rows={3}
                        className="resize-none pr-10"
                      />
                      <Button
                        onClick={handleSubmitReply}
                        disabled={!replyContent.trim() || submittingReply}
                        size="icon"
                        className="absolute bottom-2 right-2 h-7 w-7 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        title="Gửi phản hồi"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Thông báo đã hết hạn, không thể phản hồi
                    </p>
                  </div>
                )}
              </div>
              
              {/* Button Group - Previous/Next */}
              <div className="flex flex-1 gap-3 flex-wrap pt-8 mt-8 border-t border-slate-200 dark:border-slate-800 justify-between">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (prevNotification) {
                      navigate(`${prefix}/notifications/${prevNotification._id}`);
                    }
                  }}
                  disabled={!prevNotification}
                  className="flex items-center gap-2 min-w-[84px] max-w-[480px] cursor-pointer justify-center overflow-hidden rounded-lg h-10 px-4 bg-transparent text-slate-900 dark:text-slate-50 hover:bg-primary/10 text-sm font-bold leading-normal tracking-[0.015em] transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="truncate">Thông báo trước</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (nextNotification) {
                      navigate(`${prefix}/notifications/${nextNotification._id}`);
                    }
                  }}
                  disabled={!nextNotification}
                  className="flex items-center gap-2 min-w-[84px] max-w-[480px] cursor-pointer justify-center overflow-hidden rounded-lg h-10 px-4 bg-transparent text-slate-900 dark:text-slate-50 hover:bg-primary/10 text-sm font-bold leading-normal tracking-[0.015em] transition-colors"
                >
                  <span className="truncate">Thông báo sau</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            {/* Thông tin chi tiết (chỉ Admin và BGH) */}
            {canViewDateDetails && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Thông tin chi tiết</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Ngày tạo:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-50">
                      {formatFullDateTime(new Date(notification.createdAt))}
                    </span>
                  </div>
                  {notification.startDate && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Ngày bắt đầu:</span>
                      <span className="ml-2 text-slate-900 dark:text-slate-50">
                        {formatFullDateTime(new Date(notification.startDate))}
                      </span>
                    </div>
                  )}
                  {notification.endDate && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Ngày kết thúc:</span>
                      <span className="ml-2 text-slate-900 dark:text-slate-50">
                        {formatFullDateTime(new Date(notification.endDate))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Mark as Read Button (for students) */}
            {!notification.isRead && isStudent && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Button 
                  variant="outline"
                  onClick={handleMarkAsRead}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Đánh dấu đã đọc
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

