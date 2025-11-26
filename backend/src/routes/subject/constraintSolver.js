const express = require("express");
const router = express.Router();
const constraintSolverController = require("../../controllers/subject/constraintSolverController");
const authMiddleware = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");

// Thuật toán Backtracking (CSP) cho thời khóa biểu
router.post(
  "/backtracking",
  authMiddleware,
  checkPermission(PERMISSIONS.SCHEDULE_CREATE),
  constraintSolverController.solveWithBacktracking
);

module.exports = router;


