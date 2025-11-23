const mongoose = require('mongoose');

/**
 * ✅ Model: Đề xuất phân công giảng dạy (Proposal)
 * 
 * Workflow 2 tầng:
 * 1. Trưởng bộ môn tạo proposal (status = 'pending')
 * 2. Admin/BGH xem và quyết định áp dụng hoặc bỏ qua
 * 3. Khi Auto Assign, có thể tôn trọng proposal hoặc ghi đè
 * 4. Sau khi xác nhận → cập nhật vào TeachingAssignment chính thức
 */
const teachingAssignmentProposalSchema = new mongoose.Schema({
  // ==============================
  // Thông tin phân công
  // ==============================
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  year: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    enum: ['1', '2'],
    required: true
  },
  
  // ==============================
  // Thông tin đề xuất
  // ==============================
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'applied', 'cancelled'],
    default: 'pending'
  },
  // pending: Chờ duyệt
  // approved: Đã được duyệt (chưa áp dụng vào TKB)
  // rejected: Bị từ chối
  // applied: Đã được áp dụng vào TeachingAssignment
  // cancelled: Bị hủy
  
  proposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  
  // ==============================
  // Thông tin phê duyệt
  // ==============================
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin hoặc Teacher (BGH)
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  notes: {
    type: String
  },
  
  // ==============================
  // Thông tin áp dụng
  // ==============================
  appliedAt: {
    type: Date
  },
  teachingAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeachingAssignment',
    // ID của TeachingAssignment sau khi được áp dụng
  },
  
  // ==============================
  // Metadata
  // ==============================
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ✅ Index để tìm kiếm nhanh
teachingAssignmentProposalSchema.index({ teacherId: 1, subjectId: 1, classId: 1, year: 1, semester: 1 });
teachingAssignmentProposalSchema.index({ status: 1, proposedBy: 1 });
teachingAssignmentProposalSchema.index({ departmentId: 1, status: 1 });
teachingAssignmentProposalSchema.index({ year: 1, semester: 1 });
teachingAssignmentProposalSchema.index({ status: 1, year: 1, semester: 1 });

// ✅ Compound unique index để tránh duplicate proposal (chỉ khi status = pending hoặc approved)
teachingAssignmentProposalSchema.index(
  { teacherId: 1, subjectId: 1, classId: 1, year: 1, semester: 1 },
  { 
    unique: true,
    partialFilterExpression: { 
      status: { $in: ['pending', 'approved'] }
    }
  }
);

const TeachingAssignmentProposal = mongoose.model('TeachingAssignmentProposal', teachingAssignmentProposalSchema);

module.exports = TeachingAssignmentProposal;

