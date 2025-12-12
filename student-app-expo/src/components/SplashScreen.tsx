/**
 * Splash Screen Component - Hiển thị logo từ settings khi app load
 */

import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { usePublicSchoolInfo } from '../hooks/usePublicSchoolInfo';

// Import logo mặc định từ assets
const defaultLogo = require('../../assets/logo_school_outline.png');

export default function CustomSplashScreen({ onFinish }: { onFinish: () => void }) {
  const { info: schoolInfo, loading } = usePublicSchoolInfo();
  const [appIsReady, setAppIsReady] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Đợi một chút để logo và thông tin trường load (hoặc timeout nếu không kết nối được)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    // Nếu đã sẵn sàng (sau 2 giây) và không còn loading, chuyển sang màn hình chính
    // Không cần đợi API response thành công - app vẫn hoạt động với logo mặc định
    if (appIsReady) {
      const timer = setTimeout(() => {
        onFinish();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [appIsReady, onFinish]);

  // Sử dụng logo từ URL nếu có và chưa lỗi, ngược lại dùng logo mặc định
  const logoSource = schoolInfo.logoUrl && !logoError 
    ? { uri: schoolInfo.logoUrl } 
    : defaultLogo;

  return (
    <View style={styles.container}>
      <Image
        source={logoSource}
        style={styles.logo}
        resizeMode="contain"
        onError={() => {
          // Nếu logo từ URL lỗi, fallback về logo mặc định
          if (!logoError) {
            setLogoError(true);
            console.log('[SplashScreen] Logo URL failed, using default logo');
          }
        }}
      />
      {(schoolInfo.name && schoolInfo.name !== 'Hệ thống quản lý trường học') ? (
        <Text style={styles.title} numberOfLines={2}>
          {schoolInfo.name}
        </Text>
      ) : null}
      <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 16,
  },
});

