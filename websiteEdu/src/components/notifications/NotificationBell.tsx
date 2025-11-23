import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { getUserRoutePrefix } from "@/utils/permissions";
import {
  Calendar,
  CheckCircle,
  BookOpen,
  Users,
  Megaphone,
  Info,
  GraduationCap,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

const NOTIFICATION_TYPES = {
  exam: { label: "Lịch kiểm tra / lịch thi", icon: Calendar, color: "text-blue-600" },
  holiday: { label: "Nghỉ học", icon: Calendar, color: "text-orange-600" },
  grade: { label: "Điểm số", icon: CheckCircle, color: "text-green-600" },
  rule: { label: "Quy định", icon: BookOpen, color: "text-purple-600" },
  homeroom: { label: "GVCN gửi cho lớp", icon: Users, color: "text-pink-600" },
  event: { label: "Sự kiện, ngoại khóa", icon: Megaphone, color: "text-yellow-600" },
  system: { label: "Thông báo hệ thống", icon: Info, color: "text-indigo-600" },
  general: { label: "Chung chung", icon: Bell, color: "text-gray-600" },
};

interface Notification {
  _id: string;
  title: string;
  content: string;
  type: keyof typeof NOTIFICATION_TYPES;
  priority: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  isRead: boolean;
}

export const NotificationBell = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const token = backendUser?.idToken;
      const res = await axios.get(`${API_BASE_URL}/notifications/unread/count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(res.data.unreadCount || 0);
    } catch (error) {
      console.error("Lỗi fetch unread count:", error);
    }
  };

  const fetchNotifications = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    try {
      const token = backendUser?.idToken;
      const res = await axios.get(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Lấy 10 thông báo mới nhất
      const allNotifications = res.data.data || [];
      setNotifications(allNotifications.slice(0, 10));
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông báo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = backendUser?.idToken;
      await axios.post(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      // Cập nhật local state
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Lỗi mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = backendUser?.idToken;
      await axios.post(
        `${API_BASE_URL}/notifications/read-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      
      toast({
        title: "Thành công",
        description: "Đã đánh dấu tất cả đã đọc",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể đánh dấu đã đọc",
        variant: "destructive",
      });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    
    // Điều hướng đến trang thông báo
    const prefix = getUserRoutePrefix(backendUser);
    navigate(`${prefix}/notifications`);
    setIsOpen(false);
  };

  useEffect(() => {
    if (backendUser) {
      fetchUnreadCount();
      // Refresh mỗi 30 giây
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [backendUser]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  if (!backendUser) return null;

  const getTypeConfig = (type: string) => {
    return NOTIFICATION_TYPES[type as keyof typeof NOTIFICATION_TYPES] || NOTIFICATION_TYPES.general;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs font-bold rounded-full"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Thông báo</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Đang tải...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Không có thông báo nào
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const typeConfig = getTypeConfig(notification.type);
                const TypeIcon = typeConfig.icon;
                const isUnread = !notification.isRead;
                
                return (
                  <div
                    key={notification._id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      isUnread ? "bg-blue-50/50" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`mt-0.5 ${typeConfig.color}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <p
                            className={`text-sm font-medium ${
                              isUnread ? "font-semibold" : ""
                            }`}
                          >
                            {notification.title}
                          </p>
                          {isUnread && (
                            <div className="h-2 w-2 bg-blue-500 rounded-full mt-1.5 ml-2 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: vi,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const prefix = getUserRoutePrefix(backendUser);
              navigate(`${prefix}/notifications`);
              setIsOpen(false);
            }}
          >
            Xem tất cả thông báo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

