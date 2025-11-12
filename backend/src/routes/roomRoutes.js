// routes/roomRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/room/roomController");
const auth = require('../middlewares/authMiddleware');


router.post("/",auth, ctrl.create);
router.get("/",auth, ctrl.getAll);
router.put("/:id",auth, ctrl.update);
router.delete("/:id",auth, ctrl.remove);

module.exports = router;
