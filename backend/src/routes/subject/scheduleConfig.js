const express = require("express");
const router = express.Router();
const controller = require('../../controllers/subject/scheduleConfigController');

router.get("/", controller.getScheduleConfig);
router.post("/", controller.upsertScheduleConfig);
router.patch("/day/:day", controller.updateDayConfig);
router.patch("/subject-hours", controller.updateSubjectHours);

module.exports = router;