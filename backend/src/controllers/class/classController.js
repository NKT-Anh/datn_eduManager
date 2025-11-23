const User = require("../../models/user/user");
const Class = require("../../models/class/class");
const Student = require("../../models/user/student");
const Room = require("../../models/room/room");
const mongoose = require("mongoose");
const Teacher = require("../../models/user/teacher");
const Setting = require("../../models/settings");
const SchoolYearModel = require("../../models/schoolYear");

// ✅ Helper: Lấy năm học hiện tại từ settings hoặc active school year
async function getCurrentSchoolYear() {
  try {
    // Ưu tiên lấy từ active SchoolYear
    const activeYear = await SchoolYearModel.findOne({ isActive: true }).lean();
    if (activeYear && activeYear.code) {
      return String(activeYear.code);
    }
    // Fallback về settings
    const settings = await Setting.findOne().lean();
    if (settings && settings.currentSchoolYear) {
      return String(settings.currentSchoolYear);
    }
    // Fallback về env
    return process.env.SCHOOL_YEAR || null;
  } catch (error) {
    console.error('Error getting current school year:', error);
    return null;
  }
}

// ✅ Helper: Cập nhật yearRoles cho giáo viên
async function updateTeacherYearRole(teacherId, updates, targetYear = null) {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return;

    // ✅ Sử dụng targetYear nếu được cung cấp, nếu không thì dùng currentYear
    let schoolYear = targetYear;
    if (!schoolYear) {
      schoolYear = await getCurrentSchoolYear();
      if (!schoolYear) {
        console.warn('Không tìm thấy năm học, bỏ qua cập nhật yearRoles');
        return;
      }
    }

    // Đảm bảo yearRoles là array
    if (!Array.isArray(teacher.yearRoles)) {
      teacher.yearRoles = [];
    }

    // ✅ Tìm hoặc tạo yearRole entry cho năm học được chỉ định (targetYear hoặc currentYear)
    let yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(schoolYear));
    if (!yearRole) {
      yearRole = { schoolYear: schoolYear };
      teacher.yearRoles.push(yearRole);
    }

    // ✅ Cập nhật các trường từ updates (KHÔNG bao gồm isLeader - BGH được set cứng ở top-level)
    if (updates.departmentId !== undefined) {
      yearRole.departmentId = updates.departmentId;
    }
    if (updates.isDepartmentHead !== undefined) {
      yearRole.isDepartmentHead = updates.isDepartmentHead;
    }
    if (updates.isHomeroom !== undefined) {
      yearRole.isHomeroom = updates.isHomeroom;
    }
    // ✅ isLeader đã được loại bỏ khỏi yearRoles - BGH được set cứng ở top-level (teacher.isLeader)
    if (updates.currentHomeroomClassId !== undefined) {
      yearRole.currentHomeroomClassId = updates.currentHomeroomClassId;
    }
    if (updates.permissions !== undefined) {
      yearRole.permissions = Array.isArray(updates.permissions) ? updates.permissions : [];
    }

    await teacher.save();
  } catch (error) {
    console.error('Error updating teacher yearRole:', error);
  }
}

/* =========================================================
   📘 LẤY TẤT CẢ LỚP
   ✅ Có thể quản lý qua tất cả các niên khóa
   - Nếu có year parameter: filter theo năm học đó
   - Nếu không có year: trả về tất cả các lớp của tất cả các niên khóa
========================================================= */
exports.getAllClasses = async (req, res) => {
  try {
    const filter = {};

    // ✅ Nếu có year parameter, filter theo năm học đó
    if (req.query.year) {
      filter.year = req.query.year;
    }
    // ✅ Nếu không có year, không filter → trả về tất cả các lớp của tất cả các niên khóa
    
    if (req.query.grade) filter.grade = req.query.grade;

    const cls = await Class.find(filter)
      .populate("teacherId", "name")
      .populate("students", "name studentCode grade classId")
      .populate("roomId", "roomCode name type status")
      .sort({ year: -1, grade: 1, className: 1 }); // ✅ Sắp xếp theo năm học mới nhất trước

    res.status(200).json(cls);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách lớp:", error);
    res.status(500).json({ message: "Không thể tải danh sách lớp" });
  }
};

/* =========================================================
   📗 LẤY LỚP THEO ID
========================================================= */
exports.getClassById = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate("teacherId", "name")
      .populate("students", "name studentCode")
      .populate("roomId", "roomCode name");
    if (!cls) return res.status(404).json({ message: "Không tìm thấy lớp" });
    res.json(cls);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy lớp" });
  }
};

