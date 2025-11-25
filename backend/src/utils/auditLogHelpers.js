/**
 * Helper functions để lấy tên từ ID cho audit log
 */

/**
 * Mapping component code sang tên tiếng Việt
 */
const COMPONENT_LABELS = {
  'oral': 'Miệng',
  'quiz15': '15 phút',
  'quiz45': '1 tiết',
  'midterm': 'Giữa kỳ',
  'final': 'Cuối kỳ',
};

/**
 * Lấy tên component từ code
 */
function getComponentLabel(component) {
  return COMPONENT_LABELS[component] || component;
}

/**
 * Lấy tên học sinh từ ID
 */
async function getStudentName(studentId) {
  if (!studentId || studentId === 'N/A') return 'N/A';
  try {
    const Student = require('../models/user/student');
    const student = await Student.findById(studentId).select('name studentCode').lean();
    return student ? `${student.name} (${student.studentCode || ''})` : studentId;
  } catch (e) {
    return studentId;
  }
}

/**
 * Lấy tên môn học từ ID
 */
async function getSubjectName(subjectId) {
  if (!subjectId || subjectId === 'N/A') return 'N/A';
  try {
    const Subject = require('../models/subject/subject');
    const subject = await Subject.findById(subjectId).select('name code').lean();
    return subject ? subject.name : subjectId;
  } catch (e) {
    return subjectId;
  }
}

/**
 * Lấy tên lớp từ ID
 */
async function getClassName(classId) {
  if (!classId || classId === 'N/A') return 'N/A';
  try {
    const Class = require('../models/class/class');
    const classObj = await Class.findById(classId).select('className classCode').lean();
    return classObj ? classObj.className : classId;
  } catch (e) {
    return classId;
  }
}

/**
 * Lấy tên giáo viên từ ID
 */
async function getTeacherName(teacherId) {
  if (!teacherId || teacherId === 'N/A') return 'N/A';
  try {
    const Teacher = require('../models/user/teacher');
    const teacher = await Teacher.findById(teacherId).select('name').lean();
    return teacher ? teacher.name : teacherId;
  } catch (e) {
    return teacherId;
  }
}

/**
 * Lấy tên người dùng từ accountId
 */
async function getUserName(accountId) {
  if (!accountId || accountId === 'N/A') return 'N/A';
  try {
    const User = require('../models/user/user');
    const user = await User.findById(accountId).select('name email').lean();
    return user ? (user.name || user.email) : accountId;
  } catch (e) {
    return accountId;
  }
}

module.exports = {
  getStudentName,
  getSubjectName,
  getClassName,
  getTeacherName,
  getUserName,
  getComponentLabel,
  COMPONENT_LABELS,
};

