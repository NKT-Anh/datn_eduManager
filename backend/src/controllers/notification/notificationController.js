const Notification = require('../../models/notification');
const Teacher = require('../../models/user/teacher');
const Student = require('../../models/user/student');
const Class = require('../../models/class/class');
const User = require('../../models/user/user');
const { getCurrentSchoolYear } = require('../../utils/schoolYearHelper');

const TEACHER_ROLE_VARIANTS = ['teacher', 'gvcn', 'gvbm', 'qlbm', 'bgh'];

const buildTeacherContext = (role, teacherFlags = {}) => {
  const isTeacherRole = TEACHER_ROLE_VARIANTS.includes(role);
  const isLeader = !!teacherFlags.isLeader || role === 'bgh';
  const isDepartmentHead = !!teacherFlags.isDepartmentHead || role === 'qlbm';
  const isHomeroom = !!teacherFlags.isHomeroom || role === 'gvcn';
  return {
    isTeacherRole,
    isLeader,
    isDepartmentHead,
    isHomeroom,
    isSubjectTeacher: isTeacherRole && !isLeader && !isDepartmentHead && !isHomeroom,
  };
};

const FEMALE_NAME_HINTS = ['anh', 'lan', 'mai', 'linh', 'hương', 'huong', 'thu', 'hoa', 'ngọc', 'ngoc', 'như', 'nhu', 'phương', 'phuong', 'anh thư', 'thư', 'ngan', 'yen', 'trang'];

const isLikelyFemaleName = (name = '') => {
  const lower = name.toLowerCase();
  return FEMALE_NAME_HINTS.some((hint) => lower.includes(hint));
};

const formatTeacherDisplayName = (name, gender) => {
  if (!name) return null;
  const normalizedGender = (gender || '').toLowerCase();
  if (normalizedGender === 'female' || normalizedGender === 'nữ') {
    return `Cô ${name}`;
  }
  if (normalizedGender === 'male' || normalizedGender === 'nam') {
    return `Thầy ${name}`;
  }
  return isLikelyFemaleName(name) ? `Cô ${name}` : `Thầy ${name}`;
};

const enrichSenderMetadata = async (notification) => {
  if (!notification) {
    return notification;
  }

  const createdByInfo = notification.createdBy;
  const createdByRole =
    typeof createdByInfo === 'object' && createdByInfo !== null
      ? createdByInfo.role
      : undefined;
  const accountId =
    typeof createdByInfo === 'object' && createdByInfo !== null
      ? createdByInfo._id || createdByInfo.accountId
      : createdByInfo;

  let userProfile = null;
  if (accountId) {
    userProfile = await User.findOne({ accountId })
      .select('name avatarUrl gender')
      .lean();
  }

  const name = userProfile?.name;
  const gender = userProfile?.gender;
  let displayName;

  if (createdByRole === 'teacher') {
    displayName =
      formatTeacherDisplayName(name, gender) || createdByInfo?.email || 'Giáo viên';
  } else if (createdByRole === 'admin') {
    displayName = name || createdByInfo?.email || 'Ban Giám hiệu';
  } else {
    displayName = name || createdByInfo?.email || 'Hệ thống';
  }

  if (typeof createdByInfo === 'object' && createdByInfo !== null) {
    if (userProfile) {
      createdByInfo.linkedId = {
        ...(createdByInfo.linkedId || {}),
        name: userProfile.name,
        avatarUrl: userProfile.avatarUrl,
        gender: userProfile.gender,
      };
    }
    createdByInfo.displayName = displayName;
  }

  notification.sender = displayName;
  notification.senderDisplayName = displayName;

  return notification;
};

/**
 * 📋 LẤY DANH SÁCH THÔNG BÁO
 * - Admin: Tất cả
 * - BGH: Tất cả
 * - GVCN: Thông báo đã gửi cho lớp CN
 * - Học sinh: Thông báo dành cho mình
 */