/* =========================================================
   📅 LẤY DANH SÁCH CÁC NĂM HỌC CÓ LỚP
   ✅ Để quản lý lớp qua các niên khóa
========================================================= */
exports.getAvailableYears = async (req, res) => {
  try {
    // Lấy danh sách các năm học duy nhất từ các lớp
    const years = await Class.distinct('year');
    
    // Sắp xếp theo năm học mới nhất trước
    const sortedYears = years.sort((a, b) => {
      // Parse năm học (format: "2024-2025")
      const [aStart] = a.split('-').map(Number);
      const [bStart] = b.split('-').map(Number);
      return bStart - aStart; // Năm mới nhất trước
    });

    res.status(200).json({ 
      years: sortedYears,
      total: sortedYears.length 
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách năm học:", error);
    res.status(500).json({ message: "Không thể tải danh sách năm học" });
  }
};

/* =========================================================
   ➕ TẠO LỚP HỌC (TỰ GẮN PHÒNG)
========================================================= */
exports.createClass = async (req, res) => {
  try {
    let { className, year, grade, capacity, teacherId } = req.body;

    if (!className || !year) {
      return res.status(400).json({ message: "Thiếu tên lớp hoặc năm học" });
    }

    // 🔒 Ràng buộc: Không được tạo lớp nếu chưa có năm học active
    const SchoolYear = require('../../models/schoolYear');
    const activeYear = await SchoolYear.findOne({ isActive: true });
    if (!activeYear) {
      return res.status(400).json({ 
        message: "Không thể tạo lớp. Vui lòng kích hoạt một năm học trước." 
      });
    }

    // Kiểm tra năm học được chọn có phải là năm học active không
    if (year !== activeYear.code) {
      return res.status(400).json({ 
        message: `Chỉ có thể tạo lớp cho năm học đang hoạt động: ${activeYear.name} (${activeYear.code})` 
      });
    }

    // 🔹 Chuẩn hoá dữ liệu
    className = className.trim().toUpperCase();
    const classCode = `${year}-${className}`;

    // 🔹 Tự động phát hiện khối nếu chưa nhập
    if (!grade && /^10/.test(className)) grade = "10";
    if (!grade && /^11/.test(className)) grade = "11";
    if (!grade && /^12/.test(className)) grade = "12";

    // 🔹 Kiểm tra lớp trùng (theo classCode)
    const existing = await Class.findOne({ classCode });
    if (existing)
      return res
        .status(400)
        .json({ message: `Đã tồn tại lớp ${className} (${year})` });

    // ✅ Kiểm tra trùng tên lớp trong cùng năm học và khối
    const duplicateName = await Class.findOne({
      className,
      year,
      grade,
    });
    if (duplicateName) {
      return res.status(400).json({
        message: `Tên lớp "${className}" đã tồn tại trong khối ${grade} năm học ${year}`,
      });
    }

    // 🔹 Kiểm tra giáo viên GVCN trùng trong năm
    if (teacherId) {
      const teacherUsed = await Class.findOne({ teacherId, year });
      if (teacherUsed) {
        return res.status(400).json({
          message: `Giáo viên này đã là GVCN của lớp ${teacherUsed.className} (${teacherUsed.year})`,
        });
      }
      
      // ✅ Sẽ được cập nhật sau khi tạo lớp (xem code bên dưới)
    }

    // 🔹 Giới hạn sĩ số lớp
    if (capacity && (capacity < 20 || capacity > 60)) {
      return res.status(400).json({
        message: "Sĩ số lớp phải trong khoảng 20–60 học sinh",
      });
    }

    /* =========================================================
       🏫 Tự động tạo / gán phòng học tương ứng (VD: 10A1 → roomCode: 10A1)
    ========================================================= */
    let room = await Room.findOne({ roomCode: className });
    if (!room) {
      room = await Room.create({
        roomCode: className,
        name: `Phòng học ${className}`,
        capacity: capacity || 45,
        type: "normal",
        status: "available",
      });
      console.log(`🏫 Đã tạo phòng mới: ${room.roomCode}`);
    }

    // ✅ Tạo lớp và gán roomId
    const newClass = await Class.create({
      classCode,
      className,
      year,
      grade,
      capacity: capacity || room.capacity || 45,
      currentSize: 0,
      teacherId: teacherId || null,
      roomId: room._id,
    });

    // ✅ Nếu có teacherId (GVCN), cập nhật homeroomClassIds, currentHomeroomClassId và isHomeroom
    // ✅ Lưu ý: Không ảnh hưởng đến isDepartmentHead, giáo viên có thể vừa là GVCN vừa là TBM
    if (teacherId) {
      const Setting = require('../../models/settings');
      const settings = await Setting.findOne().lean();
      const currentSchoolYear = settings?.currentSchoolYear;

      const updateData = {
        $addToSet: { homeroomClassIds: newClass._id }, // ✅ Lịch sử: thêm vào danh sách lớp đã chủ nhiệm
        isHomeroom: true
      };

      // ✅ Nếu lớp thuộc năm học hiện tại → cập nhật currentHomeroomClassId
      if (year === currentSchoolYear) {
        // ✅ Kiểm tra xem giáo viên đã có lớp chủ nhiệm trong năm học hiện tại chưa
        const existingClass = await Class.findOne({
          teacherId: teacherId,
          year: currentSchoolYear,
          _id: { $ne: newClass._id }
        });
        
        if (existingClass) {
          return res.status(400).json({
            message: `Giáo viên này đã là GVCN của lớp ${existingClass.className} trong năm học ${currentSchoolYear}`
          });
        }

        updateData.currentHomeroomClassId = newClass._id; // ✅ Hiện tại: lớp đang chủ nhiệm
      }

      await Teacher.findByIdAndUpdate(teacherId, updateData);
      
      // ✅ Cập nhật yearRoles cho năm học của lớp (year), không phải năm học hiện tại
      await updateTeacherYearRole(teacherId, {
        isHomeroom: true,
        currentHomeroomClassId: newClass._id
      }, year); // ✅ Truyền year của lớp vào
    }

    console.log(`✅ Tạo lớp ${className} (${year}) thành công`);

    res.status(201).json(newClass);
  } catch (error) {
    console.error("[createClass]", error);
    res.status(500).json({
      message: "Không thể tạo lớp",
      error: error.message,
    });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT LỚP
========================================================= */
exports.updateClass = async (req, res) => {
  try {
    const { teacherId, year, className, grade } = req.body;
    const classId = req.params.id;

    // ✅ Lấy thông tin lớp cũ để so sánh
    const oldClass = await Class.findById(classId);
    if (!oldClass) {
      return res.status(404).json({ message: "Không tìm thấy lớp" });
    }

    // ✅ Chuẩn hóa className nếu có trong request
    let normalizedClassName = className;
    if (className !== undefined) {
      normalizedClassName = className.trim().toUpperCase();
      req.body.className = normalizedClassName;
    } else {
      // Nếu không có className trong request, dùng className cũ
      normalizedClassName = oldClass.className;
    }

    // ✅ Cập nhật classCode nếu className hoặc year thay đổi
    const classNameChanged = className !== undefined && normalizedClassName !== oldClass.className;
    const yearChanged = year !== undefined && year !== oldClass.year;
    
    if (classNameChanged || yearChanged) {
      const newYear = year !== undefined ? year : oldClass.year;
      const newClassName = normalizedClassName;
      const newClassCode = `${newYear}-${newClassName}`;
      
      // ✅ Kiểm tra classCode không trùng với lớp khác
      const duplicateClassCode = await Class.findOne({
        classCode: newClassCode,
        _id: { $ne: classId },
      });
      
      if (duplicateClassCode) {
        return res.status(400).json({
          message: `Mã lớp "${newClassCode}" đã tồn tại. Vui lòng chọn tên lớp khác.`,
        });
      }
      
      // ✅ Cập nhật classCode trong req.body
      req.body.classCode = newClassCode;
    }

    // ✅ Kiểm tra trùng tên lớp trong cùng năm học và khối (nếu có thay đổi tên)
    const finalYear = year !== undefined ? year : oldClass.year;
    const finalGrade = grade !== undefined ? grade : oldClass.grade;
    
    if (normalizedClassName && finalYear && finalGrade) {
      const duplicateName = await Class.findOne({
        className: normalizedClassName,
        year: finalYear,
        grade: finalGrade,
        _id: { $ne: classId },
      });
      if (duplicateName) {
        return res.status(400).json({
          message: `Tên lớp "${normalizedClassName}" đã tồn tại trong khối ${finalGrade} năm học ${finalYear}`,
        });
      }
    }

    const Teacher = require('../../models/user/teacher');
    const Setting = require('../../models/settings');
    const settings = await Setting.findOne().lean();
    const currentSchoolYear = settings?.currentSchoolYear;
    
    if (teacherId) {
      const teacherUsed = await Class.findOne({
        teacherId,
        year: finalYear,
        _id: { $ne: classId },
      });
      if (teacherUsed) {
        return res.status(400).json({
          message: `Giáo viên này đã là GVCN của lớp ${teacherUsed.className} (${teacherUsed.year})`,
        });
      }
      
      // ✅ Tự động set isHomeroom = true và thêm vào homeroomClassIds (lịch sử)
      // ✅ Lưu ý: Không ảnh hưởng đến isDepartmentHead, giáo viên có thể vừa là GVCN vừa là TBM
      const updateData = {
        $addToSet: { homeroomClassIds: classId }, // ✅ Lịch sử: thêm vào danh sách lớp đã chủ nhiệm
        isHomeroom: true
      };

      // ✅ Reset currentHomeroomClassId của GVCN cũ (nếu có) của lớp này
      // ✅ Lưu ý: Chỉ reset currentHomeroomClassId, việc gỡ flag isHomeroom sẽ xử lý ở phần sau
      if (oldClass?.teacherId && oldClass.teacherId.toString() !== teacherId.toString()) {
        const oldTeacher = await Teacher.findById(oldClass.teacherId);
        if (oldTeacher && oldTeacher.currentHomeroomClassId?.toString() === classId) {
          await Teacher.findByIdAndUpdate(oldClass.teacherId, {
            currentHomeroomClassId: null
          });
          console.log(`🔄 Đang đổi GVCN cho lớp ${oldClass.className} (${oldClass.year}): Reset currentHomeroomClassId cho GVCN cũ`);
        }
      }

      // ✅ Nếu lớp thuộc năm học hiện tại → cập nhật currentHomeroomClassId cho GVCN mới
      if (finalYear === currentSchoolYear) {
        updateData.currentHomeroomClassId = classId; // ✅ Hiện tại: lớp đang chủ nhiệm
      }

      await Teacher.findByIdAndUpdate(teacherId, updateData);
      
      // ✅ Cập nhật yearRoles cho năm học của lớp (finalYear), không phải năm học hiện tại
      await updateTeacherYearRole(teacherId, {
        isHomeroom: true,
        currentHomeroomClassId: classId
      }, finalYear); // ✅ Truyền year của lớp vào
    }
    
    // ✅ Nếu thay đổi GVCN (có GVCN cũ) hoặc gỡ GVCN (teacherId = null)
    // ✅ Lưu ý: KHÔNG xóa khỏi homeroomClassIds vì đó là lịch sử, chỉ reset currentHomeroomClassId và yearRoles
    if (oldClass && oldClass.teacherId) {
      const isRemoved = !teacherId; // Nếu teacherId = null → gỡ GVCN
      const isChanged = teacherId && oldClass.teacherId.toString() !== teacherId.toString(); // Thay đổi GVCN
      
      if (isRemoved || isChanged) {
        const oldTeacher = await Teacher.findById(oldClass.teacherId);
        if (oldTeacher) {
          // ✅ Kiểm tra xem GVCN cũ còn lớp chủ nhiệm nào trong năm học của lớp (oldClass.year) không
          const yearClasses = await Class.find({
            teacherId: oldClass.teacherId,
            year: oldClass.year, // ✅ Kiểm tra theo năm học của lớp cũ
            _id: { $ne: classId }
          });
          
          console.log(`🔄 Đổi GVCN: Lớp ${oldClass.className} (${oldClass.year}) - GVCN cũ: ${oldClass.teacherId}`);
          console.log(`   - GVCN cũ còn ${yearClasses.length} lớp chủ nhiệm trong năm học ${oldClass.year}`);
          
          // ✅ Nếu không còn lớp chủ nhiệm nào trong năm học đó → Gỡ flag isHomeroom trong yearRoles
          if (yearClasses.length === 0) {
            console.log(`   ✅ Gỡ flag isHomeroom cho GVCN cũ trong năm học ${oldClass.year}`);
            await updateTeacherYearRole(oldClass.teacherId, {
              isHomeroom: false,
              currentHomeroomClassId: null
            }, oldClass.year); // ✅ Truyền year của lớp vào
            
            // ✅ Nếu lớp thuộc năm học hiện tại → reset currentHomeroomClassId của GVCN cũ
            if (oldClass.year === currentSchoolYear) {
              await Teacher.findByIdAndUpdate(oldClass.teacherId, {
                currentHomeroomClassId: null
              });
              console.log(`   ✅ Reset currentHomeroomClassId cho GVCN cũ`);
            }
            
            // ✅ Nếu không còn lớp chủ nhiệm nào trong năm học hiện tại và không có lớp chủ nhiệm nào khác
            if (oldClass.year === currentSchoolYear && (!oldTeacher.homeroomClassIds || oldTeacher.homeroomClassIds.length === 0)) {
              await Teacher.findByIdAndUpdate(oldClass.teacherId, {
                isHomeroom: false // ✅ Reset top-level flag
              });
              console.log(`   ✅ Reset top-level isHomeroom flag cho GVCN cũ`);
            }
          } else {
            // ✅ Vẫn còn lớp chủ nhiệm khác trong năm học đó → Chỉ reset currentHomeroomClassId cho lớp này
            if (oldTeacher.currentHomeroomClassId?.toString() === classId) {
              await Teacher.findByIdAndUpdate(oldClass.teacherId, {
                currentHomeroomClassId: null
              });
              // ✅ Cập nhật yearRoles: chỉ reset currentHomeroomClassId, giữ nguyên isHomeroom = true
              await updateTeacherYearRole(oldClass.teacherId, {
                currentHomeroomClassId: null
                // ✅ KHÔNG set isHomeroom: false vì vẫn còn lớp chủ nhiệm khác
              }, oldClass.year);
              console.log(`   ✅ Chỉ reset currentHomeroomClassId (vẫn giữ isHomeroom = true vì còn lớp chủ nhiệm khác)`);
            }
          }
        }
      }
    }

    const cls = await Class.findByIdAndUpdate(classId, req.body, { new: true });
    if (!cls) return res.status(404).json({ message: "Không tìm thấy lớp" });

    res.json(cls);
  } catch (error) {
    console.error("[updateClass]", error);
    res.status(500).json({ message: "Lỗi khi cập nhật lớp" });
  }
};

/* =========================================================
   🗑️ XOÁ LỚP
========================================================= */
exports.deleteClass = async (req, res) => {
  const classId = req.params.id;
  try {
    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ message: "Không tìm thấy lớp" });

    // 🔹 Gỡ classId khỏi học sinh
    await Student.updateMany({ classId }, { $set: { classId: null } });

    // ✅ Nếu lớp có GVCN, cập nhật thông tin giáo viên
    if (cls.teacherId) {
      const Teacher = require('../../models/user/teacher');
      const Setting = require('../../models/settings');
      const settings = await Setting.findOne().lean();
      const currentSchoolYear = settings?.currentSchoolYear;

      // ✅ Gỡ lớp khỏi homeroomClassIds (lịch sử) - KHÔNG xóa vì đó là lịch sử
      // ✅ Chỉ reset currentHomeroomClassId nếu lớp thuộc năm học hiện tại
      if (cls.year === currentSchoolYear) {
        await Teacher.findByIdAndUpdate(cls.teacherId, {
          currentHomeroomClassId: null
        });
      }

      // ✅ Kiểm tra xem GVCN còn lớp chủ nhiệm nào trong năm học của lớp không
      const teacher = await Teacher.findById(cls.teacherId);
      if (teacher) {
        const yearClasses = await Class.find({
          teacherId: cls.teacherId,
          year: cls.year,
          _id: { $ne: classId }
        });
        
        // ✅ Cập nhật yearRoles: nếu không còn lớp chủ nhiệm nào trong năm học đó, set isHomeroom = false
        if (yearClasses.length === 0) {
          await updateTeacherYearRole(cls.teacherId, {
            isHomeroom: false,
            currentHomeroomClassId: null
          }, cls.year); // ✅ Truyền year của lớp vào
        }
        
        // Nếu không còn lớp chủ nhiệm nào trong năm học hiện tại và không có lớp chủ nhiệm nào khác
        if (cls.year === currentSchoolYear && yearClasses.length === 0 && (!teacher.homeroomClassIds || teacher.homeroomClassIds.length === 0)) {
          await Teacher.findByIdAndUpdate(cls.teacherId, {
            isHomeroom: false
          });
        }
      }
    }

    await Class.findByIdAndDelete(classId);

    res.json({
      message: `Đã xoá lớp ${cls.className} thành công và cập nhật học sinh.`,
    });
  } catch (error) {
    console.error("[deleteClass]", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xoá lớp", error: error.message });
  }
};

/* =========================================================
   🏫 GẮN PHÒNG CHO LỚP
========================================================= */
exports.assignRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const classId = req.params.id;

    if (!classId) {
      return res.status(400).json({ message: "Thiếu ID lớp" });
    }

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ message: "Không tìm thấy lớp" });
    }

    // Nếu roomId là null hoặc rỗng, gỡ phòng
    if (!roomId || roomId === 'null' || roomId === '') {
      cls.roomId = null;
      await cls.save();
      return res.json({
        message: "Đã gỡ phòng khỏi lớp",
        data: cls,
      });
    }

    // Kiểm tra phòng có tồn tại không
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Không tìm thấy phòng" });
    }

    // Kiểm tra loại phòng: chỉ cho phép gán phòng học bình thường (normal)
    if (room.type !== 'normal') {
      const typeText = room.type === 'lab' ? 'phòng thí nghiệm' : room.type === 'computer' ? 'phòng máy' : 'phòng đặc biệt';
      return res.status(400).json({
        message: `Không thể gán ${typeText} cho lớp học. Chỉ có thể gán phòng học bình thường (normal).`,
      });
    }

    // 🔍 Kiểm tra trùng phòng
    const Schedule = require('../../models/subject/schedule');
    const ScheduleConfig = require('../../models/subject/scheduleConfig');

    // 1. Kiểm tra cùng khối: không cho phép
    const otherClassSameGrade = await Class.findOne({
      roomId: roomId,
      year: cls.year,
      grade: cls.grade, // Cùng khối
      _id: { $ne: classId },
    }).populate('roomId', 'roomCode');

    if (otherClassSameGrade) {
      return res.status(400).json({
        message: `Phòng ${room.roomCode} đã được sử dụng bởi lớp ${otherClassSameGrade.className} trong khối ${cls.grade}. Mỗi phòng chỉ được gán cho một lớp trong cùng khối.`,
      });
    }

    // 2. Kiểm tra khác khối: chỉ cho phép nếu khác buổi học
    const otherClassesDifferentGrade = await Class.find({
      roomId: roomId,
      year: cls.year,
      grade: { $ne: cls.grade }, // Khác khối
      _id: { $ne: classId },
    }).populate('roomId', 'roomCode');

    if (otherClassesDifferentGrade.length > 0) {
      // Lấy schedule config để biết số tiết buổi sáng
      const scheduleConfig = await ScheduleConfig.findOne();
      if (!scheduleConfig) {
        return res.status(400).json({
          message: "Chưa có cấu hình thời khóa biểu. Vui lòng cấu hình trước khi gán phòng.",
        });
      }

      // Lấy schedule của lớp hiện tại
      const currentClassSchedule = await Schedule.findOne({
        classId: classId,
        year: cls.year,
      });

      const currentSession = getClassSession(currentClassSchedule, scheduleConfig);

      // Lấy schedule của các lớp khác đã dùng phòng
      const otherClassIds = otherClassesDifferentGrade.map(c => c._id);
      const otherSchedules = await Schedule.find({
        classId: { $in: otherClassIds },
        year: cls.year,
      });

      // Kiểm tra trùng buổi với từng lớp khác
      for (const otherSchedule of otherSchedules) {
        const otherSession = getClassSession(otherSchedule, scheduleConfig);
        if (hasSessionConflict(currentSession, otherSession)) {
          // Tìm tên lớp để hiển thị
          const conflictingClass = otherClassesDifferentGrade.find(
            c => c._id.toString() === otherSchedule.classId.toString()
          );
          const sessionText = otherSession === 'morning' ? 'sáng' : otherSession === 'afternoon' ? 'chiều' : 'cả ngày';
          return res.status(400).json({
            message: `Phòng ${room.roomCode} đã được sử dụng bởi lớp ${conflictingClass?.className || 'khác'} (khối ${conflictingClass?.grade}) trong cùng buổi (buổi ${sessionText}). Vui lòng chọn phòng khác hoặc điều chỉnh thời khóa biểu.`,
          });
        }
      }
    }

    // Gắn phòng cho lớp
    cls.roomId = roomId;
    await cls.save();

    // Populate để trả về thông tin đầy đủ
    await cls.populate('roomId', 'roomCode name type status');

    res.json({
      message: `Đã gắn phòng ${room.roomCode} cho lớp ${cls.className}`,
      data: cls,
    });
  } catch (error) {
    console.error("[assignRoom]", error);
    res.status(500).json({
      message: "Lỗi khi gắn phòng cho lớp",
      error: error.message,
    });
  }
};

