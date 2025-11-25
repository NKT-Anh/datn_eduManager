const User = require('../models/user/user');
const Account = require('../models/user/account');
const admin = require('../config/firebaseAdmin'); // Firebase Admin SDK
const jwt = require('jsonwebtoken');
const { logLogin } = require('../middlewares/auditLogMiddleware');
const Setting = require('../models/settings');
const nodemailer = require('nodemailer');

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

/**
 * 🔐 Gửi OTP qua SMS hoặc Email để reset mật khẩu
 * Hỗ trợ cả SMS (Firebase Phone Auth) và Email (Nodemailer)
 */
exports.sendPasswordResetOTP = async (req, res) => {
  console.log('🔔 [sendPasswordResetOTP] Called with:', { phoneNumber: req.body.phoneNumber, email: req.body.email });
  try {
    const { phoneNumber, email } = req.body;

    // Phải có ít nhất một trong hai: phoneNumber hoặc email
    if (!phoneNumber && !email) {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại hoặc email' });
    }

    let account = null;
    let user = null;
    let method = null; // 'phone' hoặc 'email'

    // ✅ Xử lý theo số điện thoại
    if (phoneNumber) {
      method = 'phone';
      
      let trimmedPhone = phoneNumber.trim();
      let formattedPhone;
      
      // ✅ Nếu input đã có format +84, xử lý riêng
      if (trimmedPhone.startsWith('+84')) {
        // Lấy phần sau +84
        const afterPlus84 = trimmedPhone.substring(3).replace(/\D/g, '');
        
        if (afterPlus84.length !== 9) {
          return res.status(400).json({ message: 'Số điện thoại sau +84 phải có đúng 9 chữ số' });
        }
        
        // Format: +84 + 9 số
        formattedPhone = '+84' + afterPlus84;
        trimmedPhone = '0' + afterPlus84; // Để tìm kiếm trong database
      } else {
        // ✅ Nếu input bắt đầu bằng 0 hoặc chỉ có số
        // Trim và chỉ lấy số, tối đa 10 ký tự
        trimmedPhone = trimmedPhone.replace(/\D/g, '');
        
        // Kiểm tra độ dài
        if (trimmedPhone.length > 10) {
          trimmedPhone = trimmedPhone.slice(0, 10);
        }
        
        if (trimmedPhone.length !== 10) {
          return res.status(400).json({ message: 'Số điện thoại phải có đúng 10 chữ số' });
        }
        
        // Format phone number (đảm bảo có +84)
        if (trimmedPhone.startsWith('0')) {
          formattedPhone = '+84' + trimmedPhone.substring(1);
        } else {
          formattedPhone = '+84' + trimmedPhone;
        }
      }

      // ✅ Tìm số điện thoại theo cả 2 format: +84 và 0
      // Format 1: +84397090096
      // Format 2: 0397090096 (nếu có trong database)
      const phoneVariants = [
        formattedPhone, // +84397090096
        trimmedPhone.startsWith('0') ? trimmedPhone : '0' + trimmedPhone, // 0397090096
      ];
      
      console.log(`🔍 [Forgot Password] Tìm kiếm số điện thoại:`, {
        input: phoneNumber,
        trimmed: trimmedPhone,
        formatted: formattedPhone,
        variants: phoneVariants
      });
      
      // Tìm trong Account với cả 2 format
      account = await Account.findOne({ 
        $or: phoneVariants.map(phone => ({ phone }))
      });
      
      if (account) {
        console.log(`✅ [Forgot Password] Tìm thấy account:`, { 
          uid: account.uid, 
          phone: account.phone, 
          role: account.role,
          email: account.email 
        });
      } else {
        console.log(`⚠️ [Forgot Password] Không tìm thấy account với format:`, phoneVariants);
      }
      
      // Nếu không tìm thấy trong Account, tìm trong User model
      if (!account) {
        const User = require('../models/user/user');
        user = await User.findOne({ 
          $or: phoneVariants.map(phone => ({ phone }))
        }).populate('accountId');
        
        if (user && user.accountId) {
          account = user.accountId;
          
          // ✅ Đồng bộ số điện thoại mới vào Account và Firebase (luôn dùng format +84)
          try {
            account.phone = formattedPhone; // Lưu format +84
            await account.save();
            
            // Cập nhật Firebase
            await admin.auth().updateUser(account.uid, {
              phoneNumber: formattedPhone,
            });
            
            console.log(`✅ Đã đồng bộ số điện thoại mới vào Account và Firebase: ${formattedPhone}`);
          } catch (syncError) {
            console.error('⚠️ Lỗi đồng bộ số điện thoại:', syncError);
          }
        }
      } else {
        // ✅ Nếu tìm thấy account nhưng số điện thoại không đúng format, cập nhật
        if (account.phone !== formattedPhone && phoneVariants.includes(account.phone)) {
          account.phone = formattedPhone; // Cập nhật sang format +84
          await account.save();
          console.log(`✅ Đã cập nhật số điện thoại từ ${account.phone} sang ${formattedPhone}`);
        }
      }
      
      if (!account) {
        // ✅ Log để debug - thử tìm tất cả số điện thoại có chứa 9 số cuối
        const last9Digits = trimmedPhone.slice(-9);
        const similarPhones = await Account.find({
          phone: { $regex: last9Digits }
        }).limit(5).select('phone uid role email');
        
        console.log(`❌ [Forgot Password] Không tìm thấy account. Số điện thoại tương tự:`, 
          similarPhones.map(a => ({ phone: a.phone, uid: a.uid, role: a.role }))
        );
        
        return res.status(404).json({ 
          message: 'Số điện thoại không tồn tại trong hệ thống',
          debug: process.env.NODE_ENV === 'development' ? {
            input: phoneNumber,
            formatted: formattedPhone,
            searchedVariants: phoneVariants,
            similarPhones: similarPhones.map(a => a.phone)
          } : undefined
        });
      }

      // Firebase Phone Auth sẽ được xử lý ở client-side
      // Backend chỉ cần xác nhận số điện thoại tồn tại
      return res.json({
        success: true,
        message: 'Mã OTP đã được gửi đến số điện thoại của bạn',
        method: 'phone',
        phoneNumber: formattedPhone,
        maskedPhone: formattedPhone.substring(0, 4) + '****' + formattedPhone.substring(formattedPhone.length - 3),
        uid: account.uid
      });
    }

    // ✅ Xử lý theo email
    if (email) {
      method = 'email';
      const formattedEmail = email.trim().toLowerCase();

      // Tìm account theo email
      account = await Account.findOne({ email: formattedEmail });
      
      // Nếu không tìm thấy trong Account, tìm trong User model
      if (!account) {
        const User = require('../models/user/user');
        user = await User.findOne({ email: formattedEmail }).populate('accountId');
        
        if (user && user.accountId) {
          account = user.accountId;
        }
      }
      
      if (!account) {
        return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
      }

      // ✅ Tạo mã OTP 6 chữ số
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // ✅ Lưu OTP vào account (có thể dùng Redis hoặc lưu tạm vào account với thời gian hết hạn)
      // Tạm thời lưu vào một field tạm (có thể tạo model OTP riêng sau)
      account.tempOTP = otpCode;
      account.tempOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
      await account.save();

      // ✅ Gửi email OTP
      const Setting = require('../models/settings');
      const setting = await Setting.findOne();
      
      console.log('📧 [Email OTP] Kiểm tra cấu hình SMTP:', {
        hasSetting: !!setting,
        hasSmtp: !!(setting && setting.smtp),
        hasHost: !!(setting && setting.smtp && setting.smtp.host),
        hasUser: !!(setting && setting.smtp && setting.smtp.user),
        hasPass: !!(setting && setting.smtp && setting.smtp.pass)
      });
      
      if (!setting || !setting.smtp || !setting.smtp.host || !setting.smtp.user || !setting.smtp.pass) {
        console.error('❌ [Email OTP] SMTP chưa được cấu hình đầy đủ');
        return res.status(500).json({ 
          message: 'Hệ thống chưa được cấu hình email. Vui lòng liên hệ quản trị viên.',
          debug: process.env.NODE_ENV === 'development' ? {
            hasSetting: !!setting,
            hasSmtp: !!(setting && setting.smtp),
            missingFields: {
              host: !(setting && setting.smtp && setting.smtp.host),
              user: !(setting && setting.smtp && setting.smtp.user),
              pass: !(setting && setting.smtp && setting.smtp.pass)
            }
          } : undefined
        });
      }

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: setting.smtp.host,
        port: setting.smtp.port || 587,
        secure: setting.smtp.secure || false,
        auth: {
          user: setting.smtp.user,
          pass: setting.smtp.pass,
        },
      });

      const mailOptions = {
        from: `"${setting.smtp.fromName || 'Hệ thống trường học'}" <${setting.smtp.fromEmail || setting.smtp.user}>`,
        to: formattedEmail,
        subject: '🔐 Mã OTP đặt lại mật khẩu',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Đặt lại mật khẩu</h2>
            <p>Xin chào,</p>
            <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
            </div>
            <p>Mã OTP này có hiệu lực trong <strong>10 phút</strong>.</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Đây là email tự động, vui lòng không trả lời.</p>
          </div>
        `,
        text: `Mã OTP đặt lại mật khẩu của bạn là: ${otpCode}. Mã này có hiệu lực trong 10 phút.`
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Đã gửi OTP qua email đến: ${formattedEmail}`);
      } catch (emailError) {
        console.error('❌ [Email Send Error]', {
          message: emailError.message,
          code: emailError.code,
          command: emailError.command,
          response: emailError.response,
          stack: emailError.stack
        });
        
        // Xóa OTP đã lưu nếu gửi email thất bại
        account.tempOTP = undefined;
        account.tempOTPExpiry = undefined;
        await account.save();
        
        return res.status(500).json({ 
          message: 'Không thể gửi email. Vui lòng kiểm tra cấu hình SMTP hoặc liên hệ quản trị viên.',
          error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
        });
      }

      return res.json({
        success: true,
        message: 'Mã OTP đã được gửi đến email của bạn',
        method: 'email',
        email: formattedEmail,
        maskedEmail: formattedEmail.replace(/(.{2})(.*)(@.*)/, '$1****$3'),
        uid: account.uid
      });
    }
  } catch (error) {
    console.error('❌ [Send OTP Error]', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      message: 'Không thể gửi mã OTP. Vui lòng thử lại sau.', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 🔐 Xác thực OTP (cho email)
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    const formattedEmail = email.trim().toLowerCase();
    const account = await Account.findOne({ email: formattedEmail });

    if (!account) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
    }

    // Kiểm tra OTP
    if (!account.tempOTP || account.tempOTP !== otpCode) {
      return res.status(400).json({ message: 'Mã OTP không đúng' });
    }

    // Kiểm tra OTP hết hạn
    if (!account.tempOTPExpiry || new Date() > account.tempOTPExpiry) {
      return res.status(400).json({ message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' });
    }

    // Xóa OTP sau khi xác thực thành công
    account.tempOTP = undefined;
    account.tempOTPExpiry = undefined;
    await account.save();

    // Tạo token tạm để đổi mật khẩu (có thể dùng JWT hoặc session)
    const resetToken = jwt.sign(
      { uid: account.uid, email: formattedEmail, type: 'password_reset' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      message: 'Xác thực OTP thành công',
      resetToken: resetToken,
      uid: account.uid
    });
  } catch (error) {
    console.error('[Verify OTP Error]', error);
    res.status(500).json({ message: 'Không thể xác thực OTP. Vui lòng thử lại sau.', error: error.message });
  }
};

/**
 * 🔐 Reset mật khẩu sau khi xác thực OTP thành công
 * Hỗ trợ cả SMS (Firebase) và Email (OTP)
 */
exports.resetPassword = async (req, res) => {
  try {
    const { phoneNumber, email, newPassword, idToken, resetToken } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập mật khẩu mới' });
    }

    let uid = null;
    let account = null;

    // ✅ Xử lý theo SMS (Firebase)
    if (phoneNumber && idToken) {
      // Xác thực Firebase token (đã được verify OTP)
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;

      // ✅ Format phone number để tìm kiếm
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+84' + formattedPhone.substring(1);
        } else {
          formattedPhone = '+84' + formattedPhone;
        }
      }
      
      // ✅ Tìm kiếm theo cả 2 format
      const phoneVariants = [
        formattedPhone, // +84397090096
        phoneNumber.trim().startsWith('0') ? phoneNumber.trim() : '0' + phoneNumber.trim().replace(/^\+84/, ''), // 0397090096
      ];
      
      // Kiểm tra số điện thoại khớp với uid (tìm theo cả 2 format)
      account = await Account.findOne({ 
        uid,
        $or: phoneVariants.map(phone => ({ phone }))
      });
      if (!account) {
        return res.status(404).json({ message: 'Số điện thoại không khớp với tài khoản' });
      }
      
      // ✅ Cập nhật số điện thoại sang format +84 nếu cần
      if (account.phone !== formattedPhone && phoneVariants.includes(account.phone)) {
        account.phone = formattedPhone;
        await account.save();
      }
    }
    // ✅ Xử lý theo Email (OTP)
    else if (email && resetToken) {
      try {
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'your-secret-key');
        
        if (decoded.type !== 'password_reset') {
          return res.status(400).json({ message: 'Token không hợp lệ' });
        }

        const formattedEmail = email.trim().toLowerCase();
        if (decoded.email !== formattedEmail) {
          return res.status(400).json({ message: 'Email không khớp với token' });
        }

        uid = decoded.uid;
        account = await Account.findOne({ uid, email: formattedEmail });
        
        if (!account) {
          return res.status(404).json({ message: 'Email không khớp với tài khoản' });
        }
      } catch (tokenError) {
        return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
      }
    } else {
      return res.status(400).json({ message: 'Vui lòng cung cấp thông tin xác thực (idToken hoặc resetToken)' });
    }

    if (!account || !uid) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    // Cập nhật mật khẩu mới trong Firebase
    await admin.auth().updateUser(uid, { password: newPassword });

    // Xóa reset token nếu có
    if (account.tempOTP) {
      account.tempOTP = undefined;
      account.tempOTPExpiry = undefined;
      await account.save();
    }

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công',
      phoneNumber: phoneNumber || undefined,
      email: email || undefined
    });
  } catch (error) {
    console.error('[Reset Password Error]', error);
    res.status(500).json({ message: 'Không thể đặt lại mật khẩu. Vui lòng thử lại sau.', error: error.message });
  }
};

