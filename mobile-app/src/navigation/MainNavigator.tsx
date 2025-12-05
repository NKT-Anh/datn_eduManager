/**
 * Main Navigator (after authentication)
 */

import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import {colors} from '../theme';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
// Student screens
import StudentDashboardScreen from '../screens/student/StudentDashboardScreen';
import StudentScheduleScreen from '../screens/student/StudentScheduleScreen';
import StudentGradesScreen from '../screens/student/StudentGradesScreen';
import StudentExamsScreen from '../screens/student/StudentExamsScreen';
import StudentExamGradesScreen from '../screens/student/StudentExamGradesScreen';
// Teacher screens
import TeacherDashboardScreen from '../screens/teacher/TeacherDashboardScreen';
import TeacherScheduleScreen from '../screens/teacher/TeacherScheduleScreen';
import TeacherExamScheduleScreen from '../screens/teacher/TeacherExamScheduleScreen';
import TeacherExamRoomsScreen from '../screens/teacher/TeacherExamRoomsScreen';
import StudentNotificationsScreen from '../screens/student/StudentNotificationsScreen';
import StudentNotificationDetailScreen from '../screens/student/StudentNotificationDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainNavigator: React.FC = () => {
  const {user} = useAuth();
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  const commonScreenOptions = {
    headerStyle: { backgroundColor: colors.surface },
    headerShadowVisible: false as const,
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
    headerTintColor: colors.textPrimary,
  };

  if (isStudent) {
    return (
      <Stack.Navigator screenOptions={commonScreenOptions}>
        <Stack.Screen
          name="StudentDashboard"
          component={StudentDashboardScreen}
          options={{title: 'Trang chủ'}}
        />
        <Stack.Screen
          name="StudentSchedule"
          component={StudentScheduleScreen}
          options={{title: 'Lịch học'}}
        />
        <Stack.Screen
          name="StudentGrades"
          component={StudentGradesScreen}
          options={{title: 'Điểm số'}}
        />
        <Stack.Screen
          name="StudentExams"
          component={StudentExamsScreen}
          options={{title: 'Lịch thi'}}
        />
        <Stack.Screen
          name="StudentExamGrades"
          component={StudentExamGradesScreen}
          options={{title: 'Điểm thi'}}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{title: 'Hồ sơ'}}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{title: 'Cài đặt'}}
        />
        <Stack.Screen
          name="StudentNotifications"
          component={StudentNotificationsScreen}
          options={{title: 'Thông báo'}}
        />
        <Stack.Screen
          name="StudentNotificationDetail"
          component={StudentNotificationDetailScreen}
          options={{title: 'Chi tiết thông báo'}}
        />
      </Stack.Navigator>
    );
  }

  if (isTeacher) {
    return (
      <Stack.Navigator screenOptions={commonScreenOptions}>
        <Stack.Screen
          name="TeacherDashboard"
          component={TeacherDashboardScreen}
          options={{title: 'Trang chủ'}}
        />
        <Stack.Screen
          name="TeacherSchedule"
          component={TeacherScheduleScreen}
          options={{title: 'Lịch dạy'}}
        />
        <Stack.Screen
          name="TeacherExamSchedule"
          component={TeacherExamScheduleScreen}
          options={{title: 'Lịch coi thi'}}
        />
        <Stack.Screen
          name="TeacherExamRooms"
          component={TeacherExamRoomsScreen}
          options={{title: 'Phòng gác thi'}}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{title: 'Hồ sơ'}}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{title: 'Cài đặt'}}
        />
      </Stack.Navigator>
    );
  }

  // Default navigator for other roles
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default MainNavigator;

