import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Activity,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auditLogApi, AuditLog, AuditLogStats } from "@/services/auditLogApi";
import { format, subDays } from "date-fns";
import { vi } from "date-fns/locale";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  VIEW: 'Xem',
  EXPORT: 'Xuất dữ liệu',
  IMPORT: 'Nhập dữ liệu',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  LOCK: 'Khóa',
  UNLOCK: 'Mở khóa',
  RESET_PASSWORD: 'Reset mật khẩu',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
};

const RESOURCE_LABELS: Record<string, string> = {
  USER: 'Người dùng',
  STUDENT: 'Học sinh',
  TEACHER: 'Giáo viên',
  CLASS: 'Lớp học',
  SUBJECT: 'Môn học',
  GRADE: 'Điểm số',
  EXAM: 'Kỳ thi',
  ATTENDANCE: 'Điểm danh',
  TEACHING_ASSIGNMENT: 'Phân công giảng dạy',
  SCHOOL_YEAR: 'Năm học',
  PERMISSION: 'Phân quyền',
  NOTIFICATION: 'Thông báo',
  SYSTEM: 'Hệ thống',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  teacher: 'Giáo viên',
  student: 'Học sinh',
  bgh: 'Ban giám hiệu',
};

/**
 * Format teacher flags thành text hiển thị
 */
const formatTeacherFlags = (flags: any): string => {
  if (!flags || typeof flags !== 'object') return '';
  
  const parts: string[] = [];
  if (flags.isHomeroom) parts.push('GVCN');
  if (flags.isDepartmentHead) parts.push('TBM');
  if (flags.isLeader) parts.push('BGH');
  if (flags.permissions && Array.isArray(flags.permissions) && flags.permissions.length > 0) {
    parts.push(`Quyền: ${flags.permissions.join(', ')}`);
  }
  
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
};