/**
 * 📧 Gửi OTP khi đăng nhập
 */
exports.sendLoginOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    const formattedEmail = email.trim().toLowerCase();
    const account = await Account.findOne({ email: formattedEmail });

    if (!account) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
    }

    // Tạo mã OTP 6 chữ số
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10); // OTP hết hạn sau 10 phút

    // Lưu OTP vào database
    account.loginOTP = otpCode;
    account.loginOTPExpiry = expiryTime;
    await account.save();

    // Gửi OTP qua email
    const setting = await Setting.findOne();
    if (!setting || !setting.smtp || !setting.smtp.host || !setting.smtp.user || !setting.smtp.pass) {
      return res.status(400).json({ 
        message: 'Chưa cấu hình SMTP. Vui lòng liên hệ quản trị viên.' 
      });
    }

    const transporter = nodemailer.createTransport({
      host: setting.smtp.host,
      port: setting.smtp.port || 587,
      secure: setting.smtp.secure || false,
      auth: {
        user: setting.smtp.user,
        pass: setting.smtp.pass,
      },
    });

    const mailOptions = {
      from: `"${setting.smtp.fromName || 'Hệ thống trường học'}" <${setting.smtp.fromEmail || setting.smtp.user}>`,
      to: formattedEmail,
      subject: '🔐 Mã OTP đăng nhập - Hệ thống quản lý trường học',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Mã OTP đăng nhập</h2>
          <p>Xin chào,</p>
          <p>Bạn đang đăng nhập vào hệ thống quản lý trường học.</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
          </div>
          <p>Mã OTP này có hiệu lực trong <strong>10 phút</strong>.</p>
          <p>Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Đây là email tự động, vui lòng không trả lời.</p>
        </div>
      `,
      text: `Mã OTP đăng nhập của bạn là: ${otpCode}. Mã này có hiệu lực trong 10 phút.`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Đã gửi OTP đăng nhập qua email đến: ${formattedEmail}`);
    } catch (emailError) {
      console.error('❌ [Email Send Error]', emailError);
      account.loginOTP = undefined;
      account.loginOTPExpiry = undefined;
      await account.save();
      
      return res.status(500).json({ 
        message: 'Không thể gửi email. Vui lòng kiểm tra cấu hình SMTP hoặc liên hệ quản trị viên.'
      });
    }

    return res.json({
      success: true,
      message: 'Mã OTP đã được gửi đến email của bạn',
      email: formattedEmail.replace(/(.{2})(.*)(@.*)/, '$1****$3')
    });
  } catch (error) {
    console.error('❌ [Send Login OTP Error]', error);
    res.status(500).json({ 
      message: 'Không thể gửi mã OTP. Vui lòng thử lại sau.'
    });
  }
};

