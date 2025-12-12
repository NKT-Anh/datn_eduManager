/**
 * App Navigator
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/student/DashboardScreen';
import ScheduleScreen from '../screens/student/ScheduleScreen';
import GradesScreen from '../screens/student/GradesScreen';
import ExamsScreen from '../screens/student/ExamsScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import NotificationDetailScreen from '../screens/student/NotificationDetailScreen';
import ProfileScreen from '../screens/student/ProfileScreen';
import AttendanceScreen from '../screens/student/AttendanceScreen';
import SurveyScreen from '../screens/student/SurveyScreen';
import ConductScreen from '../screens/student/ConductScreen';
import GradeDetailScreen from '../screens/student/GradeDetailScreen';
import ScheduleDayDetailScreen from '../screens/student/ScheduleDayDetailScreen';
import ExamRoomDetailScreen from '../screens/student/ExamRoomDetailScreen';
import AttendanceRecordDetailScreen from '../screens/student/AttendanceRecordDetailScreen';
import { ActivityIndicator, View, Text } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function StudentTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Trang chủ',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{
          tabBarLabel: 'Lịch học',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📅</Text>,
        }}
      />
      <Tab.Screen
        name="Grades"
        component={GradesScreen}
        options={{
          tabBarLabel: 'Điểm số',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="Exams"
        component={ExamsScreen}
        options={{
          tabBarLabel: 'Kỳ thi',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📝</Text>,
        }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{
          tabBarLabel: 'Điểm danh',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>✅</Text>,
        }}
      />
      <Tab.Screen
        name="Survey"
        component={SurveyScreen}
        options={{
          tabBarLabel: 'Khảo sát',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📋</Text>,
        }}
      />
      <Tab.Screen
        name="Conduct"
        component={ConductScreen}
        options={{
          tabBarLabel: 'Hạnh kiểm',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>⭐</Text>,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Thông báo',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🔔</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Hồ sơ',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 12, color: '#666' }}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={StudentTabs} />
            <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
            <Stack.Screen name="GradeDetail" component={GradeDetailScreen} />
            <Stack.Screen name="ScheduleDayDetail" component={ScheduleDayDetailScreen} />
            <Stack.Screen name="ExamRoomDetail" component={ExamRoomDetailScreen} />
            <Stack.Screen name="AttendanceDetail" component={AttendanceRecordDetailScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

