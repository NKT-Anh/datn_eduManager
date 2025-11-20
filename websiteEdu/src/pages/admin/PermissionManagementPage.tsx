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
import { Search, Shield, User, Edit, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import userApi from "@/services/userApi";

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
}

const PermissionManagementPage = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AccountWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [editingAccount, setEditingAccount] = useState<AccountWithPermissions | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isFlagsDialogOpen, setIsFlagsDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [flags, setFlags] = useState({
    isHomeroom: false,
    isDepartmentHead: false,
    isLeader: false,
    permissions: [] as string[],
  });

  // Load accounts
  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await userApi.getAllAccountsWithPermissions();
      setAccounts(res.data || []);
    } catch (error: any) {
      console.error("Error loading accounts:", error);
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể tải danh sách tài khoản",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return accounts.filter((acc) => {
      const matchesSearch =
        !searchTerm ||
        acc.email.toLowerCase().includes(lower) ||
        acc.userInfo?.name?.toLowerCase().includes(lower) ||
        acc.userInfo?.code?.toLowerCase().includes(lower);
      
      const matchesRole = filterRole === "all" || acc.role === filterRole;
      
      return matchesSearch && matchesRole;
    });
  }, [accounts, searchTerm, filterRole]);

  // Open role edit dialog
  const handleEditRole = (account: AccountWithPermissions) => {
    setEditingAccount(account);
    setNewRole(account.role);
    setIsRoleDialogOpen(true);
  };

  // Open flags edit dialog
  const handleEditFlags = (account: AccountWithPermissions) => {
    if (account.role !== "teacher" || !account.teacherFlags) {
      toast({
        title: "Lỗi",
        description: "Chỉ có thể chỉnh sửa flags cho giáo viên",
        variant: "destructive",
      });
      return;
    }
    setEditingAccount(account);
    setFlags({
      isHomeroom: account.teacherFlags.isHomeroom || false,
      isDepartmentHead: account.teacherFlags.isDepartmentHead || false,
      isLeader: account.teacherFlags.isLeader || false,
      permissions: account.teacherFlags.permissions || [],
    });
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

  // Update flags
  const handleUpdateFlags = async () => {
    if (!editingAccount || !editingAccount.userInfo) return;

    try {
      await userApi.updateTeacherFlags(editingAccount.userInfo._id, flags);
      toast({
        title: "Thành công",
        description: "Đã cập nhật quyền giáo viên thành công",
      });
      setIsFlagsDialogOpen(false);
      setEditingAccount(null);
      loadAccounts();
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

  // Get flags badges
  const getFlagsBadges = (teacherFlags?: AccountWithPermissions["teacherFlags"]) => {
    if (!teacherFlags) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {teacherFlags.isHomeroom && (
          <Badge variant="outline" className="text-xs">GVCN</Badge>
        )}
        {teacherFlags.isDepartmentHead && (
          <Badge variant="outline" className="text-xs">TBM</Badge>
        )}
        {teacherFlags.isLeader && (
          <Badge variant="outline" className="text-xs">BGH</Badge>
        )}
        {teacherFlags.permissions && teacherFlags.permissions.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{teacherFlags.permissions.length} quyền
          </Badge>
        )}
      </div>
    );
  };

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
        </div>
      </div>

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
                  filteredAccounts.map((account) => (
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
                        {account.role === "teacher" && account.teacherFlags
                          ? getFlagsBadges(account.teacherFlags)
                          : account.role === "teacher" && !account.teacherFlags
                          ? <span className="text-muted-foreground text-sm">Chưa có flags</span>
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
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Giáo viên chủ nhiệm (GVCN)</Label>
                  <p className="text-sm text-muted-foreground">
                    Cho phép quản lý lớp chủ nhiệm
                  </p>
                </div>
                <Switch
                  checked={flags.isHomeroom}
                  onCheckedChange={(checked) =>
                    setFlags({ ...flags, isHomeroom: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Trưởng bộ môn (TBM)</Label>
                  <p className="text-sm text-muted-foreground">
                    Cho phép quản lý tổ bộ môn
                  </p>
                </div>
                <Switch
                  checked={flags.isDepartmentHead}
                  onCheckedChange={(checked) =>
                    setFlags({ ...flags, isDepartmentHead: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ban giám hiệu (BGH)</Label>
                  <p className="text-sm text-muted-foreground">
                    Cho phép quyền quản lý toàn hệ thống
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

            <div className="space-y-2">
              <Label>Quyền bổ sung (Permissions)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Danh sách quyền tùy chỉnh (mỗi quyền một dòng)
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

