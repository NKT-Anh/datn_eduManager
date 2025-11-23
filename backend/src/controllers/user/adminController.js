const Admin = require('../../models/user/admin');
const adminSDK = require('../../config/firebaseAdmin');
// Lấy danh sách tất cả admin
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy admin theo id
exports.getAdminById = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAdmin = async (req, res) => {
  const { email, password, name, phone } = req.body;
  const existing = await Admin.findOne({ uid: userRecord.uid });
  if (existing) {
    return res.status(400).json({ message: 'Admin already exists' });
  }
  try {
    // 1. Tạo user trong Firebase
    const userRecord = await adminSDK.auth().createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone || undefined
    });

    // 2. Lưu vào MongoDB
    const newAdmin= new Admin({
      uid: userRecord.uid,
      email: userRecord.email,
      role: 'admin',
      name,
      phone
    });

    await newUser.save();

    res.status(201).json({ message: 'Admin created successfully', user: newAdmin});
  } catch (error) {
    console.error('[Create Admin Error]', error);
    res.status(500).json({ message: 'Error creating admin', error: error.message });
  }
};

// Cập nhật admin
exports.updateAdmin = async (req, res) => {
  try {
    const admin = await Admin.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json(admin);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Xóa admin
exports.deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ message: 'Admin deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 