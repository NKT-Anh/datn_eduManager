import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import {
  ArrowLeft as ArrowBack,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  File as FileIcon,
  User,
  Check,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  formatFileSize,
  getFileIconColor,
} from "@/services/cloudinary/cloudinaryFileUpload";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

type Attachment = { fileName: string; fileUrl: string; fileSize?: number; fileType?: string };

type CreatedBy = {
  _id: string;
  email?: string;
  role?: string;
  displayName?: string;
  linkedId?: { name?: string; avatarUrl?: string; gender?: string };
};

type Notification = {
  _id: string;
  title: string;
  content?: string;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  isRead?: boolean;
  recipientType?: string;
  recipientRole?: string;
  attachments?: Attachment[];
  createdBy?: CreatedBy | string;
  sender?: string;
  senderDisplayName?: string;
};

type Reply = {
  _id: string;
  content: string;
  createdAt: string;
  accountId: { role?: string; linkedId?: { name?: string; avatarUrl?: string; gender?: string } };
};

const StudentNotificationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { backendUser } = useAuth();
  const { toast } = useToast();

  const idToken = backendUser?.idToken;

  const [item, setItem] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 414
  );

  const prefix = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/student")) return "/student";
    return "/student";
  }, [location.pathname]);

  useEffect(() => {
    const run = async () => {
      if (!id || !idToken) return;
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/notifications/${id}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = res.data?.data || res.data; // fallback shape
        setItem(data);

        if (!data?.isRead) {
          try {
            await axios.post(
              `${API_BASE_URL}/notifications/${id}/read`,
              {},
              { headers: { Authorization: `Bearer ${idToken}` } }
            );
            setItem((prev) => (prev ? { ...prev, isRead: true } : prev));
          } catch (e) {
            // ignore
          }
        }
      } catch (error: any) {
        toast({
          title: "Lỗi",
          description: error.response?.data?.error || "Không thể tải thông báo",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchReplies = async () => {
      if (!id || !idToken) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/notifications/replies/${id}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        setReplies(res.data?.data || []);
      } catch {}
    };

    const fetchAll = async () => {
      if (!idToken) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/notifications`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        setAllNotifications(res.data?.data || []);
      } catch {}
    };

    run();
    fetchReplies();
    fetchAll();
  }, [id, idToken]);

  // Track viewport width to adjust filename length on very small screens
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onResize);
      }
    };
  }, []);

  const currentIndex = useMemo(
    () => allNotifications.findIndex((n) => n._id === item?._id),
    [allNotifications, item]
  );
  const prevNotification = currentIndex > 0 ? allNotifications[currentIndex - 1] : null;
  const nextNotification =
    currentIndex >= 0 && currentIndex < allNotifications.length - 1
      ? allNotifications[currentIndex + 1]
      : null;

  const getSenderName = (notif: Notification): string => {
    if (notif.senderDisplayName) return notif.senderDisplayName;
    if (notif.sender) return notif.sender;
    if (typeof notif.createdBy === "string" || !notif.createdBy) {
      return "Nhà trường";
    }
    if (notif.createdBy.displayName) return notif.createdBy.displayName;
    const name = notif.createdBy.linkedId?.name;
    const role = notif.createdBy.role;
    const gender = notif.createdBy.linkedId?.gender;
    if (role === "teacher" && name) {
      if (gender === "female" || gender === "nữ") return `Cô ${name}`;
      if (gender === "male" || gender === "nam") return `Thầy ${name}`;
      return `Thầy/Cô ${name}`;
    }
    if (role === "admin") return name || notif.createdBy.email || "Ban Giám hiệu";
    return name || notif.createdBy.email || "Nhà trường";
  };

  const getSenderAvatar = (notif: Notification): string | null => {
    if (typeof notif.createdBy === "string") return null;
    return notif.createdBy?.linkedId?.avatarUrl || null;
  };

  const formatPublicationDate = (date: Date) => {
    const dayOfWeek = format(date, "EEEE", { locale: vi });
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${day}/${month}/${year}, ${time}`;
  };

  // Student detail doesn't need to display recipient labels per requirements

  const shortenFileName = (fileName: string, maxBaseLen: number): string => {
    // Legacy helper (kept for potential reuse): trim base length but keep full extension
    if (!fileName) return "";
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot <= 0 || lastDot === fileName.length - 1) {
      return fileName.length > maxBaseLen
        ? fileName.slice(0, maxBaseLen) + "..."
        : fileName;
    }
    const base = fileName.slice(0, lastDot);
    const ext = fileName.slice(lastDot);
    if (base.length <= maxBaseLen) return fileName;
    return base.slice(0, maxBaseLen) + "..." + ext;
  };

  const ellipsizeMiddle = (text: string, keepStart = 6, keepEnd = 5): string => {
    if (!text) return "";
    const minLen = keepStart + keepEnd + 3; // 3 for '...'
    if (text.length <= minLen) return text;
    return text.slice(0, keepStart) + "..." + text.slice(text.length - keepEnd);
  };

  const canReply = (notif: Notification): boolean => {
    if (!notif.endDate) return true;
    return new Date(notif.endDate) >= new Date();
  };

  const handleSubmitReply = async () => {
    if (!item || !replyContent.trim() || !idToken) return;
    if (!canReply(item)) {
      toast({ title: "Lỗi", description: "Thông báo đã hết hạn", variant: "destructive" });
      return;
    }
    try {
      setSubmittingReply(true);
      await axios.post(
        `${API_BASE_URL}/notifications/replies/${item._id}`,
        { content: replyContent },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      setReplyContent("");
      // refresh replies
      const res = await axios.get(`${API_BASE_URL}/notifications/replies/${item._id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setReplies(res.data?.data || []);
      toast({ title: "Đã gửi phản hồi" });
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

  const handleMarkAsRead = async () => {
    if (!item || item.isRead || !idToken) return;
    try {
      await axios.post(
        `${API_BASE_URL}/notifications/${item._id}/read`,
        {},
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      setItem((prev) => (prev ? { ...prev, isRead: true } : prev));
      toast({ title: "Đã đánh dấu đã đọc" });
    } catch {}
  };

  if (loading) {
    return <div className="p-6">Đang tải...</div>;
  }

  if (!item) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-start">
          <Button variant="outline" onClick={() => navigate(`${prefix}/notifications`)}>
            <ArrowBack className="h-4 w-4 mr-1" /> Quay lại danh sách
          </Button>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">Không tìm thấy thông báo.</div>
      </div>
    );
  }

  const senderName = getSenderName(item);
  const senderAvatar = getSenderAvatar(item);
  const createdAt = new Date(item.createdAt);
  const publicationDate = item.startDate ? new Date(item.startDate) : createdAt;
  const formattedPublicationDate = formatPublicationDate(publicationDate);
  // No recipient labels on student detail

  return (
    <div className="p-0 space-y-3 w-full overflow-x-hidden">
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          onClick={() => navigate(`${prefix}/notifications`)}
          className="flex items-center gap-1 h-8 px-2 text-xs"
        >
          <ArrowBack className="h-4 w-4" /> Quay lại
        </Button>
        <div />
      </div>

      <Card className="w-full p-2 space-y-3">
        <h2 className="text-lg font-semibold">{item.title}</h2>
        <div className="flex items-center gap-3">
          {senderAvatar ? (
            <img src={senderAvatar} alt={senderName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{senderName}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">{formattedPublicationDate}</div>
          </div>
        </div>

        {/* Không hiển thị 'Gửi đến' cho trang học sinh */}

        {!!item.attachments?.length && (
          <div className="space-y-2 pt-1">
            <div className="font-medium">Tệp đính kèm ({item.attachments.length})</div>
            {item.attachments.map((att, idx) => {
              const isSmall = viewportWidth <= 360;
              const isMedium = viewportWidth > 360 && viewportWidth <= 414;
              const displayName = isSmall
                ? ellipsizeMiddle(att.fileName, 6, 5)
                : isMedium
                ? ellipsizeMiddle(att.fileName, 12, 8)
                : att.fileName;
              return (
              <Card key={idx} className="p-2 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileIcon className={`h-4 w-4 ${getFileIconColor(att.fileName)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{displayName}</div>
                    {typeof att.fileSize === "number" && (
                      <div className="text-xs text-muted-foreground truncate">{formatFileSize(att.fileSize)}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary text-xs"
                    title="Tải xuống"
                  >
                    <Download className="h-4 w-4" /> Tải xuống
                  </a>
                </div>
              </Card>
              );
            })}
          </div>
        )}

        {item.content && (
          <div className="pt-1 text-sm whitespace-pre-wrap">{item.content}</div>
        )}

        {!item.isRead && (
          <div className="pt-1">
            <Button variant="outline" onClick={handleMarkAsRead} className="flex items-center gap-2 h-8 px-2 text-xs">
              <Check className="h-4 w-4" /> Đánh dấu đã đọc
            </Button>
          </div>
        )}
      </Card>

      <Card className="w-full p-2 space-y-3">
        <div className="font-medium">Phản hồi</div>
        {replies.length > 0 ? (
          <div className="space-y-3">
            {replies.map((reply) => {
              const isStudent = reply.accountId?.role === "student";
              const isTeacher = reply.accountId?.role === "teacher";
              let name = reply.accountId?.linkedId?.name || "Người dùng";
              if (isTeacher && name) {
                const gender = reply.accountId?.linkedId?.gender;
                name = gender === "female" || gender === "nữ" ? `Cô ${name}` : `Thầy ${name}`;
              }
              const avatar = reply.accountId?.linkedId?.avatarUrl;
              return (
                <div
                  key={reply._id}
                  className={`flex gap-3 p-3 rounded-md border ${
                    isStudent
                      ? "bg-blue-50 border-blue-100"
                      : isTeacher
                      ? "bg-green-50 border-green-100"
                      : "bg-muted/30 border-border"
                  }`}
                >
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{name}</div>
                      {isStudent && <Badge variant="outline" className="text-xs">Học sinh</Badge>}
                      {isTeacher && <Badge variant="outline" className="text-xs">Giáo viên</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: vi })}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{reply.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Chưa có phản hồi nào.</div>
        )}

        <div className="space-y-2">
          {canReply(item) ? (
            <div className="relative">
              <Textarea
                placeholder="Viết phản hồi..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (replyContent.trim() && !submittingReply) handleSubmitReply();
                  }
                }}
                rows={3}
                className="pr-9 text-sm"
              />
              <Button
                onClick={handleSubmitReply}
                disabled={!replyContent.trim() || submittingReply}
                size="icon"
                className="absolute bottom-2 right-2 h-7 w-7"
                title="Gửi phản hồi"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Thông báo đã hết hạn, không thể phản hồi.</div>
          )}
        </div>
      </Card>

      {/* Prev/Next at bottom */}
      <div className="flex items-center justify-between pb-2 px-2">
        <Button
          variant="ghost"
          disabled={!prevNotification}
          onClick={() => prevNotification && navigate(`${prefix}/notifications/${prevNotification._id}`)}
          className="flex items-center gap-1 h-8 px-2 text-xs"
        >
          <ChevronLeft className="h-4 w-4" /> Trước
        </Button>
        <Button
          variant="ghost"
          disabled={!nextNotification}
          onClick={() => nextNotification && navigate(`${prefix}/notifications/${nextNotification._id}`)}
          className="flex items-center gap-1 h-8 px-2 text-xs"
        >
          Sau <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StudentNotificationDetailPage;
