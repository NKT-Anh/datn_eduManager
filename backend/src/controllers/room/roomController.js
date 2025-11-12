// controllers/room/roomController.js
const Room = require("../../models/room/room");
const Class = require("../../models/class/class");

// 🧩 Lấy tất cả phòng
exports.getAll = async (req, res) => {
  try {
    const { keyword, status, type } = req.query;
    const filter = {};

    if (status && status !== "all") filter.status = status;
    if (type && type !== "all") filter.type = type;
    if (keyword) filter.roomCode = { $regex: keyword, $options: "i" };

    const rooms = await Room.find(filter).sort({ roomCode: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: "Lỗi tải danh sách phòng", error: err });
  }
};

// ➕ Tạo phòng mới

// exports.create = async (req, res) => {
//   try {
//     console.log("📥 Dữ liệu nhận:", req.body);

//     // 🔍 Kiểm tra dữ liệu tối thiểu
//     if (!req.body.roomCode || req.body.roomCode.trim() === "") {
//       return res.status(400).json({ message: "Thiếu mã phòng (roomCode)" });
//     }

//     // 🧠 Kiểm tra trùng mã phòng
//     const existed = await Room.findOne({ roomCode: req.body.roomCode });
//     if (existed) {
//       return res
//         .status(400)
//         .json({ message: `Phòng ${req.body.roomCode} đã tồn tại` });
//     }

//     // 🏗️ Tạo phòng mới
//     const room = await Room.create(req.body);
//     console.log("✅ Tạo phòng thành công:", room.roomCode);

//     res.status(201).json({
//       message: "Tạo phòng thành công",
//       data: room,
//     });
//   } catch (err) {
//     console.error("❌ Lỗi khi tạo phòng:", err.message);
//     res.status(400).json({
//       message: "Không thể tạo phòng",
//       error: err.message,
//     });
//   }
// };
exports.create = async (req, res) => {
  try {
    console.log("📥 Dữ liệu nhận:", req.body);

    if (!req.body.roomCode || req.body.roomCode.trim() === "") {
      return res.status(400).json({ message: "Thiếu mã phòng (roomCode)" });
    }

    const roomCode = req.body.roomCode.trim().toUpperCase();

    // 🔍 Kiểm tra phòng trùng mã
    const existed = await Room.findOne({ roomCode });
    if (existed) {
      return res
        .status(400)
        .json({ message: `Phòng ${roomCode} đã tồn tại` });
    }

    // ✅ Tạo phòng
    const room = await Room.create({
      roomCode,
      name: req.body.name || `Phòng ${roomCode}`,
      type: req.body.type || "normal",
      status: req.body.status || "available",
      note: req.body.note || "",
    });

    console.log(`✅ Tạo phòng thành công: ${room.roomCode}`);

    // 🏫 Tìm tất cả lớp có cùng className (VD: 10A1) và gán roomId
    const updated = await Class.updateMany(
      { className: roomCode },
      { $set: { roomId: room._id } }
    );

    console.log(
      `🔗 Đã gán phòng ${roomCode} cho ${updated.modifiedCount} lớp trùng tên`
    );

    res.status(201).json({
      message: `Tạo phòng ${roomCode} thành công và gán cho ${updated.modifiedCount} lớp.`,
      data: room,
    });
  } catch (err) {
    console.error("❌ [createRoom]", err);
    res.status(400).json({
      message: "Không thể tạo phòng",
      error: err.message,
    });
  }
};

// ✏️ Cập nhật phòng
exports.update = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng" });

    // 🔁 Nếu có lớp cùng tên thì cập nhật capacity
    const cls = await Class.findOne({ className: room.roomCode });
    if (cls && req.body.capacity) {
      cls.capacity = req.body.capacity;
      await cls.save();
      console.log(`🔄 Cập nhật sĩ số tối đa cho lớp ${cls.className}`);
    }

    res.json(room);
  } catch (err) {
    console.error("❌ [updateRoom]", err);
    res.status(400).json({ message: "Không thể cập nhật", error: err.message });
  }
};

// 🗑️ Xóa phòng
exports.remove = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng" });

    // 🧹 Gỡ roomId khỏi lớp nếu đang dùng phòng này
    await Class.updateMany({ roomId: room._id }, { $set: { roomId: null } });
    console.log(`🧹 Đã gỡ liên kết phòng ${room.roomCode} khỏi các lớp.`);

    res.json({ message: `Đã xóa phòng ${room.roomCode}` });
  } catch (err) {
    console.error("❌ [removeRoom]", err);
    res.status(500).json({ message: "Không thể xóa phòng", error: err.message });
  }
};
