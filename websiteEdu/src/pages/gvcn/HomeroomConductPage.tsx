/**
 * Trang nhập hạnh kiểm cho GVCN
 * - Dropdown chọn HK1/HK2
 * - Danh sách học sinh với: Đề xuất (auto), Hạnh kiểm (GVCN nhập), Ghi chú
 * - Nút: Lưu bản nháp, Gửi phê duyệt
 * - Kiểm tra thời gian cho phép nhập
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import api from '@/services/axiosInstance';
import { toast } from 'sonner';
import {
  Save,
  Send,
  Clock,
  Lock,
  AlertCircle,
  Users,
  MessageSquare
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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
  conduct: string | null;
  conductDraft?: string | null;
  academicLevel?: string | null;
  conductSuggested: string | null;
  conductNote: string;
  conductStatus: 'draft' | 'pending' | 'approved' | 'locked';
  conductComment?: string;
  note?: string | null;
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

const NEW_CONDUCT_PLACEHOLDER_ID = 'undefined';

export default function HomeroomConductPage() {
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { currentYearCode, currentYearData } = useCurrentAcademicYear();
  const currentYear = currentYearCode;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [homeroomClass, setHomeroomClass] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<'HK1' | 'HK2' | 'CN'>('HK1');
  const [conducts, setConducts] = useState<ConductRecord[]>([]);
  const [timeInfo, setTimeInfo] = useState<TimeInfo | null>(null);
  const [savingConductId, setSavingConductId] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteRecord, setNoteRecord] = useState<ConductRecord | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [conductNoteDialogOpen, setConductNoteDialogOpen] = useState(false);
  const [conductNoteRecord, setConductNoteRecord] = useState<ConductRecord | null>(null);
  const [conductNoteValue, setConductNoteValue] = useState('');
  const [conductNoteSaving, setConductNoteSaving] = useState(false);

  const allHaveAcademicLevel = useMemo(() => {
    if (conducts.length === 0) return false;
    return conducts.every(record => {
      const level = record.academicLevel;
      return typeof level === 'string' && level.trim().length > 0;
    });
  }, [conducts]);

  const submitReadyCount = useMemo(() => {
    return conducts.filter(record => {
      const hasConduct = (record.conductDraft ?? record.conduct ?? '').trim().length > 0;
      return hasConduct;
    }).length;
  }, [conducts]);

  // Nút gửi phê duyệt tất cả chỉ disable khi đang saving hoặc không có học sinh nào nhập hạnh kiểm
  const disableSubmitAll = saving || submitReadyCount === 0;

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
        } else if (selectedSemester === 'HK2' || selectedSemester === 'CN') {
          // Nếu là HK2 hoặc Cuối năm (CN) thì đều lấy thời gian của HK2
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

        const draftValue = record.conductDraft ?? record.conduct;

        const payload: any = {
          conductNote: record.conductNote || '',
          action: 'save'
        };

        if (draftValue) {
          payload.conduct = draftValue;
        }

        if (!record._id || record._id === 'null' || record._id === 'undefined') {
          if (record.studentId && selectedYear && selectedSemester) {
            payload.studentId = record.studentId._id || record.studentId;
            payload.year = selectedYear;
            payload.semester = selectedSemester;
          } else {
            return Promise.reject(new Error('Thiếu thông tin học sinh'));
          }
        }

        const requestId = getRequestId(record);
        return api.put(`/conducts/${requestId}`, payload);
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
          .map(record => {
            if (record.conductStatus === 'locked') return null;

            const draftValue = record.conductDraft ?? record.conduct;
            if (!draftValue) return null;

            const payload: any = {
              conduct: draftValue,
              conductNote: record.conductNote || '',
              action: 'submit'
            };
          
          // ✅ Nếu record chưa có _id, gửi thêm studentId, year, semester
          if (!record._id || record._id === 'null' || record._id === 'undefined') {
            if (record.studentId && selectedYear && selectedSemester) {
              payload.studentId = record.studentId._id || record.studentId;
              payload.year = selectedYear;
              payload.semester = selectedSemester;
            } else {
              return Promise.reject(new Error('Thiếu thông tin học sinh'));
            }
          }
          
          const requestId = getRequestId(record);
          return api.put(`/conducts/${requestId}`, payload);
        });
      
        const validPromises = promises.filter(Boolean) as Promise<any>[];
      
        await Promise.all(validPromises);
      toast.success('Đã gửi phê duyệt tất cả');
      fetchConducts();
    } catch (error: any) {
      console.error('Error submitting all:', error);
      toast.error(error.response?.data?.error || 'Không thể gửi phê duyệt tất cả');
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

  const getRecordKey = (record: ConductRecord) => {
    if (record._id) return String(record._id);
    const studentId = record.studentId?._id || record.studentId;
    return `${studentId}-${record.year}-${record.semester}`;
  };

  const isSameRecord = (a: ConductRecord, b: ConductRecord) => {
    if (a._id && b._id) {
      return String(a._id) === String(b._id);
    }
    const aStudent = a.studentId?._id || a.studentId;
    const bStudent = b.studentId?._id || b.studentId;
    return (
      String(aStudent) === String(bStudent) &&
      String(a.year) === String(b.year) &&
      String(a.semester) === String(b.semester)
    );
  };

  const getRequestId = (record: ConductRecord) => {
    if (record._id && record._id !== 'null' && record._id !== 'undefined') {
      return String(record._id);
    }
    return NEW_CONDUCT_PLACEHOLDER_ID;
  };

  const handleConductSelect = async (record: ConductRecord, value: string) => {
    if (!value) return;

    const newConduct = value;
    const recordKey = getRecordKey(record);
    const previous = {
      conduct: record.conduct || null,
      conductDraft: record.conductDraft || null,
      conductStatus: record.conductStatus
    };

    setConducts(prev => prev.map(r => (
      isSameRecord(r, record)
        ? {
            ...r,
            conductDraft: newConduct,
            conductStatus: 'draft'
          }
        : r
    )));

    const payload: any = {
      action: 'save',
      conductNote: record.conductNote || ''
    };

    if (newConduct) {
      payload.conduct = newConduct;
    }

    if (!record._id || record._id === 'null' || record._id === 'undefined') {
      payload.studentId = record.studentId._id || record.studentId;
      payload.year = selectedYear;
      payload.semester = selectedSemester;
    }

    setSavingConductId(recordKey);

    try {
      const requestId = getRequestId(record);
      const res = await api.put(`/conducts/${requestId}`, payload);
      const updated = res.data?.data as ConductRecord | undefined;
      if (updated) {
        setConducts(prev => prev.map(r => (
          isSameRecord(r, record)
            ? {
                ...r,
                ...updated,
                studentId: updated.studentId || r.studentId,
                classId: updated.classId || r.classId
              }
            : r
        )));
      }
      toast.success('Đã lưu hạnh kiểm (bản nháp)');
    } catch (error: any) {
      console.error('Error updating conduct:', error);
      toast.error(error.response?.data?.error || 'Không thể lưu hạnh kiểm');
      setConducts(prev => prev.map(r => (
        isSameRecord(r, record)
          ? {
              ...r,
              conduct: previous.conduct,
              conductDraft: previous.conductDraft,
              conductStatus: previous.conductStatus
            }
          : r
      )));
    } finally {
      setSavingConductId(null);
    }
  };

  const openNoteDialog = (record: ConductRecord) => {
    setNoteRecord(record);
    setNoteContent(record.note || '');
    setNoteDialogOpen(true);
  };

  const openConductNoteDialog = (record: ConductRecord) => {
    setConductNoteRecord(record);
    setConductNoteValue(record.conductNote || '');
    setConductNoteDialogOpen(true);
  };

  const handleNoteSave = async () => {
    if (!noteRecord || !selectedYear) return;

    const semesterForNote: 'HK1' | 'HK2' = selectedSemester === 'HK2' ? 'HK2' : 'HK1';

    try {
      setNoteSaving(true);
      await api.put('/conducts/year-note/update', {
        studentId: noteRecord.studentId._id,
        year: selectedYear,
        semester: semesterForNote,
        note: noteContent
      });
      toast.success(`Đã lưu nhận xét ${semesterForNote === 'HK1' ? 'học kỳ 1' : 'học kỳ 2'} thành công`);
      setNoteDialogOpen(false);
      setNoteRecord(null);
      setNoteContent('');
      fetchConducts();
    } catch (error: any) {
      console.error('Error saving year note:', error);
      toast.error(error.response?.data?.error || 'Không thể lưu nhận xét');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleConductNoteSave = async () => {
    if (!conductNoteRecord) return;

    const draftValue = conductNoteRecord.conductDraft ?? conductNoteRecord.conduct ?? undefined;

    const payload: any = {
      conductNote: conductNoteValue,
      action: 'save'
    };

    if (draftValue) {
      payload.conduct = draftValue;
    }

    if (!conductNoteRecord._id || conductNoteRecord._id === 'null' || conductNoteRecord._id === 'undefined') {
      payload.studentId = conductNoteRecord.studentId._id;
      payload.year = selectedYear;
      payload.semester = selectedSemester;
    }

    try {
      setConductNoteSaving(true);
      const requestId = getRequestId(conductNoteRecord);
      await api.put(`/conducts/${requestId}`, payload);
      toast.success('Đã lưu ghi chú (bản nháp)');
      setConductNoteDialogOpen(false);
      setConductNoteRecord(null);
      setConductNoteValue('');
      fetchConducts();
    } catch (error: any) {
      console.error('Error saving conduct note:', error);
      toast.error(error.response?.data?.error || 'Không thể lưu ghi chú');
    } finally {
      setConductNoteSaving(false);
    }
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
              <Select value={selectedSemester} onValueChange={(value) => setSelectedSemester(value as 'HK1' | 'HK2' | 'CN')}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HK1">Học kỳ 1</SelectItem>
                  <SelectItem value="HK2">Học kỳ 2</SelectItem>
                  <SelectItem value="CN">Cuối năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Nút hành động tổng */}
      {timeInfo?.allowed && conducts.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
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
            disabled={disableSubmitAll}
            variant="default"
            className={disableSubmitAll ? 'opacity-70 pointer-events-none' : undefined}
          >
            <Send className="h-4 w-4 mr-2" />
            Gửi phê duyệt tất cả ({submitReadyCount})
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
                    <TableHead>Hạnh kiểm</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead>Nhận xét GVCN</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conducts.map((record, index) => {
                    const rowKey = getRecordKey(record);
                    const isLocked = record.conductStatus === 'locked';
                    const canEditConduct = !isLocked && (timeInfo?.allowed || record.conductStatus === 'pending');
                    const isSavingThis = savingConductId === rowKey;
                    const currentConductValue = record.conductDraft ?? record.conduct ?? '';

                    return (
                      <TableRow key={rowKey}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{record.studentId.studentCode}</TableCell>
                        <TableCell className="font-medium">{record.studentId.name}</TableCell>
                        <TableCell>
                          {isLocked ? (
                            record.conduct
                              ? getConductBadge(record.conduct)
                              : <Badge variant="outline">Chưa có</Badge>
                          ) : (
                            <Select
                              value={currentConductValue}
                              onValueChange={(value) => handleConductSelect(record, value)}
                              disabled={!canEditConduct || isSavingThis}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Chưa xếp loại" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Tốt">Tốt</SelectItem>
                                <SelectItem value="Khá">Khá</SelectItem>
                                <SelectItem value="Trung bình">Trung bình</SelectItem>
                                <SelectItem value="Yếu">Yếu</SelectItem>
                              </SelectContent>
                            </Select>
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
                        <TableCell className="max-w-xs">
                          {record.note ? (
                            <p className="text-sm truncate" title={record.note || undefined}>
                              {record.note}
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-sm">Chưa có</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(record.conductStatus)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openNoteDialog(record)}
                            >
                              <MessageSquare className="h-3.5 w-3.5 mr-1" />
                              Nhận xét HK
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openConductNoteDialog(record)}
                              disabled={isLocked}
                            >
                              {record.conductNote ? 'Ghi chú' : 'Thêm ghi chú'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ Dialog nhập nhận xét GVCN */}
      <Dialog
        open={noteDialogOpen}
        onOpenChange={(open) => {
          setNoteDialogOpen(open);
          if (!open) {
            setNoteRecord(null);
            setNoteContent('');
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nhận xét học sinh</DialogTitle>
            <DialogDescription>
              {noteRecord?.studentId.name} ({noteRecord?.studentId.studentCode}) · Học kỳ {selectedSemester === 'HK1' ? '1' : '2'} · Năm học {selectedYear}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nhận xét</Label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={5}
                placeholder="Nhập nhận xét về học tập, rèn luyện của học sinh..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNoteDialogOpen(false);
                setNoteRecord(null);
                setNoteContent('');
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleNoteSave} disabled={noteSaving || !noteRecord}>
              {noteSaving ? 'Đang lưu...' : 'Lưu nhận xét'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ Dialog ghi chú hạnh kiểm (lưu nháp) */}
      <Dialog
        open={conductNoteDialogOpen}
        onOpenChange={(open) => {
          setConductNoteDialogOpen(open);
          if (!open) {
            setConductNoteRecord(null);
            setConductNoteValue('');
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ghi chú hạnh kiểm</DialogTitle>
            <DialogDescription>
              {conductNoteRecord?.studentId.name} ({conductNoteRecord?.studentId.studentCode}) · Học kỳ {selectedSemester === 'HK1' ? '1' : '2'} · Năm học {selectedYear}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={conductNoteValue}
              onChange={(e) => setConductNoteValue(e.target.value)}
              rows={4}
              placeholder="Nhập ghi chú về hạnh kiểm..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConductNoteDialogOpen(false);
                setConductNoteRecord(null);
                setConductNoteValue('');
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleConductNoteSave} disabled={conductNoteSaving || !conductNoteRecord}>
              {conductNoteSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

