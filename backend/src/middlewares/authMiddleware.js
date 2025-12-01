const admin = require('../config/firebaseAdmin');
const Account = require('../models/user/account');
const { getEffectiveSchoolYear } = require('../utils/schoolYearHelper');

// Middleware xác thực Firebase token
const authMiddleware = async (req, res, next) => {
try {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    console.log("❌ [Auth] Không có Authorization header");
    return res.status(401).json({ message: "Không có token", code: "auth/missing-token" });
  }

  // ✅ Kiểm tra format Bearer token
  if (!authHeader.startsWith("Bearer ")) {
    console.log("❌ [Auth] Format token sai. Header:", authHeader.substring(0, 20) + "...");
    return res.status(401).json({ message: "Token phải có format: Bearer <token>", code: "auth/invalid-format" });
  }

  const idToken = authHeader.split(" ")[1];
  
  // ✅ Kiểm tra token không rỗng
  if (!idToken || idToken.trim() === "") {
    console.log("❌ [Auth] Token rỗng sau khi split");
    return res.status(401).json({ message: "Token không được để trống", code: "auth/empty-token" });
  }

  // ✅ Kiểm tra token có đủ độ dài (Firebase ID token thường > 100 ký tự)
  if (idToken.length < 50) {
    console.log("❌ [Auth] Token quá ngắn:", idToken.length, "ký tự");
    return res.status(401).json({ message: "Token không hợp lệ (quá ngắn)", code: "auth/invalid-token" });
  }

  console.log("✅ [Auth] Đã nhận token, độ dài:", idToken.length, "ký tự. Đang verify...");

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  console.log("✅ [Auth] Token hợp lệ. UID:", decodedToken.uid);

  const account = await Account.findOne({ uid: decodedToken.uid });

  if (!account) {
    console.log("❌ [Auth] Không tìm thấy account với UID:", decodedToken.uid);
    return res.status(401).json({ message: "Tài khoản không tồn tại trong hệ thống" });
  }

  // ✅ Kiểm tra tài khoản có bị khóa không
  if (account.isLocked === true) {
    console.log("❌ [Auth] Tài khoản đã bị khóa. UID:", decodedToken.uid);
    return res.status(403).json({ 
      message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.',
      code: 'ACCOUNT_LOCKED',
      lockedAt: account.lockedAt,
      lockReason: account.lockReason
    });
  }

  console.log("✅ [Auth] Xác thực thành công. Role:", account.role);
  
  // ✅ Gắn thông tin user vào request
  req.user = { 
    uid: decodedToken.uid, 
    accountId: account._id, 
    role: account.role,
    email: account.email,
    phone: account.phone
  };
  
  // ✅ Nếu là teacher, lấy teacherFlags
  if (account.role === 'teacher') {
    const Teacher = require('../models/user/teacher');
    // Lấy cả yearRoles để ưu tiên nếu có năm hiện tại
    const teacher = await Teacher.findOne({ accountId: account._id })
      .select('isHomeroom isDepartmentHead isLeader permissions yearRoles currentHomeroomClassId');
    if (teacher) {
      // ✅ Xác định năm học hiện tại bằng utility function
      const effectiveYear = await getEffectiveSchoolYear(req);

      // ✅ QUAN TRỌNG: Chỉ lấy flags theo năm học hiện tại (effectiveYear)
      // Nếu không có yearRoleEntry cho năm hiện tại → không có flag đó trong năm này
      // Role gốc (teacher) giữ nguyên, nhưng flags thay đổi theo năm học
      // ✅ isLeader được set cứng ở top-level (teacher.isLeader) để BGH luôn truy cập ở mọi năm
      if (effectiveYear && Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
        const yr = teacher.yearRoles.find(r => String(r.schoolYear) === String(effectiveYear));
        if (yr) {
          // ✅ Có yearRoleEntry cho năm hiện tại → dùng flags từ đó (trừ isLeader)
          teacherFlags = {
            isHomeroom: !!yr.isHomeroom,
            isDepartmentHead: !!yr.isDepartmentHead,
            isLeader: !!teacher.isLeader, // ✅ CHỈ lấy từ top-level - BGH được set cứng
            permissions: Array.isArray(yr.permissions) ? yr.permissions : (yr.permissions ? [yr.permissions] : []),
            currentHomeroomClassId: yr.currentHomeroomClassId || null
          };
        } else {
          // ✅ Không có yearRoleEntry cho năm hiện tại → không có flags trong năm này (trừ isLeader)
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

      req.user.teacherFlags = teacherFlags;
      console.log("✅ [Auth] Teacher flags (năm học:", effectiveYear, "):", req.user.teacherFlags);
    }
  }
  
  next();
} catch (error) {
  console.error("❌ [Auth] Lỗi xác thực:", {
    message: error.message,
    code: error.code,
    errorName: error.name,
    stack: error.stack?.substring(0, 200) // Chỉ log 200 ký tự đầu của stack
  });
  
  // Trả về thông báo lỗi chi tiết hơn
  let errorMessage = "Sai token hoặc tài khoản";
  let errorCode = error.code || "auth/unknown-error";
  
  if (error.code === "auth/id-token-expired") {
    errorMessage = "Token đã hết hạn. Vui lòng đăng nhập lại.";
  } else if (error.code === "auth/argument-error") {
    errorMessage = "Token không hợp lệ. Vui lòng kiểm tra lại token hoặc đăng nhập lại.";
    console.log("💡 [Auth] Gợi ý: Token có thể bị cắt, sai format, hoặc không phải Firebase ID token");
  } else if (error.code === "auth/invalid-id-token") {
    errorMessage = "Token không hợp lệ hoặc đã bị thay đổi.";
  } else if (error.code === "auth/network-request-failed") {
    errorMessage = "Không thể kết nối với Firebase. Vui lòng thử lại sau.";
  }
  
  res.status(401).json({ 
    message: errorMessage, 
    code: errorCode,
    hint: error.code === "auth/argument-error" ? "Đảm bảo token là Firebase ID token hợp lệ, không bị cắt hoặc thay đổi" : undefined
  });
}
};

module.exports = authMiddleware;