exports.getNotifications = async (req, res) => {
  try {
    const { role } = req.user;
    const { recipientType, recipientRole, recipientId, classId } = req.query;
    
    let filter = {};
    const teacherFlags = req.user.teacherFlags || {};
    const {
      isTeacherRole,
      isLeader,
      isDepartmentHead,
      isHomeroom,
      isSubjectTeacher,
    } = buildTeacherContext(role, teacherFlags);
    const isAdmin = role === 'admin';
    
    // Admin và BGH: Xem tất cả
    if (isAdmin || (isTeacherRole && isLeader)) {
      if (recipientType) filter.recipientType = recipientType;
      if (recipientRole) filter.recipientRole = recipientRole;
      if (recipientId) filter.recipientId = recipientId;
      if (classId) filter.classId = classId;
    }
    // Trưởng bộ môn (QLBM): Xem tất cả thông báo (tương tự BGH nhưng không phải BGH)
    else if (isTeacherRole && isDepartmentHead && !isLeader) {
      // Trưởng bộ môn có thể xem tất cả thông báo
      if (recipientType) filter.recipientType = recipientType;
      if (recipientRole) filter.recipientRole = recipientRole;
      if (recipientId) filter.recipientId = recipientId;
      if (classId) filter.classId = classId;
    }
    // GVCN: Xem thông báo đã gửi cho lớp CN
    else if (isTeacherRole && isHomeroom) {
      const teacher = await Teacher.findOne({ accountId: req.user.accountId })
        .populate('homeroomClassIds');
      if (!teacher || !teacher.homeroomClassIds || teacher.homeroomClassIds.length === 0) {
        return res.json({ success: true, total: 0, data: [] });
      }
      // Lấy danh sách lớp chủ nhiệm
      const homeroomClassIds = teacher.homeroomClassIds.map(c => c._id || c);
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'class', classId: { $in: homeroomClassIds } },
        { recipientType: 'role', recipientRole: 'student' } // Thông báo cho học sinh
      ];
    }
    // GVBM: Xem thông báo đã gửi cho lớp đang dạy
    else if (isSubjectTeacher) {
      const teacher = await Teacher.findOne({ accountId: req.user.accountId })
        .select('_id')
        .lean();
      if (!teacher) {
        return res.json({ success: true, total: 0, data: [] });
      }
      // ✅ Lấy danh sách lớp đang dạy từ TeachingAssignment
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const currentYear = await getCurrentSchoolYear();
      const assignments = await TeachingAssignment.find({
        teacherId: teacher._id,
        year: currentYear || new Date().getFullYear()
      }).select('classId').lean();
      
      if (!assignments || assignments.length === 0) {
        return res.json({ success: true, total: 0, data: [] });
      }
      // Lấy danh sách lớp đang dạy
      const teachingClassIds = assignments.map(a => a.classId).filter(Boolean);
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'class', classId: { $in: teachingClassIds } },
        { recipientType: 'role', recipientRole: 'student' } // Thông báo cho học sinh
      ];
    }
    // Học sinh: Xem thông báo dành cho mình
    else if (role === 'student') {
      const student = await Student.findOne({ accountId: req.user.accountId });
      if (!student) {
        return res.json({ success: true, total: 0, data: [] });
      }
      // Lấy lớp của học sinh
      const studentClass = await Class.findOne({ students: student._id });
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'user', recipientId: req.user.accountId },
        { recipientType: 'role', recipientRole: 'student' },
        { recipientType: 'class', classId: studentClass?._id }
      ];
    } else {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    
    // ✅ Filter theo thời gian hiển thị (startDate và endDate)
    // Admin, BGH và Trưởng bộ môn: Xem tất cả (kể cả đã hết hạn)
    // Các role khác: Chỉ xem thông báo đang còn hiệu lực
    const skipDateFilter = isAdmin || (isTeacherRole && (isLeader || isDepartmentHead));
    if (!skipDateFilter) {
      const now = new Date();
      const dateFilter = {
        $or: [
          // Không có startDate và endDate (thông báo vĩnh viễn)
          { startDate: { $exists: false }, endDate: { $exists: false } },
          { startDate: null, endDate: null },
          // Có startDate và endDate: hiện tại nằm trong khoảng
          {
            $and: [
              { startDate: { $lte: now } },
              { endDate: { $gte: now } }
            ]
          },
          // Chỉ có startDate: đã bắt đầu
          {
            startDate: { $lte: now },
            endDate: { $exists: false }
          },
          // Chỉ có endDate: chưa hết hạn
          {
            startDate: { $exists: false },
            endDate: { $gte: now }
          }
        ]
      };
      
      // Merge với filter hiện tại
      if (filter.$or) {
        filter = {
          $and: [
            { $or: filter.$or },
            dateFilter
          ]
        };
      } else {
        filter = { ...filter, ...dateFilter };
      }
    }
    
    // ✅ Sắp xếp: ưu tiên cao trước, sau đó mới đến ngày tạo
    const notifications = await Notification.find(filter)
      .populate('createdBy', 'email role')
      .sort({ 
        priority: -1, // high > medium > low
        createdAt: -1 
      })
      .lean(); // Dùng lean() để có thể modify object

    await Promise.all(notifications.map((notif) => enrichSenderMetadata(notif)));
    
    // ✅ Thêm field isRead cho mỗi notification
    const notificationsWithReadStatus = notifications.map(notif => {
      const isRead = notif.readBy?.some(
        read => String(read.accountId) === String(req.user.accountId)
      ) || false;
      return {
        ...notif,
        isRead
      };
    });
    
    res.json({ success: true, total: notificationsWithReadStatus.length, data: notificationsWithReadStatus });
  } catch (error) {
    console.error('❌ Lỗi getNotifications:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📋 LẤY CHI TIẾT THÔNG BÁO
 */
exports.getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    const notification = await Notification.findById(id)
      .populate('createdBy', 'email role')
      .lean();
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }
    
    // Kiểm tra quyền truy cập
    if (role === 'student') {
      const student = await Student.findOne({ accountId: req.user.accountId });
      const studentClass = await Class.findOne({ students: student._id });
      
      const hasAccess = 
        notification.recipientType === 'all' ||
        (notification.recipientType === 'user' && String(notification.recipientId) === String(req.user.accountId)) ||
        (notification.recipientType === 'role' && notification.recipientRole === 'student') ||
        (notification.recipientType === 'class' && studentClass && String(notification.classId) === String(studentClass._id));
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
    }
    
    await enrichSenderMetadata(notification);

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('❌ Lỗi getNotificationById:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ➕ TẠO THÔNG BÁO
 * - Admin: Tạo/Sửa
 * - BGH: Tạo/Xem
 * - GVCN: Gửi cho lớp CN
 */
exports.createNotification = async (req, res) => {
  try {
    const { role } = req.user;
    const { 
      title, 
      content, 
      type, 
      priority, 
      startDate, 
      endDate, 
      recipientType,
      recipientRole, 
      recipientId, 
      classId,
      attachments // ✅ Tệp đính kèm
    } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc' });
    }
    
    // ✅ Quyền đã được kiểm tra ở middleware, chỉ cần xử lý logic
    let finalRecipientType = recipientType || 'all';
    let finalRecipientRole = null;
    let finalRecipientId = null;
    let finalClassId = null;
    
    // ✅ Xác định quyền - ƯU TIÊN BGH và Admin TRƯỚC
    const teacherFlags = req.user.teacherFlags || {};
    const {
      isTeacherRole,
      isLeader,
      isDepartmentHead,
      isHomeroom,
      isSubjectTeacher,
    } = buildTeacherContext(role, teacherFlags);
    const isAdmin = role === 'admin';
    const canSendAll = isAdmin || (isTeacherRole && (isLeader || isDepartmentHead));
    const isGVCN = isTeacherRole && isHomeroom && !canSendAll;
    const isGVBM = isTeacherRole && isSubjectTeacher && !canSendAll;
    
    // ✅ Kiểm tra quyền gửi theo recipientType
    // BGH và Admin LUÔN được phép gửi all hoặc role, bỏ qua validation
    if (canSendAll) {
      // BGH và Admin được phép gửi tất cả, không cần kiểm tra thêm
      console.log('✅ [Backend] BGH/Admin được phép gửi thông báo');
    } else if (isGVCN || isGVBM) {
      // GVCN và GVBM (KHÔNG phải BGH): KHÔNG được gửi toàn trường (all) hoặc theo role
      if (finalRecipientType === 'all' || finalRecipientType === 'role') {
        return res.status(403).json({ error: 'Bạn không có quyền gửi thông báo toàn trường hoặc theo vai trò' });
      }
      
      // Chỉ được gửi class hoặc user
      if (finalRecipientType !== 'class' && finalRecipientType !== 'user') {
        finalRecipientType = 'class'; // Mặc định là class nếu không chỉ định
      }
    }
    
    // ✅ Xử lý theo recipientType
    if (finalRecipientType === 'role') {
      finalRecipientRole = recipientRole;
    } else if (finalRecipientType === 'user') {
      finalRecipientId = recipientId;
      if (!finalRecipientId) {
        return res.status(400).json({ error: 'Cần nhập ID người nhận' });
      }
    } else if (finalRecipientType === 'class') {
      finalClassId = classId;
      if (!finalClassId) {
        return res.status(400).json({ error: 'Cần chọn lớp học' });
      }
      
      // ✅ Kiểm tra quyền gửi cho lớp
      if (isGVCN) {
        // GVCN: Chỉ được gửi cho lớp chủ nhiệm
        const teacher = await Teacher.findOne({ accountId: req.user.accountId })
          .populate('homeroomClassIds');
        if (!teacher || !teacher.homeroomClassIds || 
            !teacher.homeroomClassIds.some(c => String(c._id || c) === String(finalClassId))) {
          return res.status(403).json({ error: 'Bạn chỉ được gửi thông báo cho lớp chủ nhiệm của mình' });
        }
      } else if (isGVBM) {
        // GVBM: Chỉ được gửi cho lớp đang dạy
        const teacher = await Teacher.findOne({ accountId: req.user.accountId })
          .select('_id')
          .lean();
        if (!teacher) {
          return res.status(403).json({ error: 'Không tìm thấy thông tin giáo viên' });
        }
        // ✅ Lấy danh sách lớp đang dạy từ TeachingAssignment
        const TeachingAssignment = require('../../models/subject/teachingAssignment');
        const currentYear = await getCurrentSchoolYear();
        const assignments = await TeachingAssignment.find({
          teacherId: teacher._id,
          classId: finalClassId,
          year: currentYear || new Date().getFullYear()
        }).lean();
        
        if (!assignments || assignments.length === 0) {
          return res.status(403).json({ error: 'Bạn chỉ được gửi thông báo cho lớp đang dạy của mình' });
        }
      }
    }
    
    // Tạo thông báo
    const notification = await Notification.create({
      title,
      content,
      type: type || 'general',
      priority: priority || 'medium',
      startDate: startDate || null,
      endDate: endDate || null,
      recipientType: finalRecipientType,
      recipientRole: finalRecipientRole,
      recipientId: finalRecipientId,
      classId: finalClassId,
      createdBy: req.user.accountId,
      attachments: attachments || [] // ✅ Tệp đính kèm
    });
    
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error('❌ Lỗi createNotification:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✏️ CẬP NHẬT THÔNG BÁO
 * - Admin: Tạo/Sửa
 * - BGH: Tạo/Xem (không sửa)
 */
exports.updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }
    
    // Chỉ Admin mới được sửa
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được sửa thông báo' });
    }
    
    const { 
      title, 
      content, 
      type, 
      priority, 
      startDate, 
      endDate, 
      recipientType,
      recipientRole, 
      recipientId,
      classId,
      attachments // ✅ Tệp đính kèm
    } = req.body;
    
    if (title) notification.title = title;
    if (content) notification.content = content;
    if (type) notification.type = type;
    if (priority) notification.priority = priority;
    if (startDate !== undefined) notification.startDate = startDate || null;
    if (endDate !== undefined) notification.endDate = endDate || null;
    if (recipientType) notification.recipientType = recipientType;
    if (recipientRole !== undefined) notification.recipientRole = recipientRole || null;
    if (recipientId !== undefined) notification.recipientId = recipientId || null;
    if (classId !== undefined) notification.classId = classId || null;
    if (attachments !== undefined) notification.attachments = attachments || []; // ✅ Cập nhật attachments
    
    await notification.save();
    
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('❌ Lỗi updateNotification:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🗑️ XÓA THÔNG BÁO (Chỉ Admin)
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được xóa thông báo' });
    }
    
    const notification = await Notification.findByIdAndDelete(id);
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }
    
    res.json({ success: true, message: 'Đã xóa thông báo' });
  } catch (error) {
    console.error('❌ Lỗi deleteNotification:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🔔 ĐẾM SỐ THÔNG BÁO CHƯA ĐỌC
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const { role } = req.user;
    const accountId = req.user.accountId;
    
    let filter = {};
    
    // ✅ Filter theo thời gian hiển thị (tương tự getNotifications)
    let dateFilter = {};
    if (role !== 'admin' && !(role === 'teacher' && req.user.teacherFlags?.isLeader)) {
      const now = new Date();
      dateFilter = {
        $or: [
          { startDate: { $exists: false }, endDate: { $exists: false } },
          { startDate: null, endDate: null },
          {
            $and: [
              { startDate: { $lte: now } },
              { endDate: { $gte: now } }
            ]
          },
          {
            startDate: { $lte: now },
            endDate: { $exists: false }
          },
          {
            startDate: { $exists: false },
            endDate: { $gte: now }
          }
        ]
      };
    }
    
    // Tương tự logic getNotifications
    if (role === 'admin' || (role === 'teacher' && req.user.teacherFlags?.isLeader)) {
      // Admin và BGH: Xem tất cả
      if (Object.keys(dateFilter).length > 0) {
        filter = { ...filter, ...dateFilter };
      }
    } else if (role === 'teacher' && req.user.teacherFlags?.isHomeroom) {
      const teacher = await Teacher.findOne({ accountId })
        .populate('homeroomClassIds');
      if (!teacher || !teacher.homeroomClassIds || teacher.homeroomClassIds.length === 0) {
        return res.json({ success: true, unreadCount: 0 });
      }
      const homeroomClassIds = teacher.homeroomClassIds.map(c => c._id || c);
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'class', classId: { $in: homeroomClassIds } },
        { recipientType: 'role', recipientRole: 'student' }
      ];
      // Merge với dateFilter
      if (Object.keys(dateFilter).length > 0) {
        filter = {
          $and: [
            { $or: filter.$or },
            dateFilter
          ]
        };
      }
    } else if (role === 'teacher' && req.user.teacherFlags?.isDepartmentHead && 
               !req.user.teacherFlags?.isLeader) {
      // ✅ Trưởng bộ môn: Xem tất cả thông báo (tương tự BGH nhưng không phải BGH)
      if (Object.keys(dateFilter).length > 0) {
        filter = { ...filter, ...dateFilter };
      }
    } else if (role === 'teacher' && !req.user.teacherFlags?.isHomeroom && 
               !req.user.teacherFlags?.isLeader && !req.user.teacherFlags?.isDepartmentHead) {
      // ✅ Lấy danh sách lớp đang dạy từ TeachingAssignment
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const currentYear = await getCurrentSchoolYear();
      const assignments = await TeachingAssignment.find({
        teacherId: accountId,
        year: currentYear || new Date().getFullYear()
      }).select('classId').lean();
      
      if (!assignments || assignments.length === 0) {
        return res.json({ success: true, unreadCount: 0 });
      }
      const teachingClassIds = assignments.map(a => a.classId).filter(Boolean);
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'class', classId: { $in: teachingClassIds } },
        { recipientType: 'role', recipientRole: 'student' }
      ];
      // Merge với dateFilter
      if (Object.keys(dateFilter).length > 0) {
        filter = {
          $and: [
            { $or: filter.$or },
            dateFilter
          ]
        };
      }
    } else if (role === 'student') {
      const student = await Student.findOne({ accountId });
      if (!student) {
        return res.json({ success: true, unreadCount: 0 });
      }
      const studentClass = await Class.findOne({ students: student._id });
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'user', recipientId: accountId },
        { recipientType: 'role', recipientRole: 'student' },
        { recipientType: 'class', classId: studentClass?._id }
      ];
      // Merge với dateFilter
      if (Object.keys(dateFilter).length > 0) {
        filter = {
          $and: [
            { $or: filter.$or },
            dateFilter
          ]
        };
      }
    } else {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    
    // Đếm số thông báo chưa đọc
    // Thông báo chưa đọc = không có trong readBy hoặc accountId không có trong readBy
    // ✅ Merge filter với điều kiện chưa đọc
    const unreadConditions = {
      $or: [
        { readBy: { $exists: false } },
        { readBy: { $size: 0 } },
        { readBy: { $not: { $elemMatch: { accountId } } } }
      ]
    };
    
    // Merge tất cả điều kiện
    let unreadFilter;
    if (filter.$and) {
      // Nếu filter đã có $and, thêm unreadConditions vào
      unreadFilter = {
        $and: [
          ...filter.$and,
          unreadConditions
        ]
      };
    } else if (filter.$or) {
      unreadFilter = {
        $and: [
          { $or: filter.$or },
          unreadConditions
        ]
      };
    } else {
      unreadFilter = {
        ...filter,
        ...unreadConditions
      };
    }
    
    const unreadCount = await Notification.countDocuments(unreadFilter);
    
    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error('❌ Lỗi getUnreadCount:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✅ ĐÁNH DẤU ĐÃ ĐỌC
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.accountId;
    
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }
    
    // Kiểm tra đã đọc chưa
    const alreadyRead = notification.readBy?.some(
      read => String(read.accountId) === String(accountId)
    );
    
    if (!alreadyRead) {
      notification.readBy = notification.readBy || [];
      notification.readBy.push({
        accountId,
        readAt: new Date()
      });
      await notification.save();
    }
    
    res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    console.error('❌ Lỗi markAsRead:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✅ ĐÁNH DẤU TẤT CẢ ĐÃ ĐỌC
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const { role } = req.user;
    const accountId = req.user.accountId;
    
    let filter = {};
    
    // ✅ Filter theo thời gian hiển thị (tương tự getNotifications)
    let dateFilter = {};
    if (role !== 'admin' && !(role === 'teacher' && req.user.teacherFlags?.isLeader)) {
      const now = new Date();
      dateFilter = {
        $or: [
          { startDate: { $exists: false }, endDate: { $exists: false } },
          { startDate: null, endDate: null },
          {
            $and: [
              { startDate: { $lte: now } },
              { endDate: { $gte: now } }
            ]
          },
          {
            startDate: { $lte: now },
            endDate: { $exists: false }
          },
          {
            startDate: { $exists: false },
            endDate: { $gte: now }
          }
        ]
      };
    }
    
    // Tương tự logic getNotifications
    if (role === 'admin' || (role === 'teacher' && req.user.teacherFlags?.isLeader)) {
      // Admin và BGH: Xem tất cả
      if (Object.keys(dateFilter).length > 0) {
        filter = { ...filter, ...dateFilter };
      }
    } else if (role === 'teacher' && req.user.teacherFlags?.isHomeroom) {
      const teacher = await Teacher.findOne({ accountId })
        .populate('homeroomClassIds');
      if (!teacher || !teacher.homeroomClassIds || teacher.homeroomClassIds.length === 0) {
        return res.json({ success: true, updated: 0 });
      }
      const homeroomClassIds = teacher.homeroomClassIds.map(c => c._id || c);
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'class', classId: { $in: homeroomClassIds } },
        { recipientType: 'role', recipientRole: 'student' }
      ];
      // Merge với dateFilter
      if (Object.keys(dateFilter).length > 0) {
        filter = {
          $and: [
            { $or: filter.$or },
            dateFilter
          ]
        };
      }
    } else if (role === 'teacher' && !req.user.teacherFlags?.isHomeroom && 
               !req.user.teacherFlags?.isLeader && !req.user.teacherFlags?.isDepartmentHead) {
      // ✅ Lấy danh sách lớp đang dạy từ TeachingAssignment
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const currentYear = await getCurrentSchoolYear();
      const assignments = await TeachingAssignment.find({
        teacherId: accountId,
        year: currentYear || new Date().getFullYear()
      }).select('classId').lean();
      
      if (!assignments || assignments.length === 0) {
        return res.json({ success: true, updated: 0 });
      }
      const teachingClassIds = assignments.map(a => a.classId).filter(Boolean);
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'class', classId: { $in: teachingClassIds } },
        { recipientType: 'role', recipientRole: 'student' }
      ];
      // Merge với dateFilter
      if (Object.keys(dateFilter).length > 0) {
        filter = {
          $and: [
            { $or: filter.$or },
            dateFilter
          ]
        };
      }
    } else if (role === 'student') {
      const student = await Student.findOne({ accountId });
      if (!student) {
        return res.json({ success: true, updated: 0 });
      }
      const studentClass = await Class.findOne({ students: student._id });
      filter.$or = [
        { recipientType: 'all' },
        { recipientType: 'user', recipientId: accountId },
        { recipientType: 'role', recipientRole: 'student' },
        { recipientType: 'class', classId: studentClass?._id }
      ];
      // Merge với dateFilter
      if (Object.keys(dateFilter).length > 0) {
        filter = {
          $and: [
            { $or: filter.$or },
            dateFilter
          ]
        };
      }
    } else {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    
    // Tìm tất cả thông báo chưa đọc
    // ✅ Merge filter với điều kiện chưa đọc
    const unreadConditions = {
      $or: [
        { readBy: { $exists: false } },
        { readBy: { $size: 0 } },
        { readBy: { $not: { $elemMatch: { accountId } } } }
      ]
    };
    
    // Merge tất cả điều kiện
    let unreadFilter;
    if (filter.$and) {
      unreadFilter = {
        $and: [
          ...filter.$and,
          unreadConditions
        ]
      };
    } else if (filter.$or) {
      unreadFilter = {
        $and: [
          { $or: filter.$or },
          unreadConditions
        ]
      };
    } else {
      unreadFilter = {
        ...filter,
        ...unreadConditions
      };
    }
    
    const unreadNotifications = await Notification.find(unreadFilter);
    
    // Đánh dấu tất cả đã đọc
    let updated = 0;
    for (const notif of unreadNotifications) {
      const alreadyRead = notif.readBy?.some(
        read => String(read.accountId) === String(accountId)
      );
      if (!alreadyRead) {
        notif.readBy = notif.readBy || [];
        notif.readBy.push({
          accountId,
          readAt: new Date()
        });
        await notif.save();
        updated++;
      }
    }
    
    res.json({ success: true, updated });
  } catch (error) {
    console.error('❌ Lỗi markAllAsRead:', error);
    res.status(500).json({ error: error.message });
  }
};

