const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/examStudentController");
const auth = require("../../middlewares/authMiddleware");
const upload = require("../../middlewares/uploadMiddleware");

router.post("/add", auth, ctrl.addStudentsToExam);
router.get("/exam/:examId", auth, ctrl.getStudentsByExam);
router.get("/:id", auth, ctrl.getExamStudentById);
router.put("/:id", auth, ctrl.updateExamStudent);
router.delete("/:id", auth, ctrl.deleteExamStudent);
router.delete("/reset/:examId", auth, ctrl.resetExamStudents);
router.get("/stats/:examId", auth, ctrl.countStudentsByGrade);
router.post("/import", auth, upload.single("file"), ctrl.importStudentsFromExcel);

module.exports = router;
