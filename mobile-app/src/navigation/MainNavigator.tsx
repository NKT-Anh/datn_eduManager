/**
 * Main Navigator (after authentication)
 */

import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
// Student screens
import StudentDashboardScreen from '../screens/student/StudentDashboardScreen';
import StudentScheduleScreen from '../screens/student/StudentScheduleScreen';
import StudentGradesScreen from '../screens/student/StudentGradesScreen';
import StudentExamsScreen from '../screens/student/StudentExamsScreen';
// Teacher screens
import TeacherDashboardScreen from '../screens/teacher/TeacherDashboardScreen';
import TeacherScheduleScreen from '../screens/teacher/TeacherScheduleScreen';
import TeacherExamScheduleScreen from '../screens/teacher/TeacherExamScheduleScreen';
import TeacherExamRoomsScreen from '../screens/teacher/TeacherExamRoomsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainNavigator: React.FC = () => {
  const {user} = useAuth();
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  if (isStudent) {
    return (
      <Stack.Navigator>
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

  if (isTeacher) {
    return (
      <Stack.Navigator>
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

