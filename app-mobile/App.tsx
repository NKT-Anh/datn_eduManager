import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context/lib/typescript/src';
import {AuthProvider} from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;

