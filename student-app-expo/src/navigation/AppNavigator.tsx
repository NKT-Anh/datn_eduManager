/**
 * App Navigator - Fixed Bottom Bar Logic
 */

import React from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';

// --- Screens Import ---
import LoginScreen from '../screens/auth/LoginScreen';

// Main Screens
import DashboardScreen from '../screens/student/DashboardScreen';
import ScheduleScreen from '../screens/student/ScheduleScreen';
import GradesScreen from '../screens/student/GradesScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import ProfileScreen from '../screens/student/ProfileScreen';

// Feature Screens (Các trang này cần hiện Tab Bar)
import ExamsScreen from '../screens/student/ExamsScreen';
import AttendanceScreen from '../screens/student/AttendanceScreen';
import SurveyScreen from '../screens/student/SurveyScreen';
import ConductScreen from '../screens/student/ConductScreen';

// Detail Screens
import NotificationDetailScreen from '../screens/student/NotificationDetailScreen';
import GradeDetailScreen from '../screens/student/GradeDetailScreen';
import ScheduleDayDetailScreen from '../screens/student/ScheduleDayDetailScreen';
import ExamRoomDetailScreen from '../screens/student/ExamRoomDetailScreen';
import AttendanceRecordDetailScreen from '../screens/student/AttendanceRecordDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tạo các Stack con cho từng Tab để giữ Bottom Bar
const HomeStack = createNativeStackNavigator();
const ScheduleStack = createNativeStackNavigator();
const GradesStack = createNativeStackNavigator();
const NotificationStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const COLORS = {
  primary: '#2563EB',
  inactive: '#94A3B8',
  background: '#FFFFFF',
  border: '#E2E8F0',
};

// ====================================================
// 1. HOME STACK (Dashboard + Các tính năng tiện ích)
// ====================================================
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="DashboardMain" component={DashboardScreen} />
      
      {/* Các tính năng mở từ Dashboard sẽ nằm trong Stack này -> Giữ được Tab Bar */}
      <HomeStack.Screen name="Exams" component={ExamsScreen} />
      <HomeStack.Screen name="Attendance" component={AttendanceScreen} />
      <HomeStack.Screen name="Survey" component={SurveyScreen} />
      <HomeStack.Screen name="Conduct" component={ConductScreen} />
      
      {/* Các trang chi tiết liên quan đến Home/Exams */}
      <HomeStack.Screen name="ExamRoomDetail" component={ExamRoomDetailScreen} />
      <HomeStack.Screen name="AttendanceDetail" component={AttendanceRecordDetailScreen} />
    </HomeStack.Navigator>
  );
}

// ====================================================
// 2. SCHEDULE STACK (Lịch + Chi tiết ngày)
// ====================================================
function ScheduleStackNavigator() {
  return (
    <ScheduleStack.Navigator screenOptions={{ headerShown: false }}>
      <ScheduleStack.Screen name="ScheduleMain" component={ScheduleScreen} />
      <ScheduleStack.Screen name="ScheduleDayDetail" component={ScheduleDayDetailScreen} />
    </ScheduleStack.Navigator>
  );
}

// ====================================================
// 3. GRADES STACK (Điểm + Chi tiết điểm)
// ====================================================
function GradesStackNavigator() {
  return (
    <GradesStack.Navigator screenOptions={{ headerShown: false }}>
      <GradesStack.Screen name="GradesMain" component={GradesScreen} />
      <GradesStack.Screen name="GradeDetail" component={GradeDetailScreen} />
    </GradesStack.Navigator>
  );
}

// ====================================================
// 4. NOTIFICATIONS STACK (Thông báo + Chi tiết)
// ====================================================
function NotificationsStackNavigator() {
  return (
    <NotificationStack.Navigator screenOptions={{ headerShown: false }}>
      <NotificationStack.Screen name="NotificationsMain" component={NotificationsScreen} />
      <NotificationStack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
    </NotificationStack.Navigator>
  );
}

// ====================================================
// 5. PROFILE STACK (Hồ sơ + Cài đặt nếu có)
// ====================================================
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      {/* Nếu sau này Profile có trang con (ví dụ Đổi mật khẩu), thêm vào đây */}
    </ProfileStack.Navigator>
  );
}

// ====================================================
// MAIN TAB NAVIGATOR
// ====================================================
function StudentTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: Platform.OS === 'android' ? 8 : 0,
          marginTop: -4,
        },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 65,
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          elevation: 0,
        },
        // Quan trọng: Để false để khi mở trang con bàn phím không che mất tab bar (tùy chọn)
        tabBarHideOnKeyboard: true, 
        
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'alert-circle';

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Schedule':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Grades':
              iconName = focused ? 'ribbon' : 'ribbon-outline';
              break;
            case 'Notifications':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      {/* Thay vì component là Screen lẻ, ta truyền vào Stack Navigator tương ứng */}
      <Tab.Screen 
        name="Home" 
        component={HomeStackNavigator} 
        options={{ tabBarLabel: 'Trang chủ' }} 
      />
      <Tab.Screen 
        name="Schedule" 
        component={ScheduleStackNavigator} 
        options={{ tabBarLabel: 'Lịch học' }} 
      />
      <Tab.Screen 
        name="Grades" 
        component={GradesStackNavigator} 
        options={{ tabBarLabel: 'Điểm số' }} 
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsStackNavigator} 
        options={{ tabBarLabel: 'Thông báo' }} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator} 
        options={{ tabBarLabel: 'Hồ sơ' }} 
      />
    </Tab.Navigator>
  );
}

// ====================================================
// ROOT NAVIGATOR (Chỉ chứa Login và Main Tab)
// ====================================================
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: '#666' }}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          // Khi đã login, chỉ cần gọi StudentTabs. 
          // Mọi trang con đã được nhét vào trong các Tab Stack rồi.
          <Stack.Screen name="Main" component={StudentTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}