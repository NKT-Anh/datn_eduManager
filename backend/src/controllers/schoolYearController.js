const SchoolYear = require('../models/schoolYear');
const Setting = require('../models/settings');
const { getCurrentSchoolYear } = require('../utils/schoolYearHelper');

/**
 * 🔄 Tính trạng thái năm học dựa vào ngày hiện tại
 * - upcoming: Chưa tới ngày bắt đầu
 * - active: Đang trong khoảng thời gian năm học
 * - inactive: Đã qua ngày kết thúc
 */
const calculateSchoolYearStatus = (startDate, endDate) => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Reset time để so sánh chỉ theo ngày
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (now < start) {
    return 'upcoming';
  } else if (now >= start && now <= end) {
    return 'active';
  } else {
    return 'inactive';
  }
};

/**
 * 📋 Lấy danh sách tất cả năm học
 * Tự động cập nhật trạng thái học kỳ và năm học dựa vào ngày hiện tại
 */
exports.getAllSchoolYears = async (req, res) => {
  try {
    const schoolYears = await SchoolYear.find({}).sort({ code: -1 }); // Sắp xếp mới nhất trước
    
    // Tự động cập nhật trạng thái cho tất cả năm học và học kỳ
    for (const schoolYear of schoolYears) {
      let updated = false;
      
      // Cập nhật trạng thái năm học
      // Nếu isActive = true, tự động set status = 'active' (không tính theo ngày)
      // Nếu isActive = false, tính dựa vào ngày hiện tại
      if (schoolYear.isActive) {
        if (schoolYear.status !== 'active') {
          schoolYear.status = 'active';
          updated = true;
        }
      } else {
        const newYearStatus = calculateSchoolYearStatus(schoolYear.startDate, schoolYear.endDate);
        if (schoolYear.status !== newYearStatus) {
          schoolYear.status = newYearStatus;
          updated = true;
        }
      }
      
      // Không tự động cập nhật trạng thái học kỳ - chỉ cho phép set thủ công
      
      if (updated) {
        await schoolYear.save();
      }
    }
    
    // Reload để lấy dữ liệu mới nhất
    const updatedSchoolYears = await SchoolYear.find({}).sort({ code: -1 });
    
    res.json({
      success: true,
      data: updatedSchoolYears,
      count: updatedSchoolYears.length
    });
  } catch (error) {
    console.error('❌ Lỗi getAllSchoolYears:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy danh sách năm học',
      error: error.message 
    });
  }
};

/**
 * 🔍 Lấy chi tiết một năm học
 */
exports.getSchoolYearById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolYear = await SchoolYear.findById(id);
    
    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy năm học'
      });
    }

    res.json({
      success: true,
      data: schoolYear
    });
  } catch (error) {
    console.error('❌ Lỗi getSchoolYearById:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin năm học',
      error: error.message
    });
  }
};

/**
 * ➕ Tạo năm học mới
 */
