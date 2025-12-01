// controllers/subject/activityController.js
const Activity = require('../../models/subject/activity');
const ScheduleConfig = require('../../models/subject/scheduleConfig');
// 📌 Lấy danh sách tất cả hoạt động
exports.getActivities = async (req, res) => {
  try {
    // ✅ Soft Delete: Filter isDeleted != true mặc định (bao gồm false, null, không có trường)
    const { isDeleted = 'false' } = req.query;
    const query = isDeleted === 'true' ? { isDeleted: true } : { isDeleted: { $ne: true } };

    const activities = await Activity.find(query).sort({ createdAt: -1 });
    res.status(200).json(activities);
  } catch (err) {
    console.error('❌ [getActivities] Lỗi khi lấy danh sách hoạt động:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      message: 'Lỗi máy chủ khi lấy danh sách hoạt động.',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// 📌 Lấy 1 hoạt động theo ID
exports.getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Không tìm thấy hoạt động.' });
    }
    res.status(200).json(activity);
  } catch (err) {
    console.error('❌ getActivityById error:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy hoạt động.' });
  }
};

// 📌 Tạo mới hoạt động
exports.createActivity = async (req, res) => {
  try {
    const { name } = req.body;

    // ✅ Kiểm tra bắt buộc
    if (!name) {
      return res.status(400).json({ message: 'Tên hoạt động là bắt buộc.' });
    }

    // ✅ Loại bỏ các trường không thuộc Activity model (dayOfWeek, timeSlot, isPermanent, startDate, endDate được lưu trong ScheduleConfig)
    const activityData = {
      name: req.body.name,
      type: req.body.type,
      description: req.body.description,
      grades: req.body.grades,
      code: req.body.code,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    };

    const activity = new Activity(activityData);
    await activity.save();
    res.status(201).json(activity);
  } catch (err) {
    console.error('❌ createActivity error:', err);
    res.status(400).json({ message: err.message });
  }
};

// 📌 Cập nhật hoạt động
exports.updateActivity = async (req, res) => {
  try {
    // ✅ Chỉ cập nhật các trường thuộc Activity model (loại bỏ dayOfWeek, timeSlot, isPermanent, startDate, endDate)
    const updateData = {
      name: req.body.name,
      type: req.body.type,
      description: req.body.description,
      grades: req.body.grades,
      code: req.body.code,
      isActive: req.body.isActive,
    };

    // ✅ Loại bỏ các trường undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const activity = await Activity.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true, // ✅ để mongoose kiểm tra schema khi update
    });

    if (!activity) {
      return res.status(404).json({ message: 'Không tìm thấy hoạt động.' });
    }

    res.status(200).json(activity);
  } catch (err) {
    console.error('❌ updateActivity error:', err);
    res.status(400).json({ message: err.message });
  }
};

// 📌 Xóa hoạt động
// ✅ Soft Delete - Xóa mềm hoạt động (chỉ đánh dấu, không xóa thật)
exports.deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    
    if (!activity) {
      return res.status(404).json({ message: 'Không tìm thấy hoạt động.' });
    }

    // ✅ Đánh dấu isDeleted = true (soft delete)
    activity.isDeleted = true;
    await activity.save();

    res.status(200).json({ 
      message: 'Đã xóa hoạt động thành công (soft delete).',
      activity: activity
    });
  } catch (err) {
    console.error('❌ deleteActivity error:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa hoạt động.' });
  }
};