/**
 * ✅ Xác thực OTP và đăng nhập
 */
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    const formattedEmail = email.trim().toLowerCase();
    const account = await Account.findOne({ email: formattedEmail });

    if (!account) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
    }

    // Kiểm tra OTP
    if (!account.loginOTP || account.loginOTP !== otpCode) {
      return res.status(400).json({ message: 'Mã OTP không đúng' });
    }

    // Kiểm tra OTP hết hạn
    if (!account.loginOTPExpiry || new Date() > account.loginOTPExpiry) {
      account.loginOTP = undefined;
      account.loginOTPExpiry = undefined;
      await account.save();
      return res.status(400).json({ message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' });
    }

    // Xóa OTP sau khi xác thực thành công
    account.loginOTP = undefined;
    account.loginOTPExpiry = undefined;
    await account.save();

    // Tìm user trong MongoDB
    const user = await User.findOne({ uid: account.uid });

    if (!user) {
      return res.status(404).json({ message: 'User not found in database' });
    }

    // Tạo Firebase custom token để frontend đăng nhập
    const customToken = await admin.auth().createCustomToken(account.uid);

    // Log login
    try {
      await logLogin(user._id, user.role, 'OTP Login');
    } catch (logError) {
      console.warn('⚠️ [Login] Không thể log login:', logError);
    }

    res.json({
      success: true,
      message: 'Xác thực OTP thành công',
      customToken, // Frontend sẽ dùng customToken để đăng nhập Firebase
      uid: account.uid,
      email: formattedEmail
    });
  } catch (error) {
    console.error('❌ [Verify Login OTP Error]', error);
    res.status(500).json({ 
      message: 'Không thể xác thực OTP. Vui lòng thử lại sau.'
    });
  }
};
