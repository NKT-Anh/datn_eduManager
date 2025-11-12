const User = require('../../models/user/user');
const Account = require('../../models/user/account');
const Student = require('../../models/user/student');
const Teacher = require('../../models/user/teacher');
const admin = require('../../config/firebaseAdmin');

/* =========================================================
   🧠 LẤY THÔNG TIN CÁ NHÂN
========================================================= */
exports.getProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    if (!uid) return res.status(401).json({ message: 'UID không tồn tại' });

    // Lấy account
    const account = await Account.findOne({ uid });
    if (!account) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    // Lấy user liên kết với account
    const user = await User.findOne({ accountId: account._id });

    let profileData = {
      uid,
      accountId: account._id,
      email: account.email,
      role: account.role,
      name: user?.name || null,
      address: user?.address || null,
      phone: user?.phone || null,
      dob: user?.dob || null,
      gender: user?.gender || null,
    };

    if (!user) {
      return res.json(profileData);
    }

    /* =========================================================
       👨‍🏫 GIÁO VIÊN
    ========================================================== */
    if (user.__t === 'Teacher') {
      const teacher = await Teacher.findById(user._id)
        .populate('mainSubject', 'name code')
        .populate('subjects.subjectId', 'name code')
        .populate('classIds', 'className classCode grade year')
        .populate('homeroomClassIds', 'className classCode grade year')
        .lean();

      if (teacher) {
        profileData = {
          ...profileData,
          teacherId: teacher._id.toString(),
          teacherCode: teacher.teacherCode || null,
          mainSubject: teacher.mainSubject || null,
          subjects: teacher.subjects || [],
          classIds: teacher.classIds || [],
          homeroomClassIds: teacher.homeroomClassIds || [],
          hireYear: teacher.hireYear || null,
          hireYearInField: teacher.hireYearInField || null,
          weeklyLessons: teacher.weeklyLessons || null,
          qualification: teacher.qualification || null,
          specialization: teacher.specialization || null,
          teachingExperience: teacher.teachingExperience || null,
          certifications: teacher.certifications || null,
          school: teacher.school || null,
          position: teacher.position || null,
          status: teacher.status || 'active',
          notes: teacher.notes || null,
          avatarUrl: teacher.avatarUrl || null,
          maxClasses: teacher.maxClasses || null,

        };
      }
    }

    /* =========================================================
       👨‍🎓 HỌC SINH
    ========================================================== */
    if (user.__t === 'Student') {
      const student = await Student.findById(user._id)
        .populate('classId', 'className classCode grade year')
        .populate('parentIds', 'name phone relation occupation')
        .lean();

      if (student) {
        profileData = {
          ...profileData,
          studentId: student._id.toString(),
          studentCode: student.studentCode || null,
          admissionYear: student.admissionYear || null,
          grade: student.grade || null,
          classId: student.classId || null,
          parents: student.parentIds || [],
          status: student.status || 'active',

          // 🆕 Thông tin cá nhân mở rộng
          ethnic: student.ethnic || null,
          religion: student.religion || null,
          idNumber: student.idNumber || null,
          birthPlace: student.birthPlace || null,
          hometown: student.hometown || null,
          avatarUrl: student.avatarUrl || null,
          note: student.note || null,
        };
      }
    }

    /* =========================================================
       🧑‍💼 ADMIN
    ========================================================== */
    if (user.__t === 'Admin') {
      profileData = {
        ...profileData,
        adminId: user._id.toString(),
        department: user.department || null,
        position: user.position || null,
      };
    }

    res.json(profileData);
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT THÔNG TIN CÁ NHÂN
========================================================= */
exports.updateProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      name, address, phone, dob, gender,
      // Student fields
      parents,
      ethnic, religion, idNumber, birthPlace, hometown, avatarUrl, note,
      // Teacher fields
      qualification, specialization, teachingExperience, certifications, school, position, notes,maxClasses,
    } = req.body;

    const account = await Account.findOne({ uid });
    if (!account) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    const user = await User.findOne({ accountId: account._id });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    // Cập nhật cơ bản cho mọi loại user
    const baseUpdate = {};
    if (name !== undefined) baseUpdate.name = name;
    if (address !== undefined) baseUpdate.address = address;
    if (phone !== undefined) baseUpdate.phone = phone;
    if (dob !== undefined) baseUpdate.dob = dob;
    if (gender !== undefined) baseUpdate.gender = gender;

    await User.findOneAndUpdate({ accountId: account._id }, baseUpdate, { new: true });

    /* =========================================================
       👨‍🎓 HỌC SINH
    ========================================================== */
    if (user.__t === 'Student') {
      const studentUpdateData = {};
      if (ethnic !== undefined) studentUpdateData.ethnic = ethnic;
      if (religion !== undefined) studentUpdateData.religion = religion;
      if (idNumber !== undefined) studentUpdateData.idNumber = idNumber;
      if (birthPlace !== undefined) studentUpdateData.birthPlace = birthPlace;
      if (hometown !== undefined) studentUpdateData.hometown = hometown;
      if (avatarUrl !== undefined) studentUpdateData.avatarUrl = avatarUrl;
      if (note !== undefined) studentUpdateData.note = note;

      if (Object.keys(studentUpdateData).length > 0) {
        await Student.findByIdAndUpdate(user._id, studentUpdateData, { new: true });
      }

      // Cập nhật danh sách phụ huynh
      if (Array.isArray(parents)) {
        const Parent = require('../../models/user/parent');
        const updatedParents = await Promise.all(
          parents.map(async (p) => {
            if (p._id) {
              return await Parent.findByIdAndUpdate(
                p._id,
                {
                  ...(p.name !== undefined && { name: p.name }),
                  ...(p.phone !== undefined && { phone: p.phone }),
                  ...(p.relation !== undefined && { relation: p.relation }),
                  ...(p.occupation !== undefined && { occupation: p.occupation }),
                },
                { new: true }
              );
            } else {
              const newParent = await Parent.create({
                name: p.name || '',
                phone: p.phone || '',
                relation: p.relation || 'guardian',
                occupation: p.occupation || '',
              });
              return newParent;
            }
          })
        );

        await Student.findByIdAndUpdate(
          user._id,
          { parentIds: updatedParents.map(p => p._id) },
          { new: true }
        );
      }
    }

    /* =========================================================
       👨‍🏫 GIÁO VIÊN
    ========================================================== */
    if (user.__t === 'Teacher') {
      const teacherUpdate = {};
      if (qualification !== undefined) teacherUpdate.qualification = qualification;
      if (specialization !== undefined) teacherUpdate.specialization = specialization;
      if (teachingExperience !== undefined) teacherUpdate.teachingExperience = teachingExperience;
      if (certifications !== undefined) teacherUpdate.certifications = certifications;
      if (school !== undefined) teacherUpdate.school = school;
      if (position !== undefined) teacherUpdate.position = position;
      if (notes !== undefined) teacherUpdate.notes = notes;
      if (avatarUrl !== undefined) teacherUpdate.avatarUrl = avatarUrl;
if (maxClasses !== undefined) teacherUpdate.maxClasses = maxClasses;


      if (Object.keys(teacherUpdate).length > 0) {
        await Teacher.findByIdAndUpdate(user._id, teacherUpdate, { new: true });
      }
    }

    /* =========================================================
       🔁 LẤY LẠI PROFILE SAU UPDATE
    ========================================================== */
    const updatedUser = await User.findOne({ accountId: account._id });
    let updatedProfile = {
      uid,
      accountId: account._id,
      email: account.email,
      role: account.role,
      name: updatedUser?.name || null,
      address: updatedUser?.address || null,
      phone: updatedUser?.phone || null,
      dob: updatedUser?.dob || null,
      gender: updatedUser?.gender || null,
      
    };

    if (updatedUser.__t === 'Student') {
      const student = await Student.findById(updatedUser._id)
        .populate('classId', 'className classCode grade year')
        .populate('parentIds', 'name phone relation occupation')
        .lean();

      if (student) {
        updatedProfile = {
          ...updatedProfile,
          studentId: student._id.toString(),
          studentCode: student.studentCode || null,
          admissionYear: student.admissionYear || null,
          grade: student.grade || null,
          classId: student.classId || null,
          parents: student.parentIds || [],
          status: student.status || 'active',

          ethnic: student.ethnic || null,
          religion: student.religion || null,
          idNumber: student.idNumber || null,
          birthPlace: student.birthPlace || null,
          hometown: student.hometown || null,
          avatarUrl: student.avatarUrl || null,
          
          note: student.note || null,
        };
      }
    }

    if (updatedUser.__t === 'Teacher') {
      const teacher = await Teacher.findById(updatedUser._id)
        .populate('mainSubject', 'name code')
        .populate('subjects.subjectId', 'name code')
        .populate('classIds', 'className classCode grade year')
        .populate('homeroomClassIds', 'className classCode grade year')
        .lean();

      if (teacher) {
        updatedProfile = {
          ...updatedProfile,
          teacherId: teacher._id.toString(),
          teacherCode: teacher.teacherCode || null,
          mainSubject: teacher.mainSubject || null,
          subjects: teacher.subjects || [],
          classIds: teacher.classIds || [],
          homeroomClassIds: teacher.homeroomClassIds || [],
          qualification: teacher.qualification || null,
          specialization: teacher.specialization || null,
          teachingExperience: teacher.teachingExperience || null,
          certifications: teacher.certifications || null,
          school: teacher.school || null,
          position: teacher.position || null,
          notes: teacher.notes || null,
                    avatarUrl: teacher.avatarUrl || null,
                    maxClasses: teacher.maxClasses || null,


        };
      }
    }

    res.json({ message: 'Cập nhật thành công', ...updatedProfile });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   🔑 ĐỔI MẬT KHẨU
========================================================= */
exports.changePassword = async (req, res) => {
  try {
    const { uid } = req.user;
    const { newPassword } = req.body;

    if (!newPassword) return res.status(400).json({ message: 'Mật khẩu mới không được để trống' });

    await admin.auth().updateUser(uid, { password: newPassword });

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('changePassword error:', error);
    res.status(500).json({ message: error.message });
  }
};
