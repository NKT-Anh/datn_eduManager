const SystemSetting =   require('../../models/admin/systemSetting');

// Lấy tất cả setting
exports.getAllSettings = async (req, res) => {
    try {
      const settings = await SystemSetting.find();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  };
  
  // Lấy setting theo key
  exports.getSettingByKey = async (req, res) => {
    try {
      const setting = await SystemSetting.findOne({ key: req.params.key });
      if (!setting) return res.status(404).json({ msg: 'Setting not found' });
      res.json(setting);
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  };
  
  // Tạo setting mới
  exports.createSetting = async (req, res) => {
    try {
      const { key, value } = req.body;
      const newSetting = await SystemSetting.create({ key, value });
      res.status(201).json(newSetting);
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  };
  
  // Cập nhật setting
  exports.updateSetting = async (req, res) => {
    try {
      const { value } = req.body;
      const updatedSetting = await SystemSetting.findOneAndUpdate(
        { key: req.params.key },
        { value, updatedAt: Date.now() },
        { new: true, runValidators: true }
      );
      if (!updatedSetting) return res.status(404).json({ msg: 'Setting not found' });
      res.json(updatedSetting);
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  };