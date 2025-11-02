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
  console.log("== Incoming Request ==");
console.log("Headers:", req.headers);

try {
  const authHeader = req.headers.authorization;
  console.log("Auth header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Không có token" });
  }

  const idToken = authHeader.split(" ")[1];
  console.log("ID Token:", idToken);

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  console.log("Decoded token:", decodedToken);

  const account = await Account.findOne({ uid: decodedToken.uid });
  console.log("Account in DB:", account);

  if (!account) {
    return res.status(401).json({ message: "Tài khoản không tồn tại trong hệ thống" });
  }

  req.user = { uid: decodedToken.uid, accountId: account._id, role: account.role };
  next();
} catch (error) {
  console.error("Lỗi xác thực:", error.message, error.code);
  res.status(401).json({ message: "Sai token hoặc tài khoản" });
}

};

module.exports = authMiddleware;
