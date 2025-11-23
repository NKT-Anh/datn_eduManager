import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import userApi from '@/services/userApi';
import settingApi from '@/services/settingApi';
import { AlertCircle, Mail } from 'lucide-react';

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  userData?: {
    _id: string;
    name: string;
    code?: string;
    teacherCode?: string;
    phone?: string;
  };
}

const ROLE_OPTIONS = [
  { value: 'student', label: 'Học sinh' },
  { value: 'teacher', label: 'Giáo viên' },
  { value: 'admin', label: 'Quản trị hệ thống (Admin)' },
  { value: 'bgh', label: 'Ban Giám Hiệu (BGH)' },
  { value: 'qlbm', label: 'Quản lý bộ môn (QLBM)' },
  { value: 'gvcn', label: 'Giáo viên chủ nhiệm (GVCN)' },
  { value: 'gvbm', label: 'Giáo viên bộ môn (GVBM)' },
];

export const CreateAccountDialog = ({
  open,
  onOpenChange,
  onSuccess,
  userData,
}: CreateAccountDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [emailDomain, setEmailDomain] = useState<string>('');
  const [settings, setSettings] = useState<any>(null);

  // Load settings để lấy domain
  useEffect(() => {
    if (open) {
      settingApi
        .getSettings()
        .then((res) => {
          // res có thể là data trực tiếp hoặc res.data
          setSettings(res.data || res);
        })
        .catch(() => {
          toast({
            title: 'Lỗi',
            description: 'Không thể tải cấu hình email domain',
            variant: 'destructive',
          });
        });
    }
  }, [open, toast]);

  // Load user data nếu có
  useEffect(() => {
    if (open && userData) {
      setCode(userData.code || userData.teacherCode || '');
      setRole('');
      setEmail('');
      setEmailDomain('');
    }
  }, [open, userData]);

  // Cập nhật domain và email khi role hoặc code thay đổi
  useEffect(() => {
    if (!settings || !role || !code) {
      setEmailDomain('');
      setEmail('');
      return;
    }

    const domainMap: Record<string, string> = {
      student: settings?.studentEmailDomain || 'student.school.com',
      teacher: settings?.teacherEmailDomain || 'teacher.school.com',
      admin: settings?.adminEmailDomain || 'admin.school.com',
      bgh: settings?.bghEmailDomain || 'bgh.school.com',
      // GVCN, GVBM, QLBM đều dùng chung domain giáo viên để tránh mất dữ liệu khi đổi role
      qlbm: settings?.teacherEmailDomain || 'teacher.school.com',
      gvcn: settings?.teacherEmailDomain || 'teacher.school.com',
      gvbm: settings?.teacherEmailDomain || 'teacher.school.com',
    };

    const domain = domainMap[role] || 'school.com';
    setEmailDomain(domain);
    setEmail(`${code}@${domain}`);
  }, [role, code, settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!role) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn role',
        variant: 'destructive',
      });
      return;
    }

    if (!code) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập mã',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Nếu có userData, tạo tài khoản cho user đó
      if (userData) {
        let res;
        if (role === 'student') {
          res = await userApi.createBatchStudents({
            students: [{ _id: userData._id, studentCode: code, phone: userData.phone }],
          });
        } else if (role === 'teacher') {
          res = await userApi.createBatchTeachers({
            teachers: [{ _id: userData._id, teacherCode: code, phone: userData.phone }],
          });
        } else {
          // Các role khác (admin, bgh, qlbm, gvcn, gvbm)
          res = await userApi.createBatchAccounts({
            users: [{ _id: userData._id, code, phone: userData.phone }],
            role,
          });
        }

        toast({
          title: 'Thành công',
          description: `Đã tạo tài khoản ${role} cho ${userData.name}`,
        });

        onSuccess?.();
        onOpenChange(false);
        // Reset form
        setRole('');
        setCode('');
        setEmail('');
      } else {
        // Tạo tài khoản mới không gắn với user cụ thể
        // Cần tạo user trước hoặc chỉ tạo account
        toast({
          title: 'Lỗi',
          description: 'Cần chọn người dùng để tạo tài khoản',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || error.message || 'Không thể tạo tài khoản',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Tạo tài khoản</DialogTitle>
          <DialogDescription>
            {userData
              ? `Tạo tài khoản cho ${userData.name}`
              : 'Tạo tài khoản mới cho người dùng'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Chọn Role */}
          <div className="space-y-2">
            <Label>Vai trò (Role) *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Lưu ý: GVCN, GVBM, QLBM đều là giáo viên và dùng chung domain email để tránh mất dữ liệu khi đổi role
            </p>
          </div>

          {/* Mã (Code) */}
          <div className="space-y-2">
            <Label>Mã *</Label>
            <Input
              placeholder={
                role === 'student'
                  ? 'Mã học sinh (VD: HS001)'
                  : role === 'admin'
                  ? 'Mã admin (VD: AD001)'
                  : 'Mã giáo viên (VD: GV001)'
              }
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          {/* Hiển thị Domain Email */}
          {role && emailDomain && (
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Domain Email:</Label>
              </div>
              <div className="text-sm">
                <span className="font-mono text-primary">{emailDomain}</span>
              </div>
            </div>
          )}

          {/* Hiển thị Email đầy đủ */}
          {role && code && email && (
            <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Email sẽ được tạo:</Label>
              </div>
              <div className="text-sm font-mono text-primary">{email}</div>
            </div>
          )}

          {/* Thông tin user nếu có */}
          {userData && (
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <Label className="text-sm font-medium">Thông tin người dùng:</Label>
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-medium">Tên:</span> {userData.name}
                </p>
                {userData.phone && (
                  <p>
                    <span className="font-medium">SĐT:</span> {userData.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setRole('');
                setCode('');
                setEmail('');
              }}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={loading || !role || !code}>
              {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

