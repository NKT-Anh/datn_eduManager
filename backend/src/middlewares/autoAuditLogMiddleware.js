const AuditLog = require('../models/auditLog');

/**
 * Middleware tự động log tất cả các hoạt động dựa trên HTTP method và route
 */
function autoAuditLog(req, res, next) {
  // Chỉ log các method có thay đổi dữ liệu hoặc quan trọng
  const logMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (!logMethods.includes(req.method)) {
    return next(); // Bỏ qua GET requests
  }

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

      // Xác định action dựa trên HTTP method
      let action = 'VIEW';
      if (req.method === 'POST') action = 'CREATE';
      else if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
      else if (req.method === 'DELETE') action = 'DELETE';

      // Xác định resource dựa trên route path
      let resource = 'SYSTEM';
      const path = req.path.toLowerCase();
      
      if (path.includes('/student')) resource = 'STUDENT';
      else if (path.includes('/teacher')) resource = 'TEACHER';
      else if (path.includes('/class') && !path.includes('classperiods')) resource = 'CLASS';
      else if (path.includes('/subject')) resource = 'SUBJECT';
      else if (path.includes('/grade') && !path.includes('gradeconfig')) resource = 'GRADE';
      else if (path.includes('/exam')) resource = 'EXAM';
      else if (path.includes('/attendance')) resource = 'ATTENDANCE';
      else if (path.includes('/teachingassignment')) resource = 'TEACHING_ASSIGNMENT';
      else if (path.includes('/school-year') || path.includes('/schoolyear')) resource = 'SCHOOL_YEAR';
      else if (path.includes('/permission')) resource = 'PERMISSION';
      else if (path.includes('/notification')) resource = 'NOTIFICATION';
      else if (path.includes('/user') || path.includes('/account')) resource = 'USER';

      // Lấy resourceId từ params hoặc body
      const resourceId = req.params.id || req.params.teacherId || req.params.studentId || req.body.id || null;

      // Tạo description
      let description = `${action} ${resource}`;
      if (resourceId) {
        description += ` (ID: ${resourceId})`;
      }
      if (req.body.name) {
        description += ` - ${req.body.name}`;
      } else if (req.body.className) {
        description += ` - ${req.body.className}`;
      } else if (req.body.subjectName) {
        description += ` - ${req.body.subjectName}`;
      }

      // Lấy thông tin user
      const userId = req.user._id || req.user.accountId;
      const userRole = req.user.role || 'unknown';
      const userName = req.user.name || req.user.email || 'Unknown';

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
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        statusCode,
      };

      // Lưu log
      await AuditLog.create({
        userId,
        userRole,
        userName,
        action,
        resource,
        resourceId,
        description,
        ipAddress,
        userAgent,
        metadata,
        status,
        errorMessage,
      });
    } catch (error) {
      // Không throw error để không ảnh hưởng đến request
      console.error('Error creating auto audit log:', error);
    }
  });

  next();
}

module.exports = autoAuditLog;

