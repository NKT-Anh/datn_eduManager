const teachingAssignmentController = require('../../controllers/subject/teachingAssignmentController');

const express = require('express');
const router = express.Router();

router.post('/', teachingAssignmentController.createAssignment);
router.get('/', teachingAssignmentController.getAllAssignments);
router.get('/teacher/:teacherId', teachingAssignmentController.getAssignmentsByTeacher);
router.put('/:id', teachingAssignmentController.updateAssignment);
router.delete('/:id', teachingAssignmentController.deleteAssignment);
router.post("/bulk", teachingAssignmentController.createBulkAssignments);


module.exports = router;