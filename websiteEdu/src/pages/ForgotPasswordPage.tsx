/**
 * Forgot Password Page
 * Sử dụng Firebase sendPasswordResetEmail để gửi link reset password
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { sendResetPasswordEmail } from '@/services/firebase/authService';
import logoSchool from '@/assets/logo_school.png';
import { usePublicSchoolInfo } from '@/hooks/usePublicSchoolInfo';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const { info: schoolInfo } = usePublicSchoolInfo();

  /**
   * Gửi email reset password qua Firebase
   */
  const handleSendResetEmail = async () => {
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập email hợp lệ');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess(false);

      const trimmedEmail = email.trim().toLowerCase();
      
      // ✅ Sử dụng Firebase sendPasswordResetEmail
      await sendResetPasswordEmail(trimmedEmail);
      
      // ✅ Thành công
      setSentEmail(trimmedEmail);
      setSuccess(true);
      setError('');
      
      console.log('✅ [Forgot Password] Email reset đã được gửi đến:', trimmedEmail);
    } catch (error: any) {
      console.error('❌ [Forgot Password] Send reset email error:', {
        message: error.message,
        code: error.code
      });
      
      if (error.code === 'auth/user-not-found') {
        setError('Email không tồn tại trong hệ thống. Vui lòng kiểm tra lại.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Email không hợp lệ. Vui lòng nhập email đúng định dạng.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.');
      } else {
        setError(error.message || 'Không thể gửi email reset. Vui lòng thử lại sau.');
      }
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Quay về trang đăng nhập
   */
  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-blue-50/50">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img
              src={schoolInfo.logoUrl || logoSchool}
              alt="Logo trường học"
              className="w-16 h-16 object-contain rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Quên mật khẩu</h1>
            <p className="text-sm text-gray-500">
              {success 
                ? 'Email đặt lại mật khẩu đã được gửi' 
                : 'Nhập email để nhận link đặt lại mật khẩu'}
            </p>
          </div>
        </div>

        {/* Form Card */}
        {!success ? (
          <Card className="shadow-md border border-gray-200 bg-white">
            <CardHeader className="space-y-1 pb-6 pt-6">
              <CardTitle className="text-xl font-semibold text-center text-gray-900">
                Nhập email của bạn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email <span className="text-green-600">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-600" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Nhập email của bạn (VD: user@example.com)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !loading) {
                          handleSendResetEmail();
                        }
                      }}
                      className="pl-10 h-11 border-gray-300 focus:border-green-500 focus:ring-green-500"
                      required
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    📧 Link đặt lại mật khẩu sẽ được gửi đến email này
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-sm text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="button"
                  onClick={handleSendResetEmail}
                  className="w-full h-11 text-sm font-semibold bg-green-600 hover:bg-green-700"
                  disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Đang gửi...
                    </span>
                  ) : (
                    'Gửi email đặt lại mật khẩu'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackToLogin}
                  className="w-full text-sm text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Quay lại đăng nhập
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-md border border-green-200 bg-green-50/50">
            <CardHeader className="space-y-1 pb-6 pt-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-xl font-semibold text-center text-green-900">
                Email đã được gửi!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-center">
                <p className="text-sm text-gray-700">
                  Chúng tôi đã gửi link đặt lại mật khẩu đến email:
                </p>
                <p className="text-sm font-semibold text-gray-900 break-all">
                  {sentEmail}
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <p className="text-xs text-blue-800 font-medium mb-2">📋 Hướng dẫn:</p>
                  <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Kiểm tra hộp thư đến của email trên</li>
                    <li>Mở email từ Firebase Authentication</li>
                    <li>Click vào link "Reset password" trong email</li>
                    <li>Nhập mật khẩu mới và xác nhận</li>
                    <li>Đăng nhập lại với mật khẩu mới</li>
                  </ol>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    ⚠️ <strong>Lưu ý:</strong> Nếu không thấy email, vui lòng kiểm tra thư mục <strong>Spam</strong> hoặc <strong>Thư rác</strong>
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full h-11 text-sm font-semibold bg-green-600 hover:bg-green-700">
                  Quay lại đăng nhập
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                    setError('');
                  }}
                  className="w-full text-sm">
                  Gửi lại email
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