/* =========================================================
   🔍 HELPER: XÁC ĐỊNH BUỔI HỌC CỦA LỚP
========================================================= */
const getClassSession = (schedule, scheduleConfig) => {
  if (!schedule || !schedule.timetable) {
    return null; // Lớp chưa có schedule
  }

  let hasMorning = false;
  let hasAfternoon = false;

  schedule.timetable.forEach(dayEntry => {
    if (dayEntry.periods && Array.isArray(dayEntry.periods)) {
      const dayConfig = scheduleConfig.days?.get(dayEntry.day);
      const morningPeriods = dayConfig?.morningPeriods || 5;

      dayEntry.periods.forEach((period, index) => {
        if (period.subject && period.subject.trim() !== '') {
          const periodNumber = period.period || (index + 1);
          if (periodNumber <= morningPeriods) {
            hasMorning = true;
          } else {
            hasAfternoon = true;
          }
        }
      });
    }
  });

  if (hasMorning && hasAfternoon) return 'both';
  if (hasMorning) return 'morning';
  if (hasAfternoon) return 'afternoon';
  return null; // Không có tiết học nào
};

/* =========================================================
   🔍 HELPER: KIỂM TRA TRÙNG BUỔI
========================================================= */
const hasSessionConflict = (session1, session2) => {
  if (!session1 || !session2) return false; // Nếu một trong hai chưa có schedule → không conflict
  
  // Nếu một lớp học cả ngày (both) → luôn conflict với lớp khác
  if (session1 === 'both' || session2 === 'both') return true;
  
  // Nếu cùng buổi → conflict
  if (session1 === session2) return true;
  
  return false; // Khác buổi → không conflict
};

