const AuditLog = require('../models/auditLog');

/**
 * Middleware để log các hoạt động của người dùng
 * @param {Object} options - Các tùy chọn
 * @param {String} options.action - Hành động (CREATE, UPDATE, DELETE, VIEW, etc.)
 * @param {String} options.resource - Tài nguyên (USER, STUDENT, TEACHER, etc.)
 * @param {Function} options.getResourceId - Hàm để lấy resourceId từ req
 * @param {Function} options.getResourceName - Hàm để lấy resourceName từ req
 * @param {Function} options.getDescription - Hàm để tạo mô tả từ req
 * @param {Boolean} options.skipOnSuccess - Bỏ qua log nếu thành công (mặc định false)
 */
function auditLog(options = {}) {
  return async (req, res, next) => {
    const originalSend = res.json;
    const originalStatus = res.status;

    let statusCode = 200;
    let responseData = null;

    // Override res.json để capture response
    res.json = function (data) {
      responseData = data;
      return originalSend.call(this, data);
    };

    // Override res.status để capture status code
    res.status = function (code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Log sau khi response được gửi
    res.on('finish', async () => {
      try {
        if (!req.user) {
          return; // Không log nếu chưa đăng nhập
        }

        const {
          action = 'VIEW',
          resource = 'SYSTEM',
          getResourceId = (req) => req.params.id || req.body.id || null,
          getResourceName = (req) => null,
          getDescription = (req) => `${action} ${resource}`,
          skipOnSuccess = false,
        } = options;

        // Bỏ qua log nếu skipOnSuccess và thành công
        if (skipOnSuccess && statusCode >= 200 && statusCode < 300) {
          return;
        }

        const resourceId = getResourceId(req);
        const resourceName = getResourceName(req);
        // ✅ Hỗ trợ async getDescription - luôn await để xử lý cả sync và async
        let description;
        try {
          const descResult = getDescription(req);
          description = descResult instanceof Promise ? await descResult : descResult;
        } catch (err) {
          console.error('Error getting description for audit log:', err);
          description = `${action} ${resource}`;
        }

        // Lấy thông tin user
        const userId = req.user._id || req.user.accountId;
        const userRole = req.user.role || 'unknown';
        const userName = req.user.name || req.user.email || 'Unknown';
        
        // Lấy teacher flags nếu có (đã được set bởi authMiddleware)
        let userFlags = null;
        if (userRole === 'teacher' && req.user.teacherFlags) {
          userFlags = {
            isHomeroom: req.user.teacherFlags.isHomeroom || false,
            isDepartmentHead: req.user.teacherFlags.isDepartmentHead || false,
            isLeader: req.user.teacherFlags.isLeader || false,
            permissions: req.user.teacherFlags.permissions || [],
            // Lưu thêm thông tin năm học hiện tại nếu có
            currentYear: req.headers?.['x-school-year'] || req.query?.year || null,
          };
        }

        // Lấy IP address
        const ipAddress =
          req.ip ||
          req.headers['x-forwarded-for'] ||
          req.connection.remoteAddress ||
          'unknown';

        // Lấy User-Agent
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Xác định status
        const status =
          statusCode >= 200 && statusCode < 300
            ? 'SUCCESS'
            : statusCode >= 400
            ? 'FAILED'
            : 'PENDING';

        // Lấy error message nếu có
        const errorMessage =
          status === 'FAILED' && responseData?.error
            ? responseData.error
            : status === 'FAILED' && responseData?.message
            ? responseData.message
            : null;

        // Tạo metadata
        const metadata = {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body ? Object.keys(req.body).length > 0 : false,
          statusCode,
        };

        // Lưu log
        await AuditLog.create({
          userId,
          userRole,
          userName,
          userFlags,
          action,
          resource,
          resourceId,
          resourceName,
          description,
          ipAddress,
          userAgent,
          metadata,
          status,
          errorMessage,
        });
      } catch (error) {
        // Không throw error để không ảnh hưởng đến request
        console.error('Error creating audit log:', error);
      }
    });

    next();
  };
}

/**
 * Helper function để log đăng nhập
 */
function logLogin(req, user, status = 'SUCCESS', errorMessage = null) {
  return AuditLog.create({
    userId: user._id || user.accountId,
    userRole: user.role || 'unknown',
    userName: user.name || user.email || 'Unknown',
    action: 'LOGIN',
    resource: 'SYSTEM',
    description: `Đăng nhập vào hệ thống`,
    ipAddress:
      req.ip ||
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    status,
    errorMessage,
  });
}

/**
 * Helper function để log đăng xuất
 */
function logLogout(req, user) {
  return AuditLog.create({
    userId: user._id || user.accountId,
    userRole: user.role || 'unknown',
    userName: user.name || user.email || 'Unknown',
    action: 'LOGOUT',
    resource: 'SYSTEM',
    description: `Đăng xuất khỏi hệ thống`,
    ipAddress:
      req.ip ||
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    status: 'SUCCESS',
  });
}

module.exports = {
  auditLog,
  logLogin,
  logLogout,
};

