/**
 * Forgot Password Screen
 * Gửi OTP qua SMS để reset mật khẩu
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {auth} from '../../config/firebase';
import {httpClient} from '../../services/httpClient';

const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp' | 'reset'>('phone');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [maskedPhone, setMaskedPhone] = useState('');

  /**
   * Bước 1: Gửi OTP qua SMS
   */
  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại hợp lệ');
      return;
    }

    try {
      setLoading(true);

      // Trim và chỉ lấy số, tối đa 10 ký tự
      const trimmedPhone = phoneNumber.trim().replace(/\D/g, '').slice(0, 10);
      
      if (trimmedPhone.length !== 10) {
        Alert.alert('Lỗi', 'Vui lòng nhập đúng 10 chữ số');
        setLoading(false);
        return;
      }

      // Format phone number: 0xxxxxxxxx -> +84xxxxxxxxx
      let formattedPhone = trimmedPhone;
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+84' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+84' + formattedPhone;
      }

      // Gọi API backend để kiểm tra số điện thoại
      const response = await httpClient.post('/auth/forgot-password', {
        phoneNumber: formattedPhone,
      });

      if (response.success) {
        // Sử dụng Firebase Phone Authentication để gửi OTP
        const confirmationResult = await auth().signInWithPhoneNumber(formattedPhone);
        setConfirmation(confirmationResult);
        setMaskedPhone(response.data.maskedPhone || formattedPhone.substring(0, 4) + '****' + formattedPhone.substring(formattedPhone.length - 3));
        setStep('otp');
        Alert.alert('Thành công', 'Mã OTP đã được gửi đến số điện thoại của bạn');
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể gửi mã OTP');
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      Alert.alert(
        'Lỗi',
        error.message || 'Không thể gửi mã OTP. Vui lòng thử lại sau.',
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Bước 2: Xác thực OTP
   */
  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã OTP đầy đủ');
      return;
    }

    try {
      setLoading(true);

      if (!confirmation) {
        Alert.alert('Lỗi', 'Phiên xác thực đã hết hạn. Vui lòng thử lại');
        setStep('phone');
        return;
      }

      // Xác thực OTP với Firebase
      const userCredential = await confirmation.confirm(otpCode);
      const idToken = await userCredential.user.getIdToken();

      // Lưu idToken để dùng cho bước reset password
      setConfirmation({...confirmation, idToken, verified: true});
      setStep('reset');
      Alert.alert('Thành công', 'Xác thực OTP thành công. Vui lòng nhập mật khẩu mới');
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      Alert.alert('Lỗi', 'Mã OTP không đúng. Vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Bước 3: Reset mật khẩu
   */
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setLoading(true);

      // Format phone number
      // Trim và chỉ lấy số, tối đa 10 ký tự
      const trimmedPhone = phoneNumber.trim().replace(/\D/g, '').slice(0, 10);
      
      if (trimmedPhone.length !== 10) {
        Alert.alert('Lỗi', 'Vui lòng nhập đúng 10 chữ số');
        setLoading(false);
        return;
      }

      // Format phone number: 0xxxxxxxxx -> +84xxxxxxxxx
      let formattedPhone = trimmedPhone;
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+84' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+84' + formattedPhone;
      }

      // Gọi API backend để reset password
      const response = await httpClient.post('/auth/reset-password', {
        phoneNumber: formattedPhone,
        newPassword: newPassword,
        idToken: confirmation?.idToken,
      });

      if (response.success) {
        Alert.alert('Thành công', 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login' as never),
          },
        ]);
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể đặt lại mật khẩu');
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      Alert.alert('Lỗi', error.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Quay lại bước trước
   */
  const handleBack = () => {
    if (step === 'otp') {
      setStep('phone');
      setOtpCode('');
      setConfirmation(null);
    } else if (step === 'reset') {
      setStep('otp');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.subtitle}>
            {step === 'phone' && 'Nhập số điện thoại để nhận mã OTP'}
            {step === 'otp' && `Nhập mã OTP đã gửi đến ${maskedPhone}`}
            {step === 'reset' && 'Nhập mật khẩu mới'}
          </Text>

          {/* Bước 1: Nhập số điện thoại */}
          {step === 'phone' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Số điện thoại (VD: 0912345678)"
                value={phoneNumber}
                onChangeText={(text) => {
                  // Chỉ cho phép số, tối đa 10 ký tự
                  const value = text.replace(/\D/g, '').slice(0, 10);
                  setPhoneNumber(value);
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                maxLength={10}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Gửi mã OTP</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Bước 2: Nhập OTP */}
          {step === 'otp' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Mã OTP (6 số)"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Xác thực OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleBack}>
                <Text style={styles.linkText}>Quay lại</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleSendOTP}>
                <Text style={styles.linkText}>Gửi lại mã OTP</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Bước 3: Nhập mật khẩu mới */}
          {step === 'reset' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder="Xác nhận mật khẩu"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Đặt lại mật khẩu</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleBack}>
                <Text style={styles.linkText}>Quay lại</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login' as never)}>
            <Text style={styles.linkText}>Quay lại đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666666',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default ForgotPasswordScreen;

