const User = require('../models/user/user');
const admin = require('../config/firebaseAdmin'); // Firebase Admin SDK
const jwt = require('jsonwebtoken');
const { logLogin } = require('../middlewares/auditLogMiddleware');

// Login: Xác thực Firebase token + trả về role + JWT backend nếu muốn
exports.login = async (req, res) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) {
    return res.status(401).json({ message: 'Missing Firebase ID token' });
  }

  try {
    // 1. Xác minh token với Firebase
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2. Tìm user trong MongoDB
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({ message: 'User not found in database' });
    }

    // 3. (Tuỳ chọn) Tạo JWT riêng để bảo vệ API backend
    const token = jwt.sign(
      { userId: user._id, uid: user.uid, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    // ✅ Nếu user là teacher, thêm teacherFlags (ưu tiên yearRoles theo năm học hiện tại)
    let teacherFlags = null;
    if (user.role === 'teacher') {
      const Teacher = require('../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: user._id })
        .select('isHomeroom isDepartmentHead isLeader permissions yearRoles currentHomeroomClassId');
      if (teacher) {
        // ✅ Xác định năm học hiện tại: ưu tiên header > query > active SchoolYear > settings > env
        const SchoolYearModel = require('../models/schoolYear');
        const Setting = require('../models/settings');
        
        let effectiveYear = (req.headers && (req.headers['x-school-year'] || req.headers['x-school-year-code']))
          || req.query?.year
          || null;
        
        // ✅ Nếu không có từ request, lấy từ active SchoolYear hoặc settings
        if (!effectiveYear) {
          try {
            const active = await SchoolYearModel.findOne({ isActive: true }).lean();
            if (active && active.code) {
              effectiveYear = String(active.code);
            } else {
              const s = await Setting.findOne().lean();
              if (s && s.currentSchoolYear) {
                effectiveYear = String(s.currentSchoolYear);
              } else {
                effectiveYear = process.env.SCHOOL_YEAR || null;
              }
            }
          } catch (e) {
            effectiveYear = process.env.SCHOOL_YEAR || null;
          }
        }

        // ✅ QUAN TRỌNG: Chỉ lấy flags theo năm học hiện tại (effectiveYear)
        // Nếu không có yearRoleEntry cho năm hiện tại → không có flag đó trong năm này
        // Role gốc (teacher) giữ nguyên, nhưng flags thay đổi theo năm học
        // ✅ isLeader được set cứng ở top-level (teacher.isLeader) để BGH luôn truy cập ở mọi năm
        if (effectiveYear && Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
          console.log(`🔍 [Login] Tìm yearRoleEntry cho năm học: ${effectiveYear}`);
          console.log(`🔍 [Login] Teacher yearRoles:`, teacher.yearRoles.map(yr => ({
            schoolYear: yr.schoolYear,
            isHomeroom: yr.isHomeroom,
            isDepartmentHead: yr.isDepartmentHead
          })));
          
          const yr = teacher.yearRoles.find(r => String(r.schoolYear) === String(effectiveYear));
          if (yr) {
            // ✅ Có yearRoleEntry cho năm hiện tại → dùng flags từ đó (trừ isLeader)
            console.log(`✅ [Login] Tìm thấy yearRoleEntry cho năm ${effectiveYear}:`, {
              isHomeroom: yr.isHomeroom,
              isDepartmentHead: yr.isDepartmentHead,
              currentHomeroomClassId: yr.currentHomeroomClassId
            });
            teacherFlags = {
              isHomeroom: !!yr.isHomeroom,
              isDepartmentHead: !!yr.isDepartmentHead,
              isLeader: !!teacher.isLeader, // ✅ CHỈ lấy từ top-level - BGH được set cứng
              permissions: Array.isArray(yr.permissions) ? yr.permissions : (yr.permissions ? [yr.permissions] : []),
              currentHomeroomClassId: yr.currentHomeroomClassId || null
            };
          } else {
            // ✅ Không có yearRoleEntry cho năm hiện tại → không có flags trong năm này (trừ isLeader)
            console.log(`⚠️ [Login] Không tìm thấy yearRoleEntry cho năm ${effectiveYear}. Set isHomeroom: false`);
            teacherFlags = {
              isHomeroom: false,
              isDepartmentHead: false,
              isLeader: !!teacher.isLeader, // ✅ CHỈ lấy từ top-level - BGH được set cứng
              permissions: [],
              currentHomeroomClassId: null
            };
          }
        } else {
          // ✅ Nếu không có effectiveYear hoặc không có yearRoles → fallback về legacy (chỉ khi không có năm học)
          // Điều này chỉ xảy ra khi hệ thống chưa có cấu hình năm học
          teacherFlags = {
            isHomeroom: teacher.isHomeroom || Boolean(teacher.currentHomeroomClassId),
            isDepartmentHead: teacher.isDepartmentHead || false,
            isLeader: !!teacher.isLeader, // ✅ CHỈ lấy từ top-level - BGH được set cứng
            permissions: teacher.permissions || [],
            currentHomeroomClassId: teacher.currentHomeroomClassId || null
          };
        }
        
        console.log(`✅ [Login] Teacher flags (năm học: ${effectiveYear}):`, teacherFlags);
      }
    }

    // ✅ Log đăng nhập thành công
    try {
      await logLogin(req, user, 'SUCCESS');
    } catch (logError) {
      console.error('Error logging login:', logError);
    }

    res.json({
      message: 'Login successful',
      role: user.role,
      uid: user.uid,
      jwt: token, // token này chỉ dùng để gọi API backend (nếu cần)
      ...(teacherFlags && { teacherFlags })
    });
    console.log("JWT_SECRET =", process.env.JWT_SECRET);

  } catch (error) {
    console.error('[Login Error]', error);
    
    // ✅ Log đăng nhập thất bại (nếu có thể lấy được thông tin user)
    try {
      let decoded = null;
      try {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (idToken) {
          decoded = await admin.auth().verifyIdToken(idToken);
        }
      } catch (e) {
        // Token không hợp lệ, bỏ qua
      }
      
      if (decoded?.uid) {
        const Account = require('../models/user/account');
        const account = await Account.findOne({ uid: decoded.uid }).lean();
        if (account) {
          await logLogin(req, account, 'FAILED', error.message);
        }
      }
    } catch (logError) {
      console.error('Error logging failed login:', logError);
    }
    
    res.status(401).json({ message: 'Invalid Firebase token' });
  }
};
