// models/SchoolYear.js
const mongoose = require('mongoose');

const SchoolYearSchema = new mongoose.Schema({
  name: { type: String, required: true },        // "Năm học 2024 - 2025"
  code: { type: String, required: true, unique: true }, // "2024-2025"
  isActive: { type: Boolean, default: false },
});

module.exports = mongoose.model('SchoolYear', SchoolYearSchema);