/* =========================================================
   🏫 TỰ ĐỘNG GÁN PHÒNG CHO CÁC LỚP
========================================================= */
exports.autoAssignRooms = async (req, res) => {
  try {
    const { year, reassignAll } = req.query; // Năm học (optional), reassignAll (optional)

    // Lấy danh sách lớp cần gán phòng
    const query = {};
    if (year && year !== 'Tất cả') {
      query.year = year;
    }
    
    // Nếu reassignAll = true, lấy tất cả lớp (kể cả đã có phòng)
    // Nếu không, chỉ lấy lớp chưa có phòng
    if (reassignAll !== 'true') {
      query.roomId = null;
    }

    const classesToAssign = await Class.find(query);
    
    if (classesToAssign.length === 0) {
      const message = reassignAll === 'true' 
        ? "Không có lớp nào để phân phòng."
        : "Tất cả lớp đã có phòng hoặc không có lớp nào cần gán phòng.";
      return res.json({
        message,
        assigned: 0,
        skipped: 0,
        failed: 0,
        details: [],
      });
    }

    const Room = require('../../models/room/room');
    const Schedule = require('../../models/subject/schedule');
    const ScheduleConfig = require('../../models/subject/scheduleConfig');

    // Lấy schedule config
    const scheduleConfig = await ScheduleConfig.findOne();
    if (!scheduleConfig) {
      return res.status(400).json({
        message: "Chưa có cấu hình thời khóa biểu. Vui lòng cấu hình trước khi tự động gán phòng.",
      });
    }

    // Helper: Tạo các pattern hậu tố từ className
    const getSuffixPatterns = (className) => {
      const patterns = [];
      
      // 1. Ưu tiên: Trùng chính xác
      patterns.push({ type: 'exact', value: className });
      
      // 2. Tách các phần: "10A1" → ["10", "A", "1"]
      const match = className.match(/^(\d+)([A-Z]+)(\d+)$/);
      if (match) {
        const [, grade, letter, number] = match;
        
        // Ưu tiên: Phòng có code kết thúc bằng số cuối cùng (hậu tố số)
        patterns.push({ type: 'ends_with', value: number }); // "1" - ưu tiên cao nhất
        patterns.push({ type: 'ends_with', value: `${letter}${number}` }); // "A1"
      } else {
        // Nếu không match pattern, thử lấy hậu tố
        const letterMatch = className.match(/([A-Z]+\d+)$/);
        if (letterMatch) {
          const suffix = letterMatch[1]; // "A1"
          const numberMatch = suffix.match(/(\d+)$/);
          if (numberMatch) {
            patterns.push({ type: 'ends_with', value: numberMatch[1] }); // "1"
          }
          patterns.push({ type: 'ends_with', value: suffix }); // "A1"
        }
        const numberMatch = className.match(/(\d+)$/);
        if (numberMatch) {
          patterns.push({ type: 'ends_with', value: numberMatch[1] }); // "1"
        }
      }
      
      return patterns;
    };

    // Helper: Kiểm tra phòng có thể gán cho lớp không
    const canAssignRoom = async (room, cls, classSchedulesMap, scheduleConfig) => {
      // Kiểm tra cùng khối
      const otherClassSameGrade = await Class.findOne({
        roomId: room._id,
        year: cls.year,
        grade: cls.grade,
        _id: { $ne: cls._id },
      });
      
      if (otherClassSameGrade) {
        return { canAssign: false, reason: `Phòng ${room.roomCode} đã được sử dụng bởi lớp ${otherClassSameGrade.className} trong cùng khối ${cls.grade}` };
      }
      
      // Kiểm tra khác khối nhưng cùng buổi
      const otherClassesDifferentGrade = await Class.find({
        roomId: room._id,
        year: cls.year,
        grade: { $ne: cls.grade },
      });
      
      if (otherClassesDifferentGrade.length > 0) {
        // Lấy schedule của lớp hiện tại
        const currentClassSchedule = classSchedulesMap.get(cls._id.toString());
        const currentSession = getClassSession(currentClassSchedule, scheduleConfig);
        
        // Lấy schedule của các lớp khác
        const otherClassIds = otherClassesDifferentGrade.map(c => c._id.toString());
        const otherSchedules = otherClassIds
          .map(id => classSchedulesMap.get(id))
          .filter(Boolean);
        
        // Kiểm tra trùng buổi với từng lớp khác
        for (const otherSchedule of otherSchedules) {
          const otherSession = getClassSession(otherSchedule, scheduleConfig);
          if (hasSessionConflict(currentSession, otherSession)) {
            const conflictingClass = otherClassesDifferentGrade.find(
              c => c._id.toString() === otherSchedule.classId?.toString()
            );
            return { 
              canAssign: false, 
              reason: `Phòng ${room.roomCode} đã được sử dụng bởi lớp ${conflictingClass?.className || 'khác'} (khối ${conflictingClass?.grade}) trong cùng buổi` 
            };
          }
        }
      }
      
      return { canAssign: true };
    };

    // Tối ưu: Load tất cả dữ liệu cần thiết trước
    const classIds = classesToAssign.map(c => c._id);
    const allSchedules = await Schedule.find({
      classId: { $in: classIds },
      year: classesToAssign[0]?.year || { $exists: true },
    });
    
    // Tạo map để truy cập nhanh schedule theo classId
    const classSchedulesMap = new Map();
    allSchedules.forEach(schedule => {
      const classId = schedule.classId?.toString();
      if (classId) {
        classSchedulesMap.set(classId, schedule);
      }
    });

    // Lấy tất cả phòng available một lần
    const allAvailableRooms = await Room.find({ 
      status: 'available',
      type: 'normal'
    }).sort({ roomCode: 1 });

    let assigned = 0;
    let skipped = 0;
    let failed = 0;
    const details = [];

    // Duyệt từng lớp
    for (const cls of classesToAssign) {
      try {
        let matchingRoom = null;
        
        const suffixPatterns = getSuffixPatterns(cls.className);
        
        // 1. Ưu tiên: Tìm phòng theo các pattern
        let exactMatchRoom = null;
        for (const pattern of suffixPatterns) {
          if (pattern.type === 'exact') {
            exactMatchRoom = allAvailableRooms.find(r => r.roomCode === pattern.value);
            if (exactMatchRoom) break;
          } else if (pattern.type === 'ends_with') {
            const regex = new RegExp(`${pattern.value}$`, 'i');
            exactMatchRoom = allAvailableRooms.find(r => regex.test(r.roomCode));
            if (exactMatchRoom) break;
          }
        }
        
        // Kiểm tra quy tắc cho phòng tìm được
        if (exactMatchRoom) {
          const checkResult = await canAssignRoom(exactMatchRoom, cls, classSchedulesMap, scheduleConfig);
          if (checkResult.canAssign) {
            matchingRoom = exactMatchRoom;
          } else {
            // Ghi log lý do bỏ qua
            details.push({
              className: cls.className,
              status: 'skipped',
              reason: checkResult.reason,
            });
          }
        }
        
        // 2. Nếu không tìm thấy phòng trùng code phù hợp, tìm phòng bất kỳ còn trống
        if (!matchingRoom) {
          for (const room of allAvailableRooms) {
            const checkResult = await canAssignRoom(room, cls, classSchedulesMap, scheduleConfig);
            if (checkResult.canAssign) {
              matchingRoom = room;
              break;
            }
          }
        }
        
        // Nếu vẫn không tìm thấy phòng phù hợp
        if (!matchingRoom) {
          skipped++;
          details.push({
            className: cls.className,
            status: 'skipped',
            reason: 'Không tìm thấy phòng phù hợp (tất cả phòng đã được sử dụng hoặc vi phạm quy tắc)',
          });
          continue;
        }

        // Gán phòng (đã kiểm tra quy tắc trong vòng lặp tìm phòng)
        cls.roomId = matchingRoom._id;
        await cls.save();
        assigned++;
        details.push({
          className: cls.className,
          status: 'assigned',
          roomCode: matchingRoom.roomCode,
        });

      } catch (error) {
        failed++;
        details.push({
          className: cls.className,
          status: 'failed',
          reason: error.message,
        });
        console.error(`[autoAssignRooms] Lỗi khi gán phòng cho lớp ${cls.className}:`, error);
      }
    }

    res.json({
      message: `Đã tự động gán phòng: ${assigned} lớp thành công, ${skipped} lớp bỏ qua, ${failed} lớp lỗi`,
      assigned,
      skipped,
      failed,
      details,
    });

  } catch (error) {
    console.error("[autoAssignRooms]", error);
    res.status(500).json({
      message: "Lỗi khi tự động gán phòng",
      error: error.message,
    });
  }
};

