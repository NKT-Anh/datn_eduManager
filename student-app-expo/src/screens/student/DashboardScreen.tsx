import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  RefreshControl,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
// Import hook để lấy chiều cao tai thỏ an toàn
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';

const { width } = Dimensions.get('window');

// Config Grid
const GAP = 12;
const PADDING = 20;
const ITEM_WIDTH = (width - (PADDING * 2) - (GAP * 2)) / 3;

const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  text: '#1F2937',
};

export default function DashboardScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets(); // Lấy thông số tai thỏ
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = async () => {
    try {
      const count = await studentService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, []);

  const menuItems = [
    { title: 'Lịch học', icon: 'calendar', color: '#3B82F6', bg: '#EFF6FF', screen: 'Schedule' },
    { title: 'Điểm số', icon: 'bar-chart', color: '#F59E0B', bg: '#FEF3C7', screen: 'Grades' },
    { title: 'Lịch thi', icon: 'document-text', color: '#EF4444', bg: '#FEE2E2', screen: 'Exams' },
    { title: 'Điểm danh', icon: 'checkmark-done-circle', color: '#10B981', bg: '#D1FAE5', screen: 'Attendance' },
    { title: 'Hạnh kiểm', icon: 'star', color: '#8B5CF6', bg: '#EDE9FE', screen: 'Conduct' },
    { title: 'Khảo sát', icon: 'clipboard', color: '#EC4899', bg: '#FCE7F3', screen: 'Survey' },
    { title: 'Học phí', icon: 'wallet', color: '#059669', bg: '#D1FAE5', screen: null },
    { title: 'Thông báo', icon: 'notifications', color: '#6366F1', bg: '#E0E7FF', screen: 'Notifications', badge: unreadCount },
    { title: 'Hồ sơ', icon: 'person', color: '#64748B', bg: '#F1F5F9', screen: 'Profile' },
  ];

  const handleNavigation = (item: any) => {
    if (item.screen) {
      navigation.navigate(item.screen);
    } else {
      Alert.alert('Thông báo', `Tính năng ${item.title} đang được phát triển.`);
    }
  };

  return (
    <View style={styles.container}>
      {/* StatusBar trong suốt đè lên header xanh */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={true} 
      />
      
      {/* --- HEADER CỐ ĐỊNH (KHÔNG BACK) --- */}
      <View style={styles.fixedHeaderSection}>
        {/* Background Xanh tràn lên tận đỉnh màn hình */}
        <View style={[styles.headerBackground, { height: 180 + insets.top }]} />
        
        {/* Nội dung Header được đẩy xuống để tránh tai thỏ */}
        <View style={[styles.headerContent, { paddingTop: insets.top + 20 }]}>
          <View style={styles.userInfo}>
            <View>
              <Text style={styles.greeting}>Xin chào,</Text>
              <Text style={styles.name}>{user?.name || 'Học sinh'}</Text>
            </View>
            <TouchableOpacity onPress={() => logout && logout()} style={styles.avatarContainer}>
               <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} 
                style={styles.avatar} 
               />
            </TouchableOpacity>
          </View>

          <View style={styles.quickInfoCard}>
            <View style={styles.quickInfoHeader}>
              <Ionicons name="school" size={20} color={COLORS.primary} />
              <Text style={styles.quickInfoTitle}>Lớp sinh hoạt</Text>
            </View>
            <Text style={styles.quickInfoSubject}>{user?.className || '12A1'}</Text>
            <Text style={styles.quickInfoRoom}>GVCN: Nguyễn Văn A</Text>
          </View>
        </View>
      </View>

      {/* --- MENU CUỘN --- */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <Text style={styles.sectionTitle}>Tiện ích</Text>
        
        <View style={styles.gridContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.card}
              onPress={() => handleNavigation(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              
              {item.badge && item.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fixedHeaderSection: {
    zIndex: 1,
    backgroundColor: COLORS.background, // Màu nền phía sau
    paddingBottom: 20,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Height được set động theo insets trong code component
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    paddingHorizontal: 20,
    // Padding top được set động theo insets
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  quickInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  quickInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickInfoTitle: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  quickInfoSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  quickInfoRoom: {
    fontSize: 13,
    color: '#6B7280',
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PADDING,
    gap: GAP,
  },
  card: {
    width: ITEM_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: GAP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});