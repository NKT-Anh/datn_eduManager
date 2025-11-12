const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/roomAssignmentController");
const auth = require("../../middlewares/authMiddleware");

router.post("/auto/:scheduleId", auth, ctrl.autoAssignRooms);


router.get("/schedule/:scheduleId", auth, ctrl.getAssignmentsBySchedule);


router.put("/:id", auth, ctrl.updateAssignment);


router.delete("/reset/:scheduleId", auth, ctrl.resetAssignments);


router.get("/export/:scheduleId/pdf", auth, ctrl.exportRoomList);

module.exports = router;