exports.createSchoolYear = async (req, res) => {
  try {
    const { name, code, startDate, endDate, semesters, isActive } = req.body;

    // Validation
    if (!name || !code || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Tên, mã, ngày bắt đầu và ngày kết thúc năm học là bắt buộc'
      });
    }

    // Validate format code: YYYY-YYYY
    const codePattern = /^\d{4}-\d{4}$/;
    if (!codePattern.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Mã năm học phải có định dạng YYYY-YYYY (VD: 2024-2025)'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'Ngày kết thúc phải sau ngày bắt đầu'
      });
    }

    // Kiểm tra code đã tồn tại chưa
    const existing = await SchoolYear.findOne({ code });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Năm học với mã ${code} đã tồn tại`
      });
    }

    // Ràng buộc: Nếu set isActive = true, tắt tất cả năm học khác (không được có 2 năm học active cùng lúc)
    if (isActive) {
      await SchoolYear.updateMany({}, { isActive: false });
      
      // Tự động đổi trạng thái sang "active" khi kích hoạt
      // status sẽ được set sau khi tạo
      
      // Cập nhật currentSchoolYear trong Settings
      const setting = await Setting.findOne({});
      if (setting) {
        setting.currentSchoolYear = code;
        await setting.save();
      }
    }

    // Tự động tính trạng thái năm học
    // Nếu kích hoạt, tự động set status = 'active', nếu không thì tính dựa vào ngày
    const status = isActive ? 'active' : calculateSchoolYearStatus(start, end);

    // Xử lý semesters (không có status)
    const processedSemesters = (semesters || []).map((semester) => {
      if (!semester.startDate || !semester.endDate) {
        console.error(`❌ Học kỳ ${semester.code} thiếu ngày bắt đầu/kết thúc`);
      }
      return {
        name: semester.name,
        code: semester.code,
        startDate: new Date(semester.startDate),
        endDate: new Date(semester.endDate),
      };
    });

    const schoolYear = await SchoolYear.create({
      name,
      code,
      startDate: start,
      endDate: end,
      semesters: processedSemesters,
      isActive: isActive || false,
      status
    });

    // ✅ Tự động tạo yearRoles cho tất cả giáo viên dựa trên năm học mới
    try {
      const Teacher = require('../models/user/teacher');
      const teachers = await Teacher.find({});
      
      for (const teacher of teachers) {
        // Đảm bảo yearRoles là array
        if (!Array.isArray(teacher.yearRoles)) {
          teacher.yearRoles = [];
        }
        
        // Kiểm tra xem đã có yearRole cho năm học này chưa
        const hasYearRole = teacher.yearRoles.some(yr => String(yr.schoolYear) === String(code));
        if (!hasYearRole) {
          // Tạo yearRole mới với giá trị mặc định
          teacher.yearRoles.push({
            schoolYear: code,
            departmentId: null,
            isHomeroom: false,
            isDepartmentHead: false,
            permissions: [],
            currentHomeroomClassId: null
          });
          await teacher.save();
        }
      }
      
      console.log(`✅ Đã tạo yearRoles cho ${teachers.length} giáo viên cho năm học ${code}`);
    } catch (err) {
      console.error('❌ Lỗi khi tạo yearRoles cho giáo viên:', err);
      // Không throw error, chỉ log để không ảnh hưởng đến việc tạo năm học
    }

    res.status(201).json({
      success: true,
      message: 'Tạo năm học thành công',
      data: schoolYear
    });
  } catch (error) {
    console.error('❌ Lỗi createSchoolYear:', error);
    
    // Lỗi duplicate key
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Mã năm học đã tồn tại'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo năm học',
      error: error.message
    });
  }
};

/**
 * ✏️ Cập nhật năm học
 */
exports.updateSchoolYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, startDate, endDate, semesters, isActive } = req.body;

    const schoolYear = await SchoolYear.findById(id);
    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy năm học'
      });
    }

    // Nếu đổi code, validate format
    if (code && code !== schoolYear.code) {
      const codePattern = /^\d{4}-\d{4}$/;
      if (!codePattern.test(code)) {
        return res.status(400).json({
          success: false,
          message: 'Mã năm học phải có định dạng YYYY-YYYY (VD: 2024-2025)'
        });
      }

      // Kiểm tra code mới đã tồn tại chưa
      const existing = await SchoolYear.findOne({ code, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Năm học với mã ${code} đã tồn tại`
        });
      }
    }

    // Validate dates nếu có
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: 'Ngày kết thúc phải sau ngày bắt đầu'
        });
      }
    }

    // Ràng buộc: Nếu set isActive = true, tắt tất cả năm học khác (không được có 2 năm học active cùng lúc)
    if (isActive && !schoolYear.isActive) {
      await SchoolYear.updateMany({ _id: { $ne: id } }, { isActive: false });
      
      // Tự động đổi trạng thái sang "active" khi kích hoạt
      // status sẽ được set sau
      
      // Cập nhật currentSchoolYear trong Settings
      const setting = await Setting.findOne({});
      if (setting) {
        setting.currentSchoolYear = code || schoolYear.code;
        await setting.save();
      }
    }

    // Cập nhật thông tin
    if (name) schoolYear.name = name;
    if (code) schoolYear.code = code;
    if (startDate) schoolYear.startDate = new Date(startDate);
    if (endDate) schoolYear.endDate = new Date(endDate);
    if (isActive !== undefined) schoolYear.isActive = isActive;

    // Tự động cập nhật trạng thái
    // Nếu kích hoạt, tự động set status = 'active'
    if (isActive && !schoolYear.isActive) {
      schoolYear.status = 'active';
    } else if (startDate || endDate) {
      // Nếu ngày thay đổi và không kích hoạt, tính lại dựa vào ngày
      const newStart = startDate ? new Date(startDate) : schoolYear.startDate;
      const newEnd = endDate ? new Date(endDate) : schoolYear.endDate;
      schoolYear.status = calculateSchoolYearStatus(newStart, newEnd);
    }

    // Cập nhật semesters (không có status)
    if (semesters !== undefined) {
      schoolYear.semesters = semesters.map((semester) => {
        return {
          name: semester.name,
          code: semester.code,
          startDate: new Date(semester.startDate),
          endDate: new Date(semester.endDate),
        };
      });
    }

    await schoolYear.save();

    res.json({
      success: true,
      message: 'Cập nhật năm học thành công',
      data: schoolYear
    });
  } catch (error) {
    console.error('❌ Lỗi updateSchoolYear:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Mã năm học đã tồn tại'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật năm học',
      error: error.message
    });
  }
};

