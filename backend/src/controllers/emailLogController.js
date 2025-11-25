/**
 * Email Log Controller
 * Quản lý lịch sử và thống kê email
 */

const EmailLog = require('../models/emailLog');

/**
 * ✅ GET /email-logs
 * Admin: Xem chi tiết đầy đủ (nội dung, lỗi, etc.)
 * BGH: Chỉ xem thống kê (số liệu, không có nội dung chi tiết)
 */
exports.getEmailLogs = async (req, res) => {
  try {
    const { role, accountId, teacherFlags } = req.user;
    const isAdmin = role === 'admin';
    const isBGH = role === 'teacher' && teacherFlags?.isLeader;
    
    if (!isAdmin && !isBGH) {
      return res.status(403).json({ 
        message: 'Chỉ Admin và Ban Giám Hiệu mới được xem lịch sử email' 
      });
    }

    const {
      page = 1,
      limit = 20,
      senderId,
      recipientType,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    // Build query
    const query = {};

    if (senderId) {
      query.senderId = senderId;
    }

    if (recipientType) {
      query.recipientType = recipientType;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) {
        query.sentAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.sentAt.$lte = new Date(endDate);
      }
    }

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { senderName: { $regex: search, $options: 'i' } },
        { senderEmail: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Get logs
    const logs = await EmailLog.find(query)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('senderId', 'name email')
      .populate('approvedBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    // Get total count
    const total = await EmailLog.countDocuments(query);

    // ✅ BGH chỉ xem thống kê, không xem nội dung chi tiết
    const logsForResponse = isBGH
      ? logs.map(log => ({
          _id: log._id,
          senderName: log.senderName,
          senderEmail: log.senderEmail,
          senderRole: log.senderRole,
          recipientType: log.recipientType,
          subject: log.subject,
          // ❌ KHÔNG trả về content cho BGH
          fromEmail: log.fromEmail,
          fromName: log.fromName,
          totalRecipients: log.totalRecipients,
          successCount: log.successCount,
          failedCount: log.failedCount,
          // ❌ KHÔNG trả về errors chi tiết cho BGH
          status: log.status,
          sentAt: log.sentAt,
          schoolYear: log.schoolYear,
          createdAt: log.createdAt,
          updatedAt: log.updatedAt,
        }))
      : logs; // Admin xem đầy đủ

    res.json({
      success: true,
      data: logsForResponse,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('❌ [Email Log] Lỗi lấy danh sách:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy lịch sử email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ✅ GET /email-logs/stats
 * Thống kê tổng quan email (Admin và BGH đều xem được)
 */
exports.getEmailStats = async (req, res) => {
  try {
    const { role, accountId, teacherFlags } = req.user;
    const isAdmin = role === 'admin';
    const isBGH = role === 'teacher' && teacherFlags?.isLeader;
    
    if (!isAdmin && !isBGH) {
      return res.status(403).json({ 
        message: 'Chỉ Admin và Ban Giám Hiệu mới được xem thống kê email' 
      });
    }

    const { startDate, endDate, schoolYear } = req.query;

    // Build query
    const query = {};
    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) {
        query.sentAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.sentAt.$lte = new Date(endDate);
      }
    }
    if (schoolYear) {
      query.schoolYear = schoolYear;
    }

    // Thống kê tổng quan
    const [
      totalEmails,
      totalSent,
      totalFailed,
      byRecipientType,
      byStatus,
      bySenderRole,
      recentLogs
    ] = await Promise.all([
      // Tổng số email đã gửi
      EmailLog.countDocuments(query),
      
      // Tổng số email thành công
      EmailLog.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$successCount' } } }
      ]),
      
      // Tổng số email thất bại
      EmailLog.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$failedCount' } } }
      ]),
      
      // Thống kê theo loại người nhận
      EmailLog.aggregate([
        { $match: query },
        { $group: {
          _id: '$recipientType',
          count: { $sum: 1 },
          totalSent: { $sum: '$successCount' },
          totalFailed: { $sum: '$failedCount' }
        }}
      ]),
      
      // Thống kê theo trạng thái
      EmailLog.aggregate([
        { $match: query },
        { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]),
      
      // Thống kê theo role người gửi
      EmailLog.aggregate([
        { $match: query },
        { $group: {
          _id: '$senderRole',
          count: { $sum: 1 },
          totalSent: { $sum: '$successCount' },
          totalFailed: { $sum: '$failedCount' }
        }}
      ]),
      
      // 10 email gần nhất (chỉ thống kê, không có nội dung)
      EmailLog.find(query)
        .sort({ sentAt: -1 })
        .limit(10)
        .select('senderName senderEmail recipientType subject totalRecipients successCount failedCount status sentAt')
        .lean()
    ]);

    res.json({
      success: true,
      stats: {
        totalEmails,
        totalSent: totalSent[0]?.total || 0,
        totalFailed: totalFailed[0]?.total || 0,
        byRecipientType: byRecipientType.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalSent: item.totalSent,
            totalFailed: item.totalFailed
          };
          return acc;
        }, {}),
        byStatus: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bySenderRole: bySenderRole.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalSent: item.totalSent,
            totalFailed: item.totalFailed
          };
          return acc;
        }, {}),
        recentLogs
      }
    });
  } catch (error) {
    console.error('❌ [Email Stats] Lỗi lấy thống kê:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy thống kê email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ✅ GET /email-logs/:id
 * Xem chi tiết 1 email log (chỉ Admin)
 */
exports.getEmailLogById = async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ 
        message: 'Chỉ Admin mới được xem chi tiết email log' 
      });
    }

    const { id } = req.params;
    const log = await EmailLog.findById(id)
      .populate('senderId', 'name email')
      .populate('approvedBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    if (!log) {
      return res.status(404).json({ 
        message: 'Không tìm thấy email log' 
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('❌ [Email Log] Lỗi lấy chi tiết:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy chi tiết email log',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

