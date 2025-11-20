const admin = require('../config/firebaseAdmin');
const Account = require('../models/user/account');

// Middleware xác thực Firebase token
const authMiddleware = async (req, res, next) => {
  // try {
  //   const authHeader = req.headers.authorization;
  //   console.log('Authorization header 1 :', authHeader); // ✅ kiểm tra token có gửi đến không
  //   console.log('Authorization header 2 :', req.headers.authorization);
  //   console.log('Incoming headers:', req.headers);



    
  //   if (!authHeader || !authHeader.startsWith("Bearer ")) {
  //     return res.status(401).json({ message: "Không có token" });
  //   }

  //   const idToken = authHeader.split(" ")[1];
  //   console.log('ID Token:', idToken); // ✅ xem token Firebase nhận được

  //   const decodedToken = await admin.auth().verifyIdToken(idToken);
  //   console.log('Decoded token:', decodedToken); // ✅ thông tin user từ Firebase

  //   // Tìm account trong MongoDB dựa trên uid
  //   const account = await Account.findOne({ uid: decodedToken.uid });
  //   if (!account) {
  //     return res.status(401).json({ message: "Tài khoản không tồn tại trong hệ thống" });
  //   }

  //   // Gắn thông tin vào request để controller sử dụng
  //   req.user = {
  //     uid: decodedToken.uid,
  //     accountId: account._id,
  //     role: account.role,
  //     email: account.email,
  //     phone: account.phone
  //   };

  //   next();
  // } catch (error) {
  //   console.error("Lỗi xác thực:", error.message, error.code, error);
  //   res.status(401).json({ message: "Sai token hoặc tài khoản" });
  // }
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
    const teacher = await Teacher.findOne({ accountId: account._id })
      .select('isHomeroom isDepartmentHead isLeader permissions');
    if (teacher) {
      req.user.teacherFlags = {
        isHomeroom: teacher.isHomeroom || false,
        isDepartmentHead: teacher.isDepartmentHead || false,
        isLeader: teacher.isLeader || false,
        permissions: teacher.permissions || []
      };
      console.log("✅ [Auth] Teacher flags:", req.user.teacherFlags);
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
