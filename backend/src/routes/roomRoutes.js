// routes/roomRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/room/roomController");
const auth = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/checkPermission');
const { PERMISSIONS } = require('../config/permissions');

// ✅ Tạo phòng học - Chỉ Admin
router.post("/",
  auth, 
  checkPermission(PERMISSIONS.ROOM_CREATE), 
  ctrl.create
);

// ✅ Danh sách phòng học - Tất cả roles có quyền xem
router.get("/",
  auth, 
  checkPermission(PERMISSIONS.ROOM_VIEW), 
  ctrl.getAll
);

// ✅ Cập nhật phòng học - Chỉ Admin
router.put("/:id",
  auth, 
  checkPermission(PERMISSIONS.ROOM_UPDATE), 
  ctrl.update
);

// ✅ Xóa phòng học - Chỉ Admin
router.delete("/:id",
  auth, 
  checkPermission(PERMISSIONS.ROOM_DELETE), 
  ctrl.remove
);

module.exports = router;
