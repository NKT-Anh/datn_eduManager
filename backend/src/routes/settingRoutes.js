const express = require('express');
const router  = express.Router();
const settingController = require("../controllers/settingController")

const authMiddleware = require('../middlewares/authMiddleware')

router.get('/', authMiddleware, settingController.getSettings);
router.put('/', authMiddleware, settingController.updateSettings);
router.post('/reset', authMiddleware, settingController.resetSettings);
router.post('/test-email', authMiddleware, settingController.testEmail)
router.post('/send-test-email', authMiddleware, settingController.seenEmail);
;

module.exports = router;