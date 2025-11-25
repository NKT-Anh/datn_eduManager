import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoSchool from '@/assets/logo_school.png';
import { Chrome } from 'lucide-react';
import OTPLoginForm from './OTPLoginForm';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOTPForm, setShowOTPForm] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const { login, loginWithGoogle, backendUser } = useAuth();
  const navigate = useNavigate();

  // Điều hướng khi backendUser được cập nhật
  useEffect(() => {
    if (!backendUser) return;
    
    // ✅ Xác định route prefix dựa trên role và teacherFlags
    let routePrefix = '/';
    if (backendUser.role === 'admin') {
      routePrefix = '/admin';
    } else if (backendUser.role === 'student') {
      routePrefix = '/student';
    } else if (backendUser.role === 'teacher') {
      // Kiểm tra teacherFlags để xác định loại giáo viên
      if (backendUser.teacherFlags?.isLeader) {
        routePrefix = '/bgh';
      } else if (backendUser.teacherFlags?.isHomeroom) {
        routePrefix = '/gvcn';
      } else if (backendUser.teacherFlags?.isDepartmentHead) {
        routePrefix = '/qlbm';
      } else {
        routePrefix = '/gvbm';
      }
    }
    
    navigate(`${routePrefix}/home`);
  }, [backendUser, navigate]);

  const handleSendOTP = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Vui lòng nhập email');
      return;
    }

    setSendingOTP(true);
    setError('');

    try {
      await axios.post(`${API_BASE_URL}/auth/send-login-otp`, { email: trimmedUsername });
      setShowOTPForm(true);
    } catch (err: any) {
      console.error('[Send OTP Error]', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Không thể gửi mã OTP. Vui lòng thử lại.');
      }
    } finally {
      setSendingOTP(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ Trim email và password để tránh khoảng trống
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();
      
      if (!trimmedUsername || !trimmedPassword) {
        setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
        setLoading(false);
        return;
      }

      await login(trimmedUsername, trimmedPassword); // backendUser sẽ cập nhật tự động
    } catch (err: any) {
      console.error('[Login Error]', err);
      
      // ✅ Kiểm tra lỗi kết nối backend
      const isConnectionError = 
        err?.code === 'ERR_NETWORK' || 
        err?.code === 'ERR_CONNECTION_REFUSED' ||
        err?.message?.includes('ERR_CONNECTION_REFUSED') ||
        err?.message?.includes('Network Error') ||
        (err?.response?.status === undefined && err?.message?.includes('Network'));
      
      if (isConnectionError) {
        setError('Không thể kết nối đến server. Vui lòng kiểm tra backend server đã chạy chưa (port 3000).');
        return;
      }
      
      // ✅ Xử lý lỗi Firebase Auth
      if (err.code === 'auth/user-not-found') {
        setError('Không tìm thấy tài khoản với email này.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Tài khoản hoặc mật khẩu không chính xác.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Email không hợp lệ.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Tài khoản bị tạm khóa do đăng nhập sai nhiều lần.');
      } else if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError('Không có quyền truy cập hoặc tài khoản chưa được kích hoạt.');
      } else if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-blue-50/50">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={logoSchool} 
              alt="Logo trường học" 
              className="w-16 h-16 object-contain rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">
              Hệ thống quản lý trường học
            </h1>
            <p className="text-sm text-gray-500">Đăng nhập để tiếp tục</p>
          </div>
        </div>

        {/* Login Form */}
        <Card className="shadow-md border border-gray-200 bg-white">
          <CardHeader className="space-y-1 pb-6 pt-6">
            <CardTitle className="text-xl font-semibold text-center text-gray-900">Đăng nhập</CardTitle>
            <CardDescription className="text-center text-sm text-gray-500">Nhập thông tin đăng nhập của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                  Tên đăng nhập
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Nhập email hoặc tên đăng nhập"
                    value={username}
                    onChange={(e) => {
                      // ✅ Tự động trim khi nhập (loại bỏ khoảng trống đầu/cuối)
                      const trimmed = e.target.value.trimStart();
                      setUsername(trimmed);
                    }}
                    onBlur={(e) => {
                      // ✅ Trim khi blur (rời khỏi input)
                      setUsername(e.target.value.trim());
                    }}
                    className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Mật khẩu
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => {
                      // ✅ Cho phép nhập bình thường (không trim khi đang nhập)
                      setPassword(e.target.value);
                    }}
                    onBlur={(e) => {
                      // ✅ Trim khi blur (rời khỏi input) - loại bỏ khoảng trống đầu/cuối
                      setPassword(e.target.value.trim());
                    }}
                    className="pl-10 pr-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline focus:outline-none transition-colors"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-sm text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Đang đăng nhập...
                    </span>
                  ) : (
                    'Đăng nhập với mật khẩu'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendOTP}
                  className="w-full h-11 text-sm font-semibold border-blue-600 text-blue-600 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={sendingOTP || !username.trim()}
                >
                  {sendingOTP ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></span>
                      Đang gửi mã OTP...
                    </span>
                  ) : (
                    'Đăng nhập với mã OTP'
                  )}
                </Button>
              </div>

                      {/* Divider */}
                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-gray-500">Hoặc</span>
                        </div>
                      </div>

                      {/* Google Sign-In Button */}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 text-sm font-semibold border-gray-300 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={async () => {
                          try {
                            setLoading(true);
                            setError('');
                            await loginWithGoogle();
                          } catch (err: any) {
                            console.error('[Google Sign-In Error]', err);
                            if (err.code === 'auth/popup-closed-by-user') {
                              setError('Bạn đã đóng cửa sổ đăng nhập. Vui lòng thử lại.');
                            } else if (err.code === 'auth/popup-blocked') {
                              setError('Cửa sổ đăng nhập bị chặn. Vui lòng cho phép popup và thử lại.');
                            } else if (err.code === 'auth/operation-not-allowed') {
                              setError('Đăng nhập bằng Google chưa được bật. Vui lòng liên hệ quản trị viên.');
                            } else if (err.response?.data?.message) {
                              setError(err.response.data.message);
                            } else {
                              setError('Đăng nhập bằng Google thất bại. Vui lòng thử lại.');
                            }
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                      >
                        <Chrome className="h-4 w-4 mr-2" />
                        Đăng nhập với Google
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center text-xs text-gray-500">
                  <p>© 2025 Hệ thống quản lý trường học</p>
                </div>
      </div>
    </div>
  );
};

export default LoginForm;
