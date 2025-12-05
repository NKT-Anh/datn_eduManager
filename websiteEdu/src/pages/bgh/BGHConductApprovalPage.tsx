/**
 * Trang phê duyệt hạnh kiểm cho BGH
 * - Xem toàn bộ hạnh kiểm chờ phê duyệt
 * - Comment / yêu cầu chỉnh sửa
 * - Chốt dữ liệu
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import conductApi from '@/services/conductApi';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle, 
  Lock, 
  MessageSquare,
  Users,
  Filter
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { isAdminOrBGH } from '@/utils/permissions';

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
  conductNote: string;
  conductStatus: 'draft' | 'pending' | 'approved' | 'locked';
  conductComment?: string;
  conductApprovedBy?: {
    name: string;
  };
  conductApprovedAt?: string;
  conductLockedAt?: string;
  homeroomTeacherId?: {
    name: string;
  };
}

export default function BGHConductApprovalPage() {
  const { backendUser } = useAuth();
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { currentYearCode, currentYearData } = useCurrentAcademicYear();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('pending'); // 'pending' | 'approved' | 'all'
  const [conducts, setConducts] = useState<ConductRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ConductRecord | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'lock'>('approve');
  const [approvalComment, setApprovalComment] = useState('');

  const canApprove = isAdminOrBGH(backendUser);

  // ✅ Set năm học hiện tại khi có dữ liệu
  useEffect(() => {
    if (currentYearCode && !selectedYear) {
      setSelectedYear(currentYearCode);
    }
  }, [currentYearCode, selectedYear]);

  // ✅ Lấy danh sách hạnh kiểm
  useEffect(() => {
    if (selectedYear) {
      fetchConducts();
    }
  }, [selectedYear, selectedSemester, statusFilter]);

  const fetchConducts = async () => {
    if (!selectedYear) return;
    
    try {
      setLoading(true);
      let data: ConductRecord[] = [];
      
      if (statusFilter === 'pending') {
        // Lấy danh sách chờ phê duyệt
        const res = await conductApi.getPendingConducts({
          year: selectedYear,
          semester: selectedSemester === 'ALL' ? undefined : selectedSemester,
        });
        data = res.data || [];
      } else {
        // Lấy tất cả (có thể filter theo status sau)
        const res = await conductApi.getConducts({
          year: selectedYear,
          semester: selectedSemester === 'ALL' ? undefined : selectedSemester,
        });
        data = res.data || [];
        
        // Filter theo status
        if (statusFilter === 'approved') {
          data = data.filter(c => c.conductStatus === 'approved' || c.conductStatus === 'locked');
        } else if (statusFilter === 'all') {
          // Giữ nguyên tất cả
        }
      }
      
      setConducts(data);
      setSelectedIds([]);
    } catch (error: any) {
      console.error('Error fetching conducts:', error);
      toast.error(error.response?.data?.error || 'Không thể tải danh sách hạnh kiểm');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRecord) return;
    
    try {
      setProcessing(true);
      await conductApi.approveConduct(selectedRecord._id, {
        action: approvalAction,
        comment: approvalComment || undefined
      });
      
      toast.success(
        approvalAction === 'approve' ? 'Đã phê duyệt hạnh kiểm' :
        approvalAction === 'reject' ? 'Đã yêu cầu chỉnh sửa' :
        'Đã chốt hạnh kiểm'
      );
      
      setApprovalDialogOpen(false);
      setSelectedRecord(null);
      setApprovalComment('');
      fetchConducts();
    } catch (error: any) {
      console.error('Error approving conduct:', error);
      toast.error(error.response?.data?.error || 'Không thể xử lý yêu cầu');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveAll = async () => {
    if (!selectedYear || conducts.length === 0 || statusFilter !== 'pending') return;
    try {
      setProcessing(true);
      await conductApi.bulkApproveConducts({
        action: 'approve',
        year: selectedYear,
        semester: selectedSemester === 'ALL' ? undefined : selectedSemester,
      });
      toast.success('Đã phê duyệt tất cả hạnh kiểm đang chờ phê duyệt');
      fetchConducts();
    } catch (error: any) {
      console.error('Error bulk approving conducts:', error);
      toast.error(error.response?.data?.error || 'Không thể phê duyệt tất cả hạnh kiểm');
    } finally {
      setProcessing(false);
    }
  };

  // Chốt tất cả hạnh kiểm đã phê duyệt
  const handleLockAll = async () => {
    if (!selectedYear || conducts.length === 0 || statusFilter !== 'approved') return;
    try {
      setProcessing(true);
      await conductApi.bulkApproveConducts({
        action: 'lock',
        year: selectedYear,
        semester: selectedSemester === 'ALL' ? undefined : selectedSemester,
      });
      toast.success('Đã chốt tất cả hạnh kiểm đã phê duyệt');
      fetchConducts();
    } catch (error: any) {
      console.error('Error bulk locking conducts:', error);
      toast.error(error.response?.data?.error || 'Không thể chốt tất cả hạnh kiểm');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveSelected = async () => {
    if (!selectedYear || selectedIds.length === 0 || statusFilter !== 'pending') return;
    try {
      setProcessing(true);
      await conductApi.bulkApproveConducts({
        action: 'approve',
        year: selectedYear,
        semester: selectedSemester === 'ALL' ? undefined : selectedSemester,
        ids: selectedIds,
      });

      toast.success(`Đã phê duyệt ${selectedIds.length} bản ghi đã chọn`);
      setSelectedIds([]);
      fetchConducts();
    } catch (error: any) {
      console.error('Error bulk approving selected conducts:', error);
      toast.error(error.response?.data?.error || 'Không thể phê duyệt các bản ghi đã chọn');
    } finally {
      setProcessing(false);
    }
  };

  const allSelectableIds = conducts.map((c) => c._id);
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allSelectableIds);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openApprovalDialog = (record: ConductRecord, action: 'approve' | 'reject' | 'lock') => {
    setSelectedRecord(record);
    setApprovalAction(action);
    setApprovalComment(record.conductComment || '');
    setApprovalDialogOpen(true);
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && conducts.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phê duyệt hạnh kiểm</h1>
          <p className="text-muted-foreground">
            Xem và phê duyệt hạnh kiểm học sinh
          </p>
        </div>
      </div>

      {/* ✅ Bộ lọc */}
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-4 gap-4">
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
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  <SelectItem value="HK1">Học kỳ 1</SelectItem>
                  <SelectItem value="HK2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trạng thái</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Chờ phê duyệt</SelectItem>
                  <SelectItem value="approved">Đã phê duyệt</SelectItem>
                  <SelectItem value="all">Tất cả</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchConducts} variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Lọc
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Bảng danh sách */}
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Danh sách hạnh kiểm ({conducts.length})
          </CardTitle>
          {statusFilter === 'pending' && conducts.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleApproveAll}
                disabled={!canApprove || statusFilter !== 'pending'}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Phê duyệt tất cả
              </Button>
              <Button
                variant="default"
                onClick={handleApproveSelected}
                disabled={processing || selectedIds.length === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Phê duyệt đã chọn
              </Button>
            </div>
          )}
          {statusFilter === 'approved' && conducts.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleLockAll}
                disabled={processing}
              >
                <Lock className="h-4 w-4 mr-2" />
                Chốt tất cả
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Đang tải...</div>
          ) : conducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có dữ liệu
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      {statusFilter === 'pending' && conducts.length > 0 && (
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Chọn tất cả"
                        />
                      )}
                    </TableHead>
                    <TableHead>STT</TableHead>
                    <TableHead>Mã HS</TableHead>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Học kỳ</TableHead>
                    <TableHead>Hạnh kiểm</TableHead>
                    <TableHead>Ghi chú GVCN</TableHead>
                    <TableHead>GVCN</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conducts.map((record, index) => (
                    <TableRow key={record._id}>
                      <TableCell>
                        {statusFilter === 'pending' && (
                          <Checkbox
                            checked={selectedIds.includes(record._id)}
                            onCheckedChange={() => toggleSelectOne(record._id)}
                            aria-label="Chọn bản ghi"
                          />
                        )}
                      </TableCell>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{record.studentId.studentCode}</TableCell>
                      <TableCell className="font-medium">{record.studentId.name}</TableCell>
                      <TableCell>{record.classId.className}</TableCell>
                      <TableCell>{record.semester}</TableCell>
                      <TableCell>{getConductBadge(record.conduct)}</TableCell>
                      <TableCell className="max-w-xs">
                        {record.conductNote ? (
                          <p className="text-sm truncate" title={record.conductNote}>
                            {record.conductNote}
                          </p>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.homeroomTeacherId?.name || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.conductStatus)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {record.conductStatus === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openApprovalDialog(record, 'approve')}
                                disabled={!canApprove || processing}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openApprovalDialog(record, 'reject')}
                                disabled={processing}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {record.conductStatus === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openApprovalDialog(record, 'lock')}
                              disabled={processing}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <Lock className="h-4 w-4" />
                            </Button>
                          )}
                          {record.conductComment && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRecord(record);
                                setApprovalComment(record.conductComment || '');
                                setApprovalDialogOpen(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* ✅ Dialog phê duyệt */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Phê duyệt hạnh kiểm' :
               approvalAction === 'reject' ? 'Yêu cầu chỉnh sửa' :
               'Chốt hạnh kiểm'}
            </DialogTitle>
            <DialogDescription>
              {selectedRecord && (
                <>
                  Học sinh: {selectedRecord.studentId.name} ({selectedRecord.studentId.studentCode})<br />
                  Lớp: {selectedRecord.classId.className} - {selectedRecord.semester}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nhận xét / Ghi chú</Label>
              <Textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder={
                  approvalAction === 'approve' ? 'Nhập nhận xét (tùy chọn)' :
                  approvalAction === 'reject' ? 'Yêu cầu chỉnh sửa...' :
                  'Ghi chú khi chốt...'
                }
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setApprovalDialogOpen(false);
                setSelectedRecord(null);
                setApprovalComment('');
              }}>
                Hủy
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processing}
                className={
                  approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  approvalAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-orange-600 hover:bg-orange-700'
                }
              >
                {processing ? 'Đang xử lý...' :
                 approvalAction === 'approve' ? 'Phê duyệt' :
                 approvalAction === 'reject' ? 'Yêu cầu chỉnh sửa' :
                 'Chốt'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

