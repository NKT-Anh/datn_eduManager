/**
 * Main App Component
 */

import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
// 1. Import SafeAreaProvider
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import CustomSplashScreen from './src/components/SplashScreen';

// ✅ Dev guard: detect boolean props accidentally passed as strings
if (__DEV__) {
  const rAny = React as any;
  if (!rAny.__BOOL_PROP_GUARD_INSTALLED__) {
    rAny.__BOOL_PROP_GUARD_INSTALLED__ = true;
    const origCreateElement = React.createElement;
    const BOOL_KEYS = new Set([
      'collapsable',
      'disabled',
      'editable',
      'scrollEnabled',
      'nestedScrollEnabled',
      'removeClippedSubviews',
      'transparent',
      'secureTextEntry',
      'showsVerticalScrollIndicator',
      'showsHorizontalScrollIndicator',
      'horizontal',
      'enabled',
      'focusable',
    ]);

    (React as any).createElement = (type: any, props: any, ...children: any[]) => {
      if (props && typeof props === 'object') {
        for (const key of Object.keys(props)) {
          if (!BOOL_KEYS.has(key)) continue;
          const v = props[key];
          if (v === 'true' || v === 'false') {
            const name =
              typeof type === 'string'
                ? type
                : type?.displayName || type?.name || 'AnonymousComponent';
            console.error(
              `[BoolPropGuard] Prop "${key}" is a STRING (${JSON.stringify(v)}) on <${name}>. Fix to {${v}}.`,
              { propValue: v, props }
            );
            console.error(new Error('[BoolPropGuard] stack').stack);
          }
        }
      }
      return origCreateElement(type, props, ...children);
    };
  }
}

export default function App() {
  const [isSplashReady, setIsSplashReady] = useState(false);

  return (
    // 2. Bọc toàn bộ App trong SafeAreaProvider
    // Đây là chìa khóa để xóa khoảng trắng trên đầu và giúp useSafeAreaInsets hoạt động
    <SafeAreaProvider>
      <AuthProvider>
        {/* style="light" để chữ trên thanh pin màu trắng (nền xanh) */}
        <StatusBar style="light" translucent /> 
        
        {!isSplashReady ? (
          <CustomSplashScreen onFinish={() => setIsSplashReady(true)} />
        ) : (
          <AppNavigator />
        )}
      </AuthProvider>
    </SafeAreaProvider>
  );
}