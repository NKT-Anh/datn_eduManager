const User = require('../../models/user/user');
const Class = require('../../models/class/class');
const Student = require('../../models/user/student');
const mongoose = require('mongoose');

exports.getAllClasses = async (req, res) => {
  try {
    const cls = await Class.find()
      .populate('teacherId', 'name')
      .populate('students', 'name studentCode').sort({ grade: 1, className: 1 });
    res.json(cls);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách lớp' });
  }
};

exports.getClassById = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('teacherId', 'name')
      .populate('students', 'name studentCode');
    if (!cls) return res.status(404).json({ message: 'Không tìm thấy lớp' });
    res.json(cls);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy lớp' });
  }
};

exports.createClass = async (req, res) => {
  try {
    const { className, year, grade, capacity, teacherId } = req.body;
    const classCode = `${year}-${className}`;

    // 🔹 Kiểm tra lớp trùng
    const existing = await Class.findOne({ classCode });
    if (existing) return res.status(400).json({ message: 'Đã tồn tại lớp này' });

    // 🔹 Nếu có chọn giáo viên thì kiểm tra xem giáo viên đó đã là GVCN của lớp nào trong cùng năm chưa
    if (teacherId) {
      const teacherUsed = await Class.findOne({ teacherId, year });
      if (teacherUsed) {
        return res.status(400).json({
          message: `Giáo viên này đã là GVCN của lớp ${teacherUsed.className} (${teacherUsed.year})`,
        });
      }
    }

    const newClass = await Class.create({
      classCode,
      className,
      year,
      grade,
      capacity,
      currentSize: 0,
      teacherId: teacherId || null,
    });

    res.status(201).json(newClass);
  } catch (error) {
    console.error('[createClass]', error);
    res.status(500).json({ message: 'Không thể tạo lớp' });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { teacherId, year } = req.body;
    const classId = req.params.id;

    // 🔹 Nếu có chọn giáo viên, kiểm tra trùng lớp chủ nhiệm trong cùng năm
    if (teacherId) {
      const teacherUsed = await Class.findOne({
        teacherId,
        year,
        _id: { $ne: classId }, // loại trừ chính lớp đang cập nhật
      });

      if (teacherUsed) {
        return res.status(400).json({
          message: `Giáo viên này đã là GVCN của lớp ${teacherUsed.className} (${teacherUsed.year})`,
        });
      }
    }

    const cls = await Class.findByIdAndUpdate(classId, req.body, { new: true });
    if (!cls) return res.status(404).json({ message: 'Không tìm thấy lớp' });

    res.json(cls);
  } catch (error) {
    console.error('[updateClass]', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật lớp' });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const cls = await Class.findByIdAndDelete(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Không tìm thấy id lớp' });
    res.json({ message: 'Đã xóa lớp thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi deleteClass' });
  }
};

exports.joinClass = async (req, res) => {
  const { userId, classCode } = req.body;
  console.log('Join class input:', { userId, classCode });
  try {
    const classObj = await Class.findOne({ classCode });
    if (!classObj) {
      return res.status(404).json({ message: 'Class code not found' });
    }
    await User.findByIdAndUpdate(userId, { classId: classObj._id });
    if (!classObj.students.includes(userId)) {
      classObj.students.push(userId);
      await classObj.save();
    }
    res.json({ message: 'Joined class successfully' });
    console.log(`User ${userId} joined class ${classCode}`);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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
        ci = (ci + 1) % caps.length;
      }

      const unassigned = students.length - assigned;
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
