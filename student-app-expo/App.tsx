/**
 * Main App Component
 */

import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import CustomSplashScreen from './src/components/SplashScreen';

// ✅ Dev guard: detect boolean props accidentally passed as strings ("true"/"false")
// This helps pinpoint the exact component/prop causing Android crash: String cannot be cast to Boolean.
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
            // eslint-disable-next-line no-console
            console.error(
              `[BoolPropGuard] Prop "${key}" is a STRING (${JSON.stringify(v)}) on <${name}>. Fix to {${v}}.`,
              { propValue: v, props }
            );
            // eslint-disable-next-line no-console
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
    <AuthProvider>
      <StatusBar style="auto" />
      {!isSplashReady ? (
        <CustomSplashScreen onFinish={() => setIsSplashReady(true)} />
      ) : (
        <AppNavigator />
      )}
    </AuthProvider>
  );
}
