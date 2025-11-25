const Student = require('../../models/user/student');
const User = require('../../models/user/user');
const Parent = require('../../models/user/parent');
const Account = require('../../models/user/account');
const admin = require("firebase-admin");
const { initGradesForStudent } = require('../../services/gradeService');
const Setting = require('../../models/settings');
const Class = require('../../models/class/class');
const StudentYearRecord = require('../../models/user/studentYearRecord');
const mongoose = require('mongoose');

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
    if (phone) {
      student.phone = phone;
      
      // ✅ Đồng bộ số điện thoại mới vào Account và Firebase nếu có account
      if (student.accountId) {
        const Account = require('../../models/user/account');
        const admin = require('../../config/firebaseAdmin');
        const account = await Account.findById(student.accountId);
        
        if (account) {
          // Format phone number (đảm bảo có +84)
          let formattedPhone = phone.trim();
          if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.startsWith('0')) {
              formattedPhone = '+84' + formattedPhone.substring(1);
            } else {
              formattedPhone = '+84' + formattedPhone;
            }
          }

          // Cập nhật trong Account model
          account.phone = formattedPhone;
          await account.save();

          // Cập nhật trong Firebase
          try {
            await admin.auth().updateUser(account.uid, {
              phoneNumber: formattedPhone,
            });
            console.log(`✅ Đã cập nhật số điện thoại học sinh trong Firebase: ${formattedPhone}`);
          } catch (firebaseError) {
            console.error('⚠️ Lỗi cập nhật số điện thoại trong Firebase:', firebaseError);
          }
        }
      }
    }
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

/* =========================================================
   📈 XÉT HỌC SINH LÊN LỚP VÀ CẬP NHẬT NĂM HỌC
========================================================= */
exports.promoteStudents = async (req, res) => {
  try {
    const { 
      currentYear, // Năm học hiện tại cần xét (VD: "2024-2025")
      newYear, // Năm học mới (VD: "2025-2026")
      minGPA = 5.0, // Điểm TB tối thiểu để lên lớp
      autoAssignClass = false // Tự động phân lớp cho học sinh lên lớp
    } = req.body;

    // Validate input
    if (!currentYear || !newYear) {
      return res.status(400).json({ 
        message: "Vui lòng cung cấp currentYear và newYear (định dạng: YYYY-YYYY)" 
      });
    }

    // Validate format năm học
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(currentYear) || !yearPattern.test(newYear)) {
      return res.status(400).json({ 
        message: "Định dạng năm học không hợp lệ. Vui lòng sử dụng định dạng: YYYY-YYYY (VD: 2024-2025)" 
      });
    }

    console.log(`🚀 [promoteStudents] Bắt đầu xét học sinh lên lớp từ ${currentYear} → ${newYear}`);

    // Lấy tất cả học sinh có currentYear = currentYear và status = active
    const students = await Student.find({
      currentYear: currentYear,
      status: 'active'
    }).populate('classId', 'className grade year');

    if (students.length === 0) {
      return res.status(200).json({
        message: `Không có học sinh nào trong năm học ${currentYear} để xét lên lớp.`,
        stats: {
          total: 0,
          promoted: 0,
          retained: 0,
          graduated: 0,
          noRecord: 0
        }
      });
    }

    console.log(`📘 Tổng số học sinh cần xét: ${students.length}`);

    const stats = {
      total: students.length,
      promoted: 0, // Lên lớp
      retained: 0, // Ở lại lớp
      graduated: 0, // Tốt nghiệp (lớp 12)
      noRecord: 0, // Không có bảng điểm
      errors: []
    };

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        for (const student of students) {
          try {
            // Lấy bảng điểm cả năm của học sinh
            const yearRecord = await StudentYearRecord.findOne({
              studentId: student._id,
              year: currentYear,
              semester: 'CN'
            }).session(session);

            if (!yearRecord) {
              console.warn(`⚠️ Học sinh ${student.name} (${student.studentCode}) không có bảng điểm cả năm ${currentYear}`);
              stats.noRecord++;
              // Vẫn cập nhật currentYear nhưng không thay đổi grade
              student.currentYear = newYear;
              await student.save({ session });
              continue;
            }

            const gpa = yearRecord.gpa || 0;
            const academicLevel = yearRecord.academicLevel;

            // Điều kiện lên lớp:
            // 1. GPA >= minGPA (mặc định 5.0)
            // 2. Học lực không phải "Yếu"
            const canPromote = gpa >= minGPA && academicLevel !== 'Yếu';

            if (canPromote) {
              // Lên lớp
              if (student.grade === '12') {
                // Học sinh lớp 12 → tốt nghiệp
                student.grade = '12'; // Giữ nguyên
                student.status = 'graduated';
                student.currentYear = newYear;
                stats.graduated++;
                console.log(`✅ ${student.name} (${student.studentCode}) - Lớp 12, GPA: ${gpa.toFixed(2)}, Học lực: ${academicLevel} → Tốt nghiệp`);
              } else {
                // Lên lớp (10→11, 11→12)
                const currentGrade = parseInt(student.grade);
                const newGrade = String(currentGrade + 1);
                
                student.grade = newGrade;
                student.currentYear = newYear;
                student.classId = null; // Xóa lớp cũ để phân lớp mới
                stats.promoted++;
                console.log(`✅ ${student.name} (${student.studentCode}) - Lớp ${currentGrade} → ${newGrade}, GPA: ${gpa.toFixed(2)}, Học lực: ${academicLevel} → Lên lớp`);
              }
            } else {
              // Ở lại lớp
              student.currentYear = newYear;
              stats.retained++;
              console.log(`⚠️ ${student.name} (${student.studentCode}) - Lớp ${student.grade}, GPA: ${gpa.toFixed(2)}, Học lực: ${academicLevel} → Ở lại lớp`);
            }

            await student.save({ session });

            // Nếu học sinh lên lớp và có yêu cầu tự động phân lớp
            if (canPromote && student.grade !== '12' && autoAssignClass) {
              // Tìm lớp mới cho học sinh
              const newGrade = student.grade;
              const availableClasses = await Class.find({
                year: newYear,
                grade: newGrade,
                $or: [
                  { capacity: { $exists: false } },
                  { $expr: { $lt: ['$currentSize', '$capacity'] } }
                ]
              })
                .sort({ currentSize: 1 })
                .limit(1)
                .session(session);

              if (availableClasses.length > 0) {
                const targetClass = availableClasses[0];
                student.classId = targetClass._id;
                await student.save({ session });

                // Cập nhật lớp
                await Class.findByIdAndUpdate(
                  targetClass._id,
                  {
                    $addToSet: { students: student._id },
                    $inc: { currentSize: 1 }
                  },
                  { session }
                );

                // Tạo bảng điểm mới
                try {
                  await initGradesForStudent({
                    studentId: student._id,
                    classId: targetClass._id,
                    schoolYear: newYear,
                    semester: '1'
                  });
                  await initGradesForStudent({
                    studentId: student._id,
                    classId: targetClass._id,
                    schoolYear: newYear,
                    semester: '2'
                  });
                } catch (err) {
                  console.warn(`⚠️ Lỗi tạo bảng điểm cho ${student.name}:`, err.message);
                }
              }
            }

          } catch (error) {
            console.error(`❌ Lỗi khi xử lý học sinh ${student.name}:`, error);
            stats.errors.push({
              studentId: student._id,
              studentName: student.name,
              error: error.message
            });
          }
        }
      });
    } finally {
      await session.endSession();
    }

    // Cập nhật currentSchoolYear trong Settings nếu cần
    const settings = await Setting.findOne();
    if (settings && settings.currentSchoolYear === currentYear) {
      settings.currentSchoolYear = newYear;
      await settings.save();
      console.log(`✅ Đã cập nhật currentSchoolYear trong Settings: ${newYear}`);
    }

    console.log(`\n✅ Hoàn tất xét lên lớp:`);
    console.log(`   - Tổng: ${stats.total}`);
    console.log(`   - Lên lớp: ${stats.promoted}`);
    console.log(`   - Ở lại lớp: ${stats.retained}`);
    console.log(`   - Tốt nghiệp: ${stats.graduated}`);
    console.log(`   - Không có bảng điểm: ${stats.noRecord}`);

    res.status(200).json({
      success: true,
      message: `Đã xét lên lớp thành công cho ${stats.total} học sinh.`,
      stats,
      currentYear,
      newYear
    });

  } catch (error) {
    console.error("[promoteStudents] ❌ LỖI CHÍNH:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xét học sinh lên lớp.",
      error: error.message,
    });
  }
};

