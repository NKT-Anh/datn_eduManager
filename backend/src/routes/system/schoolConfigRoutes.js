const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/authMiddleware");

// === NĂM HỌC ===
router.get("/school-years", authMiddleware, (req, res) => {
  const schoolYears = [
    { code: "2023-2024", name: "Năm học 2023 - 2024" },
    { code: "2024-2025", name: "Năm học 2024 - 2025" },
    { code: "2025-2026", name: "Năm học 2025 - 2026" },
    { code: "2026-2027", name: "Năm học 2026 - 2027" },
  ];
  res.json(schoolYears);
});

// === HỌC KỲ ===
router.get("/semesters", authMiddleware, (req, res) => {
  const semesters = [
    { code: "1", name: "Học kỳ 1" },
    { code: "2", name: "Học kỳ 2" },
  ];
  res.json(semesters);
});

// === KHỐI HỌC ===
router.get("/grades", authMiddleware, (req, res) => {
  const grades = [
    { code: "10", name: "Khối 10" },
    { code: "11", name: "Khối 11" },
    { code: "12", name: "Khối 12" },
  ];
  res.json(grades);
});

module.exports = router;
