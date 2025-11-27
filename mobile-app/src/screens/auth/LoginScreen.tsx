/**
 * Login Screen
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
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useAuth} from '../../context/AuthContext';

const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const {login, sendLoginOTP} = useAuth();

  const handleLogin = async () => {
    if (!phoneOrEmail || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      setLoading(true);
      await login(phoneOrEmail, password);
    } catch (error: any) {
      Alert.alert('Đăng nhập thất bại', error.message || 'Vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    const trimmedEmail = phoneOrEmail.trim();
    if (!trimmedEmail) {
      Alert.alert('Lỗi', 'Vui lòng nhập email');
      return;
    }

    // Kiểm tra định dạng email đơn giản
    if (!trimmedEmail.includes('@')) {
      Alert.alert('Lỗi', 'Vui lòng nhập email hợp lệ');
      return;
    }

    try {
      setSendingOTP(true);
      await sendLoginOTP(trimmedEmail);
      // Navigate to OTP screen
      (navigation as any).navigate('OTPLogin', {email: trimmedEmail});
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể gửi mã OTP. Vui lòng thử lại');
    } finally {
      setSendingOTP(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EduManager</Text>
      <Text style={styles.subtitle}>Đăng nhập vào hệ thống</Text>

      <TextInput
        style={styles.input}
        placeholder="Số điện thoại hoặc Email"
        value={phoneOrEmail}
        onChangeText={setPhoneOrEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Đăng nhập với mật khẩu</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonOTP, (sendingOTP || !phoneOrEmail.trim()) && styles.buttonDisabled]}
        onPress={handleSendOTP}
        disabled={sendingOTP || !phoneOrEmail.trim()}>
        {sendingOTP ? (
          <ActivityIndicator color="#007AFF" />
        ) : (
          <Text style={styles.buttonOTPText}>Đăng nhập với mã OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.forgotButton}
        onPress={() => navigation.navigate('ForgotPassword' as never)}>
        <Text style={styles.forgotText}>Quên mật khẩu?</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
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
  buttonOTP: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonOTPText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default LoginScreen;

