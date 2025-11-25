/**
 * Email Stats Page
 * Trang thống kê email cho BGH - chỉ xem số liệu, không có nội dung chi tiết
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
  Search, 
  Filter, 
  BarChart3,
  TrendingUp,
  Users,
  GraduationCap,
  Globe,
  User as UserIcon,
  Loader2,
  Calendar,
  CheckCircle,
  XCircle
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const EmailStatsPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    schoolYear: '',
  });

  // Load stats
  const loadStats = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes] = await Promise.all([
        settingApi.getEmailStats(filters),
        settingApi.getEmailLogs({ limit: 10 })
      ]);
      setStats(statsRes.stats);
      setLogs(logsRes.data || []);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể tải thống kê email',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [filters.startDate, filters.endDate, filters.schoolYear]);

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

  const getRecipientTypeLabel = (type: string) => {
    switch (type) {
      case 'teachers': return 'Giáo viên';
      case 'students': return 'Học sinh';
      case 'all': return 'Tất cả';
      case 'single': return '1 người';
      default: return type;
    }
  };

  // Prepare chart data
  const recipientTypeData = stats?.byRecipientType ? Object.entries(stats.byRecipientType).map(([key, value]: [string, any]) => ({
    name: getRecipientTypeLabel(key),
    sent: value.totalSent || 0,
    failed: value.totalFailed || 0
  })) : [];

  const statusData = stats?.byStatus ? Object.entries(stats.byStatus).map(([key, value]: [string, any]) => ({
    name: key === 'sent' ? 'Đã gửi' : key === 'failed' ? 'Thất bại' : key,
    value: value || 0
  })) : [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Thống kê email
          </h1>
          <p className="text-gray-600 mt-2">
            Xem thống kê tổng quan về email đã gửi trong hệ thống
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Ngày bắt đầu</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Ngày kết thúc</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Năm học</Label>
                <Input
                  type="text"
                  placeholder="2025-2026"
                  value={filters.schoolYear}
                  onChange={(e) => setFilters(prev => ({ ...prev, schoolYear: e.target.value }))}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : stats ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Tổng số email</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalEmails || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Thành công</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{stats.totalSent || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Thất bại</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{stats.totalFailed || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Tỷ lệ thành công</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {stats.totalSent + stats.totalFailed > 0
                      ? Math.round((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100)
                      : 0}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chart: Thống kê theo loại người nhận */}
              <Card>
                <CardHeader>
                  <CardTitle>Thống kê theo loại người nhận</CardTitle>
                </CardHeader>
                <CardContent>
                  {recipientTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={recipientTypeData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="sent" fill="#10b981" name="Thành công" />
                        <Bar dataKey="failed" fill="#ef4444" name="Thất bại" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Chưa có dữ liệu
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chart: Thống kê theo trạng thái */}
              <Card>
                <CardHeader>
                  <CardTitle>Thống kê theo trạng thái</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {statusData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Chưa có dữ liệu
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Logs (chỉ số liệu, không có nội dung) */}
            <Card>
              <CardHeader>
                <CardTitle>10 email gần nhất</CardTitle>
                <CardDescription>
                  Chỉ hiển thị thống kê, không có nội dung chi tiết
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có email nào
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Người gửi</TableHead>
                          <TableHead>Tiêu đề</TableHead>
                          <TableHead>Người nhận</TableHead>
                          <TableHead>Kết quả</TableHead>
                          <TableHead>Thời gian</TableHead>
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
                              {getRecipientTypeLabel(log.recipientType)}
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
                              <div className="text-sm">
                                {formatDate(log.sentAt)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Alert */}
            <Alert>
              <AlertDescription>
                <strong>Lưu ý:</strong> Ban Giám Hiệu chỉ xem được thống kê và số liệu tổng quan. 
                Để xem nội dung chi tiết email, vui lòng liên hệ Admin.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Không có dữ liệu thống kê
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailStatsPage;

