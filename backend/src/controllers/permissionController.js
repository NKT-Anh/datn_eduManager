const Permission = require('../models/permission');
const { PERMISSIONS, ROLES } = require('../config/permissions');
const Account = require('../models/user/account');

/**
 * ✅ Lấy tất cả permissions (có thể filter theo role và schoolYear)
 */
exports.getAllPermissions = async (req, res) => {
  try {
    const { role, schoolYear, isActive } = req.query;
    
    const filter = {};
    if (role) filter.role = role;
    if (schoolYear) filter.schoolYear = schoolYear;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const permissions = await Permission.find(filter)
      .populate('createdBy', 'email')
      .populate('updatedBy', 'email')
      .sort({ schoolYear: -1, role: 1 });

    res.json(permissions);
  } catch (error) {
    console.error('Error getting permissions:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách quyền', error: error.message });
  }
};

/**
 * ✅ Lấy permission theo ID
 */
exports.getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await Permission.findById(id)
      .populate('createdBy', 'email')
      .populate('updatedBy', 'email');

    if (!permission) {
      return res.status(404).json({ message: 'Không tìm thấy quyền' });
    }

    res.json(permission);
  } catch (error) {
    console.error('Error getting permission:', error);
    res.status(500).json({ message: 'Lỗi khi lấy quyền', error: error.message });
  }
};

/**
 * ✅ Lấy permission theo role và schoolYear
 */
exports.getPermissionByRoleAndYear = async (req, res) => {
  try {
    const { role, schoolYear } = req.params;
    
    if (!role || !schoolYear) {
      return res.status(400).json({ message: 'Thiếu role hoặc schoolYear' });
    }

    let permission = await Permission.findOne({ role, schoolYear });

    // ✅ Nếu không tìm thấy, trả về quyền mặc định từ ROLE_PERMISSIONS
    if (!permission) {
      const { ROLE_PERMISSIONS } = require('../config/permissions');
      const defaultPermissions = ROLE_PERMISSIONS[role] || [];
      
      return res.json({
        role,
        schoolYear,
        permissions: defaultPermissions,
        description: `Quyền mặc định cho ${role}`,
        isActive: true,
        isDefault: true
      });
    }

    res.json(permission);
  } catch (error) {
    console.error('Error getting permission by role and year:', error);
    res.status(500).json({ message: 'Lỗi khi lấy quyền', error: error.message });
  }
};

/**
 * ✅ Tạo permission mới
 */
exports.createPermission = async (req, res) => {
  try {
    const { role, schoolYear, permissions, description, isActive } = req.body;
    const account = await Account.findOne({ uid: req.user.uid });

    if (!account) {
      return res.status(401).json({ message: 'Không tìm thấy tài khoản' });
    }

    // ✅ CHỈ ADMIN MỚI ĐƯỢC TẠO PERMISSIONS
    if (account.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin mới được tạo quyền' });
    }

    // Validation
    if (!role || !schoolYear || !Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Thiếu role, schoolYear hoặc permissions' });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ message: 'Role không hợp lệ' });
    }

    // ✅ Validate permissions
    const validPermissions = Object.values(PERMISSIONS);
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({ 
        message: `Các quyền không hợp lệ: ${invalidPermissions.join(', ')}` 
      });
    }

    // ✅ Kiểm tra xem đã có permission cho role và schoolYear này chưa
    const existing = await Permission.findOne({ role, schoolYear });
    if (existing) {
      return res.status(400).json({ 
        message: `Đã tồn tại quyền cho role ${role} và năm học ${schoolYear}` 
      });
    }

    const permission = await Permission.create({
      role,
      schoolYear,
      permissions: [...new Set(permissions)], // Loại bỏ trùng lặp
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: account._id,
      updatedBy: account._id
    });

    res.status(201).json(permission);
  } catch (error) {
    console.error('Error creating permission:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Đã tồn tại quyền cho role và năm học này' });
    }
    res.status(500).json({ message: 'Lỗi khi tạo quyền', error: error.message });
  }
};

/**
 * ✅ Cập nhật permission
 */
exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, description, isActive } = req.body;
    const account = await Account.findOne({ uid: req.user.uid });

    if (!account) {
      return res.status(401).json({ message: 'Không tìm thấy tài khoản' });
    }

    // ✅ CHỈ ADMIN MỚI ĐƯỢC CẬP NHẬT PERMISSIONS
    if (account.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin mới được cập nhật quyền' });
    }

    const permission = await Permission.findById(id);
    if (!permission) {
      return res.status(404).json({ message: 'Không tìm thấy quyền' });
    }

    // ✅ Validate permissions nếu có
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: 'Permissions phải là mảng' });
      }

      const validPermissions = Object.values(PERMISSIONS);
      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        return res.status(400).json({ 
          message: `Các quyền không hợp lệ: ${invalidPermissions.join(', ')}` 
        });
      }

      permission.permissions = [...new Set(permissions)]; // Loại bỏ trùng lặp
    }

    if (description !== undefined) {
      permission.description = description;
    }
    if (isActive !== undefined) {
      permission.isActive = isActive;
    }

    permission.updatedBy = account._id;
    await permission.save();

    res.json(permission);
  } catch (error) {
    console.error('Error updating permission:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật quyền', error: error.message });
  }
};

/**
 * ✅ Xóa permission
 */
exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await Account.findOne({ uid: req.user.uid });

    if (!account) {
      return res.status(401).json({ message: 'Không tìm thấy tài khoản' });
    }

    // ✅ CHỈ ADMIN MỚI ĐƯỢC XÓA PERMISSIONS
    if (account.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin mới được xóa quyền' });
    }

    const permission = await Permission.findByIdAndDelete(id);
    if (!permission) {
      return res.status(404).json({ message: 'Không tìm thấy quyền' });
    }

    res.json({ message: 'Đã xóa quyền thành công' });
  } catch (error) {
    console.error('Error deleting permission:', error);
    res.status(500).json({ message: 'Lỗi khi xóa quyền', error: error.message });
  }
};

/**
 * ✅ Sao chép permissions từ năm học này sang năm học khác
 */
