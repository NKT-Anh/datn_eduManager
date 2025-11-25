/**
 * Send Bulk Email Page
 * Trang gửi email hàng loạt cho giáo viên, học sinh hoặc tất cả
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Send, Users, GraduationCap, Globe, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import settingApi from '@/services/settingApi';
import { useAuth } from '@/contexts/AuthContext';

const SendBulkEmailPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  
  // ✅ CHỈ Admin và BGH (isLeader) được gửi email - Khai báo trước để sử dụng
  const isAdmin = backendUser?.role === 'admin';
  const isBGH = backendUser?.role === 'teacher' && backendUser?.teacherFlags?.isLeader;
  const canSendEmail = isAdmin || isBGH;
  
  const [loading, setLoading] = useState(false);
  // ✅ BGH chỉ có thể chọn 'teachers', Admin có thể chọn tất cả
  const [recipientType, setRecipientType] = useState<'teachers' | 'students' | 'all' | 'single'>(
    isBGH ? 'teachers' : 'single' // Mặc định là 'single' để dễ test
  );
  const [singleRecipientEmail, setSingleRecipientEmail] = useState(''); // Email cho option "single"
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  // ✅ Load user info để set default fromEmail và fromName
  useEffect(() => {
    // Set default từ thông tin người dùng hiện tại
    if (backendUser) {
      if (backendUser.email && !fromEmail) {
        setFromEmail(backendUser.email);
      }
      if (backendUser.name && !fromName) {
        setFromName(backendUser.name);
      }
    }
  }, [backendUser]);

  if (!canSendEmail) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Không có quyền truy cập</h2>
          <p className="text-muted-foreground mt-2">Bạn không có quyền truy cập trang này.</p>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    if (!subject || !content || !fromEmail || !fromName) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền đầy đủ thông tin: Email người gửi, Tên người gửi, Tiêu đề và Nội dung',
        variant: 'destructive'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      toast({
        title: 'Lỗi',
        description: 'Email người gửi không hợp lệ',
        variant: 'destructive'
      });
      return;
    }

    // ✅ Validate single recipient email nếu chọn option "single"
    if (recipientType === 'single') {
      if (!singleRecipientEmail.trim()) {
        toast({
          title: 'Lỗi',
          description: 'Vui lòng nhập email người nhận',
          variant: 'destructive'
        });
        return;
      }
      if (!emailRegex.test(singleRecipientEmail.trim())) {
        toast({
          title: 'Lỗi',
          description: 'Email người nhận không hợp lệ',
          variant: 'destructive'
        });
        return;
      }
    }

    try {
      setLoading(true);
      setResult(null);
      
      const response = await settingApi.sendBulkEmail({
        recipientType,
        subject,
        content,
        fromEmail: fromEmail || undefined,
        fromName: fromName || undefined,
        ...(recipientType === 'single' && singleRecipientEmail ? { singleRecipientEmail: singleRecipientEmail.trim() } : {})
      });
      
      setResult(response.results);
      
      toast({
        title: 'Thành công',
        description: `Đã gửi email đến ${response.results.success}/${response.results.total} người nhận`
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể gửi email hàng loạt',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getRecipientCount = () => {
    if (recipientType === 'teachers') return 'giáo viên';
    if (recipientType === 'students') return 'học sinh';
    if (recipientType === 'single') return singleRecipientEmail || '1 người nhận';
    return 'tất cả (giáo viên + học sinh)';
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-8 w-8 text-blue-600" />
            Gửi email hàng loạt
          </h1>
          <p className="text-gray-600 mt-2">
            Gửi email đến giáo viên, học sinh hoặc tất cả người dùng trong hệ thống
          </p>
        </div>

        {/* Chọn đối tượng nhận */}
        <Card>
          <CardHeader>
            <CardTitle>Chọn đối tượng nhận email</CardTitle>
            <CardDescription>
              Chọn nhóm người nhận bạn muốn gửi email đến
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 ${isBGH ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-4'}`}>
              {/* Option: Gửi cho 1 người (để test) */}
              <Button
                type="button"
                variant={recipientType === 'single' ? 'default' : 'outline'}
                onClick={() => setRecipientType('single')}
                className="h-24 flex flex-col items-center justify-center gap-2"
                disabled={loading}>
                <User className="h-6 w-6" />
                <span className="font-semibold">1 người nhận</span>
                <span className="text-xs text-muted-foreground">Gửi test cho 1 email</span>
              </Button>

              <Button
                type="button"
                variant={recipientType === 'teachers' ? 'default' : 'outline'}
                onClick={() => setRecipientType('teachers')}
                className="h-24 flex flex-col items-center justify-center gap-2"
                disabled={loading}>
                <Users className="h-6 w-6" />
                <span className="font-semibold">Giáo viên</span>
                <span className="text-xs text-muted-foreground">Gửi đến tất cả giáo viên</span>
              </Button>
              
              {!isBGH && (
                <>
                  <Button
                    type="button"
                    variant={recipientType === 'students' ? 'default' : 'outline'}
                    onClick={() => setRecipientType('students')}
                    className="h-24 flex flex-col items-center justify-center gap-2"
                    disabled={loading}>
                    <GraduationCap className="h-6 w-6" />
                    <span className="font-semibold">Học sinh</span>
                    <span className="text-xs text-muted-foreground">Gửi đến tất cả học sinh</span>
                  </Button>
                  
                  <Button
                    type="button"
                    variant={recipientType === 'all' ? 'default' : 'outline'}
                    onClick={() => setRecipientType('all')}
                    className="h-24 flex flex-col items-center justify-center gap-2"
                    disabled={loading}>
                    <Globe className="h-6 w-6" />
                    <span className="font-semibold">Tất cả</span>
                    <span className="text-xs text-muted-foreground">Gửi đến tất cả người dùng</span>
                  </Button>
                </>
              )}
            </div>

            {/* Input email khi chọn "1 người nhận" */}
            {recipientType === 'single' && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Label htmlFor="singleRecipientEmail" className="text-sm font-medium">
                  Email người nhận <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="singleRecipientEmail"
                  type="email"
                  value={singleRecipientEmail}
                  onChange={(e) => setSingleRecipientEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="mt-2"
                  disabled={loading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nhập email của người nhận để test gửi email
                </p>
              </div>
            )}
            {isBGH && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Lưu ý:</strong> Ban Giám Hiệu chỉ được gửi email cho giáo viên để đảm bảo an toàn thông tin.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form gửi email */}
        <Card>
          <CardHeader>
            <CardTitle>Nội dung email</CardTitle>
            <CardDescription>
              Soạn nội dung email sẽ được gửi đến {getRecipientCount()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Thông tin người gửi - Mỗi người tự nhập */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <Label htmlFor="fromEmail">
                  Email người gửi <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  className="mt-2"
                  disabled={loading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email hiển thị trong email nhận được (ví dụ: {backendUser?.email || 'your-email@example.com'})
                </p>
              </div>
              <div>
                <Label htmlFor="fromName">
                  Tên người gửi <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fromName"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder={backendUser?.name || "Tên của bạn"}
                  className="mt-2"
                  disabled={loading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tên hiển thị trong email nhận được (ví dụ: {backendUser?.name || 'Tên của bạn'})
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="subject">
                Tiêu đề email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Nhập tiêu đề email"
                className="mt-2"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="content">
                Nội dung email <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập nội dung email...&#10;&#10;Bạn có thể xuống dòng để tạo đoạn văn."
                rows={10}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Có thể xuống dòng, nội dung sẽ được format tự động. Email sẽ được gửi với HTML format.
              </p>
            </div>

            {result && (
              <Alert className={result.success === result.total ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">
                      {result.success === result.total 
                        ? '✅ Gửi email thành công!' 
                        : `⚠️ Gửi email: ${result.success}/${result.total} thành công`}
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Tổng số:</span>
                        <span className="font-semibold ml-2">{result.total}</span>
                      </div>
                      <div>
                        <span className="text-green-600">Thành công:</span>
                        <span className="font-semibold ml-2 text-green-700">{result.success}</span>
                      </div>
                      <div>
                        <span className="text-red-600">Thất bại:</span>
                        <span className="font-semibold ml-2 text-red-700">{result.failed}</span>
                      </div>
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <details className="text-xs mt-2">
                        <summary className="cursor-pointer text-red-600 font-medium">
                          Xem chi tiết lỗi ({result.errors.length})
                        </summary>
                        <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                          {result.errors.map((err: any, idx: number) => (
                            <li key={idx} className="text-red-700 bg-red-50 p-2 rounded">
                              <strong>{err.name}</strong> ({err.email}): {err.error}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSend}
              disabled={loading || !subject || !content || !fromEmail || !fromName}
              className="w-full h-12 text-base font-semibold"
              size="lg">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang gửi email...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Gửi email đến {getRecipientCount()}
                </span>
              )}
            </Button>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>📋 Lưu ý:</strong>
              </p>
              <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>Email sẽ được gửi đến tất cả {getRecipientCount()} có email trong hệ thống</li>
                <li>Quá trình gửi có thể mất vài phút tùy vào số lượng người nhận</li>
                <li>Vui lòng đảm bảo cấu hình SMTP đã được thiết lập đúng trong Settings</li>
                <li>Email sẽ được gửi theo batch để tránh quá tải server</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SendBulkEmailPage;

