import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Edit,
  Save,
  Camera
} from 'lucide-react';
import profileApi from '@/services/profileApi';


const roleMap: Record<string, string> = {
  admin: 'Quản lý hệ thống',
  student: 'Học sinh',
  teacher: 'Giáo viên',
  parent: 'Phụ huynh'
};

const ProfilePage = () => {
  const { backendUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await profileApi.getProfile();
        setProfile(data);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <p>Đang tải...</p>;
  if (!profile) return <p>Không có dữ liệu</p>;

  const handleSave = async () => {
    try {
      await profileApi.updateProfile(profile);
      if (password) {
        await profileApi.changePassword(password);
        setPassword('');
      }
      setIsEditing(false);
      alert('Cập nhật thành công');
    } catch (err) {
      console.error(err);
      alert('Cập nhật thất bại');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Hồ sơ cá nhân</h1>
          <p className="text-muted-foreground">Xem và cập nhật thông tin cá nhân của bạn</p>
        </div>
        <Button onClick={isEditing ? handleSave : () => setIsEditing(true)}>
          {isEditing ? (
            <>
              <Save className="h-4 w-4 mr-2" /> Lưu thay đổi
            </>
          ) : (
            <>
              <Edit className="h-4 w-4 mr-2" /> Chỉnh sửa
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <Card className="text-center">
          <CardContent>
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
                <User className="h-12 w-12 text-white" />
              </div>
              {isEditing && (
                <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2">
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
            <h2 className="text-xl font-semibold mb-2">{profile.name}</h2>
            <p className="text-muted-foreground capitalize">{profile.role}</p>
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Thông tin cá nhân</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Họ và tên</Label>
                <Input
                  value={profile.name || ''}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={profile.email || ''} disabled />
              </div>
              <div>
                <Label>Số điện thoại</Label>
                <Input
                  value={profile.phone || ''}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Ngày sinh</Label>
                <Input
                  type="date"
                  value={profile.dob ? profile.dob.split('T')[0] : ''}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Địa chỉ</Label>
                <Input
                  value={profile.address || ''}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role-specific */}
        {profile.role === 'admin' && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Thông tin công việc</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Chức vụ</Label>
                <Input
                  value={profile.position || ''}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                />
              </div>
              <div>
                <Label>Bộ phận</Label>
                <Input
                  value={profile.department || ''}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {isEditing && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Đổi mật khẩu</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Mật khẩu mới</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
