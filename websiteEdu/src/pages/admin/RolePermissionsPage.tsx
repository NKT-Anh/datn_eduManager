import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { permissionApi } from '@/services/permissionApi';
import {
  Shield,
  Users,
  User,
  GraduationCap,
  Save,
  RotateCcw,
  Loader2,
  Search,
  Check,
  X,
  AlertCircle,
  Eye,
  Plus,
  Edit,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';

interface RolePermission {
  role: string;
  roleName: string;
  permissions: string[];
  allPermissions: Array<{
    key: string;
    name: string;
    enabled: boolean;
  }>;
  isFromDB: boolean;
  isDefault: boolean;
}

const RolePermissionsPage = () => {
  const { toast } = useToast();
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<string>('admin');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [roleToReset, setRoleToReset] = useState<string>('');

  // Load role permissions
  const loadRolePermissions = async () => {
    try {
      setLoading(true);
      const res = await permissionApi.getAllRolePermissions();
      if (res.success && res.data) {
        setRolePermissions(res.data);
        setHasChanges(false);
      }
    } catch (error: any) {
      console.error('Error loading role permissions:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách quyền',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRolePermissions();
  }, []);

  // Toggle permission
  const togglePermission = (role: string, permissionKey: string) => {
    setRolePermissions(prev => 
      prev.map(rp => {
        if (rp.role !== role) return rp;
        
        const allPerms = rp.allPermissions.map(p => {
          if (p.key === permissionKey) {
            return { ...p, enabled: !p.enabled };
          }
          return p;
        });
        
        const enabledPermissions = allPerms
          .filter(p => p.enabled)
          .map(p => p.key);
        
        return {
          ...rp,
          permissions: enabledPermissions,
          allPermissions: allPerms,
          isFromDB: true,
          isDefault: false,
        };
      })
    );
    setHasChanges(true);
  };

  // Save changes
  const handleSave = async () => {
    try {
      setSaving(true);
      const roleData = rolePermissions.find(rp => rp.role === activeRole);
      if (!roleData) return;

      await permissionApi.updateRolePermissions(activeRole, roleData.permissions);
      
      toast({
        title: 'Thành công',
        description: `Đã cập nhật quyền cho ${roleData.roleName}`,
      });
      
      setHasChanges(false);
      await loadRolePermissions();
    } catch (error: any) {
      console.error('Error saving role permissions:', error);
      toast({
        title: 'Lỗi',
        description: error?.response?.data?.message || 'Không thể lưu quyền',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    try {
      setSaving(true);
      await permissionApi.resetRolePermissions(roleToReset);
      
      toast({
        title: 'Thành công',
        description: `Đã reset quyền cho ${roleToReset} về mặc định`,
      });
      
      setResetDialogOpen(false);
      setRoleToReset('');
      await loadRolePermissions();
    } catch (error: any) {
      console.error('Error resetting role permissions:', error);
      toast({
        title: 'Lỗi',
        description: error?.response?.data?.message || 'Không thể reset quyền',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-5 w-5" />;
      case 'teacher':
        return <Users className="h-5 w-5" />;
      case 'student':
        return <GraduationCap className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  // Get role badge
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>;
      case 'teacher':
        return <Badge variant="default">Giáo viên</Badge>;
      case 'student':
        return <Badge variant="secondary">Học sinh</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  // Filter permissions by search term
  const filteredPermissions = (role: string) => {
    const roleData = rolePermissions.find(rp => rp.role === role);
    if (!roleData) return [];
    
    if (!searchTerm) return roleData.allPermissions;
    
    const searchLower = searchTerm.toLowerCase();
    return roleData.allPermissions.filter(p => 
      p.key.toLowerCase().includes(searchLower) ||
      p.name.toLowerCase().includes(searchLower)
    );
  };

  // Parse permission key to get module and action
  const parsePermission = (key: string) => {
    const parts = key.split(':');
    const module = parts[0];
    let action = parts[1] || '';
    
    // Map action to standard actions
    if (action.includes('view') || action.includes('View')) {
      action = 'view';
    } else if (action.includes('create') || action.includes('Create')) {
      action = 'create';
    } else if (action.includes('update') || action.includes('Update')) {
      action = 'update';
    } else if (action.includes('delete') || action.includes('Delete')) {
      action = 'delete';
    } else if (action.includes('manage') || action.includes('Manage')) {
      action = 'manage';
    } else if (action.includes('enter') || action.includes('Enter')) {
      action = 'enter';
    } else if (action.includes('handle') || action.includes('Handle')) {
      action = 'handle';
    } else if (action.includes('assign') || action.includes('Assign')) {
      action = 'assign';
    } else if (action.includes('auto') || action.includes('Auto')) {
      action = 'auto';
    } else if (action.includes('stats') || action.includes('Stats')) {
      action = 'stats';
    } else {
      action = action || 'other';
    }
    
    return { module, action, originalKey: key };
  };

  // Group permissions by module with actions
  const groupPermissionsByModule = (permissions: Array<{ key: string; name: string; enabled: boolean }>) => {
    const modules: Record<string, {
      view: Array<{ key: string; name: string; enabled: boolean }>;
      create: Array<{ key: string; name: string; enabled: boolean }>;
      update: Array<{ key: string; name: string; enabled: boolean }>;
      delete: Array<{ key: string; name: string; enabled: boolean }>;
      other: Array<{ key: string; name: string; enabled: boolean }>;
    }> = {};
    
    permissions.forEach(perm => {
      const { module, action } = parsePermission(perm.key);
      
      if (!modules[module]) {
        modules[module] = {
          view: [],
          create: [],
          update: [],
          delete: [],
          other: [],
        };
      }
      
      if (['view', 'create', 'update', 'delete'].includes(action)) {
        modules[module][action as 'view' | 'create' | 'update' | 'delete'].push(perm);
      } else {
        modules[module].other.push(perm);
      }
    });
    
    return modules;
  };

  // Get module display name
  const getModuleName = (module: string) => {
    const moduleNames: Record<string, string> = {
      'user': 'Quản lý người dùng',
      'role': 'Phân quyền hệ thống',
      'year': 'Quản lý năm học',
      'class': 'Quản lý lớp học',
      'student': 'Quản lý học sinh',
      'teacher': 'Quản lý giáo viên',
      'subject': 'Quản lý môn học',
      'department': 'Quản lý tổ bộ môn',
      'teaching_assignment': 'Phân công giảng dạy',
      'schedule': 'Thời khóa biểu',
      'grade': 'Quản lý điểm',
      'conduct': 'Hạnh kiểm',
      'exam': 'Quản lý kỳ thi',
      'exam_schedule': 'Lịch thi',
      'exam_room': 'Phòng thi',
      'exam_grade': 'Điểm thi',
      'room': 'Quản lý phòng học',
      'incident': 'Quản lý sự cố',
      'notification': 'Thông báo',
      'dashboard': 'Dashboard',
      'attendance': 'Điểm danh',
    };
    return moduleNames[module] || module;
  };

  // Toggle all permissions for a module and action
  const toggleModuleAction = (role: string, module: string, action: 'view' | 'create' | 'update' | 'delete') => {
    setRolePermissions(prev => 
      prev.map(rp => {
        if (rp.role !== role) return rp;
        
        const modulePerms = rp.allPermissions.filter(p => {
          const parsed = parsePermission(p.key);
          return parsed.module === module && parsed.action === action;
        });
        
        const allEnabled = modulePerms.every(p => p.enabled);
        const newState = !allEnabled;
        
        const allPerms = rp.allPermissions.map(p => {
          const parsed = parsePermission(p.key);
          if (parsed.module === module && parsed.action === action) {
            return { ...p, enabled: newState };
          }
          return p;
        });
        
        const enabledPermissions = allPerms
          .filter(p => p.enabled)
          .map(p => p.key);
        
        return {
          ...rp,
          permissions: enabledPermissions,
          allPermissions: allPerms,
          isFromDB: true,
          isDefault: false,
        };
      })
    );
    setHasChanges(true);
  };

  const activeRoleData = rolePermissions.find(rp => rp.role === activeRole);
  const filteredPerms = filteredPermissions(activeRole);
  const groupedPerms = groupPermissionsByModule(filteredPerms);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Phân quyền hệ thống
          </h1>
          <p className="text-muted-foreground">
            Quản lý quyền truy cập cho các role trong hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Có thay đổi chưa lưu
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setRoleToReset(activeRole);
              setResetDialogOpen(true);
            }}
            disabled={saving || loading}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset về mặc định
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving || loading}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Lưu thay đổi
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Lưu ý về phân quyền hệ thống:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Quyền được áp dụng cho tất cả người dùng có role tương ứng</li>
                <li>Thay đổi quyền sẽ ảnh hưởng đến toàn bộ hệ thống</li>
                <li>Có thể reset về quyền mặc định từ config bất cứ lúc nào</li>
                <li>Quyền được lưu vào database và sẽ ưu tiên hơn quyền mặc định</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Tabs */}
      <Tabs value={activeRole} onValueChange={setActiveRole}>
        <TabsList className="grid w-full grid-cols-3">
          {rolePermissions.map(rp => (
            <TabsTrigger key={rp.role} value={rp.role} className="flex items-center gap-2">
              {getRoleIcon(rp.role)}
              <span>{rp.roleName}</span>
              {rp.isFromDB && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Đã tùy chỉnh
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {rolePermissions.map(rp => (
          <TabsContent key={rp.role} value={rp.role} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {getRoleIcon(rp.role)}
                      {rp.roleName}
                      {getRoleBadge(rp.role)}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {rp.permissions.length} quyền được kích hoạt / {rp.allPermissions.length} quyền tổng cộng
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm kiếm quyền..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Permissions grouped by module with actions */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : Object.keys(groupedPerms).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Không tìm thấy quyền nào
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedPerms).map(([module, actions]) => {
                      const hasAnyPermission = 
                        actions.view.length > 0 ||
                        actions.create.length > 0 ||
                        actions.update.length > 0 ||
                        actions.delete.length > 0 ||
                        actions.other.length > 0;
                      
                      if (!hasAnyPermission) return null;
                      
                      return (
                        <Card key={module} className="overflow-hidden">
                          <CardHeader className="bg-muted/50">
                            <CardTitle className="text-lg">{getModuleName(module)}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[200px]">Chức năng</TableHead>
                                    <TableHead className="text-center w-[120px]">
                                      <div className="flex flex-col items-center gap-1">
                                        <Eye className="h-4 w-4" />
                                        <span className="text-xs">Xem</span>
                                      </div>
                                    </TableHead>
                                    <TableHead className="text-center w-[120px]">
                                      <div className="flex flex-col items-center gap-1">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs">Thêm</span>
                                      </div>
                                    </TableHead>
                                    <TableHead className="text-center w-[120px]">
                                      <div className="flex flex-col items-center gap-1">
                                        <Edit className="h-4 w-4" />
                                        <span className="text-xs">Sửa</span>
                                      </div>
                                    </TableHead>
                                    <TableHead className="text-center w-[120px]">
                                      <div className="flex flex-col items-center gap-1">
                                        <Trash2 className="h-4 w-4" />
                                        <span className="text-xs">Xóa</span>
                                      </div>
                                    </TableHead>
                                    <TableHead className="w-[300px]">Quyền khác</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  <TableRow>
                                    <TableCell className="font-medium">
                                      {getModuleName(module)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {actions.view.length > 0 ? (
                                        <div className="flex flex-col items-center gap-2">
                                          <Switch
                                            checked={actions.view.every(p => p.enabled)}
                                            onCheckedChange={() => toggleModuleAction(rp.role, module, 'view')}
                                          />
                                          <span className="text-xs text-muted-foreground">
                                            {actions.view.filter(p => p.enabled).length}/{actions.view.length}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {actions.create.length > 0 ? (
                                        <div className="flex flex-col items-center gap-2">
                                          <Switch
                                            checked={actions.create.every(p => p.enabled)}
                                            onCheckedChange={() => toggleModuleAction(rp.role, module, 'create')}
                                          />
                                          <span className="text-xs text-muted-foreground">
                                            {actions.create.filter(p => p.enabled).length}/{actions.create.length}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {actions.update.length > 0 ? (
                                        <div className="flex flex-col items-center gap-2">
                                          <Switch
                                            checked={actions.update.every(p => p.enabled)}
                                            onCheckedChange={() => toggleModuleAction(rp.role, module, 'update')}
                                          />
                                          <span className="text-xs text-muted-foreground">
                                            {actions.update.filter(p => p.enabled).length}/{actions.update.length}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {actions.delete.length > 0 ? (
                                        <div className="flex flex-col items-center gap-2">
                                          <Switch
                                            checked={actions.delete.every(p => p.enabled)}
                                            onCheckedChange={() => toggleModuleAction(rp.role, module, 'delete')}
                                          />
                                          <span className="text-xs text-muted-foreground">
                                            {actions.delete.filter(p => p.enabled).length}/{actions.delete.length}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {actions.other.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                          {actions.other.map(perm => (
                                            <div
                                              key={perm.key}
                                              className="flex items-center gap-2 p-1.5 border rounded text-xs"
                                            >
                                              <Switch
                                                checked={perm.enabled}
                                                onCheckedChange={() => togglePermission(rp.role, perm.key)}
                                                className="scale-75"
                                              />
                                              <span className="text-xs">{perm.name}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                            
                            {/* Detailed permissions list (collapsible) */}
                            {(actions.view.length > 0 || actions.create.length > 0 || 
                              actions.update.length > 0 || actions.delete.length > 0) && (
                              <div className="p-4 bg-muted/30 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                  {actions.view.map(perm => (
                                    <div
                                      key={perm.key}
                                      className="flex items-center gap-2 p-2 border rounded text-sm"
                                    >
                                      <Switch
                                        checked={perm.enabled}
                                        onCheckedChange={() => togglePermission(rp.role, perm.key)}
                                        className="scale-90"
                                      />
                                      <Label className="text-xs cursor-pointer flex-1">
                                        {perm.name}
                                      </Label>
                                    </div>
                                  ))}
                                  {actions.create.map(perm => (
                                    <div
                                      key={perm.key}
                                      className="flex items-center gap-2 p-2 border rounded text-sm"
                                    >
                                      <Switch
                                        checked={perm.enabled}
                                        onCheckedChange={() => togglePermission(rp.role, perm.key)}
                                        className="scale-90"
                                      />
                                      <Label className="text-xs cursor-pointer flex-1">
                                        {perm.name}
                                      </Label>
                                    </div>
                                  ))}
                                  {actions.update.map(perm => (
                                    <div
                                      key={perm.key}
                                      className="flex items-center gap-2 p-2 border rounded text-sm"
                                    >
                                      <Switch
                                        checked={perm.enabled}
                                        onCheckedChange={() => togglePermission(rp.role, perm.key)}
                                        className="scale-90"
                                      />
                                      <Label className="text-xs cursor-pointer flex-1">
                                        {perm.name}
                                      </Label>
                                    </div>
                                  ))}
                                  {actions.delete.map(perm => (
                                    <div
                                      key={perm.key}
                                      className="flex items-center gap-2 p-2 border rounded text-sm"
                                    >
                                      <Switch
                                        checked={perm.enabled}
                                        onCheckedChange={() => togglePermission(rp.role, perm.key)}
                                        className="scale-90"
                                      />
                                      <Label className="text-xs cursor-pointer flex-1">
                                        {perm.name}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset quyền về mặc định</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn reset quyền cho role <strong>{roleToReset}</strong> về mặc định từ config?
              <br />
              <span className="text-destructive font-medium">
                Tất cả các thay đổi tùy chỉnh sẽ bị mất!
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetDialogOpen(false);
                setRoleToReset('');
              }}
            >
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang reset...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RolePermissionsPage;