// ✅ Hàm tính 7 ngày gần nhất (từ 6 ngày trước đến hôm nay)
const getDefaultDateRange = () => {
  const today = new Date();
  const sevenDaysAgo = subDays(today, 6); // 6 ngày trước + hôm nay = 7 ngày
  return {
    startDate: format(sevenDaysAgo, 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  };
};

export default function AuditLogPage() {
  // ✅ Mặc định hiển thị 7 ngày gần nhất
  const defaultDates = getDefaultDateRange();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    userRole: "",
    action: "",
    resource: "",
    status: "",
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    search: "",
  });

  const { toast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit,
      };

      if (filters.userRole) params.userRole = filters.userRole;
      if (filters.action) params.action = filters.action;
      if (filters.resource) params.resource = filters.resource;
      if (filters.status) params.status = filters.status;
      // ✅ Luôn gửi startDate và endDate (mặc định là 7 ngày gần nhất)
      params.startDate = filters.startDate || defaultDates.startDate;
      params.endDate = filters.endDate || defaultDates.endDate;
      if (filters.search) params.search = filters.search;

      const response = await auditLogApi.getAll(params);
      setLogs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || "Không thể tải danh sách log hoạt động",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params: any = {};
      // ✅ Luôn gửi startDate và endDate (mặc định là 7 ngày gần nhất)
      params.startDate = filters.startDate || defaultDates.startDate;
      params.endDate = filters.endDate || defaultDates.endDate;

      const response = await auditLogApi.getStats(params);
      setStats(response.data);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, filters]);

  const handleFilterChange = (key: string, value: string) => {
    // Nếu value rỗng, set về "" để clear filter
    setFilters((prev) => ({ ...prev, [key]: value || "" }));
    setPage(1); // Reset về trang đầu khi filter thay đổi
  };

  const handleResetFilters = () => {
    // ✅ Reset về 7 ngày gần nhất
    const resetDates = getDefaultDateRange();
    setFilters({
      userRole: "",
      action: "",
      resource: "",
      status: "",
      startDate: resetDates.startDate,
      endDate: resetDates.endDate,
      search: "",
    });
    setPage(1);
  };

  const handleViewDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const handleDeleteOldLogs = async () => {
    try {
      setDeleting(true);
      const result = await auditLogApi.deleteOldLogs(90);
      toast({
        title: "Thành công",
        description: result.message,
      });
      setDeleteDialogOpen(false);
      fetchLogs();
      fetchStats();
    } catch (error: any) {
      console.error("Error deleting old logs:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || "Không thể xóa logs cũ",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Thành công
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Thất bại
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Đang xử lý
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    const colorMap: Record<string, string> = {
      LOGIN: "bg-blue-500",
      LOGOUT: "bg-gray-500",
      CREATE: "bg-green-500",
      UPDATE: "bg-yellow-500",
      DELETE: "bg-red-500",
      VIEW: "bg-purple-500",
    };
    return (
      <Badge className={colorMap[action] || "bg-gray-500"}>
        {ACTION_LABELS[action] || action}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Log Hoạt Động Hệ Thống</h1>
          <p className="text-muted-foreground mt-1">
            Theo dõi và giám sát các hoạt động của người dùng trong hệ thống
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Xóa logs cũ
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tổng số logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Thành công</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.statusStats.find((s) => s._id === "SUCCESS")?.count || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Thất bại</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.statusStats.find((s) => s._id === "FAILED")?.count || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Người dùng hoạt động</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.topUsers.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Vai trò</label>
              <Select
                value={filters.userRole}
                onValueChange={(value) => handleFilterChange("userRole", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Hành động</label>
              <Select
                value={filters.action || "all"}
                onValueChange={(value) => handleFilterChange("action", value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả hành động" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả hành động</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tài nguyên</label>
              <Select
                value={filters.resource || "all"}
                onValueChange={(value) => handleFilterChange("resource", value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả tài nguyên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả tài nguyên</SelectItem>
                  {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Trạng thái</label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => handleFilterChange("status", value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="SUCCESS">Thành công</SelectItem>
                  <SelectItem value="FAILED">Thất bại</SelectItem>
                  <SelectItem value="PENDING">Đang xử lý</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Từ ngày</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Đến ngày</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Đặt lại
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách Logs ({total.toLocaleString()})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Đang tải...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có log hoạt động nào
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Người dùng</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>Hành động</TableHead>
                      <TableHead>Tài nguyên</TableHead>
                      <TableHead>Mô tả</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: vi })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{log.userName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline">{ROLE_LABELS[log.userRole] || log.userRole}</Badge>
                            {log.userRole === 'teacher' && log.userFlags && formatTeacherFlags(log.userFlags) && (
                              <span className="text-xs text-muted-foreground">
                                {formatTeacherFlags(log.userFlags)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {RESOURCE_LABELS[log.resource] || log.resource}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.ipAddress || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Trang {page} / {totalPages} ({total} logs)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Sau
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết Log Hoạt Động</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Người dùng</label>
                  <div className="font-medium">{selectedLog.userName}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vai trò</label>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline">{ROLE_LABELS[selectedLog.userRole] || selectedLog.userRole}</Badge>
                    {selectedLog.userRole === 'teacher' && selectedLog.userFlags && (
                      <div className="mt-1 space-y-1">
                        {formatTeacherFlags(selectedLog.userFlags) && (
                          <div className="text-xs text-muted-foreground">
                            {formatTeacherFlags(selectedLog.userFlags)}
                          </div>
                        )}
                        {selectedLog.userFlags.isHomeroom && (
                          <Badge variant="secondary" className="text-xs">GVCN</Badge>
                        )}
                        {selectedLog.userFlags.isDepartmentHead && (
                          <Badge variant="secondary" className="text-xs">TBM</Badge>
                        )}
                        {selectedLog.userFlags.isLeader && (
                          <Badge variant="secondary" className="text-xs">BGH</Badge>
                        )}
                        {selectedLog.userFlags.permissions && Array.isArray(selectedLog.userFlags.permissions) && selectedLog.userFlags.permissions.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Quyền bổ sung: {selectedLog.userFlags.permissions.join(', ')}
                          </div>
                        )}
                        {selectedLog.userFlags.currentYear && (
                          <div className="text-xs text-muted-foreground">
                            Năm học: {selectedLog.userFlags.currentYear}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hành động</label>
                  <div>{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tài nguyên</label>
                  <div>
                    <Badge variant="secondary">
                      {RESOURCE_LABELS[selectedLog.resource] || selectedLog.resource}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Trạng thái</label>
                  <div>{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Thời gian</label>
                  <div className="text-sm">
                    {format(new Date(selectedLog.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: vi })}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                  <div className="text-sm">{selectedLog.ipAddress || "-"}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                  <div className="text-sm text-muted-foreground truncate">
                    {selectedLog.userAgent || "-"}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Mô tả</label>
                <div className="mt-1 p-2 bg-muted rounded-md">{selectedLog.description}</div>
              </div>
              {selectedLog.resourceName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tên tài nguyên</label>
                  <div className="mt-1 p-2 bg-muted rounded-md">{selectedLog.resourceName}</div>
                </div>
              )}
              {selectedLog.errorMessage && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Lỗi</label>
                  <div className="mt-1 p-2 bg-destructive/10 text-destructive rounded-md">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                  <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Old Logs Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa Logs Cũ</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa tất cả logs cũ hơn 90 ngày? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDeleteOldLogs} disabled={deleting}>
              {deleting ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

