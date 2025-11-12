const TeachingAssignment = require('../../models/subject/teachingAssignment');
const Teacher = require('../../models/user/teacher');
exports.getAllAssignments = async (req, res) => {
  try {
    const assignments = await TeachingAssignment.find()
    .populate('teacherId', 'name availableMatrix')
    .populate('subjectId', 'name')
    .populate('classId', 'className classCode grade year');
    ;
    res.status(200).json(assignments);
  }
  catch(err){
    res.status(400).json({ message:"Lỗi khi lấy danh sách", error: err.message });   

  }
}

// exports.getAssignmentsByTeacher = async (req, res) => {
//     try{
//         const { teacherId } = req.params;
//         const assignments = await TeachingAssignment.find({ teacherId })
//         .populate('teacherId', 'name availableMatrix')
//         .populate('subjectId', 'name')
//         .populate('classId', 'className classCode grade year');
//         if (!assignments) {
//         return res.status(404).json({ message: 'Không tìm thấy phân công' });
//     }
//         res.status(200).json(assignments);
//     }
//     catch(err){
//         res.status(400).json({ message:"Lỗi khi lấy danh sách", error: err.message });
//     }
// }
exports.createAssignment = async (req, res) => {
  try {
    const { teacherId, subjectId, classId, year, semester } = req.body;
    if (!teacherId || !subjectId || !classId || !year || !semester) {
      return res.status(400).json({ error: "Không được để trống" });
    }

    // ✅ Kiểm tra trùng
    const exists = await TeachingAssignment.findOne({ classId, subjectId, year, semester });
    if (exists) {
      return res.status(400).json({ error: "Lớp này đã được phân công cho môn học này trong năm học và học kỳ này!" });
    }

    // ✅ Tạo mới
    const newAssignment = await TeachingAssignment.create({
      teacherId,
      subjectId,
      classId,
      year,
      semester,
    });

    // ✅ Cập nhật teacher
    await Teacher.findByIdAndUpdate(
      teacherId,
      { $addToSet: { classIds: classId } },
      { new: true }
    );

    // ✅ Populate trả về
    const populated = await TeachingAssignment.findById(newAssignment._id)
      .populate("teacherId", "name")
      .populate("subjectId", "name")
      .populate("classId", "className classCode grade year");

    res.status(201).json(populated);
    
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Phân công này đã tồn tại (duplicate key)" });
    }
    res.status(400).json({ error: "Lỗi khi tạo phân công", details: err.message });
  }
};


exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId, subjectId, classId, year, semester } = req.body;

    if (!teacherId || !subjectId || !classId || !year || !semester) {
      return res.status(400).json({ error: "Không được để trống" });
    }

    // 🔎 Lấy assignment cũ để so sánh
    const oldAssignment = await TeachingAssignment.findById(id);
    if (!oldAssignment) {
      return res.status(404).json({ error: "Không tìm thấy phân công" });
    }

    // 🔍 Check trùng (ngoại trừ chính nó)
    const exists = await TeachingAssignment.findOne({
      _id: { $ne: id },
      classId,
      subjectId,
      year,
      semester,
    });
    if (exists) {
      return res.status(400).json({
        error: "Lớp này đã được phân công cho môn học này trong năm học và học kỳ này!",
      });
    }

    // 🔄 Cập nhật assignment
    const updatedAssignment = await TeachingAssignment.findByIdAndUpdate(
      id,
      { teacherId, subjectId, classId, year, semester },
      { new: true }
    )
      .populate("teacherId", "name")
      .populate("subjectId", "name")
      .populate("classId", "className classCode grade year");

    // ⚡ Update lại phân công lớp trong Teacher
    if (oldAssignment.teacherId.toString() !== teacherId.toString()) {
      // Bỏ classId khỏi teacher cũ
      await Teacher.findByIdAndUpdate(oldAssignment.teacherId, {
        $pull: { classIds: oldAssignment.classId },
      });

      // Thêm classId vào teacher mới
      await Teacher.findByIdAndUpdate(teacherId, {
        $addToSet: { classIds: classId },
      });
    } else if (oldAssignment.classId.toString() !== classId.toString()) {
      // Nếu chỉ đổi classId (cùng teacher)
      await Teacher.findByIdAndUpdate(teacherId, {
        $pull: { classIds: oldAssignment.classId },
      });
      await Teacher.findByIdAndUpdate(teacherId, {
        $addToSet: { classIds: classId },
      });
    }

    res.status(200).json(updatedAssignment);
  } catch (err) {
    res.status(400).json({
      error: "Lỗi khi cập nhật phân công",
      details: err.message,
    });
  }
};


exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAssignment = await TeachingAssignment.findByIdAndDelete(id);

    if (!deletedAssignment) {
      return res.status(404).json({ message: "Không tìm thấy phân công" });
    }

    // ✅ Xóa classId và subjectId khỏi teacher
    await Teacher.findByIdAndUpdate(
      deletedAssignment.teacherId,
      {
        $pull: {
          classIds: deletedAssignment.classId,
          
        },
      },
      { new: true }
    );

    res.status(200).json({ message: "Xóa phân công thành công" });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Lỗi khi xóa phân công", error: err.message });
  }
};
exports.createBulkAssignments = async (req, res) => {
  try {
    const payloads = req.body; // mảng TeachingAssignmentPayload
    if (!Array.isArray(payloads)) {
      return res.status(400).json({ message: "Dữ liệu phải là mảng" });
    }

    // ✅ validate duplicate trong DB
    const toInsert = [];
    for (const p of payloads) {
      const exists = await TeachingAssignment.findOne({
        classId: p.classId,
        subjectId: p.subjectId,
        year: p.year,
        semester: p.semester,
      });
      if (!exists) {
        toInsert.push(p);
      }
    }

    const assignments = await TeachingAssignment.insertMany(toInsert);
    res.status(201).json(assignments);
  } catch (error) {
    res.status(500).json({ message: "Lỗi bulk insert", error });
  }
};
exports.getAssignmentsByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { year, semester } = req.query; // lấy query params

    // Build filter
    const filter = { teacherId };
    if (year) filter.year = year;
    if (semester) filter.semester = semester;

    const assignments = await TeachingAssignment.find(filter)
      .populate('teacherId', 'name availableMatrix')
      .populate('subjectId', 'name')
      .populate('classId', 'className classCode grade year');

    if (!assignments || assignments.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy phân công' });
    }

    res.status(200).json(assignments);
  } catch (err) {
    res.status(400).json({ message:"Lỗi khi lấy danh sách", error: err.message });
  }
};
