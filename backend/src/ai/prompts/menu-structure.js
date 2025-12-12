/**
 * Menu Structure - Cấu trúc menu theo từng role
 * Được extract từ AppSidebar.tsx để AI có thể hướng dẫn sử dụng hệ thống
 */

const menuStructure = {
  student: {
    role: 'Học sinh',
    prefix: '/student',
    menu: [
      {
        group: 'Điều hướng',
        items: [
          { title: 'Trang chủ', url: '/student/home', description: 'Trang chủ của học sinh' }
        ]
      },
      {
        group: 'Học tập',
        items: [
          { title: 'Thời khóa biểu', url: '/student/schedule', description: 'Xem lịch học hàng tuần' },
          { title: 'Điểm số', url: '/student/grades', description: 'Xem điểm các môn học' },
          { title: 'Hạnh kiểm', url: '/student/conduct', description: 'Xem hạnh kiểm' },
          { title: 'Điểm danh', url: '/student/attendance', description: 'Xem lịch sử điểm danh' },
          { 
            title: 'Kỳ thi', 
            url: '/student/exams',
            children: [
              { title: 'Lịch thi', url: '/student/exams/student-schedule', description: 'Xem lịch thi và phòng thi' },
              { title: 'Điểm thi', url: '/student/exams/grades-search', description: 'Xem điểm thi' }
            ]
          },
          { title: 'Khảo sát đánh giá', url: '/student/surveys', description: 'Tham gia khảo sát đánh giá môn học' }
        ]
      },
      {
        group: 'Giao tiếp',
        items: [
          { title: 'Thông báo', url: '/student/notifications', description: 'Xem thông báo từ trường, giáo viên' }
        ]
      },
      {
        group: 'Cá nhân',
        items: [
          { title: 'Hồ sơ', url: '/student/profile', description: 'Xem và cập nhật thông tin cá nhân' }
        ]
      }
    ]
  },
  gvbm: {
    role: 'Giáo viên Bộ môn',
    prefix: '/gvbm',
    menu: [
      {
        group: 'Điều hướng',
        items: [
          { title: 'Trang chủ', url: '/gvbm/home', description: 'Trang chủ giáo viên' }
        ]
      },
      {
        group: 'Giảng dạy',
        items: [
          { title: 'Lớp đang dạy', url: '/gvbm/my-classes', description: 'Xem danh sách lớp đang dạy' },
          { title: 'Thời khóa biểu', url: '/gvbm/schedule', description: 'Xem lịch dạy' },
          { title: 'Lịch theo tuần', url: '/gvbm/schedule-weekly', description: 'Xem lịch dạy theo tuần' },
          { title: 'Lịch rảnh', url: '/gvbm/availability', description: 'Cập nhật lịch rảnh' },
          { title: 'Nhập điểm', url: '/gvbm/grades', description: 'Nhập điểm cho học sinh' },
          { title: 'Danh hiệu / Khen thưởng', url: '/gvbm/awards', description: 'Quản lý danh hiệu, khen thưởng' },
          { title: 'Thống kê khảo sát', url: '/gvbm/survey-statistics', description: 'Xem thống kê khảo sát môn học' }
        ]
      },
      {
        group: 'Kỳ thi',
        items: [
          { title: 'Lịch coi thi', url: '/gvbm/exams/supervisor-schedule', description: 'Xem lịch coi thi' },
          { title: 'Phòng thi đảm nhận', url: '/gvbm/exams/supervisor-rooms', description: 'Xem phòng thi được phân công' },
          { title: 'Nhập điểm thi', url: '/gvbm/exams/enter-grades', description: 'Nhập điểm thi cho học sinh' }
        ]
      },
      {
        group: 'Giao tiếp',
        items: [
          { title: 'Thông báo', url: '/gvbm/notifications', description: 'Xem và gửi thông báo' }
        ]
      },
      {
        group: 'Khác',
        items: [
          { title: 'Môn giảng dạy', url: '/gvbm/teaching-subjects', description: 'Xem các môn đang dạy' }
        ]
      },
      {
        group: 'Cá nhân',
        items: [
          { title: 'Hồ sơ', url: '/gvbm/profile', description: 'Xem và cập nhật thông tin cá nhân' }
        ]
      }
    ]
  },
  gvcn: {
    role: 'Giáo viên Chủ nhiệm',
    prefix: '/gvcn',
    menu: [
      {
        group: 'Điều hướng',
        items: [
          { title: 'Trang chủ', url: '/gvcn/home', description: 'Trang chủ giáo viên chủ nhiệm' }
        ]
      },
      {
        group: 'Lớp chủ nhiệm',
        items: [
          { title: 'Thông tin lớp', url: '/gvcn/homeroom-class', description: 'Xem thông tin lớp chủ nhiệm' },
          { title: 'Học sinh', url: '/gvcn/students', description: 'Xem danh sách học sinh lớp chủ nhiệm' },
          { title: 'Bảng điểm lớp CN', url: '/gvcn/homeroom-grades', description: 'Xem bảng điểm lớp chủ nhiệm' },
          { title: 'Điểm danh', url: '/gvcn/attendance', description: 'Điểm danh học sinh' },
          { title: 'Hạnh kiểm', url: '/gvcn/conduct', description: 'Quản lý hạnh kiểm học sinh' },
          { title: 'Thời khóa biểu lớp CN', url: '/gvcn/homeroom-schedule', description: 'Xem thời khóa biểu lớp chủ nhiệm' }
        ]
      },
      {
        group: 'Giảng dạy',
        items: [
          { title: 'Lớp đang dạy', url: '/gvcn/my-classes', description: 'Xem danh sách lớp đang dạy' },
          { title: 'Thời khóa biểu', url: '/gvcn/schedule', description: 'Xem lịch dạy' },
          { title: 'Lịch rảnh', url: '/gvcn/availability', description: 'Cập nhật lịch rảnh' },
          { title: 'Nhập điểm', url: '/gvcn/grades', description: 'Nhập điểm cho học sinh' },
          { title: 'Danh hiệu / Khen thưởng', url: '/gvcn/awards', description: 'Quản lý danh hiệu, khen thưởng' },
          { title: 'Thống kê khảo sát', url: '/gvcn/survey-statistics', description: 'Xem thống kê khảo sát môn học' }
        ]
      },
      {
        group: 'Kỳ thi',
        items: [
          { title: 'Lịch coi thi', url: '/gvcn/exams/supervisor-schedule', description: 'Xem lịch coi thi' },
          { title: 'Phòng thi đảm nhận', url: '/gvcn/exams/supervisor-rooms', description: 'Xem phòng thi được phân công' },
          { title: 'Nhập điểm thi', url: '/gvcn/exams/enter-grades', description: 'Nhập điểm thi cho học sinh' }
        ]
      },
      {
        group: 'Giao tiếp',
        items: [
          { title: 'Thông báo', url: '/gvcn/notifications', description: 'Xem và gửi thông báo cho lớp chủ nhiệm' }
        ]
      },
      {
        group: 'Cá nhân',
        items: [
          { title: 'Hồ sơ', url: '/gvcn/profile', description: 'Xem và cập nhật thông tin cá nhân' }
        ]
      }
    ]
  },
  qlbm: {
    role: 'Quản lý Bộ môn',
    prefix: '/qlbm',
    menu: [
      {
        group: 'Điều hướng',
        items: [
          { title: 'Trang chủ', url: '/qlbm/dashboard', description: 'Trang chủ quản lý bộ môn' }
        ]
      },
      {
        group: 'Quản lý Bộ Môn',
        items: [
          { title: 'Danh sách tổ bộ môn', url: '/qlbm/departments', description: 'Xem danh sách tổ bộ môn' },
          { title: 'Danh sách giáo viên trong Tổ', url: '/qlbm/teachers', description: 'Xem danh sách giáo viên trong tổ' },
          { title: 'Đề xuất phân công', url: '/qlbm/proposals', description: 'Tạo và quản lý đề xuất phân công giảng dạy' },
          { title: 'Xem phân công', url: '/qlbm/teaching-assignments', description: 'Xem phân công giảng dạy của tổ' }
        ]
      },
      {
        group: 'Giảng dạy',
        items: [
          { title: 'Lớp đang dạy', url: '/qlbm/my-classes', description: 'Xem danh sách lớp đang dạy' },
          { title: 'Thời khóa biểu', url: '/qlbm/schedule', description: 'Xem lịch dạy' },
          { title: 'Lịch rảnh', url: '/qlbm/availability', description: 'Cập nhật lịch rảnh' },
          { title: 'Nhập điểm', url: '/qlbm/grades', description: 'Nhập điểm cho học sinh' },
          { title: 'Danh hiệu / Khen thưởng', url: '/qlbm/awards', description: 'Quản lý danh hiệu, khen thưởng' },
          { title: 'Thống kê khảo sát', url: '/qlbm/survey-statistics', description: 'Xem thống kê khảo sát môn học' }
        ]
      },
      {
        group: 'Kỳ thi',
        items: [
          { title: 'Danh sách kỳ thi', url: '/qlbm/exams', description: 'Xem danh sách kỳ thi' },
          { title: 'Lịch coi thi', url: '/qlbm/exams/supervisor-schedule', description: 'Xem lịch coi thi' },
          { title: 'Phòng thi đảm nhận', url: '/qlbm/exams/supervisor-rooms', description: 'Xem phòng thi được phân công' },
          { title: 'Nhập điểm thi', url: '/qlbm/exams/enter-grades', description: 'Nhập điểm thi cho học sinh' }
        ]
      },
      {
        group: 'Giao tiếp',
        items: [
          { title: 'Thông báo', url: '/qlbm/notifications', description: 'Xem và gửi thông báo cho tổ bộ môn' }
        ]
      },
      {
        group: 'Cá nhân',
        items: [
          { title: 'Hồ sơ', url: '/qlbm/profile', description: 'Xem và cập nhật thông tin cá nhân' }
        ]
      }
    ]
  },
  bgh: {
    role: 'Ban Giám Hiệu',
    prefix: '/bgh',
    menu: [
      {
        group: 'Điều hướng',
        items: [
          { title: 'Trang chủ', url: '/bgh/home', description: 'Trang chủ ban giám hiệu' }
        ]
      },
      {
        group: 'Thông tin',
        items: [
          {
            title: 'Người dùng',
            children: [
              { title: 'Học sinh', url: '/bgh/students', description: 'Xem danh sách học sinh' },
              { title: 'Giáo viên', url: '/bgh/teachers', description: 'Xem danh sách giáo viên' }
            ]
          },
          {
            title: 'Cơ sở',
            children: [
              { title: 'Năm học', url: '/bgh/school-years', description: 'Xem năm học' },
              { title: 'Lớp học', url: '/bgh/classes', description: 'Xem danh sách lớp học' },
              { title: 'Môn học', url: '/bgh/subjects', description: 'Xem danh sách môn học' },
              { title: 'Phòng học', url: '/bgh/rooms', description: 'Xem danh sách phòng học' }
            ]
          }
        ]
      },
      {
        group: 'Giảng dạy',
        items: [
          {
            title: 'Giảng dạy',
            children: [
              { title: 'Phân công giảng dạy', url: '/bgh/teachingAssignmentPage', description: 'Xem phân công giảng dạy' },
              { title: 'Thời khóa biểu', url: '/bgh/schedule', description: 'Xem thời khóa biểu' },
              { title: 'Lịch sử đề xuất', url: '/bgh/proposal-history', description: 'Xem lịch sử đề xuất phân công' },
              { title: 'Dashboard khảo sát', url: '/bgh/survey-dashboard', description: 'Xem thống kê khảo sát' }
            ]
          }
        ]
      },
      {
        group: 'Học tập',
        items: [
          {
            title: 'Học tập',
            children: [
              { title: 'Điểm số', url: '/bgh/grades', description: 'Xem điểm số học sinh' },
              { title: 'Hạnh kiểm', url: '/bgh/conduct', description: 'Xem hạnh kiểm học sinh' }
            ]
          }
        ]
      },
      {
        group: 'Kỳ thi',
        items: [
          {
            title: 'Kỳ thi',
            children: [
              { title: 'Danh sách kỳ thi', url: '/bgh/exam/exam-list', description: 'Xem danh sách kỳ thi' },
              { title: 'Lịch thi', url: '/bgh/exam/schedule', description: 'Xem lịch thi' },
              { title: 'DashBoard', url: '/bgh/exam/exam-dashboard', description: 'Xem dashboard kỳ thi' }
            ]
          }
        ]
      },
      {
        group: 'Giao tiếp',
        items: [
          { title: 'Thông báo', url: '/bgh/notifications', description: 'Xem thông báo' },
          { title: 'Gửi email hàng loạt', url: '/bgh/send-email', description: 'Gửi email cho nhiều người' },
          { title: 'Thống kê email', url: '/bgh/email-stats', description: 'Xem thống kê email đã gửi' }
        ]
      },
      {
        group: 'Cá nhân',
        items: [
          { title: 'Hồ sơ', url: '/bgh/profile', description: 'Xem và cập nhật thông tin cá nhân' },
          { title: 'Cài đặt', url: '/bgh/settings', description: 'Cài đặt hệ thống' }
        ]
      }
    ]
  },
  admin: {
    role: 'Quản trị viên',
    prefix: '/admin',
    menu: [
      {
        group: 'Điều hướng',
        items: [
          { title: 'Trang chủ', url: '/admin/home', description: 'Trang chủ quản trị viên' }
        ]
      },
      {
        group: 'Quản lý',
        items: [
          {
            title: 'Người dùng',
            children: [
              { title: 'Học sinh', url: '/admin/students', description: 'Quản lý học sinh' },
              { title: 'Giáo viên', url: '/admin/teachers', description: 'Quản lý giáo viên' },
              { title: 'Tổ bộ môn', url: '/admin/departments', description: 'Quản lý tổ bộ môn' },
              { title: 'Tạo tài khoản', url: '/admin/batch', description: 'Tạo tài khoản hàng loạt' },
              { title: 'Phân quyền', url: '/admin/permissions', description: 'Quản lý phân quyền người dùng' },
              { title: 'Phân quyền hệ thống', url: '/admin/role-permissions', description: 'Cấu hình phân quyền theo role' }
            ]
          },
          {
            title: 'Cơ sở',
            children: [
              { title: 'Năm học', url: '/admin/school-years', description: 'Quản lý năm học' },
              { title: 'Lớp học', url: '/admin/classes', description: 'Quản lý lớp học' },
              { title: 'Môn học', url: '/admin/subjects', description: 'Quản lý môn học' },
              { title: 'Phòng học', url: '/admin/rooms', description: 'Quản lý phòng học' }
            ]
          },
          {
            title: 'Giảng dạy',
            children: [
              { title: 'Phân công giảng dạy', url: '/admin/teachingAssignmentPage', description: 'Quản lý phân công giảng dạy' },
              { title: 'Lịch sử đề xuất', url: '/admin/proposal-history', description: 'Xem và xử lý đề xuất phân công' },
              { title: 'Thời khóa biểu', url: '/admin/schedule', description: 'Quản lý thời khóa biểu' },
              { title: 'Thời khóa biểu new', url: '/admin/scheduleNew', description: 'Tạo thời khóa biểu mới' },
              { title: 'Lịch trống giáo viên', url: '/admin/availability', description: 'Xem lịch rảnh giáo viên' },
              { title: 'Phân bổ số tiết theo lớp', url: '/admin/class-periods', description: 'Cấu hình số tiết môn học theo lớp' }
            ]
          },
          {
            title: 'Điểm số',
            children: [
              { title: 'Bảng điểm', url: '/admin/grades', description: 'Quản lý điểm số' },
              { title: 'Quản lý hạnh kiểm', url: '/admin/conduct', description: 'Quản lý hạnh kiểm học sinh' },
              { title: 'Điểm danh', url: '/admin/attendance', description: 'Quản lý điểm danh' },
              { title: 'Cấu hình điểm', url: '/admin/grade-config', description: 'Cấu hình hệ số điểm, loại điểm' },
              { title: 'Khởi tạo bảng điểm', url: '/admin/init-grades', description: 'Khởi tạo bảng điểm cho học kỳ mới' }
            ]
          },
          {
            title: 'Kỳ thi',
            children: [
              { title: 'Danh sách kỳ thi', url: '/admin/exam/exam-list', description: 'Quản lý kỳ thi' },
              { title: 'Lịch thi', url: '/admin/exam/schedule', description: 'Quản lý lịch thi' },
              { title: 'Phân phòng thi', url: '/admin/exam/room-assignment', description: 'Phân phòng thi cho học sinh' },
              { title: 'Phân công giám thị', url: '/admin/exam/supervisor-assignment', description: 'Phân công giáo viên coi thi' },
              { title: 'Điểm thi', url: '/admin/exam/grades-search', description: 'Quản lý điểm thi' },
              { title: 'DashBoard', url: '/admin/exam/exam-dashboard', description: 'Dashboard kỳ thi' }
            ]
          },
          {
            title: 'Khảo sát',
            children: [
              { title: 'Quản lý khảo sát', url: '/admin/surveyss', description: 'Quản lý khảo sát đánh giá môn học' },
              { title: 'Dashboard Khảo sát', url: '/admin/surveys/dashboard', description: 'Xem thống kê khảo sát' },
              { title: 'Danh hiệu / Khen thưởng', url: '/admin/awards', description: 'Quản lý danh hiệu, khen thưởng' }
            ]
          },
          {
            title: 'Giao tiếp',
            children: [
              { title: 'Thông báo', url: '/admin/notifications', description: 'Quản lý thông báo' },
              { title: 'Gửi email hàng loạt', url: '/admin/send-email', description: 'Gửi email cho nhiều người' },
              { title: 'Lịch sử email', url: '/admin/email-history', description: 'Xem lịch sử email đã gửi' }
            ]
          }
        ]
      },
      {
        group: 'Thống kê & Báo cáo',
        items: [
          { title: 'Dashboard Thống kê', url: '/admin/statistics', description: 'Xem thống kê tổng quan' },
          { title: 'Thống kê điểm số', url: '/admin/grades-statistics', description: 'Xem thống kê điểm số' },
          { title: 'Thống kê kỳ thi', url: '/admin/exam/exam-dashboard', description: 'Xem thống kê kỳ thi' },
          { title: 'Thống kê điểm danh', url: '/admin/attendance', description: 'Xem thống kê điểm danh' },
          { title: 'Dashboard Khảo sát', url: '/admin/surveys/dashboard', description: 'Xem thống kê khảo sát' }
        ]
      },
      {
        group: 'Giám sát',
        items: [
          { title: 'Log hoạt động', url: '/admin/audit-logs', description: 'Xem log hoạt động của người dùng' },
          { title: 'Thùng rác', url: '/admin/trash', description: 'Xem dữ liệu đã xóa' }
        ]
      },
      {
        group: 'Cá nhân',
        items: [
          { title: 'Hồ sơ', url: '/admin/profile', description: 'Xem và cập nhật thông tin cá nhân' },
          { title: 'Cài đặt', url: '/admin/settings', description: 'Cài đặt hệ thống' }
        ]
      }
    ]
  }
};