/* =========================================================
   🔄 CẬP NHẬT NĂM HỌC CHO TẤT CẢ HỌC SINH
========================================================= */
exports.updateAllStudentsYear = async (req, res) => {
  try {
    const { newYear } = req.body;

    // Validate input
    if (!newYear) {
      return res.status(400).json({ 
        message: "Vui lòng cung cấp newYear (định dạng: YYYY-YYYY)" 
      });
    }

    // Validate format năm học
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(newYear)) {
      return res.status(400).json({ 
        message: "Định dạng năm học không hợp lệ. Vui lòng sử dụng định dạng: YYYY-YYYY (VD: 2024-2025)" 
      });
    }

    console.log(`🚀 [updateAllStudentsYear] Bắt đầu cập nhật năm học cho tất cả học sinh → ${newYear}`);

    // Cập nhật currentYear cho tất cả học sinh active
    const result = await Student.updateMany(
      { status: 'active' },
      { $set: { currentYear: newYear } }
    );

    // Cập nhật currentSchoolYear trong Settings
    const settings = await Setting.findOne();
    if (settings) {
      settings.currentSchoolYear = newYear;
      await settings.save();
      console.log(`✅ Đã cập nhật currentSchoolYear trong Settings: ${newYear}`);
    }

    console.log(`✅ Đã cập nhật năm học cho ${result.modifiedCount} học sinh.`);

    res.status(200).json({
      success: true,
      message: `Đã cập nhật năm học thành công cho ${result.modifiedCount} học sinh.`,
      modifiedCount: result.modifiedCount,
      newYear
    });

  } catch (error) {
    console.error("[updateAllStudentsYear] ❌ LỖI CHÍNH:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật năm học cho học sinh.",
      error: error.message,
    });
  }
};

