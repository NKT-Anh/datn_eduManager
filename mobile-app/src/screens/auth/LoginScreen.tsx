/**
 * Login Screen
 */

import React, {useState} from 'react';
import {View, TextInput, StyleSheet, Alert, ActivityIndicator} from 'react-native';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import {colors, spacing} from '../../theme';
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
      <Text variant="h1" style={styles.appTitle}>EduManager</Text>
      <Card style={styles.card}>
        <Text variant="title" muted style={{marginBottom: spacing.lg}}>
          Đăng nhập vào hệ thống
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Số điện thoại hoặc Email"
          value={phoneOrEmail}
          onChangeText={setPhoneOrEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={colors.textSecondary}
        />

        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={colors.textSecondary}
        />

        <Button
          title="Đăng nhập với mật khẩu"
          onPress={handleLogin}
          loading={loading}
          style={{marginTop: spacing.sm}}
        />

        <Button
          title="Đăng nhập với mã OTP"
          variant="outline"
          onPress={handleSendOTP}
          disabled={sendingOTP || !phoneOrEmail.trim()}
          style={{marginTop: spacing.md}}
        />

        <Text
          variant="caption"
          muted
          onPress={() => navigation.navigate('ForgotPassword' as never)}
          style={styles.forgotText}
        >
          Quên mật khẩu?
        </Text>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  appTitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.xl,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  forgotText: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

export default LoginScreen;

