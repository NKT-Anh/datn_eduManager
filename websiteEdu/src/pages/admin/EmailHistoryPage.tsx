/**
 * Email History Page
 * Trang lịch sử email cho Admin - xem chi tiết đầy đủ
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  Users,
  GraduationCap,
  Globe,
  User as UserIcon,
  Loader2,
  Calendar,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import settingApi from '@/services/settingApi';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const EmailHistoryPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    recipientType: '',
    status: '',
    search: '',
    startDate: '',
    endDate: '',
  });

  // Load logs
  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await settingApi.getEmailLogs(filters);
      setLogs(response.data || []);
      setPagination(response.pagination);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể tải lịch sử email',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filters.page, filters.recipientType, filters.status, filters.startDate, filters.endDate]);

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    loadLogs();
  };

  const getRecipientTypeIcon = (type: string) => {
    switch (type) {
      case 'teachers': return <Users className="h-4 w-4" />;
      case 'students': return <GraduationCap className="h-4 w-4" />;
      case 'all': return <Globe className="h-4 w-4" />;
      case 'single': return <UserIcon className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getRecipientTypeLabel = (type: string) => {
    switch (type) {
      case 'teachers': return 'Giáo viên';
      case 'students': return 'Học sinh';
      case 'all': return 'Tất cả';
      case 'single': return '1 người';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Đã gửi</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Thất bại</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Chờ duyệt</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800"><XCircle className="h-3 w-3 mr-1" />Đã hủy</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (date: string | Date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-8 w-8 text-blue-600" />
            Lịch sử email
          </h1>
          <p className="text-gray-600 mt-2">
            Xem chi tiết lịch sử gửi email trong hệ thống
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Bộ lọc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Tìm kiếm</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Tiêu đề, người gửi..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>Loại người nhận</Label>
                <Select
                  value={filters.recipientType || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, recipientType: value === 'all' ? '' : value, page: 1 }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Tất cả" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="single">1 người</SelectItem>
                    <SelectItem value="teachers">Giáo viên</SelectItem>
                    <SelectItem value="students">Học sinh</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Trạng thái</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value, page: 1 }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Tất cả" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="sent">Đã gửi</SelectItem>
                    <SelectItem value="failed">Thất bại</SelectItem>
                    <SelectItem value="pending">Chờ duyệt</SelectItem>
                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ngày bắt đầu</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Ngày kết thúc</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
                  className="mt-2"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button onClick={handleSearch} className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  Tìm kiếm
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      page: 1,
                      limit: 20,
                      recipientType: '',
                      status: '',
                      search: '',
                      startDate: '',
                      endDate: '',
                    });
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Logs Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Danh sách email đã gửi</CardTitle>
                <CardDescription>
                  Tổng số: {pagination?.total || 0} email
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Không có email nào
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Người gửi</TableHead>
                        <TableHead>Tiêu đề</TableHead>
                        <TableHead>Người nhận</TableHead>
                        <TableHead>Kết quả</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log._id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.senderName}</div>
                              <div className="text-xs text-muted-foreground">{log.senderEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate" title={log.subject}>
                              {log.subject}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getRecipientTypeIcon(log.recipientType)}
                              <span>{getRecipientTypeLabel(log.recipientType)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="text-green-600">✓ {log.successCount}</div>
                              {log.failedCount > 0 && (
                                <div className="text-red-600">✗ {log.failedCount}</div>
                              )}
                              <div className="text-muted-foreground">Tổng: {log.totalRecipients}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(log.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(log.sentAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLog(log);
                                setIsDetailOpen(true);
                              }}
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
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Trang {pagination.page} / {pagination.totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page <= 1}
                      >
                        Trước
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        Sau
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Chi tiết email</DialogTitle>
              <DialogDescription>
                Thông tin chi tiết về email đã gửi
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Người gửi</Label>
                    <div className="mt-1">
                      <div>{selectedLog.senderName}</div>
                      <div className="text-sm text-muted-foreground">{selectedLog.senderEmail}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Người nhận</Label>
                    <div className="mt-1 flex items-center gap-2">
                      {getRecipientTypeIcon(selectedLog.recipientType)}
                      <span>{getRecipientTypeLabel(selectedLog.recipientType)}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Tiêu đề</Label>
                    <div className="mt-1">{selectedLog.subject}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Thời gian</Label>
                    <div className="mt-1">{formatDate(selectedLog.sentAt)}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Kết quả</Label>
                    <div className="mt-1">
                      <div>Thành công: <span className="text-green-600 font-semibold">{selectedLog.successCount}</span></div>
                      <div>Thất bại: <span className="text-red-600 font-semibold">{selectedLog.failedCount}</span></div>
                      <div>Tổng: {selectedLog.totalRecipients}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Trạng thái</Label>
                    <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Nội dung email</Label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg border">
                    <div className="whitespace-pre-wrap">{selectedLog.content}</div>
                  </div>
                </div>

                {selectedLog.errors && selectedLog.errors.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Lỗi gửi email</Label>
                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                      {selectedLog.errors.map((err: any, idx: number) => (
                        <Alert key={idx} variant="destructive">
                          <AlertDescription>
                            <strong>{err.recipientName}</strong> ({err.recipientEmail}): {err.error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EmailHistoryPage;

