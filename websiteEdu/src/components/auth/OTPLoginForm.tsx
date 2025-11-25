import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/services/firebase/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface OTPLoginFormProps {
  email: string;
  onBack: () => void;
}

const OTPLoginForm = ({ email, onBack }: OTPLoginFormProps) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { setBackendUser, backendUser } = useAuth();
  const navigate = useNavigate();

  // ✅ Điều hướng khi backendUser được cập nhật
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

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify OTP
      const verifyRes = await axios.post(`${API_BASE_URL}/auth/verify-login-otp`, {
        email,
        otpCode: otp
      });

      if (verifyRes.data.success && verifyRes.data.customToken) {
        // Đăng nhập Firebase với custom token
        const userCredential = await signInWithCustomToken(auth, verifyRes.data.customToken);
        const idToken = await userCredential.user.getIdToken();

        // Lấy năm học hiện tại
        let effectiveYear: string | null = null;
        try {
          const settingsRes = await axios.get(`${API_BASE_URL}/settings/public`, {
            timeout: 5000,
          });
          const settingData = settingsRes?.data;
          if (settingData && settingData.currentSchoolYear) {
            effectiveYear = String(settingData.currentSchoolYear);
          }
        } catch (error) {
          console.warn('⚠️ [OTP Login] Không lấy được năm học từ settings');
        }

        // Lấy thông tin user từ backend
        const userRes = await axios.get(`${API_BASE_URL}/accounts/me`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
            ...(effectiveYear ? { 'x-school-year': effectiveYear } : {}),
          }
        });

        // Tính toán effective permissions
        const { getEffectivePermissions } = await import('@/utils/permissions');
        const effectivePermissions = getEffectivePermissions(userRes.data);

        // Cập nhật backendUser (useEffect sẽ tự động navigate)
        setBackendUser({ 
          ...userRes.data, 
          idToken,
          effectivePermissions,
          currentSchoolYear: effectiveYear
        });
      }
    } catch (err: any) {
      console.error('[OTP Verify Error]', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Mã OTP không đúng hoặc đã hết hạn. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    setError('');
    try {
      await axios.post(`${API_BASE_URL}/auth/send-login-otp`, { email });
      setError('');
      alert('Đã gửi lại mã OTP đến email của bạn');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi lại mã OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="shadow-md border border-gray-200 bg-white">
      <CardHeader className="space-y-1 pb-6 pt-6">
        <CardTitle className="text-xl font-semibold text-center text-gray-900">
          Nhập mã OTP
        </CardTitle>
        <CardDescription className="text-center text-sm text-gray-500">
          Mã OTP đã được gửi đến email: <strong>{email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerifyOTP} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-sm font-medium text-gray-700">
              Mã OTP
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="otp"
                type="text"
                placeholder="Nhập mã OTP 6 chữ số"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(value);
                }}
                className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 text-center text-2xl tracking-widest"
                required
                maxLength={6}
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500">
              Mã OTP có hiệu lực trong 10 phút
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertDescription className="text-sm text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || otp.length !== 6}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Đang xác thực...
              </span>
            ) : (
              'Xác thực OTP'
            )}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={onBack}
              className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </button>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resending}
              className="text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50"
            >
              {resending ? 'Đang gửi...' : 'Gửi lại mã OTP'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default OTPLoginForm;