/* =========================================================
   👩‍🏫 TỰ ĐỘNG GÁN GIÁO VIÊN CHỦ NHIỆM
========================================================= */
exports.autoAssignHomeroomTeachers = async (req, res) => {
  try {
    const { year, reassignAll } = req.query;

    // Lấy danh sách lớp cần gán GVCN
    const query = {};
    if (year && year !== 'Tất cả') {
      query.year = year;
    }
    
    // Nếu reassignAll = true, lấy tất cả lớp (kể cả đã có GVCN)
    // Nếu không, chỉ lấy lớp chưa có GVCN
    if (reassignAll !== 'true') {
      query.teacherId = null;
    }

    const classesToAssign = await Class.find(query);
    
    if (classesToAssign.length === 0) {
      const message = reassignAll === 'true' 
        ? "Không có lớp nào để phân GVCN."
        : "Tất cả lớp đã có GVCN hoặc không có lớp nào cần gán GVCN.";
      return res.json({
        message,
        assigned: 0,
        skipped: 0,
        failed: 0,
        details: [],
      });
    }

    const Teacher = require('../../models/user/teacher');
    const Subject = require('../../models/subject/subject');

    // Tìm môn Văn và Toán
    const vanSubject = await Subject.findOne({ 
      $or: [
        { name: { $regex: /^văn$/i } },
        { name: { $regex: /^ngữ văn$/i } },
        { code: { $regex: /^VAN$/i } }
      ]
    });
    const toanSubject = await Subject.findOne({ 
      $or: [
        { name: { $regex: /^toán$/i } },
        { name: { $regex: /^toán học$/i } },
        { code: { $regex: /^TOAN$/i } }
      ]
    });

    const vanSubjectId = vanSubject?._id;
    const toanSubjectId = toanSubject?._id;

    // Lấy tất cả giáo viên active
    const allTeachers = await Teacher.find({ status: 'active' })
      .populate('subjects.subjectId', 'name code')
      .populate('mainSubject', 'name code');

    // Lấy danh sách lớp đã có GVCN trong cùng năm học
    const classesWithTeacher = await Class.find({
      year: classesToAssign[0]?.year || { $exists: true },
      teacherId: { $ne: null },
    });

    // Tạo Set để check nhanh giáo viên đã làm GVCN
    const teachersWithHomeroom = new Set();
    classesWithTeacher.forEach(cls => {
      if (cls.teacherId) {
        teachersWithHomeroom.add(cls.teacherId.toString());
      }
    });

    let assigned = 0;
    let skipped = 0;
    let failed = 0;
    const details = [];

    // Helper: Kiểm tra giáo viên có dạy môn ưu tiên không
    const hasPrioritySubject = (teacher, prioritySubjectIds) => {
      if (!prioritySubjectIds || prioritySubjectIds.length === 0) return false;
      
      // Kiểm tra trong subjects array
      if (teacher.subjects && teacher.subjects.length > 0) {
        for (const subj of teacher.subjects) {
          if (subj.subjectId && prioritySubjectIds.includes(subj.subjectId.toString())) {
            return true;
          }
        }
      }
      
      // Kiểm tra mainSubject
      if (teacher.mainSubject && prioritySubjectIds.includes(teacher.mainSubject.toString())) {
        return true;
      }
      
      return false;
    };

    // Helper: Kiểm tra giáo viên có dạy khối của lớp không
    const teachesGrade = (teacher, grade) => {
      if (!teacher.subjects || teacher.subjects.length === 0) return true; // Nếu không có subjects, cho phép
      
      for (const subj of teacher.subjects) {
        if (subj.grades && subj.grades.includes(grade)) {
          return true;
        }
      }
      
      return false;
    };

    // Helper: Sắp xếp giáo viên theo độ ưu tiên
    const sortTeachersByPriority = (teachers, prioritySubjectIds, grade) => {
      return teachers
        .filter(teacher => {
          // Lọc giáo viên chưa làm GVCN
          if (teachersWithHomeroom.has(teacher._id.toString())) {
            return false;
          }
          
          // Lọc giáo viên có dạy khối (nếu có subjects)
          if (teacher.subjects && teacher.subjects.length > 0) {
            return teachesGrade(teacher, grade);
          }
          
          return true;
        })
        .sort((a, b) => {
          // Ưu tiên 1: Giáo viên dạy Văn
          const aHasVan = hasPrioritySubject(a, [vanSubjectId].filter(Boolean));
          const bHasVan = hasPrioritySubject(b, [vanSubjectId].filter(Boolean));
          if (aHasVan && !bHasVan) return -1;
          if (!aHasVan && bHasVan) return 1;
          
          // Ưu tiên 2: Giáo viên dạy Toán
          const aHasToan = hasPrioritySubject(a, [toanSubjectId].filter(Boolean));
          const bHasToan = hasPrioritySubject(b, [toanSubjectId].filter(Boolean));
          if (aHasToan && !bHasToan) return -1;
          if (!aHasToan && bHasToan) return 1;
          
          // Ưu tiên 3: Giáo viên có mainSubject
          if (a.mainSubject && !b.mainSubject) return -1;
          if (!a.mainSubject && b.mainSubject) return 1;
          
          return 0;
        });
    };

    // Duyệt từng lớp
    for (const cls of classesToAssign) {
      try {
        // Sắp xếp giáo viên theo độ ưu tiên
        const prioritySubjectIds = [vanSubjectId, toanSubjectId].filter(Boolean);
        const sortedTeachers = sortTeachersByPriority(allTeachers, prioritySubjectIds, cls.grade);
        
        if (sortedTeachers.length === 0) {
          skipped++;
          details.push({
            className: cls.className,
            status: 'skipped',
            reason: 'Không tìm thấy giáo viên phù hợp (tất cả giáo viên đã làm GVCN hoặc không dạy khối này)',
          });
          continue;
        }

        // Gán giáo viên đầu tiên phù hợp
        const selectedTeacher = sortedTeachers[0];
        cls.teacherId = selectedTeacher._id;
        await cls.save();

        // ✅ Cập nhật homeroomClassIds (lịch sử) và currentHomeroomClassId (hiện tại) của giáo viên
        // ✅ Lưu ý: Không ảnh hưởng đến isDepartmentHead, giáo viên có thể vừa là GVCN vừa là TBM
        const Setting = require('../../models/settings');
        const settings = await Setting.findOne().lean();
        const currentSchoolYear = settings?.currentSchoolYear;

        if (!selectedTeacher.homeroomClassIds) {
          selectedTeacher.homeroomClassIds = [];
        }
        if (!selectedTeacher.homeroomClassIds.includes(cls._id)) {
          selectedTeacher.homeroomClassIds.push(cls._id); // ✅ Lịch sử: thêm vào danh sách lớp đã chủ nhiệm
        }
        selectedTeacher.isHomeroom = true;

        // ✅ Nếu lớp thuộc năm học hiện tại → cập nhật currentHomeroomClassId
        if (cls.year === currentSchoolYear) {
          selectedTeacher.currentHomeroomClassId = cls._id; // ✅ Hiện tại: lớp đang chủ nhiệm
        }

        // Không set isDepartmentHead ở đây để giữ lại flag nếu giáo viên đã là TBM
        await selectedTeacher.save();

        // Cập nhật Set để tránh gán lại
        teachersWithHomeroom.add(selectedTeacher._id.toString());

        assigned++;
        details.push({
          className: cls.className,
          status: 'assigned',
          teacherName: selectedTeacher.name,
          teacherCode: selectedTeacher.teacherCode,
        });

      } catch (error) {
        failed++;
        details.push({
          className: cls.className,
          status: 'failed',
          reason: error.message,
        });
        console.error(`[autoAssignHomeroomTeachers] Lỗi khi gán GVCN cho lớp ${cls.className}:`, error);
      }
    }

    res.json({
      message: `Đã tự động gán GVCN: ${assigned} lớp thành công, ${skipped} lớp bỏ qua, ${failed} lớp lỗi`,
      assigned,
      skipped,
      failed,
      details,
    });

  } catch (error) {
    console.error("[autoAssignHomeroomTeachers]", error);
    res.status(500).json({
      message: "Lỗi khi tự động gán GVCN",
      error: error.message,
    });
  }
};

