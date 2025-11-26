// src/pages/SettingsPage.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Bell,
  Shield,
  Database,
  Mail,
  Save,
  RefreshCw,
  Download,
  BookOpen,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import settingApi from '@/services/settingApi';
import backupApi from '@/services/backupApi';
import { useSchoolYears } from '@/hooks';
import { Info } from 'lucide-react';

const SettingsPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const { schoolYears, currentYearData } = useSchoolYears();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [uploadToDrive, setUploadToDrive] = useState(false); // Tùy chọn upload lên Google Drive

  // settings state
  const [settings, setSettings] = useState<any>({
    schoolName: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    currentSchoolYear: '',
    termStart: '',
    termEnd: '',
    gradingScale: '10',
    passThreshold: 5.0,
    notifyEmail: true,
    notifySMS: false,
    notifyAbsence: true,
    notifyGrades: true,
    autoBackup: 'weekly',
    retentionMonths: 12,
    sessionTimeoutMinutes: 30,
    passwordPolicy: 'medium',
    smtp: {
      host: '',
      port: 587,
      user: '',
      pass: '',
      secure: false
    },
    studentEmailDomain: '',
    teacherEmailDomain: ''
  });

  // load settings
  useEffect(() => {
    setLoading(true);
    settingApi.getSettings()
      .then((data) => {
        if (data) {
          setSettings((s: any) => ({ ...s, ...data }));
          // Load giá trị autoUploadToDrive từ settings
          setUploadToDrive(data.autoUploadToDrive || false);
        }
      })
      .catch((err) => {
        console.error(err);
        toast({
          title: 'Lỗi',
          description: 'Không tải được cấu hình',
          variant: 'destructive'
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (backendUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Không có quyền truy cập</h2>
          <p className="text-muted-foreground mt-2">Bạn không có quyền truy cập trang này.</p>
        </div>
      </div>
    );
  }

  const handleChange = (path: string, value: any) => {
    setSettings((s: any) => {
      const copy = { ...s };
      if (path.startsWith('smtp.')) {
        const key = path.replace('smtp.', '');
        copy.smtp = { ...(copy.smtp || {}), [key]: value };
      } else {
        copy[path] = value;
      }
      return copy;
    });
  };

  // ✅ Tự động lưu autoUploadToDrive khi thay đổi
  const handleUploadToDriveChange = async (checked: boolean) => {
    setUploadToDrive(checked);
    try {
      // Lưu ngay vào database
      const settingsToSave = { ...settings, autoUploadToDrive: checked };
      delete settingsToSave.currentSchoolYear;
      delete settingsToSave.termStart;
      delete settingsToSave.termEnd;
      await settingApi.updateSettings(settingsToSave);
      handleChange('autoUploadToDrive', checked);
    } catch (err: any) {
      console.error('Lỗi khi lưu autoUploadToDrive:', err);
      // Revert nếu lỗi
      setUploadToDrive(!checked);
      toast({
        title: 'Lỗi',
        description: 'Không thể lưu cài đặt upload Google Drive',
        variant: 'destructive'
      });
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // ✅ Loại bỏ các trường năm học và học kỳ (chỉ lấy từ năm học active, không lưu vào settings)
      const settingsToSave = { ...settings };
      delete settingsToSave.currentSchoolYear;
      delete settingsToSave.termStart;
      delete settingsToSave.termEnd;
      
      // ✅ Lưu giá trị autoUploadToDrive vào settings
      settingsToSave.autoUploadToDrive = uploadToDrive;
      
      await settingApi.updateSettings(settingsToSave);
      toast({ title: 'Lưu thành công', description: 'Cấu hình đã được cập nhật.' });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không lưu được',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      const res = await settingApi.resetSettings();
      setSettings(res);
      toast({ title: 'Đặt lại cấu hình', description: 'Đã đặt lại về mặc định.' });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Lỗi',
        description: 'Không reset được',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Xử lý sao lưu ngay
  const handleBackupNow = async () => {
    try {
      setBackupLoading(true);
      const backup = await backupApi.createBackup({
        uploadToDrive: uploadToDrive, // Sử dụng giá trị từ checkbox
        description: 'Sao lưu thủ công từ trang cài đặt',
      });
      
      toast({
        title: 'Đang tạo sao lưu',
        description: `Đang tạo backup: ${backup.filename || 'Đang xử lý...'}`,
      });

      // Poll để kiểm tra status (nếu cần)
      const checkStatus = async () => {
        try {
          const backups = await backupApi.getBackups();
          // Đảm bảo backups là array
          const backupsArray = Array.isArray(backups) ? backups : [];
          const currentBackup = backupsArray.find((b) => b._id === backup._id);
          if (currentBackup) {
            if (currentBackup.status === 'completed') {
              toast({
                title: 'Sao lưu thành công',
                description: `Backup đã được tạo: ${currentBackup.filename}`,
              });
            } else if (currentBackup.status === 'failed') {
              toast({
                title: 'Sao lưu thất bại',
                description: currentBackup.error || 'Có lỗi xảy ra khi tạo backup',
                variant: 'destructive',
              });
            }
          }
        } catch (err) {
          console.error('Lỗi khi kiểm tra status backup:', err);
        }
      };

      // Kiểm tra sau 2 giây
      setTimeout(checkStatus, 2000);
    } catch (err: any) {
      console.error('Lỗi khi tạo backup:', err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể tạo sao lưu',
        variant: 'destructive',
      });
    } finally {
      setBackupLoading(false);
    }
  };

  // ✅ Xử lý xuất dữ liệu (tạo backup và download)
  const handleExportData = async () => {
    try {
      setExportLoading(true);
      
      // Tạo backup mới
      const backup = await backupApi.createBackup({
        uploadToDrive: false,
        description: 'Xuất dữ liệu từ trang cài đặt',
      });

      toast({
        title: 'Đang tạo backup để xuất',
        description: 'Đang tạo file backup...',
      });

      // Đợi một chút để backup hoàn thành
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Kiểm tra status và download
      const backups = await backupApi.getBackups();
      // Đảm bảo backups là array
      const backupsArray = Array.isArray(backups) ? backups : [];
      const currentBackup = backupsArray.find((b) => b._id === backup._id);
      
      if (currentBackup && currentBackup.status === 'completed') {
        // Download file
        const blob = await backupApi.downloadBackup(currentBackup._id);
        
        // Tạo link download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentBackup.filename || 'backup.tar.gz';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Xuất dữ liệu thành công',
          description: `Đã tải xuống file: ${currentBackup.filename}`,
        });
      } else {
        toast({
          title: 'Đang xử lý',
          description: 'Backup đang được tạo, vui lòng thử lại sau vài giây',
        });
      }
    } catch (err: any) {
      console.error('Lỗi khi xuất dữ liệu:', err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể xuất dữ liệu',
        variant: 'destructive',
      });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cài đặt hệ thống</h1>
          <p className="text-muted-foreground">Cấu hình phù hợp Trung học Phổ thông</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="bg-gradient-primary hover:bg-primary-hover" onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Lưu tất cả
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Đặt về mặc định
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General */}
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-primary" />
              <span>Thông tin trường & năm học</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="schoolName">Tên trường</Label>
                <Input id="schoolName" value={settings.schoolName} onChange={(e) => handleChange('schoolName', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="address">Địa chỉ</Label>
                <Input id="address" value={settings.address} onChange={(e) => handleChange('address', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="phone">SĐT</Label>
                  <Input id="phone" value={settings.phone} onChange={(e) => handleChange('phone', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={settings.email} onChange={(e) => handleChange('email', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" value={settings.website} onChange={(e) => handleChange('website', e.target.value)} />
                </div>
              </div>

              {/* ✅ Thông tin năm học và học kỳ (chỉ đọc, lấy từ năm học active) */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium text-muted-foreground">
                    Thông tin năm học và học kỳ được lấy từ năm học đang active (chỉ xem, không thể chỉnh sửa)
                  </Label>
                </div>
                
                {currentYearData ? (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
                    {/* Năm học hiện tại */}
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Năm học hiện tại</Label>
                      <div className="mt-1">
                        <p className="text-base font-semibold">{currentYearData.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{currentYearData.code}</p>
                      </div>
                    </div>

                    {/* Học kỳ 1 */}
                    {(() => {
                      const semester1 = currentYearData.semesters?.find(
                        (s) => s.code === 'HK1' || s.code === '1' || s.name?.toLowerCase().includes('học kỳ 1') || s.name?.toLowerCase().includes('học kì 1')
                      );
                      return semester1 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Học kỳ 1 - Bắt đầu</Label>
                            <p className="mt-1 text-sm">
                              {semester1.startDate 
                                ? new Date(semester1.startDate).toLocaleDateString('vi-VN', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric' 
                                  })
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Học kỳ 1 - Kết thúc</Label>
                            <p className="mt-1 text-sm">
                              {semester1.endDate 
                                ? new Date(semester1.endDate).toLocaleDateString('vi-VN', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric' 
                                  })
                                : '-'}
                            </p>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Học kỳ 2 */}
                    {(() => {
                      const semester2 = currentYearData.semesters?.find(
                        (s) => s.code === 'HK2' || s.code === '2' || s.name?.toLowerCase().includes('học kỳ 2') || s.name?.toLowerCase().includes('học kì 2')
                      );
                      return semester2 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Học kỳ 2 - Bắt đầu</Label>
                            <p className="mt-1 text-sm">
                              {semester2.startDate 
                                ? new Date(semester2.startDate).toLocaleDateString('vi-VN', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric' 
                                  })
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Học kỳ 2 - Kết thúc</Label>
                            <p className="mt-1 text-sm">
                              {semester2.endDate 
                                ? new Date(semester2.endDate).toLocaleDateString('vi-VN', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric' 
                                  })
                                : '-'}
                            </p>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ Chưa có năm học nào được kích hoạt. Vui lòng kích hoạt một năm học trong trang Quản lý năm học.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-primary" />
              <span>Thông báo & vắng</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Thông báo Email</Label>
                <p className="text-sm text-muted-foreground">Gửi thông báo chung và vắng mặt qua email</p>
              </div>
              <Switch checked={!!settings.notifyEmail} onCheckedChange={(v) => handleChange('notifyEmail', v)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Thông báo SMS</Label>
                <p className="text-sm text-muted-foreground">SMS cho các thông báo khẩn</p>
              </div>
              <Switch checked={!!settings.notifySMS} onCheckedChange={(v) => handleChange('notifySMS', v)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Thông báo vắng mặt</Label>
                <p className="text-sm text-muted-foreground">Tự động thông báo khi học sinh vắng</p>
              </div>
              <Switch checked={!!settings.notifyAbsence} onCheckedChange={(v) => handleChange('notifyAbsence', v)} />
            </div>

            <div>
              <Label>Quy định điểm & đạt</Label>
              <div className="flex gap-2 mt-2">
                <select value={settings.gradingScale} onChange={(e) => handleChange('gradingScale', e.target.value)} className="border px-2 py-1 rounded">
                  <option value="10">Thang 10</option>
                  <option value="4">Thang 4</option>
                </select>
                <Input type="number" value={settings.passThreshold} onChange={(e) => handleChange('passThreshold', Number(e.target.value))} />
                <span className="text-sm self-end text-muted-foreground">Ngưỡng đạt</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <span>Bảo mật & Phiên</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Xác thực 2 yếu tố</Label>
              </div>
              <Switch checked={!!settings.twoFactor} onCheckedChange={(v) => handleChange('twoFactor', v)} />
            </div>
            <div>
              <Label>Thời gian phiên (phút)</Label>
              <Input type="number" value={settings.sessionTimeoutMinutes} onChange={(e) => handleChange('sessionTimeoutMinutes', Number(e.target.value))} />
            </div>
            <div>
              <Label>Chính sách mật khẩu</Label>
              <select value={settings.passwordPolicy} onChange={(e) => handleChange('passwordPolicy', e.target.value)} className="w-full px-3 py-2 border rounded">
                <option value="basic">Cơ bản (6 ký tự)</option>
                <option value="medium">Trung bình (8 ký tự, chữ + số)</option>
                <option value="strong">Mạnh (10 ký tự, chữ + số + ký tự đặc biệt)</option>
              </select>
            </div>
          </CardContent>
        </Card>
        {/* Default Password */}
<Card className="shadow-card border-border">
  <CardHeader>
    <CardTitle className="flex items-center space-x-2">
      <Shield className="h-5 w-5 text-primary" />
      <span>Tài khoản & Mật khẩu mặc định</span>
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div>
      <Label>Mật khẩu mặc định</Label>
      <Input
        type="text"
        value={settings.defaultPassword || '123456'}
        onChange={(e) => handleChange('defaultPassword', e.target.value)}
        placeholder="Nhập mật khẩu mặc định (VD: 123456)"
      />
      <p className="text-sm text-muted-foreground mt-1">
        Dùng khi tạo tài khoản tự động cho học sinh và giáo viên.
      </p>
    </div>
  </CardContent>
</Card>
{/* Email Domain & Test */}
<Card className="lg:col-span-2 shadow-card border-border">
  <CardHeader>
    <CardTitle className="flex items-center space-x-2">
      <Mail className="h-5 w-5 text-primary" />
      <span>Email Domain & Test</span>
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label>Email Domain Học sinh</Label>
        <Input
          value={settings.studentEmailDomain || '@mailhs'}
          onChange={(e) => handleChange('studentEmailDomain', e.target.value)}
          placeholder="@mailhs"
        />
      </div>
      <div>
        <Label>Email Domain Giáo viên</Label>
        <Input
          value={settings.teacherEmailDomain || '@mailgv'}
          onChange={(e) => handleChange('teacherEmailDomain', e.target.value)}
          placeholder="@mailgv"
        />
      </div>
      <div className="md:col-span-2">
        <Label>Test Email</Label>
        <div className="flex gap-2">
          <Input
            value={settings.testEmail || ''}
            onChange={(e) => handleChange('testEmail', e.target.value)}
            placeholder="nhập email nhận thử"
          />
          <Button
            onClick={async () => {
              try {
                setLoading(true);
                await settingApi.sendTestEmail(settings.testEmail);
                toast({ title: 'Thành công', description: 'Email test đã gửi!' });
              } catch (err: any) {
                console.error(err);
                toast({ title: 'Lỗi', description: 'Không gửi được email', variant: 'destructive' });
              } finally {
                setLoading(false);
              }
            }}
          >
            Gửi Test
          </Button>
        </div>
      </div>
    </div>
  </CardContent>
</Card>


        {/* Data */}
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-primary" />
              <span>Quản lý dữ liệu</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sao lưu tự động</Label>
              <select 
                value={settings.autoBackup} 
                onChange={(e) => {
                  handleChange('autoBackup', e.target.value);
                  // Tự động lưu khi thay đổi
                  setTimeout(() => {
                    const updatedSettings = { ...settings, autoBackup: e.target.value };
                    const settingsToSave = { ...updatedSettings };
                    delete settingsToSave.currentSchoolYear;
                    delete settingsToSave.termStart;
                    delete settingsToSave.termEnd;
                    settingApi.updateSettings(settingsToSave).catch((err) => {
                      console.error('Lỗi khi lưu cài đặt backup:', err);
                    });
                  }, 500);
                }} 
                className="w-full px-3 py-2 border rounded"
              >
                <option value="daily">Hàng ngày</option>
                <option value="weekly">Hàng tuần</option>
                <option value="monthly">Hàng tháng</option>
                <option value="never">Không</option>
              </select>
            </div>
            <div>
              <Label>Thời gian lưu (tháng)</Label>
              <Input 
                type="number" 
                value={settings.retentionMonths} 
                onChange={(e) => {
                  const value = Number(e.target.value);
                  handleChange('retentionMonths', value);
                  // Tự động lưu khi thay đổi
                  setTimeout(() => {
                    const updatedSettings = { ...settings, retentionMonths: value };
                    const settingsToSave = { ...updatedSettings };
                    delete settingsToSave.currentSchoolYear;
                    delete settingsToSave.termStart;
                    delete settingsToSave.termEnd;
                    settingApi.updateSettings(settingsToSave).catch((err) => {
                      console.error('Lỗi khi lưu cài đặt backup:', err);
                    });
                  }, 500);
                }} 
                min="1"
                max="60"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="upload-drive" 
                  checked={uploadToDrive}
                  onCheckedChange={handleUploadToDriveChange}
                />
                <Label htmlFor="upload-drive" className="text-sm cursor-pointer">
                  Tự động upload lên Google Drive
                </Label>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleBackupNow}
                  disabled={backupLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${backupLoading ? 'animate-spin' : ''}`} />
                  {backupLoading ? 'Đang sao lưu...' : 'Sao lưu ngay'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleExportData}
                  disabled={exportLoading}
                >
                  <Download className={`h-4 w-4 mr-2 ${exportLoading ? 'animate-spin' : ''}`} />
                  {exportLoading ? 'Đang xuất...' : 'Xuất dữ liệu'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
{/* Grade Entry Period */}
<Card className="shadow-card border-border">
  <CardHeader>
    <CardTitle className="flex items-center space-x-2">
      <BookOpen className="h-5 w-5 text-primary" />
      <span>Thời gian nhập điểm</span>
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Thiết lập khoảng thời gian giáo viên có thể nhập và chỉnh sửa điểm
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <Label>Ngày bắt đầu HK1</Label>
        <Input
          type="date"
          value={settings.gradeEntryStartHK1 || ''}
          onChange={(e) => handleChange('gradeEntryStartHK1', e.target.value)}
        />
      </div>
      <div>
        <Label>Ngày kết thúc HK1</Label>
        <Input
          type="date"
          value={settings.gradeEntryEndHK1 || ''}
          onChange={(e) => handleChange('gradeEntryEndHK1', e.target.value)}
        />
      </div>
      <div>
        <Label>Ngày bắt đầu HK2</Label>
        <Input
          type="date"
          value={settings.gradeEntryStartHK2 || ''}
          onChange={(e) => handleChange('gradeEntryStartHK2', e.target.value)}
        />
      </div>
      <div>
        <Label>Ngày kết thúc HK2</Label>
        <Input
          type="date"
          value={settings.gradeEntryEndHK2 || ''}
          onChange={(e) => handleChange('gradeEntryEndHK2', e.target.value)}
        />
      </div>
    </div>

    <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30 mt-3">
      <div>
        <Label>Cho phép admin nhập điểm ngoài thời gian</Label>
        <p className="text-sm text-muted-foreground">Admin luôn có quyền nhập điểm</p>
      </div>
      <Switch
        checked={!!settings.allowAdminGradeOverride}
        onCheckedChange={(v) => handleChange('allowAdminGradeOverride', v)}
      />
    </div>
  </CardContent>
</Card>

        {/* Email */}
        <Card className="lg:col-span-2 shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-primary" />
              <span>Cấu hình Email (SMTP)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>SMTP Host <span className="text-red-500">*</span></Label>
                <Input 
                  value={settings.smtp.host} 
                  onChange={(e) => handleChange('smtp.host', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Gmail: smtp.gmail.com | Outlook: smtp-mail.outlook.com
                </p>
              </div>
              <div>
                <Label>SMTP Port <span className="text-red-500">*</span></Label>
                <Input 
                  type="number" 
                  value={settings.smtp.port} 
                  onChange={(e) => handleChange('smtp.port', Number(e.target.value))}
                  placeholder="587"
                />
                <p className="text-xs text-gray-500 mt-1">587 (TLS) hoặc 465 (SSL)</p>
              </div>
              <div>
                <Label>SMTP User (Email) <span className="text-red-500">*</span></Label>
                <Input 
                  value={settings.smtp.user} 
                  onChange={(e) => handleChange('smtp.user', e.target.value)}
                  placeholder="your-email@gmail.com"
                  type="email"
                />
                <p className="text-xs text-gray-500 mt-1">Email đăng nhập SMTP</p>
              </div>
              <div>
                <Label>SMTP Pass (App Password) <span className="text-red-500">*</span></Label>
                <Input 
                  type="password" 
                  value={settings.smtp.pass} 
                  onChange={(e) => handleChange('smtp.pass', e.target.value)}
                  placeholder="App Password (16 ký tự)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Với Gmail: Dùng App Password, không dùng mật khẩu thường
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!settings.smtp.secure} onCheckedChange={(v) => handleChange('smtp.secure', v)} />
                <Label>SSL/TLS (Bật nếu dùng port 465)</Label>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={settings.testEmail || ''}
                  onChange={(e) => handleChange('testEmail', e.target.value)}
                  placeholder="Nhập email để test (VD: test@example.com)"
                  type="email"
                  className="flex-1"
                />
                <Button 
                  variant="outline"
                  onClick={async () => {
                    if (!settings.testEmail || !settings.testEmail.includes('@')) {
                      toast({ 
                        title: 'Lỗi', 
                        description: 'Vui lòng nhập email hợp lệ để test',
                        variant: 'destructive' 
                      });
                      return;
                    }
                    try {
                      setLoading(true);
                      await settingApi.sendTestEmail(settings.testEmail);
                      toast({ 
                        title: 'Thành công', 
                        description: `Email test đã được gửi đến ${settings.testEmail}` 
                      });
                    } catch (err: any) {
                      console.error(err);
                      toast({ 
                        title: 'Lỗi', 
                        description: err.response?.data?.message || 'Không gửi được email. Vui lòng kiểm tra cấu hình SMTP.',
                        variant: 'destructive' 
                      });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !settings.testEmail}
                >
                  {loading ? 'Đang gửi...' : 'Test Email'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                💡 Nhập email và click "Test Email" để kiểm tra cấu hình SMTP
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
