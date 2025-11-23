const Setting = require('../models/settings');
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

exports.seenEmail  = async( req,res) =>{
    try{
        const {to} = req.body;
          if (!to) return res.status(400).json({ message: 'Chưa có email để gửi' });
          const setting = await Setting.findOne();
          if(!setting) return res.status(500).json({message:'Chưa có cấu hình hệ thống'})
             const transporter = nodemailer.createTransport({
      host: setting.smtp.host,
      port: setting.smtp.port,
      secure: setting.smtp.secure,
      auth: {
        user: setting.smtp.user,
        pass: setting.smtp.pass,
      },
    });

    await transporter.sendMail({
      from: `"${setting.smtp.fromName}" <${setting.smtp.fromEmail}>`,
      to,
      subject: 'Test Email từ Hệ thống',
      text: 'Đây là email test để kiểm tra cấu hình SMTP.',
    });

    res.json({ message: 'Gửi email thành công' });
  } catch (err) {
    console.error('Send Test Email Error:', err);
    res.status(500).json({ message: 'Gửi email thất bại' });
  }
};