/* =========================================================
   🔗 JOIN CLASS (học sinh vào lớp)
========================================================= */
exports.joinClass = async (req, res) => {
  const { userId, classCode } = req.body;
  try {
    const classObj = await Class.findOne({ classCode });
    if (!classObj)
      return res.status(404).json({ message: "Class code not found" });

    const student = await Student.findById(userId);
    const oldClassId = student?.classId?.toString();

    await User.findByIdAndUpdate(userId, { classId: classObj._id });
    if (!classObj.students.includes(userId)) {
      classObj.students.push(userId);
      await classObj.save();
    }

    // 🧾 Tạo bảng điểm nếu cần
    if (
      student &&
      oldClassId !== classObj._id.toString() &&
      student.status === "active"
    ) {
      try {
        const { initGradesForStudent } = require("../../services/gradeService");
        const Setting = require("../../models/settings");
        const settings = await Setting.findOne({}).lean();
        const currentSchoolYear = settings?.currentSchoolYear || "2024-2025";

        initGradesForStudent({
          studentId: userId,
          classId: classObj._id,
          schoolYear: currentSchoolYear,
          semester: "1",
        }).catch((err) =>
          console.error("[joinClass] Lỗi tạo bảng điểm HK1:", err)
        );
        initGradesForStudent({
          studentId: userId,
          classId: classObj._id,
          schoolYear: currentSchoolYear,
          semester: "2",
        }).catch((err) =>
          console.error("[joinClass] Lỗi tạo bảng điểm HK2:", err)
        );
      } catch (error) {
        console.error("[joinClass] Lỗi khi tạo bảng điểm:", error);
      }
    }

    res.json({ message: "Joined class successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.autoAssignGrade = async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const grade = String(req.query.grade || '10');
  const minScore = Number(req.query.minScore || 0);

  if (!year || !['10', '11', '12'].includes(grade)) {
    return res.status(400).json({ message: 'Invalid year or grade' });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const classes = await Class.find({ year, grade }).session(session);
      if (classes.length === 0) {
        return res.status(400).json({ message: 'No classes configured for this year/grade' });
      }

      const caps = classes.map(c => ({
        id: c._id,
        name: c.className,
        left: c.capacity - c.currentSize,
      }));
      const students = await Student.find({
        grade,
        admissionYear: year,
        entranceScore: { $gte: minScore },
        classId: null,
      })
        .sort({ entranceScore: -1, name: 1 })
        .session(session);

      let ci = 0;
      let assigned = 0;
      const assignedStudents = []; // Lưu danh sách học sinh đã được gán để tạo bảng điểm sau
      
      for (const s of students) {
        if (caps.every(c => c.left <= 0)) break;
        let spin = 0;
        while (caps[ci].left <= 0 && spin < caps.length) {
          ci = (ci + 1) % caps.length;
          spin++;
        }
        if (spin >= caps.length) break;
        const cls = caps[ci];
        await Student.updateOne({ _id: s._id }, { $set: { classId: cls.id } }, { session });
        await Class.updateOne(
          { _id: cls.id },
          { $inc: { currentSize: 1 }, $addToSet: { students: s._id } },
          { session }
        );
        cls.left -= 1;
        assigned += 1;
        assignedStudents.push({ studentId: s._id, classId: cls.id });
        ci = (ci + 1) % caps.length;
      }

      const unassigned = students.length - assigned;
      
      // Tạo bảng điểm cho các học sinh đã được gán (sau khi transaction commit)
      if (assignedStudents.length > 0) {
        // Chạy async sau khi transaction commit
        setImmediate(async () => {
          try {
            const { initGradesForStudent } = require('../../services/gradeService');
            const Setting = require('../../models/settings');
            const settings = await Setting.findOne({}).lean();
            const currentSchoolYear = settings?.currentSchoolYear || '2024-2025';
            
            for (const { studentId, classId } of assignedStudents) {
              await initGradesForStudent({ studentId, classId, schoolYear: currentSchoolYear, semester: '1' });
              await initGradesForStudent({ studentId, classId, schoolYear: currentSchoolYear, semester: '2' });
            }
          } catch (error) {
            console.error('[autoAssignGrade] Lỗi khi tạo bảng điểm:', error);
          }
        });
      }
      
      return res.json({
        assigned,
        unassigned,
        classes: caps.map(c => ({ name: c.name, remaining: c.left })),
      });
    });
  } catch (err) {
    console.error('[autoAssignGrade]', err);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    session.endSession();
  }
};

exports.setupYearClasses = async (req, res) => {
  const year = Number(req.body.year || req.query.year || new Date().getFullYear());
  const grade = String(req.body.grade || req.query.grade || '10');
  const count = Number(req.body.count || req.query.count || 8);
  const capacity = Number(req.body.capacity || req.query.capacity || 45);

  if (!['10', '11', '12'].includes(grade))
    return res.status(400).json({ message: 'Invalid grade' });
  if (count <= 0 || capacity <= 0)
    return res.status(400).json({ message: 'Invalid count/capacity' });

  try {
    const created = [];
    for (let i = 1; i <= count; i++) {
      const className = `${grade}A${i}`;
      const classCode = `${year}-${className}`;
      const existing = await Class.findOne({ classCode });
      if (existing) continue;
      const doc = await Class.create({
        classCode,
        className,
        year,
        grade,
        capacity,
        currentSize: 0,
      });
      created.push({ id: doc._id, className });
    }
    return res.json({ year, grade, createdCount: created.length, created });
  } catch (err) {
    console.error('[setupYearClasses]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
/* =========================================================
   🏫 LẤY TẤT CẢ LỚP CHỦ NHIỆM CỦA GIÁO VIÊN QUA CÁC NĂM HỌC
   - Lấy từ yearRoles (theo từng năm học)
   - Lấy từ homeroomClassIds (lịch sử tất cả lớp đã từng chủ nhiệm)
   - Có thể filter theo năm học (query param: year)
========================================================= */
exports.getAllHomeroomClasses = async (req, res) => {
  try {
    const { accountId, role } = req.user;
    const { year } = req.query; // Năm học cụ thể (optional)
    
    if (role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Chỉ giáo viên mới có quyền truy cập' });
    }

    const Teacher = require('../../models/user/teacher');
    const teacher = await Teacher.findOne({ accountId })
      .select('yearRoles currentHomeroomClassId homeroomClassIds')
      .lean();

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
    }

    // ✅ Lấy tất cả lớp chủ nhiệm từ yearRoles
    const homeroomClassesByYear = [];
    if (Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
      for (const yearRole of teacher.yearRoles) {
        if (yearRole.isHomeroom && yearRole.currentHomeroomClassId) {
          // Nếu có filter theo năm, chỉ lấy năm đó
          if (year && String(yearRole.schoolYear) !== String(year)) {
            continue;
          }
          
          const classInfo = await Class.findById(yearRole.currentHomeroomClassId)
            .populate('teacherId', 'name teacherCode')
            .lean();
          
          if (classInfo) {
            homeroomClassesByYear.push({
              schoolYear: yearRole.schoolYear,
              class: classInfo,
            });
          }
        }
      }
    }

    // ✅ Nếu không có filter năm, lấy thêm từ homeroomClassIds (lịch sử)
    if (!year && Array.isArray(teacher.homeroomClassIds) && teacher.homeroomClassIds.length > 0) {
      for (const classId of teacher.homeroomClassIds) {
        const classInfo = await Class.findById(classId)
          .populate('teacherId', 'name teacherCode')
          .lean();
        
        if (classInfo) {
          // Kiểm tra xem đã có trong danh sách chưa (tránh trùng lặp)
          const exists = homeroomClassesByYear.some(
            item => String(item.class._id) === String(classInfo._id)
          );
          
          if (!exists) {
            homeroomClassesByYear.push({
              schoolYear: classInfo.year || 'N/A',
              class: classInfo,
            });
          }
        }
      }
    }

    // ✅ Sắp xếp theo năm học (mới nhất trước)
    homeroomClassesByYear.sort((a, b) => {
      return String(b.schoolYear).localeCompare(String(a.schoolYear));
    });

    res.json({ 
      success: true, 
      data: homeroomClassesByYear,
      total: homeroomClassesByYear.length
    });
  } catch (err) {
    console.error('[getAllHomeroomClasses]', err);
    res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
  }
};

/* =========================================================
   🏫 LẤY LỚP CHỦ NHIỆM CỦA GIÁO VIÊN THEO NĂM HỌC CỤ THỂ
   - Lấy lớp chủ nhiệm của giáo viên đang đăng nhập
   - Có thể truyền year query param để lấy lớp của năm học cụ thể
   - Nếu không có year, lấy theo năm học hiện tại
========================================================= */
exports.getHomeroomClass = async (req, res) => {
  try {
    const { accountId, role } = req.user;
    const { year } = req.query; // Năm học cụ thể (optional)
    
    if (role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Chỉ giáo viên mới có quyền truy cập' });
    }

    const Teacher = require('../../models/user/teacher');
    const teacher = await Teacher.findOne({ accountId })
      .select('yearRoles currentHomeroomClassId')
      .lean();

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
    }

    // ✅ Xác định năm học cần lấy
    const targetYear = year || await getCurrentSchoolYear();
    if (!targetYear) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy năm học' });
    }

    // ✅ Tìm lớp chủ nhiệm từ yearRoles theo năm học
    let homeroomClassId = null;
    if (Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
      const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(targetYear));
      if (yearRole && yearRole.currentHomeroomClassId) {
        homeroomClassId = yearRole.currentHomeroomClassId;
      }
    }

    // ✅ Fallback về currentHomeroomClassId nếu không tìm thấy trong yearRoles và đang tìm năm hiện tại
    if (!homeroomClassId && teacher.currentHomeroomClassId && !year) {
      const currentYear = await getCurrentSchoolYear();
      const classInfo = await Class.findById(teacher.currentHomeroomClassId).lean();
      if (classInfo && String(classInfo.year) === String(currentYear)) {
        homeroomClassId = teacher.currentHomeroomClassId;
      }
    }

    if (!homeroomClassId) {
      return res.json({ 
        success: true, 
        data: null, 
        message: `Nhiệm kỳ này thầy/cô không có lớp chủ nhiệm` 
      });
    }

    // ✅ Lấy thông tin lớp
    const classInfo = await Class.findById(homeroomClassId)
      .populate('teacherId', 'name teacherCode')
      .lean();

    if (!classInfo) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp chủ nhiệm' });
    }

    res.json({ success: true, data: classInfo, schoolYear: targetYear });
  } catch (err) {
    console.error('[getHomeroomClass]', err);
    res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
  }
};