/**
 * 🗑️ Xóa năm học
 */
exports.deleteSchoolYear = async (req, res) => {
  try {
    const { id } = req.params;

    const schoolYear = await SchoolYear.findById(id);
    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy năm học'
      });
    }

    // Không cho phép xóa năm học đang active
    if (schoolYear.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa năm học đang được kích hoạt. Vui lòng kích hoạt năm học khác trước.'
      });
    }

    // TODO: Kiểm tra xem năm học này có đang được sử dụng không (classes, exams, etc.)
    // Nếu có, không cho phép xóa hoặc cảnh báo

    await SchoolYear.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Xóa năm học thành công'
    });
  } catch (error) {
    console.error('❌ Lỗi deleteSchoolYear:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa năm học',
      error: error.message
    });
  }
};

/**
 * ✅ Kích hoạt năm học (set làm năm học hiện tại)
 */
exports.activateSchoolYear = async (req, res) => {
  try {
    const { id } = req.params;

    const schoolYear = await SchoolYear.findById(id);
    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy năm học'
      });
    }

    // Tắt tất cả năm học khác (ràng buộc: không được có 2 năm học active cùng lúc)
    await SchoolYear.updateMany({ _id: { $ne: id } }, { isActive: false });

    // Kích hoạt năm học này và tự động đổi trạng thái sang "active"
    schoolYear.isActive = true;
    schoolYear.status = 'active'; // Tự động đổi trạng thái sang "Đang diễn ra"
    
    // Không tự động cập nhật trạng thái học kỳ - chỉ cho phép set thủ công
    await schoolYear.save();

    // Cập nhật currentSchoolYear trong Settings
    const setting = await Setting.findOne({});
    if (setting) {
      setting.currentSchoolYear = schoolYear.code;
      await setting.save();
    }

    res.json({
      success: true,
      message: `Đã kích hoạt năm học ${schoolYear.name}`,
      data: schoolYear
    });
  } catch (error) {
    console.error('❌ Lỗi activateSchoolYear:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kích hoạt năm học',
      error: error.message
    });
  }
};

/**
 * 🚫 Ngừng kích hoạt năm học
 */
exports.deactivateSchoolYear = async (req, res) => {
  try {
    const { id } = req.params;

    const schoolYear = await SchoolYear.findById(id);
    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy năm học'
      });
    }

    if (!schoolYear.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Năm học này chưa được kích hoạt'
      });
    }

    // Ngừng kích hoạt
    schoolYear.isActive = false;
    await schoolYear.save();

    res.json({
      success: true,
      message: `Đã ngừng kích hoạt năm học ${schoolYear.name}`,
      data: schoolYear
    });
  } catch (error) {
    console.error('❌ Lỗi deactivateSchoolYear:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi ngừng kích hoạt năm học',
      error: error.message
    });
  }
};

/**
 * 📊 Lấy năm học hiện tại (active)
 */
exports.getCurrentSchoolYear = async (req, res) => {
  try {
    // ✅ Sử dụng utility function để lấy năm học hiện tại
    const currentYearCode = await getCurrentSchoolYear();
    
    if (!currentYearCode) {
      return res.status(404).json({
        success: false,
        message: 'Chưa có năm học nào được kích hoạt'
      });
    }

    // ✅ Lấy thông tin đầy đủ của năm học
    const currentYear = await SchoolYear.findOne({ 
      $or: [
        { isActive: true },
        { code: currentYearCode }
      ]
    });
    
    if (!currentYear) {
      return res.status(404).json({
        success: false,
        message: 'Chưa có năm học nào được kích hoạt'
      });
    }

    res.json({
      success: true,
      data: currentYear
    });
  } catch (error) {
    console.error('❌ Lỗi getCurrentSchoolYear:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy năm học hiện tại',
      error: error.message
    });
  }
};

/**
 * 🔄 Cập nhật trạng thái năm học (set thủ công)
 */
exports.updateSchoolYearStatus = async (req, res) => {
  try {
    const { id } = req.params; // ID của năm học
    const { status } = req.body; // status: 'upcoming' | 'active' | 'inactive'

    // Validate status
    const validStatuses = ['upcoming', 'active', 'inactive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Chỉ cho phép: ${validStatuses.join(', ')}`
      });
    }

    const schoolYear = await SchoolYear.findById(id);
    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy năm học'
      });
    }

    // Cập nhật trạng thái (set thủ công, không tự động tính)
    schoolYear.status = status;
    console.log(`✏️ Set thủ công trạng thái năm học ${schoolYear.code}: ${status}`);
    await schoolYear.save();

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái năm học thành ${status}`,
      data: schoolYear
    });
  } catch (error) {
    console.error('❌ Lỗi updateSchoolYearStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái năm học',
      error: error.message
    });
  }
};