exports.copyPermissionsFromYear = async (req, res) => {
  try {
    const { fromYear, toYear } = req.body;
    const account = await Account.findOne({ uid: req.user.uid });

    if (!account) {
      return res.status(401).json({ message: 'Không tìm thấy tài khoản' });
    }

    // ✅ CHỈ ADMIN MỚI ĐƯỢC SAO CHÉP PERMISSIONS
    if (account.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin mới được sao chép quyền' });
    }

    if (!fromYear || !toYear) {
      return res.status(400).json({ message: 'Thiếu fromYear hoặc toYear' });
    }

    if (fromYear === toYear) {
      return res.status(400).json({ message: 'Năm học nguồn và đích không được giống nhau' });
    }

    const sourcePermissions = await Permission.find({ schoolYear: fromYear, isActive: true });
    
    if (sourcePermissions.length === 0) {
      return res.status(404).json({ message: `Không tìm thấy quyền nào trong năm học ${fromYear}` });
    }

    const copiedPermissions = [];
    const errors = [];

    for (const sourcePerm of sourcePermissions) {
      try {
        // Kiểm tra xem đã tồn tại permission cho role và toYear chưa
        const existing = await Permission.findOne({ role: sourcePerm.role, schoolYear: toYear });
        if (existing) {
          errors.push(`Đã tồn tại quyền cho role ${sourcePerm.role} trong năm học ${toYear}`);
          continue;
        }

        const newPermission = await Permission.create({
          role: sourcePerm.role,
          schoolYear: toYear,
          permissions: sourcePerm.permissions,
          description: `${sourcePerm.description} (Sao chép từ ${fromYear})`,
          isActive: true,
          createdBy: account._id,
          updatedBy: account._id
        });

        copiedPermissions.push(newPermission);
      } catch (error) {
        errors.push(`Lỗi khi sao chép quyền cho role ${sourcePerm.role}: ${error.message}`);
      }
    }

    res.json({
      message: `Đã sao chép ${copiedPermissions.length} quyền từ ${fromYear} sang ${toYear}`,
      copied: copiedPermissions.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error copying permissions:', error);
    res.status(500).json({ message: 'Lỗi khi sao chép quyền', error: error.message });
  }
};

/**
 * ✅ Lấy tất cả role permissions (quyền cấp role, không phụ thuộc năm học)
 * GET /permissions/roles
 */
exports.getAllRolePermissions = async (req, res) => {
  try {
    const { ROLE_PERMISSIONS, ROLES, PERMISSIONS } = require('../config/permissions');
    
    // Lấy từ database (nếu có) hoặc từ config
    const rolePermissionsFromDB = await Permission.find({ 
      schoolYear: 'default',
      isActive: true 
    }).lean();
    
    const roles = Object.values(ROLES);
    const allPermissions = Object.values(PERMISSIONS);
    
    // Tạo map từ database
    const dbMap = {};
    rolePermissionsFromDB.forEach(rp => {
      dbMap[rp.role] = rp.permissions || [];
    });
    
    // Kết hợp với config
    const result = roles.map(role => {
      const dbPermissions = dbMap[role] || [];
      const configPermissions = ROLE_PERMISSIONS[role] || [];
      
      // Ưu tiên database, nếu không có thì dùng config
      const permissions = dbPermissions.length > 0 ? dbPermissions : configPermissions;
      
      return {
        role,
        roleName: role === 'admin' ? 'Quản trị viên' : 
                  role === 'teacher' ? 'Giáo viên' : 
                  role === 'student' ? 'Học sinh' : role,
        permissions: permissions,
        allPermissions: allPermissions.map(perm => ({
          key: perm,
          name: perm.split(':').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
          enabled: permissions.includes(perm)
        })),
        isFromDB: dbPermissions.length > 0,
        isDefault: dbPermissions.length === 0
      };
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting role permissions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy danh sách quyền role', 
      error: error.message 
    });
  }
};

/**
 * ✅ Cập nhật permissions cho một role
 * PUT /permissions/roles/:role
 */
exports.updateRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;
    const account = await Account.findOne({ uid: req.user.uid });

    if (!account) {
      return res.status(401).json({ 
        success: false,
        message: 'Không tìm thấy tài khoản' 
      });
    }

    // ✅ CHỈ ADMIN MỚI ĐƯỢC CẬP NHẬT ROLE PERMISSIONS
    if (account.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Chỉ admin mới được cập nhật quyền role' 
      });
    }

    // Validate role
    const { ROLES, PERMISSIONS: PERMS } = require('../config/permissions');
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: 'Role không hợp lệ' 
      });
    }

    // Validate permissions
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ 
        success: false,
        message: 'Permissions phải là mảng' 
      });
    }

    const validPermissions = Object.values(PERMS);
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: `Các quyền không hợp lệ: ${invalidPermissions.join(', ')}` 
      });
    }

    // Loại bỏ trùng lặp
    const uniquePermissions = [...new Set(permissions)];

    // Lưu vào database với schoolYear = 'default'
    let rolePermission = await Permission.findOne({ 
      role, 
      schoolYear: 'default' 
    });

    if (rolePermission) {
      rolePermission.permissions = uniquePermissions;
      rolePermission.updatedBy = account._id;
      rolePermission.isActive = true;
      await rolePermission.save();
    } else {
      rolePermission = await Permission.create({
        role,
        schoolYear: 'default',
        permissions: uniquePermissions,
        description: `Quyền hệ thống cho role ${role}`,
        isActive: true,
        createdBy: account._id,
        updatedBy: account._id
      });
    }

    res.json({
      success: true,
      message: `Đã cập nhật quyền cho role ${role} thành công`,
      data: rolePermission
    });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi cập nhật quyền role', 
      error: error.message 
    });
  }
};

/**
 * ✅ Reset permissions về mặc định từ config
 * POST /permissions/roles/:role/reset
 */
exports.resetRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const account = await Account.findOne({ uid: req.user.uid });

    if (!account) {
      return res.status(401).json({ 
        success: false,
        message: 'Không tìm thấy tài khoản' 
      });
    }

    // ✅ CHỈ ADMIN MỚI ĐƯỢC RESET ROLE PERMISSIONS
    if (account.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Chỉ admin mới được reset quyền role' 
      });
    }

    // Validate role
    const { ROLES, ROLE_PERMISSIONS } = require('../config/permissions');
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: 'Role không hợp lệ' 
      });
    }

    const defaultPermissions = ROLE_PERMISSIONS[role] || [];

    // Xóa permission từ database (nếu có)
    await Permission.deleteOne({ 
      role, 
      schoolYear: 'default' 
    });

    res.json({
      success: true,
      message: `Đã reset quyền cho role ${role} về mặc định`,
      data: {
        role,
        permissions: defaultPermissions
      }
    });
  } catch (error) {
    console.error('Error resetting role permissions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi reset quyền role', 
      error: error.message 
    });
  }
};



