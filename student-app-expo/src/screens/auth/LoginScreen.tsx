/**
 * Login Screen - UI Modern & Vector Icons
 * Yêu cầu: npm install react-native-vector-icons
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
  Dimensions,
  StatusBar,
} from 'react-native';
// Nếu dùng Expo thì đổi dòng dưới thành: import { Ionicons } from '@expo/vector-icons';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../../context/AuthContext';
import { usePublicSchoolInfo } from '../../hooks/usePublicSchoolInfo';
import { authService } from '../../services/authService';

const { width } = Dimensions.get('window');

// Màu sắc
const COLORS = {
  primary: '#2563EB',
  secondary: '#FFFFFF',
  background: '#F3F4F6',
  text: '#1F2937',
  textSecondary: '#9CA3AF',
  inputBg: '#F9FAFB',
  borderColor: '#E5E7EB',
  error: '#EF4444',
  success: '#10B981',
};

// Google Logo (Vẫn giữ ảnh màu gốc vì quy chuẩn thương hiệu)
const GoogleLogo = () => (
  <Image
    source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
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
  
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

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
      setError('Vui lòng nhập email để nhận OTP');
      return;
    }
    setSendingOTP(true);
    setError('');
    try {
      await authService.sendLoginOTP(trimmedEmail);
      setShowOTPForm(true);
      Alert.alert('Thành công', 'Mã OTP đã được gửi đến email của bạn.');
    } catch (err: any) {
      setError(err.message || 'Không thể gửi mã OTP.');
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
      await loginWithToken(response.token);
    } catch (err: any) {
      setError(err.message || 'Mã OTP không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Background Shapes */}
      <View style={styles.headerBackground}>
        <View style={styles.headerCircle1} />
        <View style={styles.headerCircle2} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Section */}
          <View style={styles.topSection}>
            <View style={styles.logoContainer}>
              {!loadingSchoolInfo && schoolInfo.logoUrl ? (
                <Image
                  source={{ uri: schoolInfo.logoUrl }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  {/* Thay Text LOGO bằng Icon School */}
                  <Ionicons name="school-outline" size={40} color={COLORS.primary} />
                </View>
              )}
            </View>
            <Text style={styles.schoolName}>
              {loadingSchoolInfo ? 'Đang tải...' : schoolInfo.name || 'School Management'}
            </Text>
            <Text style={styles.welcomeText}>Chào mừng bạn quay trở lại!</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            
            {/* Input Email/Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên đăng nhập / Email</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'email' && styles.inputFocused
              ]}>
                {/* Icon User/Mail ở đầu input */}
                <Ionicons 
                  name="person-outline" 
                  size={20} 
                  color={focusedInput === 'email' ? COLORS.primary : COLORS.textSecondary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập email hoặc số điện thoại"
                  placeholderTextColor={COLORS.textSecondary}
                  value={phoneOrEmail}
                  onChangeText={(text) => {
                    setPhoneOrEmail(text);
                    setError('');
                  }}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => {
                    setPhoneOrEmail(phoneOrEmail.trim());
                    setFocusedInput(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading && !sendingOTP}
                />
              </View>
            </View>

            {/* Password Field */}
            {!showOTPForm && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mật khẩu</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'password' && styles.inputFocused
                ]}>
                  {/* Icon Lock */}
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={focusedInput === 'password' ? COLORS.primary : COLORS.textSecondary} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor={COLORS.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    {/* Thay Emoji mắt bằng Icon */}
                    <Ionicons 
                      name={showPassword ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      color={COLORS.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert('Thông báo', 'Tính năng đang phát triển')}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* OTP Field */}
            {showOTPForm && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nhập mã OTP</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'otp' && styles.inputFocused
                ]}>
                  <Ionicons 
                    name="shield-checkmark-outline" 
                    size={20} 
                    color={focusedInput === 'otp' ? COLORS.primary : COLORS.textSecondary} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { letterSpacing: 4, fontWeight: 'bold' }]}
                    placeholder="• • • • • •"
                    placeholderTextColor={COLORS.textSecondary}
                    value={otp}
                    onChangeText={(text) => {
                      setOtp(text);
                      setError('');
                    }}
                    onFocus={() => setFocusedInput('otp')}
                    onBlur={() => setFocusedInput(null)}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!loading}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => { setShowOTPForm(false); setOtp(''); setError(''); }}
                  style={styles.backLink}
                >
                  <Ionicons name="arrow-back" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.backLinkText}>Quay lại đăng nhập mật khẩu</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                {/* Thay Emoji Warning */}
                <Ionicons name="alert-circle-outline" size={20} color={COLORS.error} style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Main Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (loading || (showOTPForm && !otp) || (!showOTPForm && (!phoneOrEmail || !password))) && styles.buttonDisabled
              ]}
              onPress={showOTPForm ? handleLoginWithOTP : handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {showOTPForm ? 'Xác nhận OTP' : 'Đăng nhập'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Secondary Button */}
            {!showOTPForm && (
              <TouchableOpacity
                style={[styles.secondaryButton, sendingOTP && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={sendingOTP || !phoneOrEmail.trim()}
              >
                {sendingOTP ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="keypad-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryButtonText}>Đăng nhập nhanh bằng OTP</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc tiếp tục với</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => Alert.alert('Thông báo', 'Tính năng đang phát triển')}
              disabled={loading}
            >
              <GoogleLogo />
              <Text style={styles.googleButtonText}>Google</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerCircle1: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerCircle2: {
    position: 'absolute',
    top: 20,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  // Style mới cho Input bao gồm cả Icon
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  eyeButton: {
    padding: 10,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginRight: 4,
  },
  forgotText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  backLinkText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
});