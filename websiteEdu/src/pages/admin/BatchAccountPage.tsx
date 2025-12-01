import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Plus, Search, X, CheckCircle2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import userApi from '@/services/userApi';
import studentApi from '@/services/studentApi';
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useTeachers, useStudents } from '@/hooks';
import api from '@/services/axiosInstance';
import settingApi from '@/services/settingApi';

type TabType = 'student' | 'teacher' | 'admin' | 'homeroom' | 'departmentHead' | 'leader' | 'accounts';

const BatchAccountPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  
  // ✅ Kiểm tra quyền BGH
  const { isBGH, hasPermission, PERMISSIONS } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.USER_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.USER_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.USER_DELETE);
  
  // ✅ Sử dụng hooks
  const { students, refetch: refetchStudents } = useStudents();
  const { teachers, refetch: refetchTeachers, create: createTeacher } = useTeachers();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  // ✅ Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // ✅ Sort state
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // ✅ Filter: Chỉ hiển thị những người chưa có tài khoản
  const [filterNoAccount, setFilterNoAccount] = useState(false);
  const [result, setResult] = useState<any>({});
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; title: string; message: string } | null>(null);
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false);
  const [selectedUserForAccount, setSelectedUserForAccount] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  
  // Form state cho tạo tài khoản
  const [formRole, setFormRole] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [isManualCreateDialogOpen, setIsManualCreateDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);

  // 🧠 Load danh sách tương ứng
  // Load settings
  useEffect(() => {
    settingApi.getSettings()
      .then((res) => setSettings(res.data || res))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    setAlert(null);
    setSearch('');

    // ✅ Không cần fetch nữa vì đã dùng hooks
    // Hook sẽ tự động load data
    if (activeTab === 'student') {
      refetchStudents();
    } else if (activeTab === 'teacher' || activeTab === 'admin' || ['homeroom', 'departmentHead', 'leader'].includes(activeTab)) {
      refetchTeachers();
    } else {
      userApi
        .getAllAccounts()
        .then((res) => setAccounts(res.data || []))
        .catch(() =>
          toast({
            title: 'Lỗi',
            description: 'Không lấy được danh sách tài khoản',
            variant: 'destructive',
          })
        );
    }
  }, [activeTab, toast]);

  // ✅ Helper: tìm account theo linkedId
  const getAccountByLinkedId = (id: string) => {
    return (
      accounts.find((a) => a.linkedId?.toString() === id?.toString()) || null
    );
  };

  // ✅ Helper: lấy teacher flags từ teacher object
  const getTeacherFlags = (teacher: any) => {
    return {
      isHomeroom: teacher.isHomeroom || false,
      isDepartmentHead: teacher.isDepartmentHead || false,
      isLeader: teacher.isLeader || false,
    };
  };

  // 🔍 Lọc danh sách theo search, flags và filter "chưa có tài khoản"
  const filteredData = useMemo(() => {
    const lower = search.toLowerCase();
    let data: any[] = [];
    
    if (activeTab === 'student') {
      data = students.filter((s) => s.name?.toLowerCase().includes(lower));
    } else if (activeTab === 'teacher') {
      // Lọc giáo viên không có flags đặc biệt (chỉ là giáo viên bộ môn thông thường)
      data = teachers.filter((t) => {
        const flags = getTeacherFlags(t);
        const hasNoSpecialFlags = !flags.isHomeroom && !flags.isDepartmentHead && !flags.isLeader;
        return hasNoSpecialFlags && t.name?.toLowerCase().includes(lower);
      });
    } else if (activeTab === 'homeroom') {
      // Lọc giáo viên chủ nhiệm (isHomeroom = true)
      data = teachers.filter((t) => {
        const flags = getTeacherFlags(t);
        return flags.isHomeroom && t.name?.toLowerCase().includes(lower);
      });
    } else if (activeTab === 'departmentHead') {
      // Lọc trưởng bộ môn (isDepartmentHead = true)
      data = teachers.filter((t) => {
        const flags = getTeacherFlags(t);
        return flags.isDepartmentHead && t.name?.toLowerCase().includes(lower);
      });
    } else if (activeTab === 'leader') {
      // Lọc ban giám hiệu (isLeader = true)
      data = teachers.filter((t) => {
        const flags = getTeacherFlags(t);
        return flags.isLeader && t.name?.toLowerCase().includes(lower);
      });
    } else if (activeTab === 'admin') {
      // Lọc admin: lấy từ accounts có role là 'admin'
      // Admin có thể là account độc lập hoặc teacher có account với role admin
      const adminAccounts = accounts.filter((a) => a.role === 'admin');
      
      // Tạo danh sách admin từ accounts
      data = adminAccounts.map((acc) => {
        if (acc.linkedId) {
          // Tìm teacher/student tương ứng
          const linkedUser = teachers.find((t) => t._id.toString() === acc.linkedId.toString()) ||
                           students.find((s) => s._id.toString() === acc.linkedId.toString());
          if (linkedUser) {
            return { ...linkedUser, account: acc, _id: linkedUser._id };
          }
        }
        
        // Account độc lập hoặc không tìm thấy linkedUser
        return {
          _id: acc._id,
          name: acc.linkedName || acc.email?.split('@')[0] || 'Admin',
          teacherCode: acc.code || acc.email?.split('@')[0] || '',
          code: acc.code || acc.email?.split('@')[0] || '',
          account: acc,
        };
      }).filter((item) => item.name?.toLowerCase().includes(lower));
    } else {
      // Tab accounts - không áp dụng filter "chưa có tài khoản"
      return accounts.filter((a) => a.email?.toLowerCase().includes(lower));
    }
    
    // ✅ Áp dụng filter "chưa có tài khoản" nếu được bật
    if (filterNoAccount) {
      data = data.filter((item) => {
        const acc = getAccountByLinkedId(item._id);
        return !acc; // Chỉ lấy những người chưa có tài khoản
      });
    }
    
    return data;
  }, [students, teachers, accounts, search, activeTab, filterNoAccount]);

  // ✅ Sort: Sắp xếp dữ liệu đã lọc
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    
    const sorted = [...filteredData].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      // Lấy giá trị theo field
      if (activeTab === 'student') {
        if (sortField === 'name') {
          aValue = a.name || '';
          bValue = b.name || '';
        } else if (sortField === 'studentCode') {
          aValue = a.studentCode || '';
          bValue = b.studentCode || '';
        } else if (sortField === 'grade') {
          aValue = a.grade || '';
          bValue = b.grade || '';
        } else if (sortField === 'className') {
          aValue = typeof a.classId === 'object' && a.classId !== null
            ? a.classId.className || ''
            : '';
          bValue = typeof b.classId === 'object' && b.classId !== null
            ? b.classId.className || ''
            : '';
        }
      } else if (activeTab === 'teacher' || activeTab === 'admin' || ['homeroom', 'departmentHead', 'leader'].includes(activeTab)) {
        if (sortField === 'name') {
          aValue = a.name || '';
          bValue = b.name || '';
        } else if (sortField === 'teacherCode') {
          aValue = a.teacherCode || '';
          bValue = b.teacherCode || '';
        }
      } else if (activeTab === 'accounts') {
        if (sortField === 'email') {
          aValue = a.email || '';
          bValue = b.email || '';
        } else if (sortField === 'role') {
          aValue = a.role || '';
          bValue = b.role || '';
        }
      }
      
      // So sánh
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue, 'vi')
          : bValue.localeCompare(aValue, 'vi');
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredData, sortField, sortDirection, activeTab]);

  // ✅ Pagination: Tính toán dữ liệu phân trang
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize]);

  // ✅ Tính tổng số trang
  const totalPages = Math.ceil(sortedData.length / pageSize);

  // ✅ Reset về trang 1 khi search, tab, sort hoặc filter thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, sortField, sortDirection, filterNoAccount]);
  
  // ✅ Reset sort và filter khi đổi tab
  useEffect(() => {
    setSortField('');
    setSortDirection('asc');
    setFilterNoAccount(false);
  }, [activeTab]);

  // ✅ Helper: Handle sort click
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Đổi chiều sort nếu đang sort field này
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Sort field mới, mặc định asc
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // ✅ Helper: Render sort icon
  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // ✅ Helper: Render sortable header
  const renderSortableHeader = (field: string, label: string) => {
    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/50 select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center">
          {label}
          {renderSortIcon(field)}
        </div>
      </TableHead>
    );
  };

  // ✅ Helper: Render Pagination Controls
  const renderPaginationControls = () => {
    if (sortedData.length === 0) return null;
    
    return (
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Hiển thị:</Label>
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            / {sortedData.length} mục
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Trang {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // 🧩 Chọn/bỏ chọn
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (activeTab === 'student' || activeTab === 'teacher') {
      if (selectedIds.length === sortedData.length) setSelectedIds([]);
      else setSelectedIds(sortedData.map((x) => x._id));
    }
  };
// 🧩 Reset mật khẩu cho tài khoản (tab accounts)
const handleResetPasswordAccounts = async () => {
  setLoading(true);
  setAlert(null);
  try {
    const res = await userApi.resetPasswords({ accountIds: selectedIds });
    setResult(res);
    setSelectedIds([]);
    setResetPasswordDialogOpen(false);
    setAlert({
      type: 'success',
      title: 'Reset thành công',
      message: `Đã reset ${res.results.length} tài khoản về mật khẩu mặc định: ${res.defaultPassword}`,
    });
  } catch (err: any) {
    setAlert({
      type: 'error',
      title: 'Lỗi',
      message: err.response?.data?.message || err.message,
    });
  } finally {
    setLoading(false);
  }
};

// 🗑️ Xóa tài khoản
const handleDeleteAccounts = async () => {
  setLoading(true);
  setAlert(null);
  try {
    const res = await userApi.deleteAccounts({ accountIds: selectedIds });
    setAccounts((prev) => prev.filter((a) => !selectedIds.includes(a._id)));
    setSelectedIds([]);
    setDeleteAccountDialogOpen(false);
    setAlert({
      type: 'success',
      title: 'Xóa thành công',
      message: `Đã xóa ${res.deletedCount || selectedIds.length} tài khoản.`,
    });
  } catch (err: any) {
    setAlert({
      type: 'error',
      title: 'Lỗi',
      message: err.response?.data?.message || err.message,
    });
  } finally {
    setLoading(false);
  }
};

  // 🧠 Tạo tài khoản hàng loạt
  const handleSubmit = async () => {
    setLoading(true);
    setResult({});
    setAlert(null);
    try {
      let res;
      if (activeTab === 'student') {
        const selectedStudents = students.filter((s) =>
          selectedIds.includes(s._id)
        );
        res = await userApi.createBatchStudents({ students: selectedStudents });
        await userApi.getAllAccounts().then((res) => setAccounts(res.data || []));
      } else if (activeTab === 'teacher') {
        const selectedTeachers = teachers.filter((t) =>
          selectedIds.includes(t._id)
        );
        res = await userApi.createBatchTeachers({ teachers: selectedTeachers });
        await userApi.getAllAccounts().then((res) => setAccounts(res.data || []));
      } else if (activeTab === 'admin') {
        // Tạo tài khoản admin
        const selectedUsers = teachers.filter((t) =>
          selectedIds.includes(t._id)
        );
        res = await userApi.createBatchAccounts({ 
          users: selectedUsers, 
          role: 'admin' 
        });
        await userApi.getAllAccounts().then((res) => setAccounts(res.data || []));
      } else if (['homeroom', 'departmentHead', 'leader'].includes(activeTab)) {
        // Tạo tài khoản với role 'teacher' và sau đó cập nhật flags
        const selectedTeachers = teachers.filter((t) =>
          selectedIds.includes(t._id)
        );
        
        // Tạo tài khoản với role 'teacher'
        res = await userApi.createBatchTeachers({ teachers: selectedTeachers });
        await userApi.getAllAccounts().then((res) => setAccounts(res.data || []));
        
        // Cập nhật flags cho từng giáo viên
        const flagUpdates = [];
        for (const teacher of selectedTeachers) {
          try {
            const flagData: any = {
              isHomeroom: activeTab === 'homeroom',
              isDepartmentHead: activeTab === 'departmentHead',
              isLeader: activeTab === 'leader',
            };
            
            // Giữ các flags khác nếu đã có
            const currentFlags = getTeacherFlags(teacher);
            if (activeTab !== 'homeroom') flagData.isHomeroom = currentFlags.isHomeroom;
            if (activeTab !== 'departmentHead') flagData.isDepartmentHead = currentFlags.isDepartmentHead;
            if (activeTab !== 'leader') flagData.isLeader = currentFlags.isLeader;
            
            await api.put(`/accounts/teacher/${teacher._id}/flags`, flagData);
            flagUpdates.push({ teacherId: teacher._id, success: true });
          } catch (err: any) {
            console.error(`Lỗi cập nhật flags cho ${teacher._id}:`, err);
            flagUpdates.push({ teacherId: teacher._id, success: false, error: err.message });
          }
        }
        
        // ✅ Reload danh sách giáo viên để cập nhật flags
        await refetchTeachers();
      }

      setResult(res);
      setAlert({
        type: 'success',
        title: 'Thành công',
        message: `Đã tạo ${res.createdAccounts?.length || 0} tài khoản mới, ${res.existedAccounts?.length || 0} tài khoản đã tồn tại.`,
      });
    } catch (err: any) {
      setAlert({
        type: 'error',
        title: 'Lỗi',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // 🔁 Reset mật khẩu hàng loạt
  const handleResetPassword = async () => {
    setLoading(true);
    setAlert(null);
    try {
      const res = await userApi.resetPasswords({ accountIds: selectedIds });
      setResult(res);
      setAlert({
        title: 'Reset thành công',
        type: 'success',
        message: `Đã reset ${res.results.length} tài khoản về mật khẩu mặc định: ${res.defaultPassword}`,
      });
    } catch (err: any) {
      setAlert({
        type: 'error',
        title: 'Lỗi',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = (user: any) => {
    setSelectedUserForAccount(user);
    setFormCode(user.studentCode || user.teacherCode || user.code || '');
    setFormRole('');
    setFormEmail('');
    setCreateAccountDialogOpen(true);
  };

  const handleAccountCreated = async () => {
    // Refresh danh sách
    if (activeTab === 'accounts') {
      userApi.getAllAccounts().then((res) => setAccounts(res.data || []));
    } else {
      // ✅ Refresh danh sách tương ứng
      if (activeTab === 'student') {
        await refetchStudents();
      } else {
        await refetchTeachers();
      }
      userApi.getAllAccounts().then((res) => setAccounts(res.data || []));
    }
    setCreateAccountDialogOpen(false);
    setSelectedUserForAccount(null);
    setFormRole('');
    setFormCode('');
    setFormEmail('');
  };

  // Tạo tài khoản từ form (cho học sinh/giáo viên có sẵn)
  const handleCreateAccountFromForm = async () => {
    if (!formRole || !formCode || !selectedUserForAccount) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền đầy đủ thông tin',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let res;
      if (formRole === 'student') {
        res = await userApi.createBatchStudents({
          students: [{
            _id: selectedUserForAccount._id,
            studentCode: formCode,
            phone: selectedUserForAccount.phone
          }]
        });
      } else if (formRole === 'teacher') {
        res = await userApi.createBatchTeachers({
          teachers: [{
            _id: selectedUserForAccount._id,
            teacherCode: formCode,
            phone: selectedUserForAccount.phone
          }]
        });
      } else if (formRole === 'admin') {
        res = await userApi.createBatchAccounts({
          users: [{
            _id: selectedUserForAccount._id,
            code: formCode,
            phone: selectedUserForAccount.phone
          }],
          role: 'admin'
        });
      } else if (['homeroom', 'departmentHead', 'leader'].includes(formRole)) {
        // Tạo với role teacher và cập nhật flags
        res = await userApi.createBatchTeachers({
          teachers: [{
            _id: selectedUserForAccount._id,
            teacherCode: formCode,
            phone: selectedUserForAccount.phone
          }]
        });
        
        // Cập nhật flags
        const flagData: any = {
          isHomeroom: formRole === 'homeroom',
          isDepartmentHead: formRole === 'departmentHead',
          isLeader: formRole === 'leader',
        };
        
        await api.put(`/accounts/teacher/${selectedUserForAccount._id}/flags`, flagData);
      }

      toast({
        title: 'Thành công',
        description: 'Đã tạo tài khoản thành công',
      });
      
      handleAccountCreated();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error?.response?.data?.message || 'Không thể tạo tài khoản',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Tạo tài khoản thủ công (không cần chọn từ danh sách)
  const handleManualCreateAccount = async () => {
    if (!formRole || !formCode || !formName || !formPhone) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền đầy đủ thông tin',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let res;
      if (formRole === 'student') {
        // Tạo học sinh mới trước
        const studentData = {
          name: formName,
          studentCode: formCode,
          phone: formPhone,
          grade: '10' as const, // ✅ Mặc định, có thể thêm field để chọn
        };
        
        const newStudent = await studentApi.create(studentData);
        
        // Tạo tài khoản cho học sinh vừa tạo
        res = await userApi.createBatchStudents({
          students: [{
            _id: newStudent._id,
            studentCode: formCode,
            phone: formPhone
          }]
        });
      } else if (formRole === 'teacher') {
        // Tạo giáo viên mới trước
        const teacherData = {
          name: formName,
          teacherCode: formCode,
          phone: formPhone,
        };
        
        const newTeacher = await createTeacher(teacherData);
        
        // Tạo tài khoản cho giáo viên vừa tạo
        res = await userApi.createBatchTeachers({
          teachers: [{
            _id: newTeacher._id,
            teacherCode: formCode,
            phone: formPhone
          }]
        });
      } else if (formRole === 'admin') {
        // Tạo admin mới
        res = await userApi.createBatchAccounts({
          users: [{
            name: formName,
            code: formCode,
            phone: formPhone
          }],
          role: 'admin'
        });
      } else if (['homeroom', 'departmentHead', 'leader'].includes(formRole)) {
        // Tạo giáo viên mới trước
        const teacherData = {
          name: formName,
          teacherCode: formCode,
          phone: formPhone,
        };
        
        const newTeacher = await createTeacher(teacherData);
        
        // Tạo tài khoản với role teacher
        res = await userApi.createBatchTeachers({
          teachers: [{
            _id: newTeacher._id,
            teacherCode: formCode,
            phone: formPhone
          }]
        });
        
        // Cập nhật flags
        const flagData: any = {
          isHomeroom: formRole === 'homeroom',
          isDepartmentHead: formRole === 'departmentHead',
          isLeader: formRole === 'leader',
        };
        
        await api.put(`/accounts/teacher/${newTeacher._id}/flags`, flagData);
      }

      toast({
        title: 'Thành công',
        description: 'Đã tạo tài khoản thành công',
      });
      
      // ✅ Refresh danh sách
      if (activeTab === 'student') {
        await refetchStudents();
      } else if (activeTab === 'teacher' || activeTab === 'admin') {
        await refetchTeachers();
      }
      await userApi.getAllAccounts().then((res) => setAccounts(res.data || []));
      
      // Reset form
      setIsManualCreateDialogOpen(false);
      setFormRole('');
      setFormCode('');
      setFormName('');
      setFormPhone('');
      setFormEmail('');
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error?.response?.data?.message || 'Không thể tạo tài khoản',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Tính email tự động
  useEffect(() => {
    if (!settings || !formRole || !formCode) {
      setFormEmail('');
      return;
    }

    const domainMap: Record<string, string> = {
      student: settings?.studentEmailDomain || 'student.school.com',
      teacher: settings?.teacherEmailDomain || 'teacher.school.com',
      admin: settings?.adminEmailDomain || 'admin.school.com',
      homeroom: settings?.teacherEmailDomain || 'teacher.school.com',
      departmentHead: settings?.teacherEmailDomain || 'teacher.school.com',
      leader: settings?.teacherEmailDomain || 'teacher.school.com',
    };

    const domain = domainMap[formRole] || 'school.com';
    setFormEmail(`${formCode}@${domain}`);
  }, [formRole, formCode, settings]);

  // Reset form khi đóng dialog thủ công
  useEffect(() => {
    if (!isManualCreateDialogOpen) {
      setFormRole('');
      setFormCode('');
      setFormName('');
      setFormPhone('');
      setFormEmail('');
    }
  }, [isManualCreateDialogOpen]);

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý tài khoản</h1>
          <p className="text-muted-foreground">Tạo và quản lý tài khoản cho học sinh, giáo viên</p>
        </div>
        <Button onClick={() => setIsManualCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tạo tài khoản thủ công
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="student">Học sinh</TabsTrigger>
          <TabsTrigger value="teacher">Giáo viên</TabsTrigger>
          <TabsTrigger value="accounts">Tài khoản</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        {/* --- Học sinh --- */}
        <TabsContent value="student">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Danh sách học sinh</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                      placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-64"
            />
                  </div>
                  {/* ✅ Filter: Chỉ hiển thị chưa có tài khoản */}
                  <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
                    <Switch
                      checked={filterNoAccount}
                      onCheckedChange={setFilterNoAccount}
                      id="filter-no-account"
                    />
                    <Label htmlFor="filter-no-account" className="text-sm cursor-pointer">
                      Chưa có tài khoản
                    </Label>
                  </div>
            <Button
              variant="outline"
              onClick={toggleSelectAll}
              disabled={sortedData.length === 0}
            >
              {selectedIds.length === sortedData.length && sortedData.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    {renderSortableHeader('studentCode', 'Mã HS')}
                    {renderSortableHeader('name', 'Tên')}
                    {renderSortableHeader('className', 'Lớp')}
                    {renderSortableHeader('grade', 'Khối')}
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-24">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {sortedData.length === 0 ? 'Không tìm thấy học sinh nào' : 'Không có dữ liệu trên trang này'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((s) => {
                const acc = getAccountByLinkedId(s._id);
                return (
                        <TableRow key={s._id}>
                          <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s._id)}
                        disabled={!!acc}
                        onChange={() => toggleSelect(s._id)}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="font-mono">{s.studentCode || '-'}</TableCell>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            {typeof s.classId === 'object' && s.classId !== null
                              ? s.classId.className || s.classId.classCode || '-'
                              : s.classId
                              ? 'Chưa có tên'
                              : '-'}
                          </TableCell>
                          <TableCell>{s.grade}</TableCell>
                          <TableCell>
                          {acc ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {acc.email}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Chưa có</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                        {!acc && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateAccount(s)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                                Tạo
                          </Button>
                        )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {renderPaginationControls()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Giáo viên --- */}
        <TabsContent value="teacher">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Danh sách giáo viên</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                      placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-64"
            />
                  </div>
                  {/* ✅ Filter: Chỉ hiển thị chưa có tài khoản */}
                  <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
                    <Switch
                      checked={filterNoAccount}
                      onCheckedChange={setFilterNoAccount}
                      id="filter-no-account-teacher"
                    />
                    <Label htmlFor="filter-no-account-teacher" className="text-sm cursor-pointer">
                      Chưa có tài khoản
                    </Label>
                  </div>
            <Button
              variant="outline"
              onClick={toggleSelectAll}
              disabled={sortedData.length === 0}
            >
              {selectedIds.length === sortedData.length && sortedData.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    {renderSortableHeader('teacherCode', 'Mã GV')}
                    {renderSortableHeader('name', 'Tên')}
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-24">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {sortedData.length === 0 ? 'Không tìm thấy giáo viên nào' : 'Không có dữ liệu trên trang này'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((t) => {
                const acc = getAccountByLinkedId(t._id);
                      const flags = getTeacherFlags(t);
                return (
                        <TableRow key={t._id}>
                          <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(t._id)}
                        disabled={!!acc}
                        onChange={() => toggleSelect(t._id)}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="font-mono">{t.teacherCode || '-'}</TableCell>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {flags.isHomeroom && <Badge variant="outline" className="text-xs">GVCN</Badge>}
                              {flags.isDepartmentHead && <Badge variant="outline" className="text-xs">TBM</Badge>}
                              {flags.isLeader && <Badge variant="outline" className="text-xs">BGH</Badge>}
                              {!flags.isHomeroom && !flags.isDepartmentHead && !flags.isLeader && (
                                <span className="text-muted-foreground text-sm">Giáo viên</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                          {acc ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {acc.email}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Chưa có</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                        {!acc && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateAccount(t)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                                Tạo
                          </Button>
                        )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {renderPaginationControls()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Admin --- */}
        <TabsContent value="admin">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Danh sách Admin</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                      placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-64"
              />
                  </div>
                  {/* ✅ Filter: Chỉ hiển thị chưa có tài khoản */}
                  <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
                    <Switch
                      checked={filterNoAccount}
                      onCheckedChange={setFilterNoAccount}
                      id="filter-no-account-admin"
                    />
                    <Label htmlFor="filter-no-account-admin" className="text-sm cursor-pointer">
                      Chưa có tài khoản
                    </Label>
                  </div>
              <Button
                variant="outline"
                onClick={toggleSelectAll}
                disabled={sortedData.length === 0}
              >
                {selectedIds.length === sortedData.length && sortedData.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </Button>
            </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Mã</TableHead>
                    {renderSortableHeader('name', 'Tên')}
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-24">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {sortedData.length === 0 ? 'Không tìm thấy admin nào' : 'Không có dữ liệu trên trang này'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((t) => {
                      // ✅ Lấy account từ object (nếu có account property) hoặc từ getAccountByLinkedId
                      const acc = t.account || getAccountByLinkedId(t._id);
                      const hasAdminRole = acc && acc.role === 'admin';
                      return (
                        <TableRow key={t._id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(t._id)}
                              disabled={hasAdminRole}
                              onChange={() => toggleSelect(t._id)}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="font-mono">{t.teacherCode || t.code || '-'}</TableCell>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell>
                            {hasAdminRole ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {acc.email}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Chưa có</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!hasAdminRole && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateAccount(t)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Tạo
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {renderPaginationControls()}
            </CardContent>
          </Card>
          </TabsContent>

        {/* --- Danh sách tài khoản --- */}
<TabsContent value="accounts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Danh sách tài khoản</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Tìm kiếm email..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-64"
    />
                  </div>
    <Button
      variant="outline"
      onClick={() => {
        if (selectedIds.length === sortedData.length) setSelectedIds([]);
        else setSelectedIds(sortedData.map((a) => a._id));
      }}
      disabled={sortedData.length === 0}
    >
      {selectedIds.length === sortedData.length && sortedData.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
    </Button>
  </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    {renderSortableHeader('email', 'Email')}
                    {renderSortableHeader('role', 'Vai trò')}
                    <TableHead>Liên kết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {sortedData.length === 0 ? 'Không tìm thấy tài khoản nào' : 'Không có dữ liệu trên trang này'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((a) => (
                      <TableRow key={a._id}>
                        <TableCell>
            <input
              type="checkbox"
              checked={selectedIds.includes(a._id)}
              onChange={() => toggleSelect(a._id)}
                            className="cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{a.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{a.role}</Badge>
                        </TableCell>
                        <TableCell>{a.linkedName || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {renderPaginationControls()}
              
              {/* Hành động - sẽ hiển thị ở fixed footer */}
            </CardContent>
          </Card>
</TabsContent>

      </Tabs>

      {/* Fixed Footer với các button hành động */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-width)] right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4 z-50 shadow-lg transition-[left] duration-200 ease-linear group-data-[collapsible=icon]/sidebar-wrapper:md:left-[var(--sidebar-width-icon)]">
          <div className="container mx-auto max-w-7xl flex items-center justify-between">
            <div className="text-sm text-muted-foreground hidden md:block">
              Đã chọn <span className="font-medium text-foreground">{selectedIds.length}</span> {activeTab === 'accounts' ? 'tài khoản' : 'người dùng'}
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              {activeTab === 'accounts' ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setResetPasswordDialogOpen(true)}
                    disabled={loading}
                    size="lg"
                    className="flex-1 sm:flex-initial"
                  >
                    {loading ? 'Đang reset...' : `Reset mật khẩu (${selectedIds.length})`}
                  </Button>
                  {canDelete && (
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteAccountDialogOpen(true)}
                      disabled={loading}
                      size="lg"
                      className="flex-1 sm:flex-initial"
                    >
                      {loading ? 'Đang xóa...' : `Xóa tài khoản (${selectedIds.length})`}
                    </Button>
                  )}
                </>
              ) : (
                canCreate && (
                  <Button onClick={handleSubmit} disabled={loading} size="lg" className="flex-1 sm:flex-initial">
                    {loading ? 'Đang tạo...' : `Tạo tài khoản (${selectedIds.length})`}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {alert && (
        <Alert
          variant={alert.type === 'error' ? 'destructive' : 'default'}
          className="mt-4"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      {/* Dialog tạo tài khoản thủ công */}
      <Dialog
        open={isManualCreateDialogOpen}
        onOpenChange={(open) => {
          setIsManualCreateDialogOpen(open);
          if (!open) {
            setFormRole('');
            setFormCode('');
            setFormName('');
            setFormPhone('');
            setFormEmail('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản thủ công</DialogTitle>
            <DialogDescription>
              Tạo tài khoản mới cho người dùng không có trong danh sách (ví dụ: Hiệu trưởng, Hiệu phó)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vai trò *</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Học sinh</SelectItem>
                  <SelectItem value="teacher">Giáo viên</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="homeroom">Giáo viên chủ nhiệm (GVCN)</SelectItem>
                  <SelectItem value="departmentHead">Trưởng bộ môn (TBM)</SelectItem>
                  <SelectItem value="leader">Ban giám hiệu (BGH)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Họ tên *</Label>
              <Input
                placeholder="Nhập họ tên"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Mã *</Label>
              <Input
                placeholder={
                  formRole === 'student'
                    ? 'Mã học sinh (VD: HS001)'
                    : formRole === 'admin'
                    ? 'Mã admin (VD: AD001)'
                    : 'Mã giáo viên (VD: GV001)'
                }
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Số điện thoại *</Label>
              <Input
                placeholder="Nhập số điện thoại"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                required
              />
            </div>

            {formRole && formCode && formEmail && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm font-medium mb-1">Email sẽ được tạo:</p>
                <p className="text-sm font-mono text-primary">{formEmail}</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsManualCreateDialogOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleManualCreateAccount} disabled={loading || !formRole || !formCode || !formName || !formPhone}>
                {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog tạo tài khoản đơn giản */}
      <Dialog
        open={createAccountDialogOpen}
        onOpenChange={(open) => {
          setCreateAccountDialogOpen(open);
          if (!open) {
            setSelectedUserForAccount(null);
            setFormRole('');
            setFormCode('');
            setFormEmail('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản</DialogTitle>
            <DialogDescription>
              {selectedUserForAccount
                ? `Tạo tài khoản cho ${selectedUserForAccount.name}`
                : 'Tạo tài khoản mới'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUserForAccount && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Thông tin người dùng:</p>
                <p className="text-sm">Tên: {selectedUserForAccount.name}</p>
                {selectedUserForAccount.phone && (
                  <p className="text-sm">SĐT: {selectedUserForAccount.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Vai trò *</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Học sinh</SelectItem>
                    <SelectItem value="teacher">Giáo viên</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="homeroom">Giáo viên chủ nhiệm (GVCN)</SelectItem>
                    <SelectItem value="departmentHead">Trưởng bộ môn (TBM)</SelectItem>
                    <SelectItem value="leader">Ban giám hiệu (BGH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mã *</Label>
                <Input
                  placeholder={
                    formRole === 'student'
                      ? 'Mã học sinh (VD: HS001)'
                      : formRole === 'admin'
                      ? 'Mã admin (VD: AD001)'
                      : 'Mã giáo viên (VD: GV001)'
                  }
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  required
                />
              </div>

              {formRole && formCode && formEmail && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium mb-1">Email sẽ được tạo:</p>
                  <p className="text-sm font-mono text-primary">{formEmail}</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateAccountDialogOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleCreateAccountFromForm} disabled={loading || !formRole || !formCode}>
                  {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Xác nhận Reset mật khẩu */}
      <AlertDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận reset mật khẩu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn reset mật khẩu cho <strong>{selectedIds.length}</strong> tài khoản đã chọn?
              <br />
              <span className="text-muted-foreground text-xs mt-2 block">
                Mật khẩu sẽ được đặt về mật khẩu mặc định. Người dùng sẽ cần đổi mật khẩu khi đăng nhập lần đầu.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPasswordAccounts}
              disabled={loading}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {loading ? 'Đang reset...' : 'Xác nhận reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Xác nhận Xóa tài khoản */}
      <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa tài khoản</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa <strong>{selectedIds.length}</strong> tài khoản đã chọn?
              <br />
              <span className="text-destructive text-xs mt-2 block font-medium">
                ⚠️ Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến các tài khoản này sẽ bị xóa vĩnh viễn.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccounts}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Đang xóa...' : 'Xác nhận xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BatchAccountPage;
