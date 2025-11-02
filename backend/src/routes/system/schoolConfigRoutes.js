const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/authMiddleware");

router.get("/school-years", authMiddleware, (req, res) => {
  const schoolYears = [
    { code: "2023-2024", name: "Năm học 2023 - 2024" },
    { code: "2024-2025", name: "Năm học 2024 - 2025" },
    { code: "2025-2026", name: "Năm học 2025 - 2026" },
    { code: "2026-2027", name: "Năm học 2026 - 2027" },
  ];
  res.json(schoolYears);
});

router.get("/semesters", authMiddleware, (req, res) => {
  const semesters = [
    { code: "1", name: "Học kỳ 1" },
    { code: "2", name: "Học kỳ 2" },
  ];
  res.json(semesters);
});

module.exports = router;