/**
 * Lấy menu structure theo role
 */
function getMenuStructure(role) {
  return menuStructure[role] || menuStructure.student;
}

/**
 * Format menu structure thành text để đưa vào prompt
 */
function formatMenuForPrompt(role) {
  const menu = getMenuStructure(role);
  let text = `\n\n**CẤU TRÚC MENU HỆ THỐNG CHO ${menu.role.toUpperCase()}:**\n\n`;
  
  menu.menu.forEach((group, groupIdx) => {
    text += `**${group.group}:**\n`;
    group.items.forEach((item, itemIdx) => {
      if (item.children) {
        text += `- **${item.title}:**\n`;
        item.children.forEach((child, childIdx) => {
          text += `  ${childIdx + 1}. ${child.title} (${child.url}): ${child.description}\n`;
        });
      } else {
        text += `${itemIdx + 1}. **${item.title}** (${item.url}): ${item.description}\n`;
      }
    });
    text += '\n';
  });
  
  text += `\n**Hướng dẫn sử dụng:**\n`;
  text += `- Khi học sinh/giáo viên/admin hỏi về cách sử dụng hệ thống, hãy dựa vào menu structure trên để hướng dẫn\n`;
  text += `- Gợi ý các chức năng phù hợp với role của họ\n`;
  text += `- Chỉ hướng dẫn các chức năng mà role đó có quyền truy cập\n`;
  text += `- Khi hướng dẫn, hãy nói rõ đường dẫn (URL) để người dùng có thể truy cập\n`;
  
  return text;
}

module.exports = {
  getMenuStructure,
  formatMenuForPrompt,
  menuStructure
};

