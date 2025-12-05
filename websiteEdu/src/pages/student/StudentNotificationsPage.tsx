import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Check, Search, X } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

type NotificationType =
  | "exam"
  | "holiday"
  | "grade"
  | "rule"
  | "homeroom"
  | "event"
  | "admission"
  | "system"
  | "general";

interface Notification {
  _id: string;
  title: string;
  content: string;
  type: NotificationType;
  priority: "high" | "medium" | "low";
  createdAt: string;
  isRead?: boolean;
  createdBy?: { role?: string; linkedId?: { name?: string } } | string;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  exam: "Lịch kiểm tra/thi",
  holiday: "Nghỉ học",
  grade: "Kết quả học tập",
  rule: "Quy định",
  homeroom: "Thông báo lớp",
  event: "Sự kiện",
  admission: "Tuyển sinh",
  system: "Hệ thống",
  general: "Chung",
};

export default function StudentNotificationsPage() {
  const { backendUser } = useAuth();
  const navigate = useNavigate();

  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all"); // all | unread | read

  // Fetch notifications for the logged-in student
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const token = backendUser?.idToken;
        const res = await axios.get(`${API_BASE_URL}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        setList(data);
        setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    };
    if (backendUser) load();
  }, [backendUser]);

  // Mark all as read
  const markAll = async () => {
    try {
      const token = backendUser?.idToken;
      await axios.post(`${API_BASE_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setList(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const filtered = useMemo(() => {
    let arr = [...list];
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(n => n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s));
    }
    if (type !== "all") arr = arr.filter(n => n.type === type);
    if (status === "unread") arr = arr.filter(n => !n.isRead);
    if (status === "read") arr = arr.filter(n => n.isRead);
    // Latest first
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [list, search, type, status]);

  const timeLabel = (iso: string) => {
    const d = new Date(iso);
    const t = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const day = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${t} ${day}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Thông báo</h1>
          <p className="text-sm text-muted-foreground">Thông báo dành cho bạn</p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">{unreadCount} chưa đọc</Badge>
        )}
      </div>

      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <label className="relative block w-full sm:w-72">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tiêu đề, nội dung..."
              className="pl-8"
            />
            {search && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}> 
                <X className="h-4 w-4" />
              </Button>
            )}
          </label>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Loại" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="unread">Chưa đọc</SelectItem>
              <SelectItem value="read">Đã đọc</SelectItem>
            </SelectContent>
          </Select>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAll} className="flex items-center gap-2">
              <Check className="h-4 w-4" /> Đánh dấu đã đọc
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải thông báo...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
          <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          Không có thông báo phù hợp
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <button
              key={n._id}
              onClick={() => navigate(`/student/notifications/${n._id}`)}
              className={`w-full text-left rounded-xl border bg-white p-4 shadow-sm transition hover:border-primary ${n.isRead ? 'opacity-70' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-primary'}`} />
                  <div>
                    <div className="font-semibold line-clamp-1">{n.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{n.content}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded bg-slate-100">{TYPE_LABELS[n.type]}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground whitespace-nowrap">{timeLabel(n.createdAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
