const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/examGradeController");
const auth = require("../../middlewares/authMiddleware");
const upload = require("../../middlewares/uploadMiddleware");

/* =========================================================
   🎓 API ROUTES - ĐIỂM THI (ExamGrade)
========================================================= */

// 📥 Import điểm từ file Excel
router.post("/import", auth, upload.single("file"), ctrl.importGradesFromExcel);

// 📤 Export điểm ra Excel
router.get("/export/:examId", auth, ctrl.exportGradesToExcel);

// 🔒 Khóa toàn bộ điểm của kỳ thi
router.put("/exam/:examId/lock", auth, ctrl.lockGrades);

// 🗑️ Reset toàn bộ điểm của kỳ thi
router.delete("/exam/:examId/reset", auth, ctrl.resetGrades);

// 📊 Lấy thống kê điểm theo môn
router.get("/exam/:examId/stats", auth, ctrl.getStats);

// 📄 Lấy danh sách điểm theo kỳ thi
router.get("/exam/:examId", auth, ctrl.getGradesByExam);

// ➕ Nhập / Cập nhật điểm 1 học sinh
router.post("/", auth, ctrl.addOrUpdateGrade);

// 🔍 Lấy chi tiết 1 điểm
router.get("/:id", auth, ctrl.getGradeById);

// ✏️ Cập nhật điểm theo ID
router.put("/:id", auth, ctrl.updateGrade);

// 🗑️ Xóa 1 bản ghi điểm
router.delete("/:id", auth, ctrl.deleteGrade);

module.exports = router;
