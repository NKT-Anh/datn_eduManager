import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSchoolYears } from '@/hooks';
import { SchoolYear } from '@/services/schoolYearApi';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Search,
  AlertCircle,
  XCircle,
  Star,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminOrBGH } from '@/utils/permissions';

const SchoolYearPageContent = () => {
  const { toast } = useToast();
  const { backendUser } = useAuth();
  
  // ✅ Sử dụng hooks
  const { 
    schoolYears, 
    isLoading: loading, 
    create: createSchoolYear, 
    update: updateSchoolYear, 
    remove: removeSchoolYear, 
    activate: activateSchoolYear,
    deactivate: deactivateSchoolYear,
    updateStatus: updateSchoolYearStatus,
  } = useSchoolYears();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<SchoolYear | null>(null);
  const [deletingYear, setDeletingYear] = useState<SchoolYear | null>(null);
  const [activatingYear, setActivatingYear] = useState<SchoolYear | null>(null);
  const [deactivatingYear, setDeactivatingYear] = useState<SchoolYear | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    startDate: '',
    endDate: '',
    semester1StartDate: '',
    semester1EndDate: '',
    semester2StartDate: '',
    semester2EndDate: '',
    isActive: false,
  });

  // ✅ Admin và BGH có quyền quản lý
  const canManage = isAdminOrBGH(backendUser);

  // Format date từ YYYY-MM-DD sang dd/mm/yyyy
  const formatDateToDDMMYYYY = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  // Parse date từ dd/mm/yyyy sang YYYY-MM-DD (cho API)
  const parseDateFromDDMMYYYY = (dateString: string): string => {
    if (!dateString) return '';
    // Format: dd/mm/yyyy
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateString;
  };

  // Validate format dd/mm/yyyy
  const isValidDateFormat = (dateString: string): boolean => {
    const pattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!pattern.test(dateString)) return false;
    const parts = dateString.split('/');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  };

  // Tự động tạo ngày từ code năm học (VD: 2024-2025 -> 01/09/2024 - 31/05/2025)
  const generateDatesFromCode = (code: string) => {
    const codePattern = /^(\d{4})-(\d{4})$/;
    const match = code.match(codePattern);
    if (match) {
      const startYear = parseInt(match[1]);
      const endYear = parseInt(match[2]);
      // Ngày bắt đầu: 1 tháng 9 năm đầu (format dd/mm/yyyy)
      const startDate = `01/09/${startYear}`;
      // Ngày kết thúc: 31 tháng 5 năm sau (format dd/mm/yyyy)
      const endDate = `31/05/${endYear}`;
      // Học kỳ 1: 01/09 - 31/12 năm đầu
      const semester1StartDate = `01/09/${startYear}`;
      const semester1EndDate = `31/12/${startYear}`;
      // Học kỳ 2: 01/01 - 31/05 năm sau
      const semester2StartDate = `01/01/${endYear}`;
      const semester2EndDate = `31/05/${endYear}`;
      return { 
        startDate, 
        endDate, 
        semester1StartDate, 
        semester1EndDate, 
        semester2StartDate, 
        semester2EndDate 
      };
    }
    return { 
      startDate: '', 
      endDate: '', 
      semester1StartDate: '', 
      semester1EndDate: '', 
      semester2StartDate: '', 
      semester2EndDate: '' 
    };
  };

  // Mở form tạo mới
  const handleCreate = () => {
    setEditingYear(null);
    setFormData({
      name: '',
      code: '',
      startDate: '',
      endDate: '',
      semester1StartDate: '',
      semester1EndDate: '',
      semester2StartDate: '',
      semester2EndDate: '',
      isActive: false,
    });
    setIsFormOpen(true);
  };

  // Mở form chỉnh sửa
  const handleEdit = (year: SchoolYear) => {
    setEditingYear(year);
    const semester1 = year.semesters?.find(s => s.code === 'HK1');
    const semester2 = year.semesters?.find(s => s.code === 'HK2');
    
    setFormData({
      name: year.name,
      code: year.code,
      startDate: year.startDate ? formatDateToDDMMYYYY(year.startDate) : '',
      endDate: year.endDate ? formatDateToDDMMYYYY(year.endDate) : '',
      semester1StartDate: semester1?.startDate ? formatDateToDDMMYYYY(semester1.startDate) : '',
      semester1EndDate: semester1?.endDate ? formatDateToDDMMYYYY(semester1.endDate) : '',
      semester2StartDate: semester2?.startDate ? formatDateToDDMMYYYY(semester2.startDate) : '',
      semester2EndDate: semester2?.endDate ? formatDateToDDMMYYYY(semester2.endDate) : '',
      isActive: year.isActive,
    });
    setIsFormOpen(true);
  };

  // Lưu năm học
  const handleSave = async () => {
    if (!formData.name || !formData.code || !formData.startDate || !formData.endDate) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền đầy đủ thông tin năm học',
        variant: 'destructive',
      });
      return;
    }

    // Validate học kỳ
    if (!formData.semester1StartDate || !formData.semester1EndDate || 
        !formData.semester2StartDate || !formData.semester2EndDate) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền đầy đủ thông tin học kỳ',
        variant: 'destructive',
      });
      return;
    }

    // Validate code format: YYYY-YYYY
    const codePattern = /^\d{4}-\d{4}$/;
    if (!codePattern.test(formData.code)) {
      toast({
        title: 'Lỗi',
        description: 'Mã năm học phải có định dạng YYYY-YYYY (VD: 2024-2025)',
        variant: 'destructive',
      });
      return;
    }

    // Validate date format dd/mm/yyyy
    const dateFields = [
      { field: formData.startDate, name: 'Ngày bắt đầu năm học' },
      { field: formData.endDate, name: 'Ngày kết thúc năm học' },
      { field: formData.semester1StartDate, name: 'Ngày bắt đầu học kỳ 1' },
      { field: formData.semester1EndDate, name: 'Ngày kết thúc học kỳ 1' },
      { field: formData.semester2StartDate, name: 'Ngày bắt đầu học kỳ 2' },
      { field: formData.semester2EndDate, name: 'Ngày kết thúc học kỳ 2' },
    ];

    for (const { field, name } of dateFields) {
      if (!isValidDateFormat(field)) {
        toast({
          title: 'Lỗi',
          description: `${name} phải có định dạng dd/mm/yyyy (VD: 01/09/2024)`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Parse dates từ dd/mm/yyyy sang YYYY-MM-DD cho API
    const startDateISO = parseDateFromDDMMYYYY(formData.startDate);
    const endDateISO = parseDateFromDDMMYYYY(formData.endDate);
    const semester1StartISO = parseDateFromDDMMYYYY(formData.semester1StartDate);
    const semester1EndISO = parseDateFromDDMMYYYY(formData.semester1EndDate);
    const semester2StartISO = parseDateFromDDMMYYYY(formData.semester2StartDate);
    const semester2EndISO = parseDateFromDDMMYYYY(formData.semester2EndDate);

    // Validate dates
    const start = new Date(startDateISO);
    const end = new Date(endDateISO);
    if (end <= start) {
      toast({
        title: 'Lỗi',
        description: 'Ngày kết thúc năm học phải sau ngày bắt đầu',
        variant: 'destructive',
      });
      return;
    }

    // Validate học kỳ 1
    const sem1Start = new Date(semester1StartISO);
    const sem1End = new Date(semester1EndISO);
    if (sem1End <= sem1Start) {
      toast({
        title: 'Lỗi',
        description: 'Ngày kết thúc học kỳ 1 phải sau ngày bắt đầu',
        variant: 'destructive',
      });
      return;
    }
    if (sem1Start < start || sem1End > end) {
      toast({
        title: 'Lỗi',
        description: 'Học kỳ 1 phải nằm trong khoảng thời gian của năm học',
        variant: 'destructive',
      });
      return;
    }

    // Validate học kỳ 2
    const sem2Start = new Date(semester2StartISO);
    const sem2End = new Date(semester2EndISO);
    if (sem2End <= sem2Start) {
      toast({
        title: 'Lỗi',
        description: 'Ngày kết thúc học kỳ 2 phải sau ngày bắt đầu',
        variant: 'destructive',
      });
      return;
    }
    if (sem2Start < start || sem2End > end) {
      toast({
        title: 'Lỗi',
        description: 'Học kỳ 2 phải nằm trong khoảng thời gian của năm học',
        variant: 'destructive',
      });
      return;
    }

    // Tạo mảng semesters
    const semesters = [
      {
        name: 'Học kỳ 1',
        code: 'HK1',
        startDate: semester1StartISO,
        endDate: semester1EndISO,
      },
      {
        name: 'Học kỳ 2',
        code: 'HK2',
        startDate: semester2StartISO,
        endDate: semester2EndISO,
      },
    ];

    try {
      const dataToSave = {
        name: formData.name,
        code: formData.code,
        startDate: startDateISO,
        endDate: endDateISO,
        semesters,
        isActive: formData.isActive,
      };

      if (editingYear) {
        await updateSchoolYear({ id: editingYear._id, data: dataToSave });
        toast({
          title: 'Thành công',
          description: 'Cập nhật năm học thành công',
        });
      } else {
        await createSchoolYear(dataToSave);
        toast({
          title: 'Thành công',
          description: 'Tạo năm học thành công',
        });
      }
      setIsFormOpen(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể lưu năm học',
        variant: 'destructive',
      });
    }
  };

  // Mở dialog xác nhận kích hoạt
  const handleActivateClick = (year: SchoolYear) => {
    setActivatingYear(year);
    setIsActivateDialogOpen(true);
  };

  // Kích hoạt năm học
  const handleActivate = async () => {
    if (!activatingYear) return;

    try {
      await activateSchoolYear(activatingYear._id);
      toast({
        title: 'Thành công',
        description: `Đã đặt ${activatingYear.name} làm năm học hiện tại`,
      });
      setIsActivateDialogOpen(false);
      setActivatingYear(null);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể kích hoạt năm học',
        variant: 'destructive',
      });
    }
  };

  // Mở dialog xác nhận ngừng kích hoạt
  const handleDeactivateClick = (year: SchoolYear) => {
    setDeactivatingYear(year);
    setIsDeactivateDialogOpen(true);
  };

  // Ngừng kích hoạt năm học
  const handleDeactivate = async () => {
    if (!deactivatingYear) return;

    try {
      await deactivateSchoolYear(deactivatingYear._id);
      toast({
        title: 'Thành công',
        description: `Đã ngừng kích hoạt năm học ${deactivatingYear.name}`,
      });
      setIsDeactivateDialogOpen(false);
      setDeactivatingYear(null);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể ngừng kích hoạt năm học',
        variant: 'destructive',
      });
    }
  };

  // Xóa năm học
  const handleDelete = async () => {
    if (!deletingYear) return;

    try {
      await removeSchoolYear(deletingYear._id);
      toast({
        title: 'Thành công',
        description: 'Xóa năm học thành công',
      });
      setIsDeleteDialogOpen(false);
      setDeletingYear(null);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể xóa năm học',
        variant: 'destructive',
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Lọc danh sách
  const filteredYears = schoolYears.filter((year) =>
    year.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    year.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Lấy danh sách học kỳ
  const getSemestersDisplay = (year: SchoolYear) => {
    if (!year.semesters || year.semesters.length === 0) {
      return '-';
    }
    return year.semesters.map((s) => s.name).join(', ');
  };

  // Cập nhật trạng thái năm học
  const handleUpdateSchoolYearStatus = async (
    yearId: string,
    newStatus: 'upcoming' | 'active' | 'inactive'
  ) => {
    try {
      await updateSchoolYearStatus({ id: yearId, status: newStatus });
      toast({
        title: 'Thành công',
        description: `Đã cập nhật trạng thái năm học`,
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể cập nhật trạng thái năm học',
        variant: 'destructive',
      });
    }
  };


  // Lấy text trạng thái năm học
  const getSchoolYearStatusText = (status?: string) => {
    switch (status) {
      case 'active':
        return 'Đang diễn ra';
      case 'inactive':
        return 'Đã kết thúc';
      case 'upcoming':
      default:
        return 'Chưa bắt đầu';
    }
  };

  // Lấy màu badge theo trạng thái năm học
  const getSchoolYearStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'active':
        return 'default'; // Xanh
      case 'inactive':
        return 'secondary'; // Xám
      case 'upcoming':
      default:
        return 'outline'; // Viền
    }
  };


  // ✅ Lấy năm học hiện tại (isActive: true)
  const currentActiveYear = schoolYears.find((y) => y.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý năm học</h1>
          <p className="text-muted-foreground">Quản lý các năm học trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Thêm năm học
            </Button>
          )}
        </div>
      </div>

      {/* ✅ Card hiển thị năm học hiện tại */}
      {currentActiveYear && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Năm học hiện tại
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Thông tin năm học */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Năm học</p>
                <p className="text-lg font-bold">{currentActiveYear.name}</p>
                <p className="text-sm text-muted-foreground font-mono">{currentActiveYear.code}</p>
              </div>

              {/* Học kỳ 1 */}
              {(() => {
                const semester1 = currentActiveYear.semesters?.find(
                  (s) => s.code === 'HK1' || s.code === '1' || s.name?.toLowerCase().includes('học kỳ 1') || s.name?.toLowerCase().includes('học kì 1')
                );
                return semester1 ? (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Học kỳ 1</p>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Bắt đầu:</span>{' '}
                        {semester1.startDate ? formatDateToDDMMYYYY(String(semester1.startDate)) : '-'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Kết thúc:</span>{' '}
                        {semester1.endDate ? formatDateToDDMMYYYY(String(semester1.endDate)) : '-'}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Học kỳ 2 */}
              {(() => {
                const semester2 = currentActiveYear.semesters?.find(
                  (s) => s.code === 'HK2' || s.code === '2' || s.name?.toLowerCase().includes('học kỳ 2') || s.name?.toLowerCase().includes('học kì 2')
                );
                return semester2 ? (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Học kỳ 2</p>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Bắt đầu:</span>{' '}
                        {semester2.startDate ? formatDateToDDMMYYYY(String(semester2.startDate)) : '-'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Kết thúc:</span>{' '}
                        {semester2.endDate ? formatDateToDDMMYYYY(String(semester2.endDate)) : '-'}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên hoặc mã năm học..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bảng danh sách năm học */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách năm học</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Năm học</TableHead>
                  <TableHead>Ngày bắt đầu</TableHead>
                  <TableHead>Ngày kết thúc</TableHead>
                  <TableHead>Học kỳ</TableHead>
                  <TableHead>Trạng thái năm học</TableHead>
                  <TableHead>Kích hoạt</TableHead>
                  <TableHead>Hiện tại</TableHead>
                  {canManage && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredYears.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 8 : 7} className="text-center py-8">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Không tìm thấy năm học nào</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredYears.map((year) => (
                    <TableRow key={year._id} className={year.isActive ? 'bg-primary/5' : ''}>
                      <TableCell className="font-semibold">
                        <div>
                          <div>{year.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{year.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(year.startDate)}</TableCell>
                      <TableCell>{formatDate(year.endDate)}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {year.semesters && year.semesters.length > 0 ? (
                            year.semesters.map((semester) => (
                              <div key={semester.code} className="text-sm">
                                <span className="font-medium">{semester.name}</span>
                                <span className="text-muted-foreground ml-2">
                                  ({formatDate(semester.startDate)} - {formatDate(semester.endDate)})
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <Select
                            value={year.status || 'upcoming'}
                            onValueChange={(value: 'upcoming' | 'active' | 'inactive') =>
                              handleUpdateSchoolYearStatus(year._id, value)
                            }
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upcoming">Chưa bắt đầu</SelectItem>
                              <SelectItem value="active">Đang diễn ra</SelectItem>
                              <SelectItem value="inactive">Đã kết thúc</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getSchoolYearStatusBadgeVariant(year.status)}>
                            {getSchoolYearStatusText(year.status)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <Switch
                            checked={year.isActive}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleActivateClick(year);
                              } else {
                                handleDeactivateClick(year);
                              }
                            }}
                            disabled={loading}
                          />
                        ) : (
                          <Badge variant={year.isActive ? 'default' : 'secondary'}>
                            {year.isActive ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {year.isActive ? (
                          <Badge variant="default" className="bg-primary">
                            <Star className="h-3 w-3 mr-1" />
                            Hiện tại
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(year)}
                              title="Chỉnh sửa"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {!year.isActive && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setDeletingYear(year);
                                  setIsDeleteDialogOpen(true);
                                }}
                                title="Xóa"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog tạo/sửa năm học */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingYear ? '✏️ Chỉnh sửa năm học' : '➕ Thêm năm học'}
            </DialogTitle>
            <DialogDescription>
              {editingYear
                ? 'Cập nhật thông tin năm học'
                : 'Nhập thông tin để tạo năm học mới'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Tên năm học *</Label>
              <Input
                placeholder="VD: Năm học 2024 - 2025"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Mã năm học *</Label>
              <Input
                placeholder="VD: 2024-2025"
                value={formData.code}
                onChange={(e) => {
                  const newCode = e.target.value;
                  
                  // Tự động điền ngày và tên nếu code hợp lệ (chỉ khi tạo mới)
                  if (!editingYear && newCode.match(/^\d{4}-\d{4}$/)) {
                    const dates = generateDatesFromCode(newCode);
                    const match = newCode.match(/^(\d{4})-(\d{4})$/);
                    
                    setFormData(prev => ({
                      ...prev,
                      code: newCode,
                      startDate: dates.startDate || prev.startDate,
                      endDate: dates.endDate || prev.endDate,
                      semester1StartDate: dates.semester1StartDate || prev.semester1StartDate,
                      semester1EndDate: dates.semester1EndDate || prev.semester1EndDate,
                      semester2StartDate: dates.semester2StartDate || prev.semester2StartDate,
                      semester2EndDate: dates.semester2EndDate || prev.semester2EndDate,
                      name: prev.name || (match ? `Năm học ${match[1]} - ${match[2]}` : prev.name),
                    }));
                  } else {
                    // Chỉ cập nhật code nếu không hợp lệ
                    setFormData(prev => ({ ...prev, code: newCode }));
                  }
                }}
                pattern="\d{4}-\d{4}"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Định dạng: YYYY-YYYY (VD: 2024-2025). Ngày sẽ tự động điền: 01/09 năm đầu - 31/05 năm sau
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Năm học</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label>Ngày bắt đầu năm học *</Label>
                    <Input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Định dạng: dd/mm/yyyy (VD: 01/09/2024)
                    </p>
                  </div>
                  <div>
                    <Label>Ngày kết thúc năm học *</Label>
                    <Input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Định dạng: dd/mm/yyyy (VD: 31/05/2025)
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Học kỳ 1</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label>Ngày bắt đầu học kỳ 1 *</Label>
                    <Input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={formData.semester1StartDate}
                      onChange={(e) => setFormData({ ...formData, semester1StartDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Định dạng: dd/mm/yyyy (VD: 01/09/2024)
                    </p>
                  </div>
                  <div>
                    <Label>Ngày kết thúc học kỳ 1 *</Label>
                    <Input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={formData.semester1EndDate}
                      onChange={(e) => setFormData({ ...formData, semester1EndDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Định dạng: dd/mm/yyyy (VD: 31/12/2024)
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Học kỳ 2</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label>Ngày bắt đầu học kỳ 2 *</Label>
                    <Input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={formData.semester2StartDate}
                      onChange={(e) => setFormData({ ...formData, semester2StartDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Định dạng: dd/mm/yyyy (VD: 01/01/2025)
                    </p>
                  </div>
                  <div>
                    <Label>Ngày kết thúc học kỳ 2 *</Label>
                    <Input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={formData.semester2EndDate}
                      onChange={(e) => setFormData({ ...formData, semester2EndDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Định dạng: dd/mm/yyyy (VD: 31/05/2025)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => {
                  // Khi bật switch, tự động điền ngày nếu chưa có
                  if (checked && (!formData.startDate || !formData.endDate || 
                      !formData.semester1StartDate || !formData.semester1EndDate ||
                      !formData.semester2StartDate || !formData.semester2EndDate)) {
                    if (formData.code && formData.code.match(/^\d{4}-\d{4}$/)) {
                      const dates = generateDatesFromCode(formData.code);
                      setFormData({
                        ...formData,
                        isActive: checked,
                        startDate: formData.startDate || dates.startDate,
                        endDate: formData.endDate || dates.endDate,
                        semester1StartDate: formData.semester1StartDate || dates.semester1StartDate,
                        semester1EndDate: formData.semester1EndDate || dates.semester1EndDate,
                        semester2StartDate: formData.semester2StartDate || dates.semester2StartDate,
                        semester2EndDate: formData.semester2EndDate || dates.semester2EndDate,
                      });
                    } else {
                      setFormData({ ...formData, isActive: checked });
                    }
                  } else {
                    setFormData({ ...formData, isActive: checked });
                  }
                }}
              />
              <Label htmlFor="isActive">Kích hoạt năm học này</Label>
            </div>
            {formData.isActive && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Năm học khác sẽ tự động bị tắt khi kích hoạt năm học này
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Đang lưu...' : editingYear ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận xóa */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Xác nhận xóa
            </DialogTitle>
            <DialogDescription className="pt-2">
              Bạn có chắc chắn muốn xóa năm học <strong>"{deletingYear?.name}"</strong>?
              <br />
              <span className="text-destructive font-medium">Hành động này không thể hoàn tác.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingYear(null);
              }}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận kích hoạt */}
      <Dialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Xác nhận kích hoạt
            </DialogTitle>
            <DialogDescription className="pt-2">
              Bạn có chắc chắn muốn đặt năm học <strong>"{activatingYear?.name}"</strong> làm năm học hiện tại?
              <br />
              <span className="text-muted-foreground text-sm mt-2 block">
                Năm học khác sẽ tự động bị tắt khi kích hoạt năm học này.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsActivateDialogOpen(false);
                setActivatingYear(null);
              }}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button onClick={handleActivate} disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận ngừng kích hoạt */}
      <Dialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-orange-500" />
              Xác nhận ngừng kích hoạt
            </DialogTitle>
            <DialogDescription className="pt-2">
              Bạn có chắc chắn muốn ngừng kích hoạt năm học <strong>"{deactivatingYear?.name}"</strong>?
              <br />
              <span className="text-muted-foreground text-sm mt-2 block">
                Sau khi ngừng kích hoạt, hệ thống sẽ không có năm học nào đang hoạt động.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeactivateDialogOpen(false);
                setDeactivatingYear(null);
              }}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button variant="outline" onClick={handleDeactivate} disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SchoolYearPage = () => {
  return <SchoolYearPageContent />;
};

export default SchoolYearPage;
