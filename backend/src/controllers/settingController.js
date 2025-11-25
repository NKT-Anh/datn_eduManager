const Setting = require('../models/settings');
const EmailLog = require('../models/emailLog');
const nodemailer = require('nodemailer');

// Lấy cấu hình hiện tại (có thể public hoặc cần auth)
exports.getSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({}); // tạo mới mặc định nếu chưa có
    }
    res.json(setting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi tải cấu hình' });
  }
};

// Lấy thông tin công khai của trường (public, không cần auth)
exports.getPublicSchoolInfo = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({}); // tạo mới mặc định nếu chưa có
    }
    
    // Chỉ trả về thông tin công khai
    res.json({
      schoolName: setting.schoolName || 'Trường THPT Chưa đặt tên',
      slogan: setting.slogan || '',
      description: setting.description || '',
      address: setting.address || '',
      phone: setting.phone || '',
      email: setting.email || '',
      website: setting.website || '',
      facebook: setting.facebook || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi tải thông tin trường' });
  }
};

// Cập nhật cấu hình
exports.updateSettings = async (req, res) => {
  try {
    const data = req.body;
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting(data);
    } else {
      Object.assign(setting, data);
    }
    await setting.save();
    res.json(setting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi cập nhật cấu hình' });
  }
};

// Reset về mặc định
exports.resetSettings = async (req, res) => {
  try {
    await Setting.deleteMany({});
    const defaultSetting = await Setting.create({});
    res.json(defaultSetting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Không reset được cấu hình' });
  }
};

// Gửi email test SMTP
exports.testEmail = async (req, res) => {
  try {
    const setting = await Setting.findOne();
    if (!setting) return res.status(400).json({ message: 'Chưa có cấu hình' });

    const smtp = setting.smtp || {};
    if (!smtp.host || !smtp.user || !smtp.pass) {
      return res.status(400).json({ message: 'Chưa cấu hình SMTP đầy đủ' });
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${smtp.fromName || 'Hệ thống trường học'}" <${smtp.fromEmail || smtp.user}>`,
      to: smtp.user,
      subject: '✅ Test Email - Smart School System',
      text: 'Email test từ hệ thống Smart School Management System.',
    });

    res.json({ message: 'Gửi email test thành công', info });
  } catch (err) {
    console.error('SMTP error:', err);
    res.status(500).json({ message: 'Không gửi được email test', error: err.message });
  }
};

