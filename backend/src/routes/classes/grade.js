const express = require("express");
const router = express.Router();
const gradeController = require("../../controllers/class/gradeController");

router.get("/", gradeController.getGrades);
router.post("/", gradeController.createGrade);
router.put("/:id", gradeController.updateGrade);
router.delete("/:id", gradeController.deleteGrade);

module.exports = router;