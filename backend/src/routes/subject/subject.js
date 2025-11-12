const express = require("express");
const router = express.Router();
const subjectController = require('../../controllers/subject/subjectController');
const authMiddleware = require('../../middlewares/authMiddleware');
router.get("/", authMiddleware,subjectController.getSubjects);
router.get("/:id", authMiddleware,subjectController.getSubject);
router.post("/",authMiddleware, subjectController.createSubject);
router.put("/:id",authMiddleware, subjectController.updateSubject);
router.delete("/:id",authMiddleware, subjectController.deleteSubject);
router.put('/:id/include-average', authMiddleware, subjectController.updateIncludeInAverage);
router.patch("/:id/default-duration", subjectController.updateDefaultExamDuration);

module.exports = router;