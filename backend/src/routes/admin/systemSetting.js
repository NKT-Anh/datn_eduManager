const express = require('express');
const router = express.Router();
const systemSettingController = require('../../controllers/admin/systemSettingControler');

// Routes
router.get('/', systemSettingController.getAllSettings);
router.get('/:key', systemSettingController.getSettingByKey);
router.post('/', systemSettingController.createSetting);
router.put('/:key', systemSettingController.updateSetting);

module.exports = router;