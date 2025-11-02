const Student = require('../../models/user/student');
const User = require('../../models/user/user');
const Parent = require('../../models/user/parent'); 
const Account = require('../../models/user/account');
const admin = require("firebase-admin");

// 📌 Lấy danh sách học sinh
exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate({ path: 'accountId', select: 'email phone role' })
      .populate({ path: 'classId', select: 'className grade' })
      .populate({ path: 'parentIds', select: 'name phone relation occupation ' });

    const data = students.map(s => {
      const studentObj = s.toObject();
      studentObj.parents = studentObj.parentIds;
      delete studentObj.parentIds;
      return studentObj;
    });

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// 📌 Lấy chi tiết một học sinh
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({ path: 'accountId', select: 'email phone role' })
      .populate({ path: 'classId', select: 'className grade' })
      .populate({ path: 'parentIds', select: 'name phone relation' });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    const studentObj = student.toObject();
    studentObj.parents = studentObj.parentIds;
    delete studentObj.parentIds;
    res.json(studentObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 📌 Tạo mới học sinh
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
      parents, // [{name, phone, relation}]
      status,
      accountId,
    } = req.body;

    // 1. Tạo Parents nếu có
    let parentIds = [];
    if (Array.isArray(parents) && parents.length > 0) {
      const createdParents = await Promise.all(parents.map(p =>
        Parent.create({
          name: p.name,
          phone: p.phone,
          relation: p.relation,
          occupation: p.occupation || "",
        })
      ));
      parentIds = createdParents.map(p => p._id);
    }

    // 2. Sinh mã học sinh
    const count = await Student.countDocuments({ admissionYear, grade });
    const studentCode = `${admissionYear}${grade}${String(count + 1).padStart(4, "0")}`;

    // 3. Tạo student
    const newStudent = await Student.create({
      name,
      dob,
      gender,
      address,
      phone,
      classId: classId || null,
      admissionYear,
      grade,
      parentIds: parentIds,
      status: status || "active",
      accountId: accountId || null,
      studentCode,
    });

    res.status(201).json(newStudent);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(400).json({ message: "Error creating student", error: error.message });
  }
};

// 📌 Cập nhật học sinh
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
    } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    // 🔹 Chỉ update field nào có gửi lên
    if (name !== undefined && name !== "") student.name = name;
    if (dob !== undefined) student.dob = dob;
    if (gender !== undefined) student.gender = gender;
    if (address !== undefined && address !== "") student.address = address;
    if (phone !== undefined && phone !== "") student.phone = phone;
    if (classId !== undefined) student.classId = classId;
    if (admissionYear !== undefined) student.admissionYear = admissionYear;
    if (grade !== undefined) student.grade = grade;
    if (status !== undefined) student.status = status;

    // 🔹 Update parents
    if (Array.isArray(parents)) {
      const updatedParents = await Promise.all(
        parents.map(async (p) => {
          if (p._id) {
            return await Parent.findByIdAndUpdate(
              p._id,
              {
                ...(p.name !== undefined && p.name !== "" && { name: p.name }),
                ...(p.phone !== undefined && p.phone !== "" && { phone: p.phone }),
                ...(p.relation !== undefined && { relation: p.relation }),
                ...(p.occupation !== undefined && { occupation: p.occupation }),
              },
              { new: true }
            );
          } else {
            const newParent = await Parent.create({
              name: p.name || "",
              phone: p.phone || "",
              relation: p.relation || "guardian",
            });
            return newParent;
          }
        })
      );
      student.parentIds = updatedParents.map((p) => p._id);
    }

    await student.save();

    res.json(student);
  } catch (error) {
    console.error("Error updating student:", error);
    res
      .status(400)
      .json({ message: "Error updating student", error: error.message });
  }
};


// 📌 Xóa học sinh
exports.deleteStudent = async (req, res) => {
  try {
    const deleted = await Student.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Student not found' });

    if (deleted.parentIds && deleted.parentIds.length > 0) {
      await Parent.deleteMany({ _id: { $in: deleted.parentIds } });
    }

    res.json({ message: 'Student and related parents deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting student', error: error.message });
  }
};

// 📌 Tạo account cho student
exports.createAccountForStudent = async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student không tồn tại" });
    if (!student.phone) return res.status(400).json({ message: "Student chưa có số điện thoại" });

    const userRecord = await admin.auth().createUser({
      phoneNumber: student.phone,
      displayName: student.name,
      password: "123456"
    });

    const account = await Account.create({
      uid: userRecord.uid,
      phone: student.phone,
      role: "student"
    });

    student.accountId = account._id;
    await student.save();

    res.status(201).json({ message: "Tạo tài khoản thành công", account });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi tạo tài khoản", error: error.message });
  }
};

// 📌 Xóa parent
exports.deleteParent = async (req, res) => {
  try {
    const parent = await Parent.findByIdAndDelete(req.params.id);
    if (!parent) return res.status(404).json({ message: 'Parent not found' });
    res.json({ message: 'Parent deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting parent', error: error.message });
  }
};