exports.seenEmail = async (req, res) => {
  try {
    const { to } = req.body;
    
    if (!to) {
      return res.status(400).json({ message: 'Chưa có email để gửi' });
    }

    const setting = await Setting.findOne();
    if (!setting) {
      return res.status(500).json({ message: 'Chưa có cấu hình hệ thống' });
    }

    // ✅ Kiểm tra cấu hình SMTP đầy đủ
    if (!setting.smtp || !setting.smtp.host || !setting.smtp.user || !setting.smtp.pass) {
      return res.status(400).json({ 
        message: 'Chưa cấu hình SMTP đầy đủ. Vui lòng cấu hình SMTP trong Settings.',
        debug: process.env.NODE_ENV === 'development' ? {
          hasSmtp: !!setting.smtp,
          hasHost: !!(setting.smtp && setting.smtp.host),
          hasUser: !!(setting.smtp && setting.smtp.user),
          hasPass: !!(setting.smtp && setting.smtp.pass)
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
      to: to,
      subject: '✅ Test Email - Hệ thống Quản lý Trường học',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Test Email thành công!</h2>
          <p>Xin chào,</p>
          <p>Đây là email test để kiểm tra cấu hình SMTP của hệ thống.</p>
          <p>Nếu bạn nhận được email này, nghĩa là cấu hình SMTP đã hoạt động đúng.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Đây là email tự động, vui lòng không trả lời.</p>
        </div>
      `,
      text: 'Đây là email test để kiểm tra cấu hình SMTP. Nếu bạn nhận được email này, nghĩa là cấu hình SMTP đã hoạt động đúng.',
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ [Test Email] Đã gửi email test đến: ${to}`);

    res.json({ 
      message: 'Gửi email thành công',
      sentTo: to
    });
  } catch (err) {
    console.error('❌ [Test Email Error]', {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      stack: err.stack
    });
    
    res.status(500).json({ 
      message: 'Gửi email thất bại',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        code: err.code,
        command: err.command
      } : undefined
    });
  }
};

/**
 * 📧 Gửi email hàng loạt cho giáo viên, học sinh hoặc tất cả
 */
exports.sendBulkEmail = async (req, res) => {
  try {
    const { recipientType, subject, content, fromEmail, fromName } = req.body;
    const { role, accountId, teacherFlags } = req.user;
    
    // ✅ CHỈ Admin và BGH (isLeader) được gửi email
    // ✅ isLeader được set cứng ở top-level, không phụ thuộc năm học
    const isAdmin = role === 'admin';
    const isBGH = role === 'teacher' && teacherFlags?.isLeader;
    
    console.log(`📧 [Bulk Email] Kiểm tra quyền:`, {
      role,
      isAdmin,
      isBGH,
      teacherFlags: teacherFlags ? {
        isLeader: teacherFlags.isLeader,
        isHomeroom: teacherFlags.isHomeroom,
        isDepartmentHead: teacherFlags.isDepartmentHead
      } : null
    });
    
    if (!isAdmin && !isBGH) {
      return res.status(403).json({ 
        message: 'Chỉ Admin và Ban Giám Hiệu mới được gửi email hàng loạt' 
      });
    }

    if (!recipientType || !subject || !content) {
      return res.status(400).json({ 
        message: 'Thiếu thông tin: recipientType, subject, content là bắt buộc' 
      });
    }

    // ✅ BGH chỉ được gửi cho giáo viên (không được gửi cho học sinh hoặc all)
    if (isBGH && recipientType !== 'teachers') {
      return res.status(403).json({ 
        message: 'Ban Giám Hiệu chỉ được gửi email cho giáo viên' 
      });
    }

    if (!['teachers', 'students', 'all', 'single'].includes(recipientType)) {
      return res.status(400).json({ 
        message: 'recipientType phải là: teachers, students, all, hoặc single' 
      });
    }

    // ✅ Nếu là single, cần có singleRecipientEmail
    if (recipientType === 'single') {
      const { singleRecipientEmail } = req.body;
      if (!singleRecipientEmail || !singleRecipientEmail.trim()) {
        return res.status(400).json({ 
          message: 'Vui lòng nhập email người nhận khi chọn gửi cho 1 người' 
        });
      }
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(singleRecipientEmail.trim())) {
        return res.status(400).json({ 
          message: 'Email người nhận không hợp lệ' 
        });
      }
    }

    const setting = await Setting.findOne();
    if (!setting || !setting.smtp || !setting.smtp.host || !setting.smtp.user || !setting.smtp.pass) {
      return res.status(400).json({ 
        message: 'Chưa cấu hình SMTP đầy đủ. Vui lòng cấu hình SMTP trong Settings.' 
      });
    }

    // ✅ Lấy danh sách email theo recipientType
    const Account = require('../models/user/account');
    const Teacher = require('../models/user/teacher');
    const Student = require('../models/user/student');
    
    let emailList = [];
    
    // ✅ Gửi cho 1 người nhận (để test)
    if (recipientType === 'single') {
      const { singleRecipientEmail } = req.body;
      emailList.push({
        email: singleRecipientEmail.trim(),
        name: singleRecipientEmail.trim().split('@')[0], // Lấy tên từ email
        type: 'custom'
      });
    } else {
      // Gửi hàng loạt
      if (recipientType === 'teachers' || recipientType === 'all') {
        const teachers = await Teacher.find({}).populate('accountId', 'email').lean();
        const teacherEmails = teachers
          .filter(t => t.accountId && t.accountId.email)
          .map(t => ({
            email: t.accountId.email,
            name: t.name,
            type: 'teacher'
          }));
        emailList.push(...teacherEmails);
      }
      
      if (recipientType === 'students' || recipientType === 'all') {
        const students = await Student.find({}).populate('accountId', 'email').lean();
        const studentEmails = students
          .filter(s => s.accountId && s.accountId.email)
          .map(s => ({
            email: s.accountId.email,
            name: s.name,
            type: 'student'
          }));
        emailList.push(...studentEmails);
      }
    }

    // ✅ Loại bỏ email trùng lặp
    const uniqueEmails = Array.from(
      new Map(emailList.map(item => [item.email, item])).values()
    );

    if (uniqueEmails.length === 0) {
      return res.status(400).json({ 
        message: 'Không tìm thấy email nào để gửi' 
      });
    }

    console.log(`📧 [Bulk Email] Bắt đầu gửi email đến ${uniqueEmails.length} người nhận (${recipientType})`);

    // ✅ Tạo transporter
    const transporter = nodemailer.createTransport({
      host: setting.smtp.host,
      port: setting.smtp.port || 587,
      secure: setting.smtp.secure || false,
      auth: {
        user: setting.smtp.user,
        pass: setting.smtp.pass,
      },
    });

    // ✅ Gửi email cho từng người nhận
    const results = {
      total: uniqueEmails.length,
      success: 0,
      failed: 0,
      errors: []
    };

    // Gửi theo batch để tránh quá tải
    const batchSize = 10;
    for (let i = 0; i < uniqueEmails.length; i += batchSize) {
      const batch = uniqueEmails.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (recipient) => {
          try {
            // ✅ Sử dụng fromEmail và fromName từ request, fallback về settings
            const finalFromName = fromName || setting.smtp.fromName || 'Hệ thống trường học';
            const finalFromEmail = fromEmail || setting.smtp.fromEmail || setting.smtp.user;
            
            const mailOptions = {
              from: `"${finalFromName}" <${finalFromEmail}>`,
              to: recipient.email,
              subject: subject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #333;">${subject}</h2>
                  <p>Xin chào <strong>${recipient.name}</strong>,</p>
                  <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    ${content.replace(/\n/g, '<br>')}
                  </div>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="color: #666; font-size: 12px;">Đây là email tự động từ hệ thống, vui lòng không trả lời.</p>
                </div>
              `,
              text: content
            };

            await transporter.sendMail(mailOptions);
            results.success++;
            console.log(`✅ [Bulk Email] Đã gửi đến: ${recipient.email}`);
          } catch (err) {
            results.failed++;
            results.errors.push({
              email: recipient.email,
              name: recipient.name,
              error: err.message
            });
            console.error(`❌ [Bulk Email] Lỗi gửi đến ${recipient.email}:`, err.message);
          }
        })
      );

      // Delay giữa các batch để tránh rate limit
      if (i + batchSize < uniqueEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`📊 [Bulk Email] Hoàn tất: ${results.success}/${results.total} thành công, ${results.failed} thất bại`);

    // ✅ Lấy thông tin người gửi để lưu log
    const Admin = require('../models/user/admin');
    
    const account = await Account.findById(accountId);
    let senderName = account?.email || 'Unknown';
    let senderEmail = account?.email || '';
    let senderTeacherFlags = null;
    
    if (role === 'teacher') {
      const teacher = await Teacher.findOne({ accountId }).lean();
      if (teacher) {
        senderName = teacher.name || senderName;
        senderTeacherFlags = {
          isHomeroom: teacher.isHomeroom || false,
          isDepartmentHead: teacher.isDepartmentHead || false,
          isLeader: teacher.isLeader || false,
        };
      }
    } else if (role === 'student') {
      const student = await Student.findOne({ accountId }).lean();
      if (student) {
        senderName = student.name || senderName;
      }
    } else if (role === 'admin') {
      const admin = await Admin.findOne({ accountId }).lean();
      if (admin) {
        senderName = admin.name || senderName;
      }
    }

    // ✅ Lấy năm học hiện tại (sử dụng lại biến setting đã có)
    const schoolYear = setting?.currentSchoolYear || null;

    // ✅ Lưu log vào EmailLog
    try {
      const emailLog = new EmailLog({
        senderId: accountId,
        senderName,
        senderEmail,
        senderRole: role,
        senderTeacherFlags,
        recipientType,
        subject,
        content,
        fromEmail: fromEmail || setting?.smtp?.fromEmail || setting?.smtp?.user || '',
        fromName: fromName || setting?.smtp?.fromName || 'Hệ thống trường học',
        scope: {
          type: recipientType === 'single' ? 'custom' : 'all', // Single = custom, còn lại = all
        },
        totalRecipients: results.total,
        successCount: results.success,
        failedCount: results.failed,
        errors: results.errors,
        status: 'sent',
        schoolYear,
      });
      await emailLog.save();
      console.log(`✅ [Email Log] Đã lưu log email: ${emailLog._id}`);
    } catch (logErr) {
      console.error('❌ [Email Log] Lỗi lưu log:', logErr);
      // Không throw error, chỉ log để không ảnh hưởng response
    }

    res.json({
      message: `Đã gửi email đến ${results.success}/${results.total} người nhận`,
      results: {
        total: results.total,
        success: results.success,
        failed: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined
      }
    });
  } catch (err) {
    console.error('❌ [Bulk Email Error]', {
      message: err.message,
      stack: err.stack
    });
    
    res.status(500).json({ 
      message: 'Lỗi khi gửi email hàng loạt',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};