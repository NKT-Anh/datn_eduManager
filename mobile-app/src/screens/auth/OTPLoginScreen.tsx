/**
 * OTP Login Screen
 * Màn hình nhập mã OTP để đăng nhập
 */

import React, {useState, useEffect} from 'react';
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
import {useAuth} from '../../context/AuthContext';
import {apiConfig} from '../../services/api';

interface OTPLoginScreenProps {
  route?: {
    params?: {
      email: string;
    };
  };
}

const OTPLoginScreen: React.FC<OTPLoginScreenProps> = ({route}) => {
  const navigation = useNavigation();
  const {loginWithOTP} = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const email = route?.params?.email || '';

  useEffect(() => {
    if (!email) {
      Alert.alert('Lỗi', 'Email không hợp lệ');
      navigation.goBack();
    }
  }, [email, navigation]);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ 6 chữ số OTP');
      return;
    }

    try {
      setLoading(true);
      await loginWithOTP(email, otp);
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Mã OTP không đúng hoặc đã hết hạn');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setResending(true);
      const response = await fetch(`${apiConfig.baseURL}/auth/send-login-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({email}),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Thành công', 'Đã gửi lại mã OTP đến email của bạn');
      } else {
        Alert.alert('Lỗi', data.message || 'Không thể gửi lại mã OTP');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể gửi lại mã OTP. Vui lòng thử lại');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Nhập mã OTP</Text>
        <Text style={styles.subtitle}>
          Mã OTP đã được gửi đến email:{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <TextInput
          style={styles.otpInput}
          placeholder="Nhập mã OTP 6 chữ số"
          value={otp}
          onChangeText={(text) => {
            // Chỉ cho phép số và giới hạn 6 ký tự
            const numericText = text.replace(/\D/g, '').slice(0, 6);
            setOtp(numericText);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          editable={!loading}
        />

        <Text style={styles.hint}>Mã OTP có hiệu lực trong 10 phút</Text>

        <TouchableOpacity
          style={[styles.button, (loading || otp.length !== 6) && styles.buttonDisabled]}
          onPress={handleVerifyOTP}
          disabled={loading || otp.length !== 6}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Xác thực OTP</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.goBack()}
            disabled={loading}>
            <Text style={styles.linkText}>← Quay lại</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleResendOTP}
            disabled={resending || loading}>
            <Text style={styles.linkText}>
              {resending ? 'Đang gửi...' : 'Gửi lại mã OTP'}
            </Text>
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
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666666',
    lineHeight: 20,
  },
  email: {
    fontWeight: '600',
    color: '#007AFF',
  },
  otpInput: {
    height: 60,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 'bold',
    color: '#000000',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
    color: '#999999',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  linkButton: {
    padding: 8,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default OTPLoginScreen;

