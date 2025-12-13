import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  StatusBar
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons'; // Hoặc @expo/vector-icons/Ionicons
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';

const { width } = Dimensions.get('window');

// Màu sắc chủ đạo
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  danger: '#EF4444',
  border: '#E5E7EB',
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [student, setStudent] = React.useState<any>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await studentService.getMyStudentProfile();
        if (mounted) setStudent(res);
      } catch {
        if (mounted) setStudent(null);
      }
    };
    load();
    return () => { mounted = false };
  }, []);

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout }
    ]);
  };

  const infoItems = [
    { label: 'Mã học sinh', value: student?.studentCode || '---', icon: 'id-card-outline' },
    { label: 'Lớp sinh hoạt', value: student?.classId?.className || (typeof student?.classId === 'string' ? student.classId : '---'), icon: 'people-outline' },
    { label: 'Khối', value: student?.classId?.grade ? `Khối ${student.classId.grade}` : '---', icon: 'layers-outline' },
    { label: 'Email', value: user?.email || '---', icon: 'mail-outline' },
    { label: 'Số điện thoại', value: user?.phone || '---', icon: 'call-outline' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* --- PHẦN CỐ ĐỊNH (KHÔNG CUỘN) --- */}
      <View style={styles.fixedHeaderContainer}>
        {/* Background Xanh */}
        <View style={styles.headerBackground}>
          <View style={styles.headerDecorationCircle} />
        </View>

        {/* Profile Card (Avatar + Tên) */}
        <View style={styles.profileCardWrapper}>
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} 
                style={styles.avatar}
              />
              <View style={styles.editIconBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </View>
            
            <Text style={styles.userName}>{user?.name || 'Học sinh'}</Text>
          </View>
        </View>
      </View>

      {/* --- PHẦN CUỘN (CHỈ CUỘN THÔNG TIN BÊN DƯỚI) --- */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* Info Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
          <View style={styles.infoCard}>
            {infoItems.map((item, index) => (
              <View key={index} style={[
                styles.infoRow, 
                index === infoItems.length - 1 && styles.noBorder
              ]}>
                <View style={styles.iconBox}>
                  <Ionicons name={item.icon as any} size={20} color={COLORS.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
        
        {/* Khoảng trống dưới cùng để không bị che bởi Bottom Tab */}
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
  
  // --- Fixed Header Styles ---
  fixedHeaderContainer: {
    // Không dùng absolute để nó đẩy ScrollView xuống dưới
    backgroundColor: COLORS.background,
    zIndex: 1,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180, // Chiều cao background xanh
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerDecorationCircle: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileCardWrapper: {
    marginTop: 80, // Đẩy xuống để hở background xanh phía trên
    paddingHorizontal: 20,
    marginBottom: 20, // Khoảng cách giữa Header và phần cuộn
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#E0E7FF',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    padding: 6,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  // --- ScrollView Styles ---
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  // Info Section Styles
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },

  // Logout Button Styles
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
  },
  
  versionText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    color: '#9CA3AF',
  },
});