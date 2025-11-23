  ///grade-config
  
  module.exports = {
    weights: {
      oral: 1,
      quiz15: 1,
      quiz45: 2,
      midterm: 2,
      final: 3,
    },
    rounding: 'half-up', // hoặc 'none'
    // Hàm làm tròn có thể được mở rộng trong service nếu cần.
  };