/* =========================================================
   📋 LẤY DANH SÁCH HỌC SINH TRONG LỚP CHỦ NHIỆM
   - Lấy đầy đủ thông tin học sinh, phụ huynh, điểm số, hạnh kiểm
   - Có thể truyền year query param để lấy lớp của năm học cụ thể
========================================================= */
exports.getHomeroomClassStudents = async (req, res) => {
  try {
    const { accountId, role } = req.user;
    const { year } = req.query; // Năm học cụ thể (optional)
    
    if (role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Chỉ giáo viên mới có quyền truy cập' });
    }

    const Teacher = require('../../models/user/teacher');
    const teacher = await Teacher.findOne({ accountId })
      .select('yearRoles currentHomeroomClassId')
      .lean();

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
    }

    // ✅ Xác định năm học cần lấy
    const targetYear = year || await getCurrentSchoolYear();
    if (!targetYear) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy năm học' });
    }

    // ✅ Tìm lớp chủ nhiệm từ yearRoles theo năm học
    let homeroomClassId = null;
    if (Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
      const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(targetYear));
      if (yearRole && yearRole.currentHomeroomClassId) {
        homeroomClassId = yearRole.currentHomeroomClassId;
      }
    }

    // ✅ Fallback về currentHomeroomClassId nếu không tìm thấy trong yearRoles và đang tìm năm hiện tại
    if (!homeroomClassId && teacher.currentHomeroomClassId && !year) {
      const currentYear = await getCurrentSchoolYear();
      const classInfo = await Class.findById(teacher.currentHomeroomClassId).lean();
      if (classInfo && String(classInfo.year) === String(currentYear)) {
        homeroomClassId = teacher.currentHomeroomClassId;
      }
    }

    if (!homeroomClassId) {
      return res.json({ success: true, data: [], message: `Nhiệm kỳ này thầy/cô không có lớp chủ nhiệm` });
    }

    // ✅ Lấy danh sách học sinh trong lớp
    const Student = require('../../models/user/student');
    const students = await Student.find({ 
      classId: homeroomClassId, 
      status: 'active' 
    })
      .populate('accountId', 'email phone')
      .populate('classId', 'className classCode grade year')
      .populate('parentIds', 'name phone relation occupation')
      .sort({ name: 1 })
      .lean();

    // ✅ Lấy thông tin điểm số và hạnh kiểm cho từng học sinh
    const StudentYearRecord = require('../../models/user/studentYearRecord');
    const GradeSummary = require('../../models/grade/gradeSummary');
    
    const studentsWithDetails = await Promise.all(students.map(async (student) => {
      // Lấy hạnh kiểm và học lực
      const yearRecords = await StudentYearRecord.find({
        studentId: student._id,
        year: targetYear
      })
        .sort({ semester: 1 })
        .lean();

      // Lấy điểm trung bình các môn theo học kỳ
      const gradeSummaries = await GradeSummary.find({
        studentId: student._id,
        schoolYear: targetYear
      })
        .populate('subjectId', 'name code includeInAverage')
        .sort({ semester: 1, 'subjectId.name': 1 })
        .lean();

      // Tính điểm trung bình cả năm
      const hk1Grades = gradeSummaries.filter(g => g.semester === '1' && g.average !== null && g.average !== undefined);
      const hk2Grades = gradeSummaries.filter(g => g.semester === '2' && g.average !== null && g.average !== undefined);
      
      const hk1Average = hk1Grades.length > 0 
        ? hk1Grades.reduce((sum, g) => sum + (g.average || 0), 0) / hk1Grades.length 
        : null;
      const hk2Average = hk2Grades.length > 0 
        ? hk2Grades.reduce((sum, g) => sum + (g.average || 0), 0) / hk2Grades.length 
        : null;
      
      const yearAverage = (hk1Average !== null && hk2Average !== null)
        ? (hk1Average + hk2Average) / 2
        : null;

      // Lấy học lực và hạnh kiểm cả năm
      const yearRecord = yearRecords.find(r => r.semester === 'CN') || null;
      const hk1Record = yearRecords.find(r => r.semester === 'HK1') || null;
      const hk2Record = yearRecords.find(r => r.semester === 'HK2') || null;

      return {
        ...student,
        parents: student.parentIds || [],
        yearRecords: {
          hk1: hk1Record,
          hk2: hk2Record,
          year: yearRecord,
        },
        grades: {
          hk1: hk1Grades,
          hk2: hk2Grades,
          hk1Average,
          hk2Average,
          yearAverage,
        },
        conduct: yearRecord?.conduct || hk2Record?.conduct || hk1Record?.conduct || null,
        academicLevel: yearRecord?.gpa ? getAcademicLevel(yearRecord.gpa) : null,
      };
    }));

    res.json({ success: true, data: studentsWithDetails, total: studentsWithDetails.length });
  } catch (err) {
    console.error('[getHomeroomClassStudents]', err);
    res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
  }
};

// ✅ Helper: Xác định học lực dựa trên điểm trung bình (fallback - dùng logic cũ)
function getAcademicLevel(average) {
  if (!average) return null;
  if (average >= 8.0) return 'Giỏi';
  if (average >= 6.5) return 'Khá';
  if (average >= 5.0) return 'Trung bình';
  return 'Yếu';
}

/* =========================================================
   📊 LẤY BẢNG ĐIỂM LỚP CHỦ NHIỆM (CẢ NĂM)
   - Hiển thị điểm tất cả môn học của tất cả học sinh
   - Tính điểm trung bình HKI, HKII, cả năm
   - Xếp loại học lực, hạnh kiểm
   - Có thể truyền year query param để lấy lớp của năm học cụ thể
========================================================= */
exports.getHomeroomClassGrades = async (req, res) => {
  try {
    const { accountId, role } = req.user;
    const { year } = req.query; // Năm học cụ thể (optional)
    
    if (role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Chỉ giáo viên mới có quyền truy cập' });
    }

    const Teacher = require('../../models/user/teacher');
    const teacher = await Teacher.findOne({ accountId })
      .select('yearRoles currentHomeroomClassId')
      .lean();

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
    }

    // ✅ Xác định năm học cần lấy
    const targetYear = year || await getCurrentSchoolYear();
    if (!targetYear) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy năm học' });
    }

    // ✅ Tìm lớp chủ nhiệm từ yearRoles theo năm học
    let homeroomClassId = null;
    if (Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
      const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(targetYear));
      if (yearRole && yearRole.currentHomeroomClassId) {
        homeroomClassId = yearRole.currentHomeroomClassId;
      }
    }

    // ✅ Fallback về currentHomeroomClassId nếu không tìm thấy trong yearRoles và đang tìm năm hiện tại
    if (!homeroomClassId && teacher.currentHomeroomClassId && !year) {
      const currentYear = await getCurrentSchoolYear();
      const classInfo = await Class.findById(teacher.currentHomeroomClassId).lean();
      if (classInfo && String(classInfo.year) === String(currentYear)) {
        homeroomClassId = teacher.currentHomeroomClassId;
      }
    }

    if (!homeroomClassId) {
      return res.json({ success: true, data: null, message: `Nhiệm kỳ này thầy/cô không có lớp chủ nhiệm` });
    }

    // ✅ Lấy danh sách học sinh trong lớp
    const Student = require('../../models/user/student');
    const students = await Student.find({ 
      classId: homeroomClassId, 
      status: 'active' 
    })
      .select('_id name studentCode')
      .sort({ name: 1 })
      .lean();

    // ✅ Lấy tất cả môn học
    const Subject = require('../../models/subject/subject');
    const subjects = await Subject.find({})
      .select('_id name code includeInAverage')
      .sort({ name: 1 })
      .lean();

    // ✅ Lấy điểm số và hạnh kiểm cho tất cả học sinh
    const StudentYearRecord = require('../../models/user/studentYearRecord');
    const GradeSummary = require('../../models/grade/gradeSummary');

    const gradeTable = await Promise.all(students.map(async (student, index) => {
      // Lấy điểm tất cả môn học
      const gradeSummaries = await GradeSummary.find({
        studentId: student._id,
        schoolYear: currentYear
      })
        .populate('subjectId', 'name code includeInAverage')
        .lean();

      // Lấy hạnh kiểm và học lực
      const yearRecords = await StudentYearRecord.find({
        studentId: student._id,
        year: targetYear
      })
        .lean();

      const hk1Record = yearRecords.find(r => r.semester === 'HK1');
      const hk2Record = yearRecords.find(r => r.semester === 'HK2');
      const yearRecord = yearRecords.find(r => r.semester === 'CN');

      // Tính điểm trung bình từng môn theo học kỳ
      const subjectGrades = {};
      
      subjects.forEach(subject => {
        const hk1Grade = gradeSummaries.find(g => 
          String(g.subjectId._id) === String(subject._id) && g.semester === '1'
        );
        const hk2Grade = gradeSummaries.find(g => 
          String(g.subjectId._id) === String(subject._id) && g.semester === '2'
        );
        
        const hk1Avg = hk1Grade?.average ?? null;
        const hk2Avg = hk2Grade?.average ?? null;
        const yearAvg = (hk1Avg !== null && hk2Avg !== null) 
          ? (hk1Avg + hk2Avg) / 2 
          : null;

        subjectGrades[subject._id] = {
          hk1: hk1Avg,
          hk2: hk2Avg,
          year: yearAvg,
        };
      });

      // Tính điểm trung bình cả năm (chỉ các môn tính điểm TB)
      const allYearAverages = Object.values(subjectGrades)
        .map(sg => sg.year)
        .filter(avg => avg !== null);
      
      const yearAverage = allYearAverages.length > 0
        ? allYearAverages.reduce((sum, avg) => sum + avg, 0) / allYearAverages.length
        : null;

      // Tính điểm trung bình HKI và HKII
      const hk1Averages = Object.values(subjectGrades)
        .map(sg => sg.hk1)
        .filter(avg => avg !== null);
      const hk2Averages = Object.values(subjectGrades)
        .map(sg => sg.hk2)
        .filter(avg => avg !== null);
      
      const hk1Average = hk1Averages.length > 0
        ? hk1Averages.reduce((sum, avg) => sum + avg, 0) / hk1Averages.length
        : null;
      const hk2Average = hk2Averages.length > 0
        ? hk2Averages.reduce((sum, avg) => sum + avg, 0) / hk2Averages.length
        : null;

      // Xác định học lực và hạnh kiểm
      const academicLevel = yearRecord?.gpa 
        ? getAcademicLevel(yearRecord.gpa) 
        : (yearAverage ? getAcademicLevel(yearAverage) : null);
      const conduct = yearRecord?.conduct || hk2Record?.conduct || hk1Record?.conduct || null;

      // Xếp loại chung cả năm
      const overallClassification = getOverallClassification(academicLevel, conduct);

      return {
        stt: index + 1,
        studentId: student._id,
        name: student.name,
        studentCode: student.studentCode,
        subjectGrades,
        hk1Average,
        hk2Average,
        yearAverage,
        academicLevel,
        conduct,
        overallClassification,
      };
    }));

    res.json({ 
      success: true, 
      data: {
        students: gradeTable,
        subjects: subjects.map(s => ({ _id: s._id, name: s.name, code: s.code })),
        classId: homeroomClassId,
        schoolYear: targetYear,
      }
    });
  } catch (err) {
    console.error('[getHomeroomClassGrades]', err);
    res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
  }
};

// ✅ Helper: Xác định xếp loại chung cả năm
function getOverallClassification(academicLevel, conduct) {
  if (!academicLevel || !conduct) return null;
  
  // Nếu học lực Giỏi và hạnh kiểm Tốt → Giỏi
  if (academicLevel === 'Giỏi' && conduct === 'Tốt') return 'Giỏi';
  // Nếu học lực Khá và hạnh kiểm Tốt hoặc Khá → Khá
  if (academicLevel === 'Khá' && (conduct === 'Tốt' || conduct === 'Khá')) return 'Khá';
  // Nếu học lực Trung bình và hạnh kiểm từ Khá trở lên → Trung bình
  if (academicLevel === 'Trung bình' && (conduct === 'Tốt' || conduct === 'Khá' || conduct === 'Trung bình')) return 'Trung bình';
  // Còn lại → Yếu
  return 'Yếu';
}

exports.getGradesAndClassesByYear = async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Thiếu tham số year" });
    }

    // 🔍 Lấy tất cả lớp theo niên khóa
    const classes = await Class.find({ year })
      .populate("teacherId", "name")
      .populate("students", "name studentCode grade")
      .sort({ grade: 1, className: 1 });

    // 🔹 Gom nhóm theo khối
    const grouped = {};
    classes.forEach((cls) => {
      if (!grouped[cls.grade]) grouped[cls.grade] = [];
      grouped[cls.grade].push(cls);
    });

    // 🔹 Chuyển về dạng [{ grade, classes }]
    const result = Object.entries(grouped).map(([grade, classes]) => ({
      grade,
      classes,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách lớp theo niên khóa:", error);
    res.status(500).json({ message: "Không thể tải danh sách lớp theo niên khóa" });
  }
};