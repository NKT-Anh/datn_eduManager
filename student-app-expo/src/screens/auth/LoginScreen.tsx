/**
 * Login Screen - Đầy đủ chức năng như web
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { usePublicSchoolInfo } from '../../hooks/usePublicSchoolInfo';
import { authService } from '../../services/authService';

// Google Logo Component - Sử dụng Image với URL PNG
const GoogleLogo = () => (
  <Image
    source={{
      uri: 'https://developers.google.com/identity/images/g-logo.png',
    }}
    style={styles.googleLogo}
    resizeMode="contain"
  />
);

export default function LoginScreen() {
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [showOTPForm, setShowOTPForm] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithToken } = useAuth();
  const { info: schoolInfo, loading: loadingSchoolInfo } = usePublicSchoolInfo();

  const handleLogin = async () => {
    if (!phoneOrEmail.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(phoneOrEmail.trim(), password.trim());
    } catch (error: any) {
      console.error('[Login Error]', error);
      
      // Xử lý các lỗi cụ thể
      if (error.message?.includes('user-not-found')) {
        setError('Không tìm thấy tài khoản với email này.');
      } else if (error.message?.includes('wrong-password') || error.message?.includes('invalid-credential')) {
        setError('Tài khoản hoặc mật khẩu không chính xác.');
      } else if (error.message?.includes('invalid-email')) {
        setError('Email không hợp lệ.');
      } else if (error.message?.includes('too-many-requests')) {
        setError('Tài khoản bị tạm khóa do đăng nhập sai nhiều lần.');
      } else {
        setError(error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    const trimmedEmail = phoneOrEmail.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập email');
      return;
    }

    setSendingOTP(true);
    setError('');

    try {
      await authService.sendLoginOTP(trimmedEmail);
      setShowOTPForm(true);
      Alert.alert('Thành công', 'Mã OTP đã được gửi đến email của bạn.');
    } catch (err: any) {
      console.error('[Send OTP Error]', err);
      setError(err.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setSendingOTP(false);
    }
  };

  const handleLoginWithOTP = async () => {
    const trimmedEmail = phoneOrEmail.trim();
    if (!trimmedEmail || !otp.trim()) {
      setError('Vui lòng nhập đầy đủ email và mã OTP.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await authService.loginWithOTP(trimmedEmail, otp.trim());
      // authService.loginWithOTP đã đổi customToken -> Firebase idToken
      await loginWithToken(response.token);
    } catch (err: any) {
      console.error('[OTP Login Error]', err);
      setError(err.message || 'Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header với Logo và Tên trường */}
          <View style={styles.header}>
            {!loadingSchoolInfo && schoolInfo.logoUrl ? (
              <Image
                source={{ uri: schoolInfo.logoUrl }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {loadingSchoolInfo ? 'Đang tải...' : 'Logo'}
                </Text>
              </View>
            )}
            <Text style={styles.title}>
              {loadingSchoolInfo ? 'Hệ thống quản lý trường học' : schoolInfo.name}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Đăng nhập</Text>

            {/* Email/Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên đăng nhập</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập email hoặc tên đăng nhập"
                value={phoneOrEmail}
                onChangeText={(text) => {
                  setPhoneOrEmail(text.trimStart());
                  setError('');
                }}
                onBlur={() => setPhoneOrEmail(phoneOrEmail.trim())}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading && !sendingOTP}
              />
            </View>

            {/* Password Input (chỉ hiện khi không dùng OTP) */}
            {!showOTPForm && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mật khẩu</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeButtonText}>
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    // TODO: Navigate to forgot password screen
                    Alert.alert('Thông báo', 'Tính năng quên mật khẩu đang được phát triển.');
                  }}
                  style={styles.forgotPasswordButton}
                >
                  <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* OTP Input (chỉ hiện khi dùng OTP) */}
            {showOTPForm && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mã OTP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mã OTP"
                  value={otp}
                  onChangeText={(text) => {
                    setOtp(text);
                    setError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowOTPForm(false);
                    setOtp('');
                    setError('');
                  }}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>← Quay lại đăng nhập với mật khẩu</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Login Button */}
            {!showOTPForm ? (
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Đăng nhập với mật khẩu</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleLoginWithOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Đăng nhập với mã OTP</Text>
                )}
              </TouchableOpacity>
            )}

            {/* OTP Button */}
            {!showOTPForm && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, (sendingOTP || !phoneOrEmail.trim()) && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={sendingOTP || !phoneOrEmail.trim()}
              >
                {sendingOTP ? (
                  <ActivityIndicator color="#007AFF" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Đăng nhập với mã OTP</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Login Button */}
            <TouchableOpacity
              style={[styles.button, styles.googleButton, loading && styles.buttonDisabled]}
              onPress={() => {
                Alert.alert('Thông báo', 'Tính năng đăng nhập với Google đang được phát triển.');
              }}
              disabled={loading}
            >
              <View style={styles.googleButtonContent}>
                <GoogleLogo />
                <Text style={styles.googleButtonText}>Đăng nhập với Google</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 16,
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoPlaceholderText: {
    fontSize: 12,
    color: '#999',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 12,
  },
  eyeButtonText: {
    fontSize: 18,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 12,
    color: '#007AFF',
  },
  backButton: {
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 12,
    color: '#007AFF',
  },
  errorContainer: {
    backgroundColor: '#fee',
    borderColor: '#fcc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});
