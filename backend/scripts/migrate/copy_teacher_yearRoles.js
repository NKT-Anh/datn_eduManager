/**
 * Script migration: Copy current teacher boolean flags into yearRoles for a given school year.
 * Usage: node copy_teacher_yearRoles.js 2025-2026
 */
const mongoose = require('mongoose');
const Teacher = require('../../src/models/user/teacher');
require('dotenv').config();

async function run() {
  const schoolYear = process.argv[2] || process.env.SCHOOL_YEAR || null;
  if (!schoolYear) {
    console.error('Usage: node copy_teacher_yearRoles.js <schoolYear>');
    process.exit(1);
  }

  const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/datn';
  await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', mongoUrl);

  const teachers = await Teacher.find({});
  let updated = 0;

  for (const t of teachers) {
    // Nếu đã có entry cho schoolYear, skip
    const exists = (t.yearRoles || []).some(r => String(r.schoolYear) === String(schoolYear));
    if (exists) continue;

    const entry = {
      schoolYear,
      isHomeroom: !!t.isHomeroom,
      isDepartmentHead: !!t.isDepartmentHead,
      isLeader: !!t.isLeader,
      permissions: t.permissions || [],
      currentHomeroomClassId: t.currentHomeroomClassId || null
    };

    t.yearRoles = t.yearRoles || [];
    t.yearRoles.push(entry);
    await t.save();
    updated++;
  }

  console.log(`Migration finished. Updated ${updated} teachers.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(2);
});
