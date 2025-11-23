const Student = require('../../models/user/student');
const User = require('../../models/user/user');
const Parent = require('../../models/user/parent');
const Account = require('../../models/user/account');
const admin = require("firebase-admin");
const { initGradesForStudent } = require('../../services/gradeService');
const Setting = require('../../models/settings');
const Class = require('../../models/class/class');

/* =========================================================
   📘 LẤY DANH SÁCH HỌC SINH
========================================================= */
exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate({ path: 'accountId', select: 'email phone role' })
      .populate({ path: 'classId', select: 'className grade' })
      .populate({ path: 'parentIds', select: 'name phone relation occupation' });

    const data = students.map(s => {
      const obj = s.toObject();
      obj.parents = obj.parentIds;
      delete obj.parentIds;
      return obj;
    });

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* =========================================================
   📘 LẤY CHI TIẾT HỌC SINH
========================================================= */
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({ path: 'accountId', select: 'email phone role' })
      .populate({ path: 'classId', select: 'className grade' })
      .populate({ path: 'parentIds', select: 'name phone relation occupation' });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    const obj = student.toObject();
    obj.parents = obj.parentIds;
    delete obj.parentIds;
    res.json(obj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* =========================================================
   ➕ TẠO HỌC SINH MỚI
========================================================= */
exports.createStudent = async (req, res) => {
  try {
    const {
      name,
      dob,
      gender,
      address,
      phone,
      classId,
      admissionYear,
      grade,
      parents,
      status,
      accountId,

      // 🔹 Thông tin cá nhân mới
      ethnic,
      religion,
      idNumber,
      birthPlace,
      hometown,
      avatarUrl,
      note,
    } = req.body;

    // 1️⃣ Tạo Parents nếu có
    let parentIds = [];
    if (Array.isArray(parents) && parents.length > 0) {
      const createdParents = await Promise.all(
        parents.map(p =>
          Parent.create({
            name: p.name,
            phone: p.phone,
            relation: p.relation,
            occupation: p.occupation || "",
          })
        )
      );
      parentIds = createdParents.map(p => p._id);
    }

    // 2️⃣ Sinh mã học sinh tự động
// 🔹 Sinh mã học sinh tự động, đảm bảo không trùng
let count = await Student.countDocuments({ admissionYear });
let studentCode;
let isUnique = false;
    let attempts = 0;

while (!isUnique) {
  studentCode = `${admissionYear}${String(count + 1).padStart(4, "0")}`;
  const exists = await Student.findOne({ studentCode });
  if (!exists) {
    isUnique = true;
  } else {  
    count++; // nếu trùng -> tăng tiếp
  }
        attempts++;
}
    if (!isUnique) {
      return res.status(500).json({ message: "Không thể sinh mã học sinh duy nhất, vui lòng thử lại." });
    }

    // 3️⃣ Tạo học sinh
    const newStudent = await Student.create({
      name,
      dob,
      gender,
      address,
      phone,
      classId: classId || null,
      admissionYear,
      grade,
      parentIds,
      status: status || "active",
      accountId: accountId || null,
      studentCode,

      // ✅ Thông tin bổ sung
      ethnic,
      religion,
      idNumber,
      birthPlace,
      hometown,
      avatarUrl,
      note,
    });

    // 4️⃣ Nếu học sinh có classId → cập nhật vào lớp
    if (classId) {
      try {
        await Class.findByIdAndUpdate(classId, {
          $addToSet: { students: newStudent._id },
          $inc: { currentSize: 1 },
        });
      } catch (error) {
        console.error('[createStudent] Lỗi khi cập nhật lớp:', error);
      }

      // 5️⃣ Tự động tạo bảng điểm (nếu active)
      if (newStudent.status === 'active') {
        try {
          const settings = await Setting.findOne({}).lean();
          const currentSchoolYear = settings?.currentSchoolYear || '2024-2025';
          await initGradesForStudent({ studentId: newStudent._id, classId, schoolYear: currentSchoolYear, semester: '1' });
          await initGradesForStudent({ studentId: newStudent._id, classId, schoolYear: currentSchoolYear, semester: '2' });
        } catch (error) {
          console.error('[createStudent] Lỗi khi tạo bảng điểm:', error);
        }
      }
    }

    res.status(201).json(newStudent);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(400).json({ message: "Error creating student", error: error.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT HỌC SINH
========================================================= */
exports.updateStudent = async (req, res) => {
  try {
    const {
      name,
      dob,
      gender,
      address,
      phone,
      classId,
      admissionYear,
      grade,
      parents,
      status,

      // 🔹 Thông tin cá nhân mới
      ethnic,
      religion,
      idNumber,
      birthPlace,
      hometown,
      avatarUrl,
      note,
    } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const oldClassId = student.classId?.toString();

    // 🔹 Cập nhật các trường cơ bản
    if (name) student.name = name;
    if (dob) student.dob = dob;
    if (gender) student.gender = gender;
    if (address) student.address = address;
    if (phone) student.phone = phone;
    if (classId !== undefined) student.classId = classId;
    if (admissionYear) student.admissionYear = admissionYear;
    if (grade) student.grade = grade;
    if (status) student.status = status;

    // 🔹 Cập nhật thông tin bổ sung
    if (ethnic) student.ethnic = ethnic;
    if (religion) student.religion = religion;
    if (idNumber) student.idNumber = idNumber;
    if (birthPlace) student.birthPlace = birthPlace;
    if (hometown) student.hometown = hometown;
    if (avatarUrl) student.avatarUrl = avatarUrl;
    if (note) student.note = note;

    // 🔹 Update parents
    if (Array.isArray(parents)) {
      const updatedParents = await Promise.all(
        parents.map(async (p) => {
          if (p._id) {
            return await Parent.findByIdAndUpdate(
              p._id,
              {
                ...(p.name && { name: p.name }),
                ...(p.phone && { phone: p.phone }),
                ...(p.relation && { relation: p.relation }),
                ...(p.occupation && { occupation: p.occupation }),
              },
              { new: true }
            );
          } else {
            return await Parent.create({
              name: p.name || "",
              phone: p.phone || "",
              relation: p.relation || "guardian",
            });
          }
        })
      );
      student.parentIds = updatedParents.map(p => p._id);
    }

    await student.save();

    const newClassId = student.classId?.toString();

    // 🔹 Cập nhật lớp học nếu thay đổi
    if (oldClassId && oldClassId !== newClassId) {
      await Class.findByIdAndUpdate(oldClassId, {
        $pull: { students: student._id },
        $inc: { currentSize: -1 },
      });
    }
    if (newClassId && oldClassId !== newClassId) {
      await Class.findByIdAndUpdate(newClassId, {
        $addToSet: { students: student._id },
        $inc: { currentSize: 1 },
      });
    }

    // 🔹 Tạo bảng điểm mới nếu chuyển lớp
    if (newClassId && oldClassId !== newClassId && student.status === 'active') {
      try {
        const settings = await Setting.findOne({}).lean();
        const currentSchoolYear = settings?.currentSchoolYear || '2024-2025';
        await initGradesForStudent({ studentId: student._id, classId: newClassId, schoolYear: currentSchoolYear, semester: '1' });
        await initGradesForStudent({ studentId: student._id, classId: newClassId, schoolYear: currentSchoolYear, semester: '2' });
      } catch (error) {
        console.error('[updateStudent] Lỗi khi tạo bảng điểm:', error);
      }
    }

    res.json(student);
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(400).json({ message: "Error updating student", error: error.message });
  }
};

/* =========================================================
   🗑️ XOÁ HỌC SINH
========================================================= */
exports.deleteStudent = async (req, res) => {
  try {
    const deleted = await Student.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Student not found' });

    if (deleted.parentIds?.length > 0) {
      await Parent.deleteMany({ _id: { $in: deleted.parentIds } });
    }

    res.json({ message: 'Student and related parents deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting student', error: error.message });
  }
};

/* =========================================================
   🔐 TẠO ACCOUNT CHO HỌC SINH
========================================================= */
exports.createAccountForStudent = async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student không tồn tại" });
    if (!student.phone) return res.status(400).json({ message: "Student chưa có số điện thoại" });

    const userRecord = await admin.auth().createUser({
      phoneNumber: student.phone,
      displayName: student.name,
      password: "123456",
    });

    const account = await Account.create({
      uid: userRecord.uid,
      phone: student.phone,
      role: "student",
    });

    student.accountId = account._id;
    await student.save();

    res.status(201).json({ message: "Tạo tài khoản thành công", account });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi tạo tài khoản", error: error.message });
  }
};

/* =========================================================
   🧹 XOÁ PHỤ HUYNH
========================================================= */
exports.deleteParent = async (req, res) => {
  try {
    const parent = await Parent.findByIdAndDelete(req.params.id);
    if (!parent) return res.status(404).json({ message: 'Parent not found' });
    res.json({ message: 'Parent deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting parent', error: error.message });
  }
};

/* =========================================================
   🧮 PHÂN LỚP TỰ ĐỘNG (theo tên + chia đều)
========================================================= */
// exports.autoAssignToClasses = async (req, res) => {
//   try {


//         const config = await Setting.findOne();
//     const currentYear = config?.currentSchoolYear;

//     if (!currentYear) {
//       return res.status(400).json({ message: "Không tìm thấy năm học hiện tại trong cấu hình." });
//     }
//     // 🔹 Lấy học sinh chưa có lớp
//     const students = await Student.find({
//       classId: null,
//       $or: [{ currentYear }, { currentYear: { $exists: false } }],
//     }).sort({ grade: 1, name: 1 });

//     if (!students.length) {
//       return res.status(200).json({ message: "Không có học sinh cần gán lớp." });
//     }

//     // 🔹 Gom học sinh theo khối
//     const groupedByGrade = students.reduce((acc, s) => {
//       if (!acc[s.grade]) acc[s.grade] = [];
//       acc[s.grade].push(s);
//       return acc;
//     }, {});

//     let totalAssigned = 0;
//     const gradeLogs = [];

//     // 🔹 Lặp qua từng khối (10, 11, 12)
//     for (const grade of Object.keys(groupedByGrade)) {
//       const gradeStudents = groupedByGrade[grade];
//       const classes = await Class.find({ year: currentYear, grade });

//       if (!classes.length) {
//         console.warn(`⚠️ Không có lớp cho khối ${grade}, bỏ qua.`);
//         continue;
//       }

//       let i = 0; // ✅ Reset tại đây để tránh lệch lớp giữa các khối
//       const perClassCount = Math.ceil(gradeStudents.length / classes.length);

//       for (const student of gradeStudents) {
//         const targetClass = classes[i % classes.length];
//         student.classId = targetClass._id;
//         student.currentYear = currentYear;
//         await student.save();

//         // Cập nhật vào lớp
//         await Class.findByIdAndUpdate(targetClass._id, {
//           $addToSet: { students: student._id },
//           $inc: { currentSize: 1 },
//         });

//         // Tạo bảng điểm nếu có
//         if (typeof initGradesForStudent === "function") {
//           try {
//             await initGradesForStudent({
//               studentId: student._id,
//               classId: targetClass._id,
//               schoolYear: currentYear,
//               semester: "1",
//             });
//             await initGradesForStudent({
//               studentId: student._id,
//               classId: targetClass._id,
//               schoolYear: currentYear,
//               semester: "2",
//             });
//           } catch (err) {
//             console.warn(`[autoAssignToClasses] ⚠️ Lỗi tạo bảng điểm cho ${student.name}:`, err.message);
//           }
//         }

//         i++;
//         totalAssigned++;
//       }

//       gradeLogs.push(`Khối ${grade}: ${gradeStudents.length} học sinh → ${classes.length} lớp`);
//     }

//     res.status(200).json({
//       message: `✅ Đã phân lớp thành công cho ${totalAssigned} học sinh.`,
//       detail: gradeLogs,
//     });
//   } catch (error) {
//     console.error("[autoAssignToClasses] ❌", error);
//     res.status(500).json({
//       message: "Lỗi khi phân lớp tự động.",
//       error: error.message,
//     });
//   }
// };
exports.autoAssignToClasses = async (req, res) => {
  try {
    console.log("🚀 [autoAssignToClasses] Bắt đầu phân lớp...");

    const config = await Setting.findOne();
    const currentYear = config?.currentSchoolYear;

    if (!currentYear) {
      return res.status(400).json({ message: "Không tìm thấy năm học hiện tại trong cấu hình." });
    }

    // 🔹 Lấy học sinh chưa có lớp
    const students = await Student.find({
      classId: null,
      $or: [{ currentYear }, { currentYear: { $exists: false } }],
    }).sort({ grade: 1, name: 1 });

    if (!students.length) {
      return res.status(200).json({ message: "Không có học sinh cần gán lớp." });
    }

    console.log(`📘 Tổng học sinh cần gán: ${students.length}`);

    // 🔹 Gom học sinh theo khối
    const groupedByGrade = students.reduce((acc, s) => {
      if (!acc[s.grade]) acc[s.grade] = [];
      acc[s.grade].push(s);
      return acc;
    }, {});

    let totalAssigned = 0;
    const gradeLogs = [];

    // 🔹 Lặp qua từng khối (10, 11, 12)
    for (const grade of Object.keys(groupedByGrade)) {
      console.log(`\n🔸 Bắt đầu xử lý khối ${grade}...`);
      const gradeStudents = groupedByGrade[grade].sort((a, b) =>
        a.name.localeCompare(b.name, "vi", { sensitivity: "base" })
      );

      const classes = await Class.find({ year: currentYear, grade });

      if (!classes.length) {
        console.warn(`⚠️ Không có lớp cho khối ${grade}, bỏ qua.`);
        continue;
      }

      console.log(`📗 Khối ${grade}: ${gradeStudents.length} HS, ${classes.length} lớp`);

      // 🔹 Kiểm tra và lọc lớp còn chỗ trống
      const availableClasses = classes.filter(c => !c.capacity || c.currentSize < c.capacity);

      if (!availableClasses.length) {
        console.warn(`⚠️ Tất cả lớp khối ${grade} đều đầy, bỏ qua.`);
        continue;
      }

      // 👉 Gán từng học sinh vào lớp có sĩ số nhỏ nhất
      for (const student of gradeStudents) {
        // ✅ Tìm lớp có sĩ số nhỏ nhất (ưu tiên lớp còn trống)
        availableClasses.sort((a, b) => (a.currentSize || 0) - (b.currentSize || 0));
        const targetClass = availableClasses[0];

        if (!targetClass) {
          console.warn(`⚠️ Không còn lớp trống cho khối ${grade}`);
          break;
        }

        // 🧠 Đảm bảo dữ liệu hợp lệ trước khi lưu
        if (!student.admissionYear) {
          const [startYear] = currentYear.split("-");
          student.admissionYear = Number(startYear);
        }

        if (!student.studentCode) {
          const shortId = student._id.toString().slice(-4).toUpperCase();
          student.studentCode = `${student.admissionYear}${shortId}`;
        }

        student.classId = targetClass._id;
        student.currentYear = currentYear;

        await student.save();

        // 🔹 Cập nhật vào lớp
        await Class.findByIdAndUpdate(targetClass._id, {
          $addToSet: { students: student._id },
          $inc: { currentSize: 1 },
        });

        // Cập nhật cache tạm để lần sau sort chính xác
        targetClass.currentSize = (targetClass.currentSize || 0) + 1;

        // 🧮 Tạo bảng điểm nếu có
        if (typeof initGradesForStudent === "function") {
          try {
            await initGradesForStudent({
              studentId: student._id,
              classId: targetClass._id,
              schoolYear: currentYear,
              semester: "1",
            });
            await initGradesForStudent({
              studentId: student._id,
              classId: targetClass._id,
              schoolYear: currentYear,
              semester: "2",
            });
          } catch (err) {
            console.warn(`[autoAssignToClasses] ⚠️ Lỗi tạo bảng điểm cho ${student.name}:`, err.message);
          }
        }

        totalAssigned++;
      }

      gradeLogs.push(`Khối ${grade}: ${gradeStudents.length} học sinh → ${availableClasses.length} lớp`);
    }

    console.log(`\n✅ Hoàn tất phân lớp: ${totalAssigned} học sinh.`);
    res.status(200).json({
      message: `✅ Đã phân lớp thành công cho ${totalAssigned} học sinh.`,
      detail: gradeLogs,
    });
  } catch (error) {
    console.error("[autoAssignToClasses] ❌ LỖI CHÍNH:", error);
    res.status(500).json({
      message: "Lỗi khi phân lớp tự động.",
      error: error.message,
    });
  }
};

