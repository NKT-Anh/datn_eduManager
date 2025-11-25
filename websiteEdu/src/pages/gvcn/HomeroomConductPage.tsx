/**
 * Trang nhập hạnh kiểm cho GVCN
 * - Dropdown chọn HK1/HK2
 * - Danh sách học sinh với: Đề xuất (auto), Hạnh kiểm (GVCN nhập), Ghi chú
 * - Nút: Lưu bản nháp, Gửi phê duyệt
 * - Kiểm tra thời gian cho phép nhập
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSchoolYears } from '@/hooks';
import api from '@/services/axiosInstance';
import { toast } from 'sonner';
import { 
  Save, 
  Send, 
  Clock, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Users
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface ConductRecord {
  _id: string;
  studentId: {
    _id: string;
    name: string;
    studentCode: string;
  };
  classId: {
    _id: string;
    className: string;
    grade: string;
  };
  year: string;
  semester: string;
  conduct: string;
  conductSuggested: string | null;
  conductNote: string;
  conductStatus: 'draft' | 'pending' | 'approved' | 'locked';
  conductComment?: string;
  homeroomTeacherId?: {
    name: string;
  };
}

interface TimeInfo {
  allowed: boolean;
  startDate: string | null;
  endDate: string | null;
  message: string;
}

export default function HomeroomConductPage() {
  const { backendUser } = useAuth();
  const { currentYearData, currentYear, schoolYears: allSchoolYears } = useSchoolYears();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [homeroomClass, setHomeroomClass] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('HK1');
  const [conducts, setConducts] = useState<ConductRecord[]>([]);
  const [timeInfo, setTimeInfo] = useState<TimeInfo | null>(null);
  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [editConduct, setEditConduct] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // ✅ Lấy lớp chủ nhiệm
  useEffect(() => {
    const fetchHomeroomClass = async () => {
      try {
        setLoading(true);
        const year = selectedYear || currentYearData?.code || currentYear;
        if (!year) return;

        const res = await api.get('/class/homeroom/class', { params: { year } });
        if (res.data.success && res.data.data) {
          setHomeroomClass(res.data.data);
        } else {
          setHomeroomClass(null);
        }
      } catch (err: any) {
        console.error('Error fetching homeroom class:', err);
        setHomeroomClass(null);
      } finally {
        setLoading(false);
      }
    };
    fetchHomeroomClass();
  }, [selectedYear, currentYearData, currentYear]);

  // ✅ Set năm học mặc định
  useEffect(() => {
    const defaultYear = currentYearData?.code || currentYear || (allSchoolYears.length > 0 ? allSchoolYears[allSchoolYears.length - 1].code : '');
    if (defaultYear && !selectedYear) {
      setSelectedYear(defaultYear);
    }
  }, [currentYearData, currentYear, allSchoolYears, selectedYear]);

  // ✅ Lấy danh sách hạnh kiểm và kiểm tra thời gian
  useEffect(() => {
    if (selectedYear && selectedSemester && homeroomClass) {
      fetchConducts();
      checkTime();
    }
  }, [selectedYear, selectedSemester, homeroomClass]);

  const checkTime = async () => {
    try {
      // Lấy thông tin thời gian từ settings
      const settingsRes = await api.get('/settings');
      const settings = settingsRes.data;
      
      let startDate, endDate;
      if (selectedSemester === 'HK1') {
        startDate = settings.conductEntryStartHK1;
        endDate = settings.conductEntryEndHK1;
      } else if (selectedSemester === 'HK2') {
        startDate = settings.conductEntryStartHK2;
        endDate = settings.conductEntryEndHK2;
      }

      if (!startDate || !endDate) {
        setTimeInfo({
          allowed: false,
          startDate: null,
          endDate: null,
          message: 'Chưa cấu hình thời gian nhập hạnh kiểm cho học kỳ này'
        });
        return;
      }

      const now = new Date();
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      if (now < start) {
        setTimeInfo({
          allowed: false,
          startDate,
          endDate,
          message: `Chưa đến thời gian nhập hạnh kiểm. Thời gian cho phép: ${formatDate(startDate)} - ${formatDate(endDate)}`
        });
      } else if (now > end) {
        setTimeInfo({
          allowed: false,
          startDate,
          endDate,
          message: `Đã hết thời gian nhập hạnh kiểm. Thời gian đã qua: ${formatDate(startDate)} - ${formatDate(endDate)}`
        });
      } else {
        setTimeInfo({
          allowed: true,
          startDate,
          endDate,
          message: `Đang trong thời gian cho phép nhập hạnh kiểm: ${formatDate(startDate)} - ${formatDate(endDate)}`
        });
      }
    } catch (error: any) {
      console.error('Error checking time:', error);
      setTimeInfo({
        allowed: false,
        startDate: null,
        endDate: null,
        message: 'Không thể kiểm tra thời gian nhập hạnh kiểm'
      });
    }
  };

  const fetchConducts = async () => {
    if (!selectedYear || !selectedSemester || !homeroomClass) return;
    
    try {
      setLoading(true);
      const res = await api.get('/conducts', {
        params: {
          year: selectedYear,
          semester: selectedSemester,
          classId: homeroomClass._id
        }
      });
      
      if (res.data.success) {
        setConducts(res.data.data || []);
      }
    } catch (error: any) {
      console.error('Error fetching conducts:', error);
      toast.error(error.response?.data?.error || 'Không thể tải danh sách hạnh kiểm');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Tính toán đề xuất hạnh kiểm tự động
  const calculateSuggested = async (studentId: string) => {
    try {
      const res = await api.get('/conducts/calculate-suggested', {
        params: {
          studentId,
          year: selectedYear,
          semester: selectedSemester
        }
      });
      
      if (res.data.success && res.data.data.suggested) {
        toast.success(`Đề xuất: ${res.data.data.suggested}`);
        fetchConducts(); // Refresh để hiển thị đề xuất
      } else {
        toast.info('Không thể tính toán tự động. Vui lòng nhập thủ công.');
      }
    } catch (error: any) {
      console.error('Error calculating suggested:', error);
      toast.error('Không thể tính toán đề xuất');
    }
  };

  // ✅ Lưu bản nháp
  const handleSaveDraft = async (recordId: string, conduct: string, note: string) => {
    try {
      setSaving(true);
      await api.put(`/conducts/${recordId}`, {
        conduct,
        conductNote: note,
        action: 'save'
      });
      toast.success('Đã lưu bản nháp');
      fetchConducts();
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error(error.response?.data?.error || 'Không thể lưu bản nháp');
    } finally {
      setSaving(false);
    }
  };

  // ✅ Gửi phê duyệt
  const handleSubmit = async (recordId: string, conduct: string, note: string) => {
    try {
      setSaving(true);
      await api.put(`/conducts/${recordId}`, {
        conduct,
        conductNote: note,
        action: 'submit'
      });
      toast.success('Đã gửi phê duyệt');
      fetchConducts();
    } catch (error: any) {
      console.error('Error submitting:', error);
      const errorMsg = error.response?.data?.error || 'Không thể gửi phê duyệt';
      toast.error(errorMsg);
      
      // Hiển thị thông tin thời gian nếu lỗi do hết thời gian
      if (error.response?.data?.timeInfo) {
        setTimeInfo({
          allowed: false,
          ...error.response.data.timeInfo,
          message: errorMsg
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // ✅ Lưu tất cả (batch save)
  const handleSaveAll = async () => {
    if (!timeInfo?.allowed) {
      toast.error('Không trong thời gian cho phép nhập hạnh kiểm');
      return;
    }

    try {
      setSaving(true);
      const promises = conducts.map(record => {
        if (record.conductStatus === 'locked') return Promise.resolve();
        return api.put(`/conducts/${record._id}`, {
          conduct: record.conduct,
          conductNote: record.conductNote || '',
          action: 'save'
        });
      });
      
      await Promise.all(promises);
      toast.success('Đã lưu tất cả bản nháp');
      fetchConducts();
    } catch (error: any) {
      console.error('Error saving all:', error);
      toast.error('Không thể lưu tất cả');
    } finally {
      setSaving(false);
    }
  };

  // ✅ Gửi phê duyệt tất cả
  const handleSubmitAll = async () => {
    if (!timeInfo?.allowed) {
      toast.error('Không trong thời gian cho phép nhập hạnh kiểm');
      return;
    }

    try {
      setSaving(true);
      const promises = conducts
        .filter(record => record.conductStatus !== 'locked' && record.conduct)
        .map(record => 
          api.put(`/conducts/${record._id}`, {
            conduct: record.conduct,
            conductNote: record.conductNote || '',
            action: 'submit'
          })
        );
      
      await Promise.all(promises);
      toast.success('Đã gửi phê duyệt tất cả');
      fetchConducts();
    } catch (error: any) {
      console.error('Error submitting all:', error);
      toast.error('Không thể gửi phê duyệt tất cả');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Bản nháp', variant: 'outline' },
      pending: { label: 'Chờ phê duyệt', variant: 'secondary' },
      approved: { label: 'Đã phê duyệt', variant: 'default' },
      locked: { label: 'Đã chốt', variant: 'destructive' }
    };
    const info = statusMap[status] || statusMap.draft;
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const getConductBadge = (conduct: string) => {
    const conductMap: Record<string, { label: string; className: string }> = {
      'Tốt': { label: 'Tốt', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      'Khá': { label: 'Khá', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      'Trung bình': { label: 'Trung bình', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      'Yếu': { label: 'Yếu', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
    };
    const info = conductMap[conduct] || conductMap['Tốt'];
    return <Badge className={info.className}>{info.label}</Badge>;
  };

  const openEditDialog = (record: ConductRecord) => {
    setEditingRecord(record._id);
    setEditConduct(record.conduct || '');
    setEditNote(record.conductNote || '');
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingRecord) return;
    const record = conducts.find(r => r._id === editingRecord);
    if (!record) return;

    if (record.conductStatus === 'locked') {
      toast.error('Hạnh kiểm đã được chốt, không thể sửa');
      return;
    }

    await handleSaveDraft(editingRecord, editConduct, editNote);
    setEditDialogOpen(false);
    setEditingRecord(null);
  };

  const handleEditSubmit = async () => {
    if (!editingRecord) return;
    const record = conducts.find(r => r._id === editingRecord);
    if (!record) return;

    if (record.conductStatus === 'locked') {
      toast.error('Hạnh kiểm đã được chốt, không thể sửa');
      return;
    }

    await handleSubmit(editingRecord, editConduct, editNote);
    setEditDialogOpen(false);
    setEditingRecord(null);
  };

  if (loading && !homeroomClass) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!homeroomClass) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Bạn chưa được phân công làm giáo viên chủ nhiệm.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nhập hạnh kiểm</h1>
          <p className="text-muted-foreground">
            Lớp: {homeroomClass.className} - Năm học: {selectedYear}
          </p>
        </div>
      </div>

      {/* ✅ Thông báo thời gian */}
      {timeInfo && (
        <Alert className={timeInfo.allowed ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}>
          <div className="flex items-center gap-2">
            {timeInfo.allowed ? (
              <Clock className="h-4 w-4 text-blue-600" />
            ) : (
              <Lock className="h-4 w-4 text-yellow-600" />
            )}
            <AlertDescription className={timeInfo.allowed ? 'text-blue-800' : 'text-yellow-800'}>
              {timeInfo.message}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* ✅ Bộ lọc */}
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Năm học</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {allSchoolYears.map(y => (
                    <SelectItem key={y.code} value={y.code}>
                      {y.name} {currentYearData?.code === y.code && "(Hiện tại)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Học kỳ</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HK1">Học kỳ 1</SelectItem>
                  <SelectItem value="HK2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Nút hành động tổng */}
      {timeInfo?.allowed && conducts.length > 0 && (
        <div className="flex gap-2">
          <Button 
            onClick={handleSaveAll} 
            disabled={saving}
            variant="outline"
          >
            <Save className="h-4 w-4 mr-2" />
            Lưu tất cả bản nháp
          </Button>
          <Button 
            onClick={handleSubmitAll} 
            disabled={saving}
          >
            <Send className="h-4 w-4 mr-2" />
            Gửi phê duyệt tất cả
          </Button>
        </div>
      )}

      {/* ✅ Bảng danh sách học sinh */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Danh sách học sinh ({conducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Đang tải...</div>
          ) : conducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Chưa có dữ liệu hạnh kiểm cho học kỳ này
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>STT</TableHead>
                    <TableHead>Mã HS</TableHead>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Đề xuất</TableHead>
                    <TableHead>Hạnh kiểm</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conducts.map((record, index) => (
                    <TableRow key={record._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{record.studentId.studentCode}</TableCell>
                      <TableCell className="font-medium">{record.studentId.name}</TableCell>
                      <TableCell>
                        {record.conductSuggested ? (
                          <div className="flex items-center gap-2">
                            {getConductBadge(record.conductSuggested)}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditConduct(record.conductSuggested || '');
                                setEditNote(record.conductNote || '');
                                setEditingRecord(record._id);
                                setEditDialogOpen(true);
                              }}
                              className="h-6 px-2"
                            >
                              Dùng
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => calculateSuggested(record.studentId._id)}
                            disabled={record.conductStatus === 'locked'}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Tính
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.conduct ? (
                          getConductBadge(record.conduct)
                        ) : (
                          <span className="text-muted-foreground">Chưa nhập</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {record.conductNote ? (
                          <p className="text-sm truncate" title={record.conductNote}>
                            {record.conductNote}
                          </p>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                        {record.conductComment && (
                          <p className="text-xs text-muted-foreground mt-1" title={record.conductComment}>
                            BGH: {record.conductComment}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.conductStatus)}</TableCell>
                      <TableCell>
                        {record.conductStatus === 'locked' ? (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Đã chốt
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(record)}
                            disabled={!timeInfo?.allowed && record.conductStatus !== 'pending'}
                          >
                            {record.conduct ? 'Sửa' : 'Nhập'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ Dialog chỉnh sửa */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nhập hạnh kiểm</DialogTitle>
            <DialogDescription>
              {editingRecord && conducts.find(r => r._id === editingRecord)?.studentId.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Hạnh kiểm</Label>
              <Select value={editConduct} onValueChange={setEditConduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn hạnh kiểm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tốt">Tốt</SelectItem>
                  <SelectItem value="Khá">Khá</SelectItem>
                  <SelectItem value="Trung bình">Trung bình</SelectItem>
                  <SelectItem value="Yếu">Yếu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Nhập ghi chú về hạnh kiểm..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Hủy
              </Button>
              <Button
                variant="outline"
                onClick={handleEditSave}
                disabled={saving || !editConduct}
              >
                <Save className="h-4 w-4 mr-2" />
                Lưu bản nháp
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={saving || !editConduct || !timeInfo?.allowed}
              >
                <Send className="h-4 w-4 mr-2" />
                Gửi phê duyệt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

