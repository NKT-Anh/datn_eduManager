const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const {
  getIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  deleteIncident
} = require('../../controllers/incident/incidentController');

// Tất cả routes đều cần xác thực
router.use(authMiddleware);

// 📋 Lấy danh sách sự cố
router.get(
  '/',
  checkPermission([
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.INCIDENT_VIEW_HOMEROOM,
    PERMISSIONS.INCIDENT_REPORT
  ], { checkContext: true }),
  getIncidents
);

// 📋 Lấy chi tiết sự cố
router.get(
  '/:id',
  checkPermission([
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.INCIDENT_VIEW_HOMEROOM,
    PERMISSIONS.INCIDENT_REPORT
  ], { checkContext: true }),
  getIncidentById
);

// ➕ Tạo sự cố (Học sinh gửi báo cáo)
router.post(
  '/',
  checkPermission(PERMISSIONS.INCIDENT_REPORT, { checkContext: false }),
  createIncident
);

// ✏️ Cập nhật sự cố (Admin, BGH)
router.put(
  '/:id',
  checkPermission([
    PERMISSIONS.INCIDENT_UPDATE,
    PERMISSIONS.INCIDENT_HANDLE
  ], { checkContext: false }),
  updateIncident
);

// 🗑️ Xóa sự cố (Chỉ Admin)
router.delete(
  '/:id',
  checkPermission(PERMISSIONS.INCIDENT_UPDATE, { checkContext: false }),
  deleteIncident
);

module.exports = router;
















