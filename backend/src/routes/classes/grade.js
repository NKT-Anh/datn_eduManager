const express = require("express");
const router = express.Router();
const gradeController = require("../../controllers/class/gradeController");
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// Quản lý khối lớp - Chỉ Admin
router.get("/", authMiddleware, checkPermission(PERMISSIONS.CLASS_VIEW, { checkContext: false }), gradeController.getGrades);
router.post("/", authMiddleware, checkPermission(PERMISSIONS.CLASS_CREATE, { checkContext: false }), gradeController.createGrade);
router.post("/init", authMiddleware, checkPermission(PERMISSIONS.CLASS_CREATE, { checkContext: false }), gradeController.initDefaultGrades);
router.put("/:id", authMiddleware, checkPermission(PERMISSIONS.CLASS_UPDATE, { checkContext: false }), gradeController.updateGrade);
router.delete("/:id", authMiddleware, checkPermission(PERMISSIONS.CLASS_DELETE, { checkContext: false }), gradeController.deleteGrade);

module.exports = router;