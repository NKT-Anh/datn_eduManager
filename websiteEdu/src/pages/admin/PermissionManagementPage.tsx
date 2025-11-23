import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Shield, User, Edit, X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import userApi from "@/services/userApi";
import { useSchoolYears } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";

interface AccountWithPermissions {
  _id: string;
  email: string;
  role: "admin" | "student" | "teacher";
  userInfo?: {
    _id: string;
    name: string;
    code?: string;
    type: string;
  };
  teacherFlags?: {
    isHomeroom: boolean;
    isDepartmentHead: boolean;
    isLeader: boolean;
    permissions: string[];
  };
  yearRoles?: Array<{
    schoolYear: string;
    isHomeroom: boolean;
    isDepartmentHead: boolean;
    // ✅ isLeader đã được loại bỏ khỏi yearRoles - BGH được set cứng ở top-level (teacherFlags.isLeader)
    permissions: string[];
  }>;
}

const PermissionManagementPage = () => {
  const { toast } = useToast();
  const { backendUser } = useAuth();
  const { schoolYears, currentYearData } = useSchoolYears();
  const [accounts, setAccounts] = useState<AccountWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [editingAccount, setEditingAccount] = useState<AccountWithPermissions | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isFlagsDialogOpen, setIsFlagsDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(""); // ✅ Năm học được chọn để cập nhật permissions
  const [viewYear, setViewYear] = useState<string>(""); // ✅ Năm học được chọn để xem quyền
  const [flags, setFlags] = useState({
    isHomeroom: false, // ✅ Chỉ để hiển thị, không cho chỉnh sửa
    isDepartmentHead: false, // ✅ Chỉ để hiển thị, không cho chỉnh sửa
    isLeader: false, // ✅ Cho phép chỉnh sửa (BGH)
    permissions: [] as string[],
  });
  
  // ✅ Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Load accounts
  const loadAccounts = async (year?: string) => {
    try {
      setLoading(true);
      // ✅ Gọi API với query param year nếu có
      const res = await userApi.getAllAccountsWithPermissions(year);
      setAccounts(res.data || []);
    } catch (error: any) {
      console.error("Error loading accounts:", error);
      
      // ✅ Kiểm tra lỗi kết nối
      const isConnectionError = 
        error?.code === 'ERR_NETWORK' || 
        error?.message?.includes('ERR_CONNECTION_REFUSED') ||
        error?.message?.includes('Network Error');
      
      toast({
        title: "Lỗi",
        description: isConnectionError 
          ? "Không thể kết nối đến server. Vui lòng kiểm tra backend server đã chạy chưa."
          : (error?.response?.data?.message || "Không thể tải danh sách tài khoản"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Set năm học hiện tại khi component mount
  useEffect(() => {
    if (currentYearData && !viewYear) {
      const currentYearCode = String(currentYearData.code || currentYearData.name);
      setViewYear(currentYearCode);
    }
  }, [currentYearData, viewYear]);

  // ✅ Load accounts khi viewYear thay đổi
  useEffect(() => {
    if (viewYear) {
      loadAccounts(viewYear);
    } else {
      loadAccounts();
    }
  }, [viewYear]);


  // Open role edit dialog
  const handleEditRole = (account: AccountWithPermissions) => {
    setEditingAccount(account);
    setNewRole(account.role);
    setIsRoleDialogOpen(true);
  };

  // Open flags edit dialog
  const handleEditFlags = (account: AccountWithPermissions) => {
    if (account.role !== "teacher") {
      toast({
        title: "Lỗi",
        description: "Chỉ có thể chỉnh sửa flags cho giáo viên",
        variant: "destructive",
      });
      return;
    }
    setEditingAccount(account);
    // ✅ Set năm học mặc định là năm học đang xem (viewYear) hoặc năm học hiện tại
    const defaultYear = viewYear || currentYearData?.code || currentYearData?.name || "";
    setSelectedSchoolYear(defaultYear);
    
    // ✅ Load flags từ yearRoles của năm học đang xem (viewYear), không gộp quyền từ các năm khác
    // ✅ isLeader CHỈ lấy từ top-level (teacherFlags.isLeader) - BGH được set cứng
    let flagsToLoad = {
      isHomeroom: false, // ✅ Chỉ để hiển thị
      isDepartmentHead: false, // ✅ Chỉ để hiển thị
      isLeader: account.teacherFlags?.isLeader || false, // ✅ Cho phép chỉnh sửa
      permissions: [] as string[],
    };
    
    // Ưu tiên lấy từ yearRoles của năm học đang xem
    if (viewYear && account.yearRoles && Array.isArray(account.yearRoles)) {
      const yearRole = account.yearRoles.find(yr => String(yr.schoolYear) === String(viewYear));
      if (yearRole) {
        flagsToLoad = {
          isHomeroom: yearRole.isHomeroom || false, // ✅ Chỉ để hiển thị
          isDepartmentHead: yearRole.isDepartmentHead || false, // ✅ Chỉ để hiển thị
          isLeader: account.teacherFlags?.isLeader || false, // ✅ CHỈ lấy từ top-level - BGH được set cứng
          permissions: Array.isArray(yearRole.permissions) ? yearRole.permissions : (yearRole.permissions ? [yearRole.permissions] : []),
        };
      }
    } else {
      // Fallback về teacherFlags nếu không có viewYear hoặc không tìm thấy yearRole
      flagsToLoad = {
        isHomeroom: account.teacherFlags?.isHomeroom || false, // ✅ Chỉ để hiển thị
        isDepartmentHead: account.teacherFlags?.isDepartmentHead || false, // ✅ Chỉ để hiển thị
        isLeader: account.teacherFlags?.isLeader || false, // ✅ CHỈ lấy từ top-level - BGH được set cứng
        permissions: Array.isArray(account.teacherFlags?.permissions) 
          ? account.teacherFlags.permissions 
          : (account.teacherFlags?.permissions ? [account.teacherFlags.permissions] : []),
      };
    }
    
    setFlags(flagsToLoad);
    setIsFlagsDialogOpen(true);
  };

  // Update role
  const handleUpdateRole = async () => {
    if (!editingAccount || !newRole) return;

    try {
      await userApi.updateAccountRole(editingAccount._id, newRole);
      toast({
        title: "Thành công",
        description: "Đã cập nhật role thành công",
      });
      setIsRoleDialogOpen(false);
      setEditingAccount(null);
      loadAccounts();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể cập nhật role",
        variant: "destructive",
      });
    }
  };

  // Update flags - CHỈ cập nhật isLeader (BGH) và permissions
  // isHomeroom và isDepartmentHead được tự động cập nhật khi gán lớp/tổ
  const handleUpdateFlags = async () => {
    if (!editingAccount || !editingAccount.userInfo) return;

    // ✅ CHỈ gửi isLeader (BGH) và permissions
    // isHomeroom và isDepartmentHead được tự động set khi gán lớp chủ nhiệm/tổ bộ môn
    const flagsToUpdate = {
      isLeader: flags.isLeader, // ✅ Cho phép chỉnh sửa BGH
      permissions: flags.permissions,
      ...(selectedSchoolYear && selectedSchoolYear !== "all" ? { year: selectedSchoolYear } : {}),
    };

    try {
      await userApi.updateTeacherFlags(editingAccount.userInfo._id, flagsToUpdate);
      toast({
        title: "Thành công",
        description: selectedSchoolYear && selectedSchoolYear !== "all"
          ? `Đã cập nhật quyền bổ sung cho năm học ${selectedSchoolYear} thành công`
          : "Đã cập nhật quyền bổ sung thành công",
      });
      setIsFlagsDialogOpen(false);
      setEditingAccount(null);
      setSelectedSchoolYear("");
      // ✅ Reload accounts với năm học đang xem để cập nhật quyền
      loadAccounts(viewYear);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể cập nhật quyền",
        variant: "destructive",
      });
    }
  };

  // Get role badge color
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive">Admin</Badge>;
      case "teacher":
        return <Badge variant="default">Giáo viên</Badge>;
      case "student":
        return <Badge variant="secondary">Học sinh</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  // Get flags badges - hiển thị quyền theo năm học đã chọn (CHỈ năm học đang xem, không gộp)
  const getFlagsBadges = (account: AccountWithPermissions) => {
    if (account.role !== "teacher") return null;
    
    // ✅ CHỈ lấy quyền từ yearRoles của năm học đang xem (viewYear), KHÔNG gộp quyền từ các năm khác
    // ✅ isLeader CHỈ lấy từ top-level (teacherFlags.isLeader) - BGH được set cứng
    let flags = null;
    if (viewYear && account.yearRoles && Array.isArray(account.yearRoles)) {
      const yearRole = account.yearRoles.find(yr => String(yr.schoolYear) === String(viewYear));
      if (yearRole) {
        flags = {
          isHomeroom: yearRole.isHomeroom || false,
          isDepartmentHead: yearRole.isDepartmentHead || false,
          // ✅ isLeader không có trong yearRoles - BGH được set cứng ở top-level
          isLeader: account.teacherFlags?.isLeader || false, // CHỈ lấy từ top-level
          permissions: Array.isArray(yearRole.permissions) ? yearRole.permissions : (yearRole.permissions ? [yearRole.permissions] : []),
        };
      }
    }
    
    // ✅ Nếu không có viewYear hoặc không tìm thấy yearRole, fallback về teacherFlags (legacy)
    if (!flags) {
      flags = account.teacherFlags || {
        isHomeroom: false,
        isDepartmentHead: false,
        isLeader: false,
        permissions: [],
      };
    }
    
    if (!flags) return <span className="text-muted-foreground text-sm">Chưa có flags</span>;
    
    return (
      <div className="flex flex-wrap gap-1">
        {flags.isHomeroom && (
          <Badge variant="outline" className="text-xs">GVCN</Badge>
        )}
        {flags.isDepartmentHead && (
          <Badge variant="outline" className="text-xs">TBM</Badge>
        )}
        {flags.isLeader && (
          <Badge variant="outline" className="text-xs">BGH</Badge>
        )}
        {flags.permissions && flags.permissions.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{flags.permissions.length} quyền
          </Badge>
        )}
        {!flags.isHomeroom && !flags.isDepartmentHead && !flags.isLeader && (!flags.permissions || flags.permissions.length === 0) && (
          <span className="text-muted-foreground text-xs">Không có quyền mở rộng</span>
        )}
      </div>
    );
  };
  
  // ✅ Tính toán phân trang
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    
    // Filter theo search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(acc => 
        acc.email.toLowerCase().includes(searchLower) ||
        acc.userInfo?.name?.toLowerCase().includes(searchLower) ||
        acc.userInfo?.code?.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter theo role
    if (filterRole !== "all") {
      filtered = filtered.filter(acc => acc.role === filterRole);
    }
    
    return filtered;
  }, [accounts, searchTerm, filterRole]);
  
  // Tính toán dữ liệu phân trang
  const totalPages = Math.ceil(filteredAccounts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedAccounts = filteredAccounts.slice(startIndex, endIndex);
  
  // Reset về trang 1 khi filter thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, viewYear]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Phân quyền tài khoản
          </h1>
          <p className="text-muted-foreground">
            Quản lý role và quyền truy cập của các tài khoản trong hệ thống
          </p>
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Lưu ý về phân quyền theo năm học:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>Giáo viên:</strong> Quyền được kiểm tra và hiển thị theo năm học đang xem. Mỗi năm học có quyền riêng, không gộp quyền từ các năm khác.</li>
                  <li><strong>Admin & Học sinh:</strong> Quyền giữ nguyên qua tất cả các năm học, không cần chọn năm học.</li>
                  <li><strong>Tổ bộ môn:</strong> Một giáo viên có thể tham gia nhiều tổ khác nhau ở các năm học khác nhau.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Dropdown chọn năm học để xem quyền */}
      <Card>
        <CardHeader>
          <CardTitle>Xem quyền theo năm học</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap">Năm học:</Label>
            <Select 
              value={viewYear || undefined} 
              onValueChange={setViewYear}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Chọn năm học để xem quyền" />
              </SelectTrigger>
              <SelectContent>
                {/* ✅ Ưu tiên hiển thị năm học hiện tại trước */}
                {currentYearData && (
                  <SelectItem 
                    key={currentYearData._id || 'current'}
                    value={String(currentYearData.code || currentYearData.name)}
                    className="font-semibold"
                  >
                    {currentYearData.name} {currentYearData.isActive && <span className="text-primary">(Hiện tại)</span>}
                  </SelectItem>
                )}
                {/* ✅ Hiển thị các năm học khác */}
                {schoolYears
                  .filter(y => !currentYearData || (y.code || y.name) !== (currentYearData.code || currentYearData.name))
                  .map((year) => (
                    <SelectItem key={year._id} value={String(year.code || year.name)}>
                      {year.name} {year.isActive && <span className="text-primary">(Hiện tại)</span>}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {viewYear && (
              <p className="text-sm text-muted-foreground">
                Đang xem quyền của giáo viên cho năm học: <strong>{viewYear}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Danh sách tài khoản</CardTitle>
            <Badge variant="secondary">
              {filteredAccounts.length} / {accounts.length} tài khoản
            </Badge>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo email, tên, mã..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Lọc theo role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả role</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Giáo viên</SelectItem>
                <SelectItem value="student">Học sinh</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Đang tải danh sách...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Quyền mở rộng</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Không tìm thấy tài khoản nào
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAccounts.map((account) => (
                    <TableRow key={account._id}>
                      <TableCell className="font-medium">{account.email}</TableCell>
                      <TableCell>
                        {account.userInfo ? (
                          <div>
                            <div className="font-medium">{account.userInfo.name}</div>
                            {account.userInfo.code && (
                              <div className="text-sm text-muted-foreground">
                                {account.userInfo.code}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Chưa liên kết</span>
                        )}
                      </TableCell>
                      <TableCell>{getRoleBadge(account.role)}</TableCell>
                      <TableCell>
                        {account.role === "teacher" 
                          ? getFlagsBadges(account)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRole(account)}
                            title="Chỉnh sửa role"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Role
                          </Button>
                          {account.role === "teacher" && account.userInfo && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditFlags(account)}
                              title="Chỉnh sửa quyền giáo viên"
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Quyền
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          
          {/* ✅ Phân trang */}
          {!loading && filteredAccounts.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Hiển thị:</Label>
                <Select value={String(pageSize)} onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-[100px]">
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
                  / trang
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Trang {currentPage} / {totalPages} ({filteredAccounts.length} tài khoản)
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog chỉnh sửa Role */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa Role</DialogTitle>
            <DialogDescription>
              Cập nhật role cho tài khoản: {editingAccount?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teacher">Giáo viên</SelectItem>
                  <SelectItem value="student">Học sinh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingAccount?.userInfo && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Người dùng:</span> {editingAccount.userInfo.name}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleUpdateRole}>Cập nhật</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chỉnh sửa Flags */}
      <Dialog open={isFlagsDialogOpen} onOpenChange={setIsFlagsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa Quyền Giáo viên</DialogTitle>
            <DialogDescription>
              Cập nhật quyền mở rộng cho giáo viên: {editingAccount?.userInfo?.name}
              <br />
              <span className="text-xs text-muted-foreground mt-1 block">
                Quyền của giáo viên có thể được điều chỉnh theo từng năm học
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* ✅ Selector chọn năm học */}
            <div className="space-y-2">
              <Label>Năm học áp dụng quyền</Label>
              <Select value={selectedSchoolYear || "all"} onValueChange={(value) => setSelectedSchoolYear(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học (để trống = áp dụng cho tất cả năm)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả các năm học (mặc định)</SelectItem>
                  {schoolYears.map((year) => (
                    <SelectItem key={year._id} value={String(year.code || year.name)}>
                      {year.name} {year.isActive && <span className="text-primary">(Hiện tại)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedSchoolYear && selectedSchoolYear !== "all"
                  ? `Quyền sẽ được áp dụng cho năm học "${selectedSchoolYear}"`
                  : "Quyền sẽ được áp dụng cho tất cả các năm học (legacy mode)"}
              </p>
            </div>
            {/* ✅ Thông tin quyền tự động (chỉ đọc) */}
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Giáo viên chủ nhiệm (GVCN)</Label>
                    <p className="text-xs text-muted-foreground">
                      {flags.isHomeroom 
                        ? "Giáo viên này đang là GVCN trong năm học này"
                        : "Giáo viên này không phải GVCN trong năm học này"}
                    </p>
                  </div>
                  <Badge variant={flags.isHomeroom ? "default" : "secondary"}>
                    {flags.isHomeroom ? "Có" : "Không"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  💡 Quyền này được tự động set khi gán lớp chủ nhiệm. Vui lòng quản lý từ trang "Quản lý lớp học".
                </p>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Trưởng bộ môn (TBM)</Label>
                    <p className="text-xs text-muted-foreground">
                      {flags.isDepartmentHead 
                        ? "Giáo viên này đang là trưởng bộ môn trong năm học này"
                        : "Giáo viên này không phải trưởng bộ môn trong năm học này"}
                    </p>
                  </div>
                  <Badge variant={flags.isDepartmentHead ? "default" : "secondary"}>
                    {flags.isDepartmentHead ? "Có" : "Không"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  💡 Quyền này được tự động set khi gán làm trưởng bộ môn. Vui lòng quản lý từ trang "Quản lý tổ bộ môn".
                </p>
              </div>

              {/* ✅ BGH - Cho phép chỉnh sửa */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label className="text-sm font-medium">Ban giám hiệu (BGH)</Label>
                    <p className="text-xs text-muted-foreground">
                      {flags.isLeader 
                        ? "Giáo viên này có quyền BGH (quản lý toàn hệ thống)"
                        : "Giáo viên này không có quyền BGH"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      💡 Quyền BGH được set cứng ở cấp giáo viên, không thay đổi theo năm học.
                    </p>
                  </div>
                  <Switch
                    checked={flags.isLeader}
                    onCheckedChange={(checked) =>
                      setFlags({ ...flags, isLeader: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quyền bổ sung (Permissions)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Danh sách quyền tùy chỉnh bổ sung cho giáo viên (mỗi quyền một dòng)
                <br />
                <span className="text-xs italic">
                  Lưu ý: Quyền GVCN và TBM được tự động quản lý khi gán lớp chủ nhiệm/tổ bộ môn. Chỉ có thể chỉnh sửa quyền BGH và quyền bổ sung ở đây.
                </span>
              </p>
              <div className="space-y-2">
                {flags.permissions.map((perm, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={perm}
                      onChange={(e) => {
                        const newPerms = [...flags.permissions];
                        newPerms[index] = e.target.value;
                        setFlags({ ...flags, permissions: newPerms });
                      }}
                      placeholder="permission:action"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newPerms = flags.permissions.filter((_, i) => i !== index);
                        setFlags({ ...flags, permissions: newPerms });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFlags({
                      ...flags,
                      permissions: [...flags.permissions, ""],
                    });
                  }}
                >
                  + Thêm quyền
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFlagsDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleUpdateFlags}>Cập nhật</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissionManagementPage;

