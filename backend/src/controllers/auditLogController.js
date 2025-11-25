const AuditLog = require('../models/auditLog');
const User = require('../models/user/user');

/**
 * GET /audit-logs
 * Lấy danh sách audit logs với filter và pagination
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      userRole,
      action,
      resource,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    // Build query
    const query = {};

    if (userId) {
      query.userId = userId;
    }

    if (userRole) {
      query.userRole = userRole;
    }

    if (action) {
      query.action = action;
    }

    if (resource) {
      query.resource = resource;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { resourceName: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Get logs
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'name email')
      .lean();

    // Get total count
    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách log hoạt động',
      error: error.message,
    });
  }
};

/**
 * GET /audit-logs/stats
 * Lấy thống kê audit logs
 */
exports.getAuditLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) {
        dateQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Thống kê theo action
    const actionStats = await AuditLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Thống kê theo resource
    const resourceStats = await AuditLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$resource',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Thống kê theo user role
    const roleStats = await AuditLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$userRole',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Thống kê theo status
    const statusStats = await AuditLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Top users
    const topUsers = await AuditLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          userRole: { $first: '$userRole' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Total logs
    const totalLogs = await AuditLog.countDocuments(dateQuery);

    res.json({
      success: true,
      data: {
        totalLogs,
        actionStats,
        resourceStats,
        roleStats,
        statusStats,
        topUsers,
      },
    });
  } catch (error) {
    console.error('Error getting audit log stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê log hoạt động',
      error: error.message,
    });
  }
};

/**
 * GET /audit-logs/:id
 * Lấy chi tiết một audit log
 */
exports.getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await AuditLog.findById(id)
      .populate('userId', 'name email')
      .lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy log hoạt động',
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết log hoạt động',
      error: error.message,
    });
  }
};

/**
 * DELETE /audit-logs
 * Xóa logs cũ (chỉ admin)
 */
exports.deleteOldLogs = async (req, res) => {
  try {
    const { days = 90 } = req.query; // Mặc định xóa logs cũ hơn 90 ngày

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const result = await AuditLog.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    res.json({
      success: true,
      message: `Đã xóa ${result.deletedCount} log hoạt động cũ hơn ${days} ngày`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting old logs:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa log hoạt động cũ',
      error: error.message,
    });
  }
};

