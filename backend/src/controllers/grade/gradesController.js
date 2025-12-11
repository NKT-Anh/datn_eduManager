// const { upsertGradeItem, getClassSubjectSummary, recomputeSummary } = require('../../services/gradeService');

//   // POST /grades/items
//   exports.upsertGradeItem = async (req, res) => {
//     try {
//       const item = await upsertGradeItem(req.body);
//       res.status(201).json(item);
//     } catch (err) {
//       console.error('[upsertGradeItem]', err);
//       res.status(400).json({ message: 'Không thể lưu điểm', error: err.message });
//     }
//   };

//   // GET /grades/summary?classId=&subjectId=&schoolYear=&semester=
//   exports.getClassSubjectSummary = async (req, res) => {
//     try {
//       const { classId, subjectId, schoolYear, semester } = req.query;
//       if (!classId || !subjectId || !schoolYear || !semester) {
//         return res.status(400).json({ message: 'Thiếu tham số classId/subjectId/schoolYear/semester' });
//       }
//       const data = await getClassSubjectSummary({ classId, subjectId, schoolYear, semester });
//       res.json({ count: data.length, data });
//     } catch (err) {
//       console.error('[getClassSubjectSummary]', err);
//       res.status(500).json({ message: 'Không thể lấy bảng điểm', error: err.message });
//     }
//   };

//   // POST /grades/recompute
//   // body: { studentId, subjectId, classId, schoolYear, semester }
//   exports.recomputeSummary = async (req, res) => {
//     try {
//       const summary = await recomputeSummary(req.body);
//       res.json(summary);
//     } catch (err) {
//       console.error('[recomputeSummary]', err);s
//       res.status(400).json({ message: 'Không thể tính lại điểm tổng hợp', error: err.message });
//     }
//   };

const { upsertGradeItem, getClassSubjectSummary, recomputeSummary, computeAndSaveYearGPA } = require('../../services/gradeService');
const Student = require('../../models/user/student');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const GradeSummary = require('../../models/grade/gradeSummary');
const GradeItem = require('../../models/grade/gradeItem');
const StudentYearRecord = require('../../models/user/studentYearRecord');
const Teacher = require('../../models/user/teacher');
const { calculateAcademicLevel } = require('../../services/academicLevelService');
const GradeConfig = require('../../models/grade/gradeConfig');
const Schedule = require('../../models/subject/schedule');
const puppeteer = require('puppeteer');
const archiver = require('archiver');
const Setting = require('../../models/settings');
const path = require('path');
const fs = require('fs/promises');
const http = require('http');
const https = require('https');

const SCHOOL_LOGO_CANDIDATE_PATHS = [
  path.join(__dirname, '../../public/assets/logo_school_outline.png'),
  path.join(__dirname, '../../../websiteEdu/src/assets/logo_school_outline.png'),
  path.join(process.cwd(), 'websiteEdu', 'src', 'assets', 'logo_school_outline.png'),
  path.join(process.cwd(), 'src', 'assets', 'logo_school_outline.png')
];

const localLogoCache = { base64: null, mime: 'image/png' };
const remoteLogoCache = new Map();

const REPORT_CARD_COMPONENTS = [
  { key: 'oral', label: 'KT miệng' },
  { key: 'quiz15', label: 'KT 15\'' },
  { key: 'quiz45', label: 'KT 1 tiết' },
  { key: 'midterm', label: 'KT giữa kỳ' },
  { key: 'final', label: 'KT cuối kỳ' },
  { key: 'practice', label: 'Thực hành' },
  { key: 'project', label: 'Dự án' },
  { key: 'attendance', label: 'Chuyên cần' },
  { key: 'bonus', label: 'Điểm cộng' }
];

const REPORT_CARD_SEMESTER_LABELS = {
  '1': 'Học kỳ I',
  '2': 'Học kỳ II',
  CN: 'Cả năm'
};

const SEMESTER_KEY_MAP = {
  '1': 'HK1',
  '2': 'HK2',
  CN: 'CN'
};

const LAUNCH_PUPPETEER_OPTS = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };

const formatReportScore = (value, digits = 1) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return Number(value).toFixed(digits);
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const sanitizeForFileName = (value, fallback) => {
  const input = value || fallback || 'student';
  return String(input)
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-');
};

const extractReportAverage = (summary) => {
  if (!summary) return null;
  const averages = summary.averages || {};
  const directSources = [summary.average, averages.final, averages.year];
  for (const raw of directSources) {
    if (typeof raw === 'number') return Number(raw);
  }
  const hk1 = typeof averages.hk1 === 'number' ? Number(averages.hk1) : null;
  const hk2 = typeof averages.hk2 === 'number' ? Number(averages.hk2) : null;
  if (hk1 !== null && hk2 !== null) {
    return Number(((hk1 + hk2) / 2).toFixed(2));
  }
  return hk1 ?? hk2 ?? null;
};

const classifyAcademicLevel = (avg) => {
  if (avg === null || avg === undefined) return '';
  if (avg >= 8) return 'Giỏi';
  if (avg >= 6.5) return 'Khá';
  if (avg >= 5) return 'TB';
  return 'Yếu';
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString('vi-VN');
  } catch (err) {
    return '';
  }
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const inferMimeType = (input, fallback = 'image/png') => {
  if (!input) return fallback;
  const normalized = input.toLowerCase();
  if (normalized.endsWith('.svg') || normalized === 'svg') return 'image/svg+xml';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg') || normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized.endsWith('.webp') || normalized === 'webp') return 'image/webp';
  if (normalized.endsWith('.gif') || normalized === 'gif') return 'image/gif';
  if (normalized.endsWith('.bmp') || normalized === 'bmp') return 'image/bmp';
  return fallback;
};

const loadLocalSchoolLogo = async () => {
  if (localLogoCache.base64 !== null) {
    return localLogoCache;
  }

  for (const candidate of SCHOOL_LOGO_CANDIDATE_PATHS) {
    try {
      const logoBuffer = await fs.readFile(candidate);
      const ext = path.extname(candidate);
      localLogoCache.base64 = logoBuffer.toString('base64');
      localLogoCache.mime = inferMimeType(ext, 'image/png');
      return localLogoCache;
    } catch (err) {
      // Continue trying next candidate path
    }
  }

  localLogoCache.base64 = '';
  localLogoCache.mime = 'image/png';
  return localLogoCache;
};

const downloadBinaryViaNode = (url) => new Promise((resolve, reject) => {
  try {
    const parsed = new URL(url);
    const client = parsed.protocol === 'http:' ? http : https;
    const request = client.get(parsed, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`Request failed with status ${response.statusCode}`));
        response.resume();
        return;
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: response.headers['content-type'] || null
        });
      });
    });
    request.on('error', reject);
  } catch (error) {
    reject(error);
  }
});

const fetchLogoFromUrl = async (url, formatHint) => {
  if (!url) return null;
  if (remoteLogoCache.has(url)) {
    return remoteLogoCache.get(url);
  }
  try {
    let base64;
    let contentType;
    if (typeof fetch === 'function') {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      base64 = Buffer.from(arrayBuffer).toString('base64');
      contentType = response.headers.get('content-type');
    } else {
      const { buffer, contentType: streamContentType } = await downloadBinaryViaNode(url);
      base64 = buffer.toString('base64');
      contentType = streamContentType;
    }
    const resolvedMime = contentType || inferMimeType(formatHint || url);
    const asset = { base64, mime: resolvedMime };
    remoteLogoCache.set(url, asset);
    return asset;
  } catch (error) {
    console.warn('[ReportCard] Không thể tải logo từ URL:', url, error?.message);
    return null;
  }
};

const resolveSchoolLogoAsset = async (setting) => {
  if (setting?.schoolLogo?.url) {
    const remoteAsset = await fetchLogoFromUrl(setting.schoolLogo.url, setting.schoolLogo.format);
    if (remoteAsset && remoteAsset.base64) {
      return remoteAsset;
    }
  }
  return loadLocalSchoolLogo();
};

const normalizeSemester = (value) => {
  const raw = String(value ?? '1').toUpperCase();
  if (raw === 'CN') return 'CN';
  return raw === '2' ? '2' : '1';
};

const ensureHomeroomExportPermission = (role, permissionContext, classId) => {
  const normalizedClassId = String(classId);
  const context = permissionContext || {};
  const isHomeroom = context.isHomeroom || false;
  const homeroomClassIds = (context.homeroomClassIds || []).map(String);

  if (role === 'teacher') {
    if (!(isHomeroom && homeroomClassIds.includes(normalizedClassId))) {
      throw createHttpError(403, 'Không phải lớp chủ nhiệm của bạn');
    }
  } else if (role !== 'admin') {
    throw createHttpError(403, 'Không có quyền truy cập');
  }
};

const renderHtmlToPdf = async (html, browser) => {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
  });
  await page.close();
  return pdfBuffer;
};

const buildReportCardDocument = async ({
  studentId,
  classId,
  schoolYear,
  semester,
  role,
  permissionContext,
  classInfo: preloadedClass,
  student: preloadedStudent,
  setting,
  logoAsset
}) => {
  if (!studentId || !classId || !schoolYear) {
    throw createHttpError(400, 'Thiếu tham số studentId/classId/schoolYear');
  }

  const normalizedSemester = normalizeSemester(semester);
  const semesterList = normalizedSemester === 'CN' ? ['1', '2'] : [normalizedSemester];
  const semesterLabel = REPORT_CARD_SEMESTER_LABELS[normalizedSemester] || REPORT_CARD_SEMESTER_LABELS['1'];
  const semKey = SEMESTER_KEY_MAP[normalizedSemester] || 'HK1';

  ensureHomeroomExportPermission(role, permissionContext, classId);

  const classInfo = preloadedClass || await Class.findById(classId)
    .populate('teacherId', 'name teacherCode')
    .lean();
  if (!classInfo) {
    throw createHttpError(404, 'Không tìm thấy lớp học');
  }

  const student = preloadedStudent || await Student.findOne({ _id: studentId, classId })
    .select('name studentCode gender dateOfBirth')
    .lean();
  if (!student) {
    throw createHttpError(404, 'Không tìm thấy học sinh trong lớp này');
  }

  let schoolSetting = setting;
  if (!schoolSetting) {
    schoolSetting = await Setting.findOne().lean();
  }
  const schoolName = (schoolSetting?.schoolName || 'Trường THPT Chưa đặt tên').toUpperCase();
  const schoolAddress = schoolSetting?.address || '';
  const schoolSlogan = schoolSetting?.slogan || '';
  const resolvedLogoAsset = logoAsset && logoAsset.base64 ? logoAsset : await resolveSchoolLogoAsset(schoolSetting);
  const finalLogoBase64 = resolvedLogoAsset?.base64 || '';
  const finalLogoMime = resolvedLogoAsset?.mime || 'image/png';

  const gradeSummaries = await GradeSummary.find({
    studentId,
    schoolYear,
    semester: {
      $in: [...semesterList, normalizedSemester === 'CN' ? 'CN' : null].filter(Boolean)
    }
  })
    .populate('subjectId', 'name code includeInAverage')
    .lean();

  const gradeItems = await GradeItem.find({
    studentId,
    classId,
    schoolYear,
    semester: { $in: semesterList },
    isDeleted: { $ne: true }
  })
    .select('component score semester subjectId')
    .lean();

  const yearRecord = await StudentYearRecord.findOne({
    studentId,
    year: schoolYear,
    semester: semKey
  })
    .populate('homeroomTeacherId', 'name teacherCode')
    .lean();

  const subjectMap = new Map();
  gradeSummaries.forEach(summary => {
    const subjectIdStr = String(summary.subjectId?._id || summary.subjectId);
    if (!subjectMap.has(subjectIdStr)) {
      subjectMap.set(subjectIdStr, {
        subjectId: subjectIdStr,
        subjectName: summary.subjectId?.name || 'Môn học',
        includeInAverage: summary.subjectId?.includeInAverage, // ✅ Lưu includeInAverage
        semesters: {}
      });
    }
    subjectMap.get(subjectIdStr).semesters[String(summary.semester)] = summary;
  });

  const componentScoreCache = new Map();
  gradeItems.forEach(item => {
    if (!item.component) return;
    const subjectIdStr = String(item.subjectId);
    const key = `${subjectIdStr}_${item.component}`;
    if (!componentScoreCache.has(key)) componentScoreCache.set(key, []);
    componentScoreCache.get(key).push({
      score: typeof item.score === 'number' ? Number(item.score) : null,
      semester: String(item.semester)
    });
  });

  const componentUsage = new Set();
  gradeItems.forEach(item => {
    const key = String(item.component);
    if (REPORT_CARD_COMPONENTS.some(component => component.key === key)) {
      componentUsage.add(key);
    }
  });
  gradeSummaries.forEach(summary => {
    if (summary?.averages) {
      Object.entries(summary.averages).forEach(([key, value]) => {
        if (typeof value === 'number' && REPORT_CARD_COMPONENTS.some(component => component.key === key)) {
          componentUsage.add(key);
        }
      });
    }
  });

  let displayComponents = REPORT_CARD_COMPONENTS.filter(component => componentUsage.has(component.key));
  if (!displayComponents.length) {
    displayComponents = REPORT_CARD_COMPONENTS.filter((_, index) => index < 5);
  }

  const buildComponentScoreText = (subjectId, componentKey) => {
    const key = `${subjectId}_${componentKey}`;
    const scores = componentScoreCache.get(key) || [];
    if (!scores.length) return '-';
    if (semesterList.length === 1) {
      const values = scores
        .filter(item => item.score !== null)
        .map(item => formatReportScore(item.score));
      return values.length ? values.join(', ') : '-';
    }
    const grouped = semesterList.map(sem => {
      const label = sem === '1' ? 'HKI' : 'HKII';
      const values = scores
        .filter(item => item.semester === sem && item.score !== null)
        .map(item => formatReportScore(item.score));
      if (!values.length) return null;
      return `${label}: ${values.join(', ')}`;
    }).filter(Boolean);
    return grouped.length ? grouped.join(' | ') : '-';
  };

  const subjectRows = Array.from(subjectMap.values())
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'vi'))
    .map(subjectData => {
      const semesters = subjectData.semesters || {};
      const currentSummary = normalizedSemester === 'CN'
        ? (semesters.CN || null)
        : (semesters[normalizedSemester] || null);

      // ✅ Lấy thông tin môn học để kiểm tra includeInAverage
      const includeInAverage = subjectData.includeInAverage;
      const result = currentSummary?.result;

      let average = extractReportAverage(currentSummary);
      if (normalizedSemester === 'CN') {
        const hk1Avg = extractReportAverage(semesters['1']);
        const hk2Avg = extractReportAverage(semesters['2']);
        if (average === null) {
          if (hk1Avg !== null && hk2Avg !== null) average = Number(((hk1Avg + hk2Avg) / 2).toFixed(2));
          else average = hk1Avg ?? hk2Avg ?? null;
        }
      }

      const componentScores = {};
      displayComponents.forEach(component => {
        componentScores[component.key] = buildComponentScoreText(subjectData.subjectId, component.key);
      });

      // ✅ Xác định rank/xếp loại:
      // - Nếu môn không tính điểm TB: hiển thị "Đạt" hoặc "Không đạt" dựa trên result
      // - Nếu môn tính điểm TB: hiển thị xếp loại học lực dựa trên average
      let rank = '-';
      if (includeInAverage === false) {
        // Môn không tính điểm TB
        if (result === 'D') {
          rank = 'Đạt';
        } else if (result === 'K') {
          rank = 'Không đạt';
        } else {
          rank = '-';
        }
      } else {
        // Môn tính điểm TB: hiển thị xếp loại học lực
        rank = classifyAcademicLevel(average);
      }

      return {
        subjectName: subjectData.subjectName,
        componentScores,
        average,
        rank
      };
    });

  const averagesForOverall = subjectRows
    .map(row => (typeof row.average === 'number' ? row.average : null))
    .filter(value => value !== null);
  const computedOverallAverage = averagesForOverall.length
    ? Number((averagesForOverall.reduce((sum, value) => sum + value, 0) / averagesForOverall.length).toFixed(2))
    : null;

  const conductText = yearRecord?.conduct || '-';
  const academicLevelText = yearRecord?.academicLevel || '-';
  const gpaNumeric = typeof yearRecord?.gpa === 'number' ? yearRecord.gpa : computedOverallAverage;
  const gpaText = formatReportScore(gpaNumeric ?? null, 2);
  const fallbackAcademicLevel = academicLevelText && academicLevelText !== '-' ? academicLevelText : classifyAcademicLevel(gpaNumeric ?? null);

  const issueDate = new Date().toLocaleDateString('vi-VN');
  const homeroomTeacherName = yearRecord?.homeroomTeacherId?.name
    || classInfo.teacherId?.name
    || '';
  const gradeLabel = classInfo?.grade ? `Khối ${classInfo.grade}` : '';
  const issuePlaceLabel = schoolAddress
    ? `${schoolAddress}, ngày ${issueDate}`
    : gradeLabel
      ? `${gradeLabel}, ngày ${issueDate}`
      : `Ngày ${issueDate}`;

  const tableRowsHtml = subjectRows.length
    ? subjectRows.map((row, index) => `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td>${escapeHtml(row.subjectName)}</td>
            ${displayComponents.map(component => `<td>${escapeHtml(row.componentScores[component.key] || '-')}</td>`).join('')}
            <td class="text-center">${row.average !== null && row.average !== undefined ? formatReportScore(row.average) : '-'}</td>
            <td class="text-center">${escapeHtml(row.rank)}</td>
          </tr>
        `).join('')
    : `<tr><td colspan="${2 + displayComponents.length + 2}" class="text-center">Chưa có dữ liệu điểm</td></tr>`;

  const genderLabel = student.gender === 'female' ? 'Nữ' : student.gender === 'male' ? 'Nam' : '';
  const dateOfBirthLabel = formatDate(student.dateOfBirth);
  const sanitizedCode = sanitizeForFileName(student.studentCode, studentId);
  const semesterFileSegment = normalizedSemester === 'CN' ? 'ca-nam' : `hk${normalizedSemester}`;
  const fileName = `phieu-ket-qua_${sanitizedCode}_${semesterFileSegment}.pdf`;

  const html = `
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: "DejaVu Sans", Arial, sans-serif; margin: 32px 36px; font-size: 12px; color: #000; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 16px; }
            .school { font-size: 12px; line-height: 1.5; text-transform: uppercase; font-weight: 600; }
            .school-name { font-size: 15px; font-weight: 700; letter-spacing: 1px; }
            .school-slogan { font-size: 11px; font-style: italic; text-transform: none; font-weight: 400; margin-top: 2px; }
            .school-address { font-size: 11px; text-transform: none; font-weight: 500; margin-top: 4px; }
            .class-line { font-size: 12px; text-transform: none; font-weight: 600; margin-top: 6px; }
            .school-logo { width: 90px; height: 90px; object-fit: contain; }
            .placeholder-logo { width: 90px; height: 90px; border: 1px dashed #999; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; text-transform: uppercase; }
            .title-block { text-align: center; margin-bottom: 20px; }
            .title-block h1 { font-size: 20px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; }
            .title-block p { margin: 2px 0; font-size: 13px; }
            .student-info { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            .student-info td { padding: 4px 6px; font-size: 12px; }
            .scores-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            .scores-table th, .scores-table td { border: 1px solid #000; padding: 6px 8px; }
            .scores-table th { background: #f3f3f3; text-align: center; font-weight: 600; text-transform: uppercase; font-size: 11px; }
            .scores-table td { vertical-align: middle; font-size: 11px; }
            .scores-table .text-center { text-align: center; }
            .summary-grid { margin-top: 18px; display: flex; gap: 16px; }
            .summary-box { flex: 1; border: 1px solid #d0d0d0; padding: 12px 14px; border-radius: 8px; background: #fafafa; min-height: 90px; }
            .summary-box h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; }
            .summary-box p { margin: 4px 0; font-size: 12px; }
            .signature-block { margin-top: 36px; display: flex; justify-content: space-between; text-align: center; }
            .signature-column { width: 32%; }
            .signature-column p { margin: 4px 0; font-size: 12px; }
            .muted { color: #555; font-style: italic; }
            .teacher-name { margin-top: 52px; font-weight: 600; text-transform: uppercase; }
            .notes { margin-top: 18px; font-size: 11px; color: #555; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school">
              <div class="school-name">${escapeHtml(schoolName)}</div>
              ${schoolSlogan ? `<div class="school-slogan">${escapeHtml(schoolSlogan)}</div>` : ''}
              ${schoolAddress ? `<div class="school-address">${escapeHtml(schoolAddress)}</div>` : ''}
              <div class="class-line">Lớp: ${escapeHtml(classInfo.className || '')}</div>
            </div>
            ${finalLogoBase64
              ? `<img src="data:${finalLogoMime};base64,${finalLogoBase64}" alt="Logo trường" class="school-logo" />`
              : '<div class="placeholder-logo">Logo</div>'}
          </div>
          <div class="title-block">
            <h1>PHIẾU BÁO KẾT QUẢ HỌC TẬP</h1>
            <p>${escapeHtml(semesterLabel)} - Năm học ${escapeHtml(schoolYear)}</p>
          </div>
          <table class="student-info">
            <tr>
              <td><strong>Họ và tên:</strong> ${escapeHtml(student.name)}</td>
              <td><strong>Mã HS:</strong> ${escapeHtml(student.studentCode || '')}</td>
            </tr>
            <tr>
              <td><strong>Giới tính:</strong> ${escapeHtml(genderLabel)}</td>
              <td><strong>Ngày sinh:</strong> ${escapeHtml(dateOfBirthLabel)}</td>
            </tr>
          </table>
          <table class="scores-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Môn học</th>
                ${displayComponents.map(component => `<th>${escapeHtml(component.label)}</th>`).join('')}
                <th>ĐTB</th>
                <th>Xếp loại</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
          <div class="summary-grid">
            <div class="summary-box">
              <h3>Kết quả chung</h3>
              <p><strong>Điểm trung bình các môn:</strong> ${gpaText}</p>
              <p><strong>Xếp loại học lực:</strong> ${escapeHtml(fallbackAcademicLevel || '-')}</p>
              <p><strong>Hạnh kiểm:</strong> ${escapeHtml(conductText || '-')}</p>
            </div>
            <div class="summary-box">
              <h3>Ghi chú</h3>
              <p>GVCN: ${escapeHtml(homeroomTeacherName || '................................')}</p>
              <p>Nhận xét: .......................................................................</p>
              <p>.......................................................................................</p>
            </div>
          </div>
          <div class="notes">
            <p>* ĐTB được tính theo trọng số môn học; các cột điểm hiển thị những điểm đã được giáo viên bộ môn công bố.</p>
          </div>
          <div class="signature-block">
            <div class="signature-column">
              <p><strong>Phụ huynh học sinh</strong></p>
              <p class="muted">(Ký và ghi rõ họ tên)</p>
            </div>
            <div class="signature-column">
              <p><strong>${escapeHtml(issuePlaceLabel)}</strong></p>
              <p><strong>Giáo viên chủ nhiệm</strong></p>
              <p class="muted">(Ký và ghi rõ họ tên)</p>
              <p class="teacher-name">${escapeHtml(homeroomTeacherName || '')}</p>
            </div>
            <div class="signature-column">
              <p><strong>Hiệu trưởng</strong></p>
              <p class="muted">(Ký, ghi rõ họ tên và đóng dấu)</p>
            </div>
          </div>
        </body>
      </html>
    `;

  return {
    html,
    fileName,
    student,
    classInfo,
    yearRecord,
    semester: normalizedSemester,
    semesterLabel,
    conductText,
    academicLevelText: fallbackAcademicLevel,
    gpaText,
    sanitizedCode,
    computedOverallAverage
  };
};

// POST /grades/items
exports.upsertGradeItem = async (req, res) => {
  try {
    const { studentId, subjectId, component, score, classId, schoolYear, semester } = req.body;
    
    console.log(`[upsertGradeItem] Request body:`, {
      studentId,
      subjectId,
      component,
      score,
      classId,
      schoolYear,
      semester
    });
    
    if (!studentId || !subjectId || !component || score == null) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const { role, accountId } = req.user;
    console.log(`[upsertGradeItem] User:`, { role, accountId });

    // ✅ Kiểm tra quyền: Giáo viên chỉ nhập điểm môn mình được phân công dạy
    // Kiểm tra trực tiếp TeachingAssignment thay vì dựa vào permissionContext
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId }).lean();
      if (!currentTeacher) {
        console.log(`[upsertGradeItem] Teacher not found for accountId:`, accountId);
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin giáo viên' 
        });
      }

      console.log(`[upsertGradeItem] Found teacher:`, currentTeacher._id);

      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      
      // Nếu có classId, schoolYear, semester thì check cụ thể
      if (classId && schoolYear && semester) {
        const assignment = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();

        console.log(`[upsertGradeItem] TeachingAssignment check:`, {
          teacherId: currentTeacher._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
          found: !!assignment
        });

        if (!assignment) {
          // Kiểm tra xem có assignment nào cho giáo viên này không (để debug)
          const anyAssign = await TeachingAssignment.findOne({
            teacherId: currentTeacher._id,
            year: String(schoolYear),
            semester: String(semester),
          }).lean();
          console.log(`[upsertGradeItem] Any assignment for this teacher/year/semester:`, anyAssign ? 'Yes' : 'No');
          
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn' 
          });
        }
      } else {
        // Nếu không có đủ thông tin, chỉ check subjectId
        console.log(`[upsertGradeItem] Missing classId/schoolYear/semester, checking by subjectId only`);
        const anyAssign = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
        }).lean();

        console.log(`[upsertGradeItem] Any assignment for this teacher/subject:`, anyAssign ? 'Yes' : 'No');

        if (!anyAssign) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy môn này' 
          });
        }
      }
    }

    console.log(`[upsertGradeItem] Permission check passed, calling upsertGradeItem service`);

    // ✅ Gắn teacherId và performedBy từ tài khoản đăng nhập để lưu dấu vết người nhập điểm
    if (role === 'teacher' && currentTeacher?._id) {
      req.body.teacherId = currentTeacher._id;
      req.body.performedBy = { role: 'teacher', accountId, teacherId: currentTeacher._id };
    } else {
      req.body.performedBy = { role, accountId };
    }

    const item = await upsertGradeItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    console.error('[GradeController::upsertGradeItem]', err);
    res.status(400).json({ success: false, message: 'Không thể lưu điểm', error: err.message });
  }
};

/**
 * GET /grades/class/semester-gpa - Điểm TB học kỳ theo học sinh của lớp
 * Query: classId, schoolYear, semester
 * Trả về: [{ studentId, name, studentCode, gpa }]
 */
exports.getClassSemesterGPA = async (req, res) => {
  try {
    const { classId, schoolYear, semester } = req.query;
    if (!classId || !schoolYear || !semester) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số classId/schoolYear/semester' });
    }

    // Lấy thông tin lớp để lọc đúng niên khóa học sinh
    const classInfo = await Class.findById(classId).select('year grade').lean();
    if (!classInfo) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }

    // Lấy học sinh đang hoạt động của lớp trong đúng năm học
    const students = await Student.find({
      classId,
      status: 'active',
      currentYear: classInfo.year,
      isDeleted: { $ne: true }
    }).select('_id name studentCode').lean();

    if (students.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const studentIds = students.map(s => s._id);

    // Xác định tập môn bắt buộc tính ĐTB HK cho lớp (includeInAverage !== false)
    // Ưu tiên theo TeachingAssignment của lớp trong năm/học kỳ; fallback theo khối lớp
    let requiredSubjectIds = new Set();
    try {
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assigns = await TeachingAssignment.find({
        classId,
        year: String(schoolYear),
        semester: String(semester)
      }).populate('subjectId', 'includeInAverage').lean();
      const subjectIds = assigns
        .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
        .map(a => String(a.subjectId._id || a.subjectId));
      subjectIds.forEach(id => requiredSubjectIds.add(id));
    } catch (e) {
      // ignore
    }
    if (requiredSubjectIds.size === 0) {
      const requiredSubjects = await Subject.find({
        grades: String(classInfo.grade),
        includeInAverage: { $ne: false }
      }).select('_id').lean();
      requiredSubjectIds = new Set(requiredSubjects.map(s => String(s._id)));
    }

    // Lấy GradeSummary đã chốt điểm (average != null) cho học kỳ
    const summaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      schoolYear,
      semester,
      average: { $ne: null },
      isOfficial: true
    })
      .populate('subjectId', 'includeInAverage')
      .lean();

    // Gom theo học sinh và tính TB học kỳ (chỉ môn includeInAverage !== false)
    const byStudent = new Map();
    students.forEach(s => byStudent.set(String(s._id), { studentId: s._id, name: s.name, studentCode: s.studentCode, gpa: null }));

    const grouped = summaries.reduce((acc, s) => {
      const sid = String(s.studentId);
      if (!acc[sid]) acc[sid] = [];
      if (!s.subjectId || s.subjectId.includeInAverage === false) {
        return acc;
      }
      if (s.average !== null && s.average !== undefined) {
        acc[sid].push({ subjectId: String(s.subjectId._id || s.subjectId), average: s.average });
      }
      return acc;
    }, {});

    Object.entries(grouped).forEach(([sid, list]) => {
      const finalizedSubjectIds = new Set(list.map((it) => it.subjectId));
      // Chỉ tính ĐTB HK khi đã có đủ tất cả môn bắt buộc
      const hasAllRequired = requiredSubjectIds.size > 0 && [...requiredSubjectIds].every(id => finalizedSubjectIds.has(id));
      let gpa = null;
      if (hasAllRequired) {
        const avgs = list.map((it) => it.average).filter(v => typeof v === 'number');
        gpa = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
      }
      if (byStudent.has(sid)) {
        byStudent.get(sid).gpa = gpa;
      }
    });

    const data = Array.from(byStudent.values());
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[GradeController::getClassSemesterGPA]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy ĐTB học kỳ của lớp', error: err.message });
  }
};

// POST /grades/items/bulk - Lưu mảng điểm cho một component
exports.upsertGradeItems = async (req, res) => {
  try {
    const { studentId, subjectId, component, scores, classId, schoolYear, semester } = req.body;
    
    console.log(`[upsertGradeItems] Request body:`, {
      studentId,
      subjectId,
      component,
      scores,
      classId,
      schoolYear,
      semester
    });
    
    // ✅ Validate đầy đủ thông tin bắt buộc
    if (!studentId || !subjectId || !component || !Array.isArray(scores)) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu thông tin bắt buộc: studentId, subjectId, component, scores (array)' 
      });
    }

    if (!schoolYear || !semester) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu thông tin bắt buộc: schoolYear, semester' 
      });
    }

    if (scores.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Mảng điểm không được rỗng' 
      });
    }

    const { role, accountId } = req.user;

    // ✅ Kiểm tra quyền tương tự như upsertGradeItem
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId }).lean();
      if (!currentTeacher) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin giáo viên' 
        });
      }

      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      
      if (classId && schoolYear && semester) {
        const assignment = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();

        if (!assignment) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn' 
          });
        }
      } else {
        const anyAssign = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
        }).lean();

        if (!anyAssign) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy môn này' 
          });
        }
      }
    }

    // ✅ Không xóa bản ghi cũ để giữ log; đánh dấu xóa mềm (soft delete)
    const softDeleteResult = await GradeItem.updateMany({
      studentId: String(studentId),
      subjectId: String(subjectId),
      schoolYear: String(schoolYear),
      semester: String(semester),
      component: String(component),
      isDeleted: { $ne: true },
    }, { $set: { isDeleted: true } });
    console.log(`[upsertGradeItems] Đã soft-delete ${softDeleteResult.modifiedCount || softDeleteResult.nModified || 0} điểm cũ cho component ${component}`);

    // ✅ Xác định teacherId để lưu audit người nhập
    let teacherIdForAudit = undefined;
    if (role === 'teacher') {
      try {
        const TeacherModel = require('../../models/user/teacher');
        const t = await TeacherModel.findOne({ accountId }).select('_id').lean();
        if (t?._id) teacherIdForAudit = t._id;
      } catch {}
    }

    // ✅ Lưu mảng điểm mới với attempt tăng dần (đảm bảo đúng học sinh, năm học, học kỳ)
    const items = scores
      .filter(score => score != null && !isNaN(score) && score >= 0 && score <= 10)
      .map((score, index) => ({
        studentId: String(studentId),
        subjectId: String(subjectId),
        classId: classId ? String(classId) : undefined,
        schoolYear: String(schoolYear),
        semester: String(semester),
        component: String(component),
        score: Number(score),
        attempt: index + 1,
        // Gắn teacherId từ tài khoản đăng nhập nếu có
        teacherId: teacherIdForAudit,
        date: new Date(),
        // Thêm performedBy để ghi nhận người thực hiện
        performedBy: { role, accountId, teacherId: teacherIdForAudit }
      }));
    
    console.log(`[upsertGradeItems] Sẽ lưu ${items.length} điểm mới cho học sinh ${studentId}, năm học ${schoolYear}, học kỳ ${semester}`);

    if (items.length === 0) {
      return res.status(400).json({ message: 'Không có điểm hợp lệ nào để lưu' });
    }

    const savedItems = await GradeItem.insertMany(items);
    
    console.log(`[upsertGradeItems] Đã lưu ${savedItems.length} điểm thành công cho học sinh ${studentId}, năm học ${schoolYear}, học kỳ ${semester}`);

    // ✅ Tính lại summary (đảm bảo đúng học sinh, năm học, học kỳ)
    try {
      const summary = await recomputeSummary({
        studentId: String(studentId),
        subjectId: String(subjectId),
        classId: classId ? String(classId) : undefined,
        schoolYear: String(schoolYear),
        semester: String(semester),
      });
      console.log(`[upsertGradeItems] Đã tính lại summary cho học sinh ${studentId}, năm học ${schoolYear}, học kỳ ${semester}`, {
        average: summary?.average,
        averages: summary?.averages,
        summaryId: summary?._id,
      });
      
      if (!summary || summary.average === null || summary.average === undefined) {
        console.warn(`[upsertGradeItems] ⚠️ Cảnh báo: Điểm trung bình chưa được tính hoặc bằng null cho học sinh ${studentId}, môn ${subjectId}`);
      }
    } catch (recomputeError) {
      console.error('⚠️ Lỗi khi tính lại summary:', recomputeError);
      console.error('⚠️ Chi tiết lỗi:', {
        message: recomputeError.message,
        stack: recomputeError.stack,
        studentId,
        subjectId,
        schoolYear,
        semester,
      });
      // Vẫn trả về success vì đã lưu điểm thành công, nhưng log lỗi để debug
    }

    // ✅ Tính lại điểm TB cả năm
    if (classId) {
      try {
        await computeAndSaveYearGPA({
          studentId: String(studentId),
          classId: String(classId),
          schoolYear: String(schoolYear),
        });
        console.log(`[upsertGradeItems] Đã tính lại điểm TB cả năm cho học sinh ${studentId}, năm học ${schoolYear}`);
      } catch (yearGPAError) {
        console.error('⚠️ Lỗi khi tính điểm TB cả năm:', yearGPAError);
      }
    }

    res.status(201).json({ 
      success: true, 
      data: savedItems, 
      count: savedItems.length,
      message: `Đã lưu ${savedItems.length} điểm cho học sinh, năm học ${schoolYear}, học kỳ ${semester}`
    });
  } catch (err) {
    console.error('[GradeController::upsertGradeItems]', err);
    res.status(400).json({ success: false, message: 'Không thể lưu điểm', error: err.message });
  }
};

// DELETE /grades/items - Xóa tất cả điểm của một component cho học sinh
exports.deleteGradeItems = async (req, res) => {
  try {
    const { studentId, subjectId, component, classId, schoolYear, semester } = req.query;
    
    if (!studentId || !subjectId || !component || !schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const { role, accountId } = req.user;

    // ✅ Kiểm tra quyền tương tự như upsertGradeItem
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId }).lean();
      if (!currentTeacher) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin giáo viên' 
        });
      }

      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      
      if (classId && schoolYear && semester) {
        const assignment = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();

        if (!assignment) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn' 
          });
        }
      } else {
        const anyAssign = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
        }).lean();

        if (!anyAssign) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy môn này' 
          });
        }
      }
    }

    // ✅ Xóa mềm tất cả điểm của component này để giữ log
    const result = await GradeItem.updateMany({
      studentId,
      subjectId,
      schoolYear,
      semester,
      component,
      isDeleted: { $ne: true },
    }, { $set: { isDeleted: true } });

    // ✅ Tính lại summary sau khi xóa
    const modified = result.modifiedCount || result.nModified || 0;
    if (modified > 0) {
      await recomputeSummary({
        studentId,
        subjectId,
        classId,
        schoolYear,
        semester,
      });
    }

    res.json({ success: true, modifiedCount: modified });
  } catch (err) {
    console.error('[GradeController::upsertGradeItem]', err);
    res.status(400).json({ success: false, message: 'Không thể lưu điểm', error: err.message });
  }
};

// GET /grades/summary?classId=&subjectId=&schoolYear=&semester=
exports.getClassSubjectSummary = async (req, res) => {
  try {
    const { classId, subjectId, schoolYear, semester } = req.query;
    if (!classId || !subjectId || !schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu tham số classId/subjectId/schoolYear/semester' });
    }

    // ✅ Middleware đã kiểm tra role và permission cơ bản
    // Frontend đã filter lớp/môn theo TeachingAssignment, nên không cần check lại ở đây
    // Cho phép tất cả giáo viên truy cập (frontend sẽ chỉ hiển thị lớp/môn được phân công)

    const data = await getClassSubjectSummary({ classId, subjectId, schoolYear, semester });
    
    // ✅ Trả về mảng rỗng thay vì 404 khi không có dữ liệu (có thể chưa khởi tạo bảng điểm)
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[GradeController::getClassSubjectSummary]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy bảng điểm', error: err.message });
  }
};

// POST /grades/recompute
exports.recomputeSummary = async (req, res) => {
  try {
    const { studentId, subjectId, schoolYear, semester } = req.body;
    if (!studentId || !subjectId || !schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu thông tin tính điểm' });
    }

    const summary = await recomputeSummary(req.body);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('[GradeController::recomputeSummary]', err);
    res.status(400).json({ success: false, message: 'Không thể tính lại điểm tổng hợp', error: err.message });
  }
};

// POST /grades/save - Lưu điểm nhiều học sinh
// body: { classId, subjectId, schoolYear, semester, scores: [{ studentId, components: [{ component, score }] }] }
exports.saveScores = async (req, res) => {
  try {
    const { classId, subjectId, schoolYear, semester, scores } = req.body || {};

    if (!classId || !subjectId || !schoolYear || !semester || !Array.isArray(scores)) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số classId/subjectId/schoolYear/semester hoặc danh sách điểm' });
    }

    if (scores.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách điểm trống' });
    }

    for (const s of scores) {
      if (!s.studentId || !Array.isArray(s.components)) {
        return res.status(400).json({ success: false, message: 'Sai định dạng dữ liệu mỗi học sinh' });
      }
      for (const c of s.components) {
        if (!c.component || c.score == null) {
          return res.status(400).json({ success: false, message: 'Thiếu component/score trong components' });
        }
      }
    }

    const { role, accountId } = req.user;

    // ✅ Kiểm tra quyền: Giáo viên chỉ nhập điểm môn mình được phân công dạy
    // Kiểm tra trực tiếp TeachingAssignment thay vì dựa vào permissionContext
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId }).lean();
      if (!currentTeacher) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin giáo viên' 
        });
      }

      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assignment = await TeachingAssignment.findOne({
        teacherId: currentTeacher._id,
        subjectId,
        classId,
        year: String(schoolYear),
        semester: String(semester),
      }).lean();

      if (!assignment) {
        return res.status(403).json({ 
          success: false, 
          message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn' 
        });
      }
    }

    const { saveScores } = require('../../services/gradeService');
    const result = await saveScores({ classId, subjectId, schoolYear, semester, scores });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('[GradeController::saveScores]', err);
    res.status(400).json({ success: false, message: 'Không thể lưu điểm hàng loạt', error: err.message });
  }
};
// POST /grades/init - Khởi tạo bảng điểm cho lớp (hoặc tất cả lớp nếu không có classId)
exports.initGradeTable = async (req, res) => {
  try {
    const { schoolYear, semester, classId } = req.body;

    if (!schoolYear || !semester) {
      return res.status(400).json({ success: false, message: 'Thiếu năm học hoặc học kỳ' });
    }

    // Nếu có classId, chỉ khởi tạo cho lớp đó
    let classes;
    if (classId) {
      const classItem = await Class.findById(classId).lean();
      if (!classItem) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
      }
      classes = [classItem];
    } else {
      // Lấy tất cả lớp học
      classes = await Class.find({}).lean();
    }
    if (classes.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học nào' });
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    // Duyệt qua từng lớp
    for (const classItem of classes) {
      const classId = classItem._id;
      const grade = classItem.grade;
      const classYear = classItem.year; // ✅ Năm học của lớp

      // ✅ Lấy tất cả học sinh trong lớp - CHỈ lấy học sinh của niên khóa tương ứng
      const students = await Student.find({ 
        classId, 
        status: 'active',
        currentYear: classYear, // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
        isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
      }).lean();
      if (students.length === 0) {
        continue;
      }

      // Lấy tất cả môn học phù hợp với khối
      const subjects = await Subject.find({ grades: grade }).lean();
      if (subjects.length === 0) {
        continue;
      }

      // Tạo GradeSummary cho mỗi cặp (học sinh, môn học)
      const summariesToCreate = [];
      for (const student of students) {
        for (const subject of subjects) {
          // Kiểm tra xem đã có GradeSummary chưa
          const exists = await GradeSummary.findOne({
            studentId: student._id,
            subjectId: subject._id,
            schoolYear,
            semester,
          });

          if (!exists) {
            summariesToCreate.push({
              studentId: student._id,
              subjectId: subject._id,
              classId,
              schoolYear,
              semester,
              averages: {},
              average: null,
              result: null, // Chưa có điểm, sẽ được cập nhật khi giáo viên nhập điểm
              computedAt: new Date(),
              version: 'v1',
            });
          } else {
            totalSkipped++;
          }
        }
      }

      // Insert nhiều GradeSummary cùng lúc
      if (summariesToCreate.length > 0) {
        await GradeSummary.insertMany(summariesToCreate);
        totalCreated += summariesToCreate.length;
      }
    }

    res.json({
      success: true,
      message: `Khởi tạo bảng điểm thành công`,
      createdCount: totalCreated,
      skippedCount: totalSkipped,
      totalCount: totalCreated + totalSkipped,
      data: {
        created: totalCreated,
        skipped: totalSkipped,
        total: totalCreated + totalSkipped,
      },
    });
  } catch (err) {
    console.error('[GradeController::initGradeTable]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /grades/student - Học sinh xem điểm của bản thân
exports.getStudentGrades = async (req, res) => {
  try {
    const { studentId, schoolYear, semester } = req.query;
    const { role, accountId } = req.user || {};

    let targetStudentId = studentId;

    // Nếu là học sinh, tự động lấy studentId từ accountId của họ
    if (role === 'student') {
      const student = await Student.findOne({ accountId }).lean();
      if (!student) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin học sinh của bạn' 
        });
      }
      targetStudentId = student._id.toString();
    } else if (!targetStudentId) {
      // Admin/teacher có thể truyền studentId, nhưng phải có
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu studentId' 
      });
    }

    // Kiểm tra học sinh có tồn tại không
    const student = await Student.findById(targetStudentId)
      .populate('classId', 'homeroomTeacherId teacherId year')
      .lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
    }

    // Kiểm tra quyền truy cập
    if (role === 'student') {
      // Học sinh chỉ xem điểm của mình
      if (targetStudentId !== student._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Bạn chỉ được xem điểm của chính mình' 
        });
      }
    } else if (role === 'teacher') {
      // GVCN chỉ xem điểm học sinh trong lớp chủ nhiệm
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId })
        .select('yearRoles currentHomeroomClassId homeroomClassIds')
        .lean();
      
      if (teacher) {
        // Lấy năm học hiện tại hoặc từ query
        // ✅ Sử dụng utility function để xác định năm học hiện tại
        const { getEffectiveSchoolYear, getCurrentSchoolYear } = require('../../utils/schoolYearHelper');
        let effectiveYear = schoolYear || null;
        
        if (!effectiveYear) {
          // Nếu có req thì dùng getEffectiveSchoolYear, nếu không thì dùng getCurrentSchoolYear
          if (req) {
            effectiveYear = await getEffectiveSchoolYear(req);
            } else {
            effectiveYear = await getCurrentSchoolYear();
          }
        }
        
        // Kiểm tra xem giáo viên có phải GVCN của lớp học sinh không
        const studentClassDoc = student.classId && typeof student.classId === 'object'
          ? student.classId
          : null;
        const studentClassId = studentClassDoc?._id || student.classId;
        const studentClassYear = studentClassDoc?.year || effectiveYear;
        const classHomeroomTeacherId = studentClassDoc?.homeroomTeacherId || studentClassDoc?.teacherId || null;
        
        // Kiểm tra từ yearRoles
        let isHomeroom = false;
        if (teacher.yearRoles && Array.isArray(teacher.yearRoles)) {
          const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(studentClassYear));
          if (yearRole && yearRole.isHomeroom && yearRole.currentHomeroomClassId) {
            if (String(yearRole.currentHomeroomClassId) === String(studentClassId)) {
              isHomeroom = true;
            }
          }
        }
        
        // Kiểm tra từ homeroomClassIds (lịch sử)
        if (!isHomeroom && teacher.homeroomClassIds && Array.isArray(teacher.homeroomClassIds)) {
          const hasHomeroom = teacher.homeroomClassIds.some(
            id => String(id._id || id) === String(studentClassId)
          );
          if (hasHomeroom) {
            isHomeroom = true;
          }
        }
        
        // Kiểm tra trực tiếp từ lớp học sinh
        if (!isHomeroom && classHomeroomTeacherId) {
          const Class = require('../../models/class/class');
          const studentClass = studentClassId
            ? await Class.findById(studentClassId)
                .select('homeroomTeacherId teacherId year')
                .lean()
            : null;

          const resolvedHomeroomId = studentClass?.homeroomTeacherId
            || studentClass?.teacherId
            || classHomeroomTeacherId;

          if (resolvedHomeroomId) {
            const TeacherModel = require('../../models/user/teacher');
            const homeroomTeacher = await TeacherModel.findById(resolvedHomeroomId)
              .select('accountId')
              .lean();

            if (homeroomTeacher && String(homeroomTeacher.accountId) === String(accountId)) {
              isHomeroom = true;
            }
          }
        }
        
        // Nếu không phải Admin và không phải GVCN, từ chối
        if (!isHomeroom && role !== 'admin') {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn chỉ được xem điểm của học sinh trong lớp chủ nhiệm' 
          });
        }
      }
    }

    // Xây dựng query
    const query = { studentId: targetStudentId };
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;

    // Lấy tất cả GradeSummary của học sinh
    const summaries = await GradeSummary.find(query)
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .sort({ schoolYear: -1, semester: -1, 'subjectId.name': 1 })
      .lean();

    // Lấy tất cả GradeItem để hiển thị các điểm riêng lẻ
    const GradeItem = require('../../models/grade/gradeItem');
    const allGradeItems = await GradeItem.find({ ...query, isDeleted: { $ne: true } })
      .select('subjectId component score semester schoolYear attempt teacherId date')
      .populate('teacherId', 'name teacherCode')
      .sort({ date: 1 })
      .lean();

    // Format dữ liệu trả về
    const formattedGrades = summaries.map(summary => {
      // Lấy các điểm riêng lẻ cho môn học này
      const subjectItems = allGradeItems.filter(
        item => String(item.subjectId) === String(summary.subjectId._id) &&
        item.semester === summary.semester &&
        item.schoolYear === summary.schoolYear
      );

      // Nhóm điểm theo component
      const gradeItemsByComponent = {
        oral: subjectItems.filter(item => item.component === 'oral').map(item => item.score),
        quiz15: subjectItems.filter(item => item.component === 'quiz15').map(item => item.score),
        quiz45: subjectItems.filter(item => item.component === 'quiz45').map(item => item.score),
        midterm: subjectItems.filter(item => item.component === 'midterm').map(item => item.score),
        final: subjectItems.filter(item => item.component === 'final').map(item => item.score),
      };

      // ✅ Thêm log chi tiết để hiển thị ai nhập điểm và khi nào
      const gradeItemLogs = {
        oral: subjectItems
          .filter(item => item.component === 'oral')
          .map(item => ({
            score: item.score,
            attempt: item.attempt,
            teacher: item.teacherId ? { _id: item.teacherId._id || item.teacherId, name: item.teacherId.name, code: item.teacherId.teacherCode } : null,
            date: item.date,
          })),
        quiz15: subjectItems
          .filter(item => item.component === 'quiz15')
          .map(item => ({
            score: item.score,
            attempt: item.attempt,
            teacher: item.teacherId ? { _id: item.teacherId._id || item.teacherId, name: item.teacherId.name, code: item.teacherId.teacherCode } : null,
            date: item.date,
          })),
        quiz45: subjectItems
          .filter(item => item.component === 'quiz45')
          .map(item => ({
            score: item.score,
            attempt: item.attempt,
            teacher: item.teacherId ? { _id: item.teacherId._id || item.teacherId, name: item.teacherId.name, code: item.teacherId.teacherCode } : null,
            date: item.date,
          })),
        midterm: subjectItems
          .filter(item => item.component === 'midterm')
          .map(item => ({
            score: item.score,
            attempt: item.attempt,
            teacher: item.teacherId ? { _id: item.teacherId._id || item.teacherId, name: item.teacherId.name, code: item.teacherId.teacherCode } : null,
            date: item.date,
          })),
        final: subjectItems
          .filter(item => item.component === 'final')
          .map(item => ({
            score: item.score,
            attempt: item.attempt,
            teacher: item.teacherId ? { _id: item.teacherId._id || item.teacherId, name: item.teacherId.name, code: item.teacherId.teacherCode } : null,
            date: item.date,
          })),
      };

      return {
        _id: summary._id,
        subject: {
          _id: summary.subjectId._id,
          name: summary.subjectId.name,
          code: summary.subjectId.code,
          includeInAverage: summary.subjectId.includeInAverage,
        },
        class: summary.classId ? {
          _id: summary.classId._id,
          className: summary.classId.className,
          classCode: summary.classId.classCode,
          grade: summary.classId.grade,
        } : null,
        schoolYear: summary.schoolYear,
        semester: summary.semester,
        averages: summary.averages, // Điểm TB của từng component
        gradeItems: gradeItemsByComponent, // Các điểm riêng lẻ
        gradeItemLogs, // ✅ Log chi tiết cho frontend HS (ai nhập, khi nào)
        average: summary.average, // Chỉ có nếu môn tính điểm TB
        result: summary.result, // "D" hoặc "K" nếu môn không tính điểm TB
        computedAt: summary.computedAt,
        isOfficial: !!summary.isOfficial,
        officialAt: summary.officialAt || null,
        officialBy: summary.officialBy || null,
      };
    });

    res.json({
      success: true,
      count: formattedGrades.length,
      data: formattedGrades,
    });
  } catch (err) {
    console.error('[GradeController::getStudentGrades]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy điểm của học sinh', error: err.message });
  }
};

/* =========================================================
   📊 LẤY ĐIỂM HỌC SINH VỚI SO SÁNH VỚI HỌC KỲ/NĂM TRƯỚC
   - So sánh điểm hiện tại với cùng học kỳ năm trước
   - So sánh HK2 với HK1 cùng năm học
   - Hiển thị xu hướng tăng/giảm
========================================================= */
exports.getStudentGradesWithTrend = async (req, res) => {
  try {
    const { studentId, schoolYear, semester } = req.query;
    const { role, accountId } = req.user || {};

    let targetStudentId = studentId;

    // Nếu là học sinh, tự động lấy studentId từ accountId của họ
    if (role === 'student') {
      const student = await Student.findOne({ accountId }).lean();
      if (!student) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin học sinh của bạn' 
        });
      }
      targetStudentId = student._id.toString();
    } else if (!targetStudentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu studentId' 
      });
    }

    // Kiểm tra học sinh có tồn tại không
    const student = await Student.findById(targetStudentId).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
    }

    // ✅ Lấy điểm hiện tại
    const currentQuery = { studentId: targetStudentId };
    if (schoolYear) currentQuery.schoolYear = schoolYear;
    if (semester) currentQuery.semester = semester;

    const currentSummaries = await GradeSummary.find(currentQuery)
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .sort({ 'subjectId.name': 1 })
      .lean();

    // ✅ So sánh với học kỳ trước (cùng năm học)
    let previousSemesterComparison = null;
    if (semester === '2' && schoolYear) {
      // So sánh HK2 với HK1 cùng năm
      const hk1Summaries = await GradeSummary.find({
        studentId: targetStudentId,
        schoolYear: schoolYear,
        semester: '1',
      })
        .populate('subjectId', 'name code includeInAverage')
        .lean();

      if (hk1Summaries.length > 0) {
        previousSemesterComparison = {
          semester: '1',
          schoolYear: schoolYear,
          comparison: currentSummaries.map((current) => {
            const previous = hk1Summaries.find(
              (p) => String(p.subjectId._id) === String(current.subjectId._id)
            );
            if (!previous || current.average === null || previous.average === null) {
              return {
                subjectId: current.subjectId._id,
                subjectName: current.subjectId.name,
                currentAverage: current.average,
                previousAverage: previous?.average || null,
                trend: null,
                trendPercentage: null,
              };
            }

            const trend = current.average - previous.average;
            const trendPercentage = previous.average > 0
              ? ((trend / previous.average) * 100).toFixed(2)
              : null;

            return {
              subjectId: current.subjectId._id,
              subjectName: current.subjectId.name,
              currentAverage: current.average,
              previousAverage: previous.average,
              trend: Number(trend.toFixed(2)),
              trendPercentage: trendPercentage ? Number(trendPercentage) : null,
            };
          }),
        };
      }
    }

    // ✅ So sánh với cùng học kỳ năm trước
    let previousYearComparison = null;
    if (schoolYear && semester) {
      // Tính năm học trước
      const yearParts = schoolYear.split('-');
      if (yearParts.length === 2) {
        const previousYearStart = parseInt(yearParts[0]) - 1;
        const previousYearEnd = parseInt(yearParts[1]) - 1;
        const previousYear = `${previousYearStart}-${previousYearEnd}`;

        const previousYearSummaries = await GradeSummary.find({
          studentId: targetStudentId,
          schoolYear: previousYear,
          semester: semester,
        })
          .populate('subjectId', 'name code includeInAverage')
          .lean();

        if (previousYearSummaries.length > 0) {
          previousYearComparison = {
            schoolYear: previousYear,
            semester: semester,
            comparison: currentSummaries.map((current) => {
              const previous = previousYearSummaries.find(
                (p) => String(p.subjectId._id) === String(current.subjectId._id)
              );
              if (!previous || current.average === null || previous.average === null) {
                return {
                  subjectId: current.subjectId._id,
                  subjectName: current.subjectId.name,
                  currentAverage: current.average,
                  previousAverage: previous?.average || null,
                  trend: null,
                  trendPercentage: null,
                };
              }

              const trend = current.average - previous.average;
              const trendPercentage = previous.average > 0
                ? ((trend / previous.average) * 100).toFixed(2)
                : null;

              return {
                subjectId: current.subjectId._id,
                subjectName: current.subjectId.name,
                currentAverage: current.average,
                previousAverage: previous.average,
                trend: Number(trend.toFixed(2)),
                trendPercentage: trendPercentage ? Number(trendPercentage) : null,
              };
            }),
          };
        }
      }
    }

    // ✅ Lấy các điểm lẻ (gradeItems) để hiển thị đầy đủ số cột điểm giống giáo viên
    const GradeItemModel = require('../../models/grade/gradeItem');
    const allGradeItems = await GradeItemModel.find(currentQuery)
      .select('subjectId component score attempt semester schoolYear date')
      .sort({ subjectId: 1, component: 1, attempt: 1, date: 1 })
      .lean();

    // Format dữ liệu trả về (kèm gradeItems)
    const formattedGrades = currentSummaries.map(summary => {
      const subjectItems = allGradeItems.filter(
        item => String(item.subjectId) === String(summary.subjectId._id) &&
          item.semester === summary.semester &&
          item.schoolYear === summary.schoolYear
      );

      const gradeItemsByComponent = {
        oral: subjectItems.filter(it => it.component === 'oral').map(it => it.score),
        quiz15: subjectItems.filter(it => it.component === 'quiz15').map(it => it.score),
        quiz45: subjectItems.filter(it => it.component === 'quiz45').map(it => it.score),
        midterm: subjectItems.filter(it => it.component === 'midterm').map(it => it.score),
        final: subjectItems.filter(it => it.component === 'final').map(it => it.score),
      };

      return {
        _id: summary._id,
        subject: {
          _id: summary.subjectId._id,
          name: summary.subjectId.name,
          code: summary.subjectId.code,
          includeInAverage: summary.subjectId.includeInAverage,
        },
        class: summary.classId ? {
          _id: summary.classId._id,
          className: summary.classId.className,
          classCode: summary.classId.classCode,
          grade: summary.classId.grade,
        } : null,
        schoolYear: summary.schoolYear,
        semester: summary.semester,
        averages: summary.averages,
        gradeItems: gradeItemsByComponent,
        average: summary.average,
        result: summary.result,
        computedAt: summary.computedAt,
        isOfficial: !!summary.isOfficial,
        officialAt: summary.officialAt || null,
        officialBy: summary.officialBy || null,
      };
    });

    res.json({
      success: true,
      count: formattedGrades.length,
      data: formattedGrades,
      previousSemesterComparison, // So sánh với HK1 (nếu đang xem HK2)
      previousYearComparison, // So sánh với cùng học kỳ năm trước
    });
  } catch (err) {
    console.error('[GradeController::getStudentGradesWithTrend]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Không thể lấy điểm của học sinh', 
      error: err.message 
    });
  }
};

/* =========================================================
   🔧 HELPER: Tính xu hướng điểm cho một học sinh
========================================================= */
const calculateStudentTrend = async (studentId, schoolYear, semester) => {
  const trends = {
    previousSemester: null, // So sánh với HK1 (nếu đang xem HK2)
    previousYear: null, // So sánh với cùng học kỳ năm trước
  };

  // ✅ So sánh với học kỳ trước (cùng năm học)
  if (semester === '2' && schoolYear) {
    const [currentSummaries, hk1Summaries] = await Promise.all([
      GradeSummary.find({
        studentId,
        schoolYear,
        semester: '2',
      })
        .populate('subjectId', 'name code includeInAverage')
        .lean(),
      GradeSummary.find({
        studentId,
        schoolYear,
        semester: '1',
      })
        .populate('subjectId', 'name code includeInAverage')
        .lean(),
    ]);

    if (hk1Summaries.length > 0) {
      const comparison = currentSummaries.map((current) => {
        const previous = hk1Summaries.find(
          (p) => String(p.subjectId._id) === String(current.subjectId._id)
        );
        if (!previous || current.average === null || previous.average === null) {
          return {
            subjectId: String(current.subjectId._id),
            subjectName: current.subjectId.name,
            currentAverage: current.average,
            previousAverage: previous?.average || null,
            trend: null,
            trendPercentage: null,
          };
        }

        const trend = current.average - previous.average;
        const trendPercentage = previous.average > 0
          ? ((trend / previous.average) * 100).toFixed(2)
          : null;

        return {
          subjectId: String(current.subjectId._id),
          subjectName: current.subjectId.name,
          currentAverage: current.average,
          previousAverage: previous.average,
          trend: Number(trend.toFixed(2)),
          trendPercentage: trendPercentage ? Number(trendPercentage) : null,
        };
      });

      trends.previousSemester = {
        semester: '1',
        schoolYear,
        comparison,
      };
    }
  }

  // ✅ So sánh với cùng học kỳ năm trước
  if (schoolYear && semester) {
    const yearParts = schoolYear.split('-');
    if (yearParts.length === 2) {
      const previousYearStart = parseInt(yearParts[0]) - 1;
      const previousYearEnd = parseInt(yearParts[1]) - 1;
      const previousYear = `${previousYearStart}-${previousYearEnd}`;

      const [currentSummaries, previousYearSummaries] = await Promise.all([
        GradeSummary.find({
          studentId,
          schoolYear,
          semester,
        })
          .populate('subjectId', 'name code includeInAverage')
          .lean(),
        GradeSummary.find({
          studentId,
          schoolYear: previousYear,
          semester,
        })
          .populate('subjectId', 'name code includeInAverage')
          .lean(),
      ]);

      if (previousYearSummaries.length > 0) {
        const comparison = currentSummaries.map((current) => {
          const previous = previousYearSummaries.find(
            (p) => String(p.subjectId._id) === String(current.subjectId._id)
          );
          if (!previous || current.average === null || previous.average === null) {
            return {
              subjectId: String(current.subjectId._id),
              subjectName: current.subjectId.name,
              currentAverage: current.average,
              previousAverage: previous?.average || null,
              trend: null,
              trendPercentage: null,
            };
          }

          const trend = current.average - previous.average;
          const trendPercentage = previous.average > 0
            ? ((trend / previous.average) * 100).toFixed(2)
            : null;

          return {
            subjectId: String(current.subjectId._id),
            subjectName: current.subjectId.name,
            currentAverage: current.average,
            previousAverage: previous.average,
            trend: Number(trend.toFixed(2)),
            trendPercentage: trendPercentage ? Number(trendPercentage) : null,
          };
        });

        trends.previousYear = {
          schoolYear: previousYear,
          semester,
          comparison,
        };
      }
    }
  }

  return trends;
};

// GET /grades/admin/all - Admin/BGH xem tất cả điểm của tất cả học sinh
exports.getAllStudentsGrades = async (req, res) => {
  try {
    const { schoolYear, semester, classId, subjectId, grade, keyword } = req.query;
    
    // Build query
    let studentQuery = {};

    // ✅ Soft Delete: Filter isDeleted != true mặc định (bao gồm false, null, không có trường)
    const { isDeleted = 'false' } = req.query;
    if (isDeleted !== 'true') {
      studentQuery.isDeleted = { $ne: true };
    }

    if (classId) {
      studentQuery.classId = classId;
    } else if (grade) {
      const classes = await Class.find({ grade: String(grade) }).select('_id').lean();
      studentQuery.classId = { $in: classes.map(c => c._id) };
    }
    if (keyword) {
      studentQuery.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { studentCode: { $regex: keyword, $options: 'i' } }
      ];
    }

    // ✅ Get students - Filter by currentYear if schoolYear is provided
    if (schoolYear && studentQuery.classId) {
      // Nếu có classId, lấy năm học của lớp và filter theo currentYear
      const classInfo = await Class.findById(studentQuery.classId).select('year').lean();
      if (classInfo) {
        studentQuery.currentYear = classInfo.year;
      }
    } else if (schoolYear && studentQuery.classId && studentQuery.classId.$in) {
      // Nếu có nhiều classId, lấy năm học của các lớp và filter
      const classes = await Class.find({ _id: { $in: studentQuery.classId.$in } }).select('year').lean();
      const classYears = [...new Set(classes.map(c => c.year).filter(Boolean))];
      if (classYears.length === 1) {
        studentQuery.currentYear = classYears[0];
      }
    }
    
    const students = await Student.find(studentQuery)
      .populate({
        path: 'classId',
        select: 'className classCode grade year',
        match: schoolYear ? { year: schoolYear } : {}
      })
      .lean();
    
    // ✅ Lọc lại để chỉ lấy học sinh có classId hợp lệ và đúng năm học (nếu có schoolYear)
    const validStudents = students.filter(s => {
      if (!s.classId) return false;
      if (schoolYear && s.classId.year && String(s.classId.year) !== String(schoolYear)) {
        return false;
      }
      return true;
    });
    const studentIds = students.map(s => s._id);

    // Build summary query
    let summaryQuery = { studentId: { $in: studentIds } };
    if (schoolYear) summaryQuery.schoolYear = schoolYear;
    if (semester) summaryQuery.semester = semester;
    if (subjectId) summaryQuery.subjectId = subjectId;

    // Get grade summaries
    const summaries = await GradeSummary.find(summaryQuery)
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .lean();

    // Get student year records for conduct and academic level
    let yearRecordQuery = { studentId: { $in: studentIds } };
    if (schoolYear) yearRecordQuery.year = schoolYear;
    if (semester) {
      if (semester === '1') yearRecordQuery.semester = 'HK1';
      else if (semester === '2') yearRecordQuery.semester = 'HK2';
    }
    const yearRecords = await StudentYearRecord.find(yearRecordQuery)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .lean();

    // Group by student
    const studentMap = new Map();
    validStudents.forEach(s => {
      studentMap.set(String(s._id), {
        _id: s._id,
        name: s.name,
        studentCode: s.studentCode,
        class: s.classId ? {
          _id: s.classId._id,
          className: s.classId.className,
          classCode: s.classId.classCode,
          grade: s.classId.grade
        } : null
      });
    });

    // Add summaries to students
    summaries.forEach(summary => {
      const studentId = String(summary.studentId);
      if (!studentMap.has(studentId)) return;
      
      const student = studentMap.get(studentId);
      if (!student.subjects) student.subjects = [];
      
      // ✅ Lấy yearRecord theo semester được chọn
      let yearRecord = null;
      if (semester === '1' || semester === 'HK1') {
        yearRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          (!schoolYear || yr.year === schoolYear) &&
          yr.semester === 'HK1'
        );
      } else if (semester === '2' || semester === 'HK2') {
        yearRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          (!schoolYear || yr.year === schoolYear) &&
          yr.semester === 'HK2'
        );
      } else {
        // Nếu không có semester hoặc CN, lấy record CN
        yearRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          (!schoolYear || yr.year === schoolYear) &&
          yr.semester === 'CN'
        );
      }

      student.subjects.push({
        _id: summary._id,
        subject: {
          _id: summary.subjectId._id,
          name: summary.subjectId.name,
          code: summary.subjectId.code,
          includeInAverage: summary.subjectId.includeInAverage
        },
        averages: summary.averages || {},
        average: summary.average,
        result: summary.result,
        semester: summary.semester,
        schoolYear: summary.schoolYear
      });

      // Add year record data if available
      if (yearRecord) {
        student.gpa = yearRecord.gpa;
        student.conduct = yearRecord.conduct;
        student.academicLevel = yearRecord.academicLevel || null;
        student.rank = yearRecord.rank || null; // Rank trong lớp
        student.rankGrade = yearRecord.rankGrade || null; // Rank trong khối
      }
    });

    // Calculate semester/year averages (chỉ tính các môn có includeInAverage !== false)
    const result = Array.from(studentMap.values()).map(student => {
      if (student.subjects && student.subjects.length > 0) {
        // ✅ Chỉ tính các môn có includeInAverage !== false
        const validAverages = student.subjects
          .filter(s => {
            // Kiểm tra includeInAverage từ subject object
            const subject = s.subject || {};
            const includeInAverage = subject.includeInAverage;
            return s.average !== null && 
                   s.average !== undefined && 
                   includeInAverage !== false;
          })
          .map(s => s.average);
        if (validAverages.length > 0) {
          const calculatedAverage = validAverages.reduce((a, b) => a + b, 0) / validAverages.length;
          student.semesterAverage = calculatedAverage;
          // ✅ Nếu chưa có GPA từ yearRecord, dùng calculatedAverage
          if (!student.gpa || student.gpa === 0) {
            student.gpa = calculatedAverage;
          }
        }
      }
      return student;
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      filters: { schoolYear, semester, classId, subjectId, grade, keyword }
    });
  } catch (err) {
    console.error('[GradeController::getAllStudentsGrades]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy điểm', error: err.message });
  }
};

/* =========================================================
   📊 LẤY ĐIỂM NHIỀU HỌC SINH VỚI XU HƯỚNG
   - Tương tự getAllStudentsGrades nhưng có thêm xu hướng
========================================================= */
exports.getAllStudentsGradesWithTrend = async (req, res) => {
  try {
    const { schoolYear, semester, classId, subjectId, grade, keyword } = req.query;
    
    // Build query (giống getAllStudentsGrades)
    let studentQuery = {};
    const { isDeleted = 'false' } = req.query;
    if (isDeleted !== 'true') {
      studentQuery.isDeleted = { $ne: true };
    }

    if (classId) {
      studentQuery.classId = classId;
    } else if (grade) {
      const classes = await Class.find({ grade: String(grade) }).select('_id').lean();
      studentQuery.classId = { $in: classes.map(c => c._id) };
    }
    if (keyword) {
      studentQuery.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { studentCode: { $regex: keyword, $options: 'i' } }
      ];
    }

    if (schoolYear && studentQuery.classId) {
      const classInfo = await Class.findById(studentQuery.classId).select('year').lean();
      if (classInfo) {
        studentQuery.currentYear = classInfo.year;
      }
    } else if (schoolYear && studentQuery.classId && studentQuery.classId.$in) {
      const classes = await Class.find({ _id: { $in: studentQuery.classId.$in } }).select('year').lean();
      const classYears = [...new Set(classes.map(c => c.year).filter(Boolean))];
      if (classYears.length === 1) {
        studentQuery.currentYear = classYears[0];
      }
    }
    
    const students = await Student.find(studentQuery)
      .populate({
        path: 'classId',
        select: 'className classCode grade year',
        match: schoolYear ? { year: schoolYear } : {}
      })
      .lean();
    
    const validStudents = students.filter(s => {
      if (!s.classId) return false;
      if (schoolYear && s.classId.year && String(s.classId.year) !== String(schoolYear)) {
        return false;
      }
      return true;
    });
    const studentIds = validStudents.map(s => s._id);

    const gradeItemsQuery = { 
      studentId: { $in: studentIds },
      isDeleted: { $ne: true } // ✅ Chỉ lấy điểm chưa bị xóa
    };
    if (schoolYear) gradeItemsQuery.schoolYear = schoolYear;
    if (semester) gradeItemsQuery.semester = semester;
    if (subjectId) gradeItemsQuery.subjectId = subjectId;

    const gradeItemDocs = studentIds.length
      ? await GradeItem.find(gradeItemsQuery)
          .select('studentId subjectId component score attempt createdAt')
          .sort({ studentId: 1, subjectId: 1, component: 1, attempt: 1, createdAt: 1 })
          .lean()
      : [];

    const createEmptyGradeItems = () => ({
      oral: [],
      quiz15: [],
      quiz45: [],
      midterm: [],
      final: [],
    });

    const gradeItemsMap = new Map();
    gradeItemDocs.forEach(item => {
      const key = `${item.studentId}-${item.subjectId}`;
      if (!gradeItemsMap.has(key)) {
        gradeItemsMap.set(key, createEmptyGradeItems());
      }
      const entry = gradeItemsMap.get(key);
      if (entry && item.component && entry[item.component]) {
        entry[item.component].push(Number(item.score));
      }
    });

    let summaryQuery = { studentId: { $in: studentIds } };
    if (schoolYear) summaryQuery.schoolYear = schoolYear;
    if (semester) summaryQuery.semester = semester;
    if (subjectId) summaryQuery.subjectId = subjectId;

    const summaries = await GradeSummary.find(summaryQuery)
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .lean();

    // Query StudentYearRecord: lấy cả CN và học kỳ để có đủ hạnh kiểm và học lực
    let yearRecordQuery = { studentId: { $in: studentIds } };
    if (schoolYear) yearRecordQuery.year = schoolYear;
    // Không filter theo semester để lấy cả CN và học kỳ (hạnh kiểm thường ở CN)
    // Sắp xếp theo updatedAt giảm dần để ưu tiên record mới nhất nếu có nhiều record
    const yearRecords = await StudentYearRecord.find(yearRecordQuery)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .sort({ updatedAt: -1 }) // ✅ Ưu tiên record mới nhất
      .lean();

    // Group by student
    const studentMap = new Map();
    validStudents.forEach(s => {
      studentMap.set(String(s._id), {
        _id: s._id,
        name: s.name,
        studentCode: s.studentCode,
        class: s.classId ? {
          _id: s.classId._id,
          className: s.classId.className,
          classCode: s.classId.classCode,
          grade: s.classId.grade
        } : null,
        subjects: [],
        trends: null, // Sẽ được tính sau
      });
    });

    // ✅ Gán GPA, hạnh kiểm và học lực cho từng học sinh (lấy đúng theo semester)
    Array.from(studentMap.values()).forEach(student => {
      const studentId = String(student._id);
      
      // ✅ Xác định semester code
      const semesterCode = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : (semester || 'CN');
      
      // ✅ Lấy tất cả records của học sinh
      // Lưu ý: yr.studentId có thể là ObjectId hoặc string, cần normalize
      // QUAN TRỌNG: Vì đã sort theo updatedAt giảm dần, find() sẽ lấy record mới nhất
      // Normalize studentId để so sánh chính xác (giống logic trong getHomeroomClassClassification)
      const normalizedStudentId = String(studentId);
      
      // Helper function để normalize studentId từ yearRecord (giống getHomeroomClassClassification)
      const normalizeYearRecordStudentId = (r) => {
        // Logic giống getHomeroomClassClassification: String(r.studentId?._id || r.studentId)
        return String(r.studentId?._id || r.studentId);
      };
      
      const hk1Record = yearRecords.find(yr => {
        const rStudentId = normalizeYearRecordStudentId(yr);
        const yrYear = String(yr.year || '');
        return rStudentId === normalizedStudentId &&
          (!schoolYear || yrYear === String(schoolYear)) &&
          yr.semester === 'HK1';
      });
      const hk2Record = yearRecords.find(yr => {
        const rStudentId = normalizeYearRecordStudentId(yr);
        const yrYear = String(yr.year || '');
        return rStudentId === normalizedStudentId &&
          (!schoolYear || yrYear === String(schoolYear)) &&
          yr.semester === 'HK2';
      });
      const cnRecord = yearRecords.find(yr => {
        const rStudentId = normalizeYearRecordStudentId(yr);
        const yrYear = String(yr.year || '');
        return rStudentId === normalizedStudentId &&
          (!schoolYear || yrYear === String(schoolYear)) &&
          yr.semester === 'CN';
      });
      
      // Debug: Log để kiểm tra (chỉ log cho học sinh đầu tiên hoặc học sinh cụ thể)
      if (student.studentCode === '2025100002' || studentMap.size === 1 || String(student._id) === String(Array.from(studentMap.keys())[0])) {
        const matchingRecords = yearRecords.filter(yr => {
          const yrStudentId = normalizeYearRecordStudentId(yr);
          return yrStudentId === normalizedStudentId && (!schoolYear || String(yr.year || '') === String(schoolYear));
        });
        console.log('🔍 [getAllStudentsGradesWithTrend] Debug for student:', {
          studentName: student.name,
          studentCode: student.studentCode,
          studentId: normalizedStudentId,
          schoolYear,
          totalYearRecords: yearRecords.length,
          matchingRecordsCount: matchingRecords.length,
          matchingRecords: matchingRecords.map(yr => ({
            semester: yr.semester,
            academicLevel: yr.academicLevel,
            gpa: yr.gpa,
            year: yr.year,
            studentId: normalizeYearRecordStudentId(yr),
            studentIdRaw: yr.studentId
          })),
          hk1Record: hk1Record ? { 
            semester: hk1Record.semester, 
            academicLevel: hk1Record.academicLevel,
            studentId: normalizeYearRecordStudentId({ studentId: hk1Record.studentId })
          } : null,
          hk2Record: hk2Record ? { 
            semester: hk2Record.semester, 
            academicLevel: hk2Record.academicLevel,
            studentId: normalizeYearRecordStudentId({ studentId: hk2Record.studentId })
          } : null,
          cnRecord: cnRecord ? { 
            semester: cnRecord.semester, 
            academicLevel: cnRecord.academicLevel,
            studentId: normalizeYearRecordStudentId({ studentId: cnRecord.studentId })
          } : null
        });
      }
      
      // ✅ Lấy GPA theo semester được chọn
      let gpaRecord = null;
      if (semesterCode === 'HK1' && hk1Record) {
        gpaRecord = hk1Record;
      } else if (semesterCode === 'HK2' && hk2Record) {
        gpaRecord = hk2Record;
      } else if (cnRecord) {
        gpaRecord = cnRecord;
      }
      
      if (gpaRecord && gpaRecord.gpa !== null && gpaRecord.gpa !== undefined) {
        student.gpa = gpaRecord.gpa;
      }
      
      // ✅ Lấy học lực theo semester được chọn (giống logic trong getHomeroomClassClassification)
      // Nếu semester là undefined (overview), không set academicLevel chung
      // Frontend sẽ tự quyết định từ academicLevelHK1/HK2/CN dựa trên overviewView
      // Chỉ set academicLevel chung khi có semester cụ thể (để tương thích với code cũ)
      if (semester) {
        const semesterCodeForAcademic = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : semester;
        let academicRecord = null;
        if (semesterCodeForAcademic === 'CN') {
          academicRecord = cnRecord;
        } else if (semesterCodeForAcademic === 'HK1') {
          academicRecord = hk1Record;
        } else if (semesterCodeForAcademic === 'HK2') {
          academicRecord = hk2Record;
        }
        // Chỉ set academicLevel chung nếu có record và có giá trị
        if (academicRecord && academicRecord.academicLevel !== null && academicRecord.academicLevel !== undefined) {
          student.academicLevel = academicRecord.academicLevel;
        }
      }
      
      // ✅ Lấy hạnh kiểm: ưu tiên record theo semester (đã chốt), fallback về CN (đã chốt)
      let conductRecord = null;
      if (semesterCode === 'HK1' && hk1Record && (hk1Record.conductStatus === 'locked' || hk1Record.conductStatus === 'approved')) {
        conductRecord = hk1Record;
      } else if (semesterCode === 'HK2' && hk2Record && (hk2Record.conductStatus === 'locked' || hk2Record.conductStatus === 'approved')) {
        conductRecord = hk2Record;
      } else if (cnRecord && (cnRecord.conductStatus === 'locked' || cnRecord.conductStatus === 'approved')) {
        conductRecord = cnRecord;
      }
      
      if (conductRecord) {
        student.conduct = conductRecord.conduct;
      }
      
      // ✅ Lấy rank theo từng học kỳ (nếu có)
      if (hk1Record) {
        if (hk1Record.rank !== null && hk1Record.rank !== undefined) {
          student.rankHK1 = hk1Record.rank;
        }
        if (hk1Record.rankGrade !== null && hk1Record.rankGrade !== undefined) {
          student.rankGradeHK1 = hk1Record.rankGrade;
        }
      }
      if (hk2Record) {
        if (hk2Record.rank !== null && hk2Record.rank !== undefined) {
          student.rankHK2 = hk2Record.rank;
        }
        if (hk2Record.rankGrade !== null && hk2Record.rankGrade !== undefined) {
          student.rankGradeHK2 = hk2Record.rankGrade;
        }
      }
      if (cnRecord) {
        // Rank từ record CN (ưu tiên cho overview)
        student.rank = cnRecord.rank || null;
        student.rankGrade = cnRecord.rankGrade || null;
        if (cnRecord.rank !== null && cnRecord.rank !== undefined) {
          student.rankCN = cnRecord.rank;
        }
        if (cnRecord.rankGrade !== null && cnRecord.rankGrade !== undefined) {
          student.rankGradeCN = cnRecord.rankGrade;
        }
      }
      
      // ✅ Tính điểm TB học kỳ
      if (hk1Record && hk1Record.gpa) {
        student.hk1Average = hk1Record.gpa;
        student.semester1Average = hk1Record.gpa;
      }
      if (hk2Record && hk2Record.gpa) {
        student.hk2Average = hk2Record.gpa;
        student.semester2Average = hk2Record.gpa;
      }
      if (cnRecord && cnRecord.gpa) {
        student.yearAverage = cnRecord.gpa;
      }
    });

    // Add summaries to students
    summaries.forEach(summary => {
      const studentId = String(summary.studentId);
      if (!studentMap.has(studentId)) return;
      
      const student = studentMap.get(studentId);
      if (!student.subjects) student.subjects = [];

      const gradeItemsKey = `${summary.studentId}-${summary.subjectId._id}`;
      const subjectGradeItems = gradeItemsMap.get(gradeItemsKey) || createEmptyGradeItems();

      student.subjects.push({
        _id: summary._id,
        subject: {
          _id: summary.subjectId._id,
          name: summary.subjectId.name,
          code: summary.subjectId.code,
          includeInAverage: summary.subjectId.includeInAverage
        },
        averages: summary.averages || {},
        average: summary.average,
        result: summary.result,
        isOfficial: !!summary.isOfficial,
        officialAt: summary.officialAt || null,
        officialBy: summary.officialBy || null,
        semester: summary.semester,
        schoolYear: summary.schoolYear,
        gradeItems: subjectGradeItems,
      });
    });

    // ✅ Tính xu hướng cho từng học sinh (song song)
    const trendPromises = Array.from(studentMap.values()).map(async (student) => {
      if (schoolYear && semester) {
        const trends = await calculateStudentTrend(student._id, schoolYear, semester);
        student.trends = trends;
      }
      return student;
    });
    await Promise.all(trendPromises);

    // Calculate semester/year averages
    const result = Array.from(studentMap.values()).map(student => {
      const studentId = String(student._id);
      
      // ✅ Helper function để normalize studentId từ yearRecord (giống logic trong forEach)
      const normalizeYearRecordStudentId = (r) => {
        // Logic giống getHomeroomClassClassification: String(r.studentId?._id || r.studentId)
        return String(r.studentId?._id || r.studentId);
      };
      
      // ✅ Luôn lấy điểm TB và hạnh kiểm từ yearRecords (dùng normalize để so sánh chính xác)
      const normalizedStudentId = String(studentId);
      const hk1Record = yearRecords.find(yr => {
        const rStudentId = normalizeYearRecordStudentId(yr);
        const yrYear = String(yr.year || '');
        return rStudentId === normalizedStudentId &&
          (!schoolYear || yrYear === String(schoolYear)) &&
          yr.semester === 'HK1';
      });
      const hk2Record = yearRecords.find(yr => {
        const rStudentId = normalizeYearRecordStudentId(yr);
        const yrYear = String(yr.year || '');
        return rStudentId === normalizedStudentId &&
          (!schoolYear || yrYear === String(schoolYear)) &&
          yr.semester === 'HK2';
      });
      const cnRecord = yearRecords.find(yr => {
        const rStudentId = normalizeYearRecordStudentId(yr);
        const yrYear = String(yr.year || '');
        return rStudentId === normalizedStudentId &&
          (!schoolYear || yrYear === String(schoolYear)) &&
          yr.semester === 'CN';
      });
      
      // ✅ Lấy điểm TB từ yearRecords cho từng học kỳ (luôn ưu tiên từ yearRecord)
      // Luôn set từ yearRecords trước, sau đó mới tính từ subjects nếu chưa có
      if (hk1Record && hk1Record.gpa !== null && hk1Record.gpa !== undefined) {
        student.hk1Average = Number(hk1Record.gpa);
        student.semester1Average = Number(hk1Record.gpa);
      }
      if (hk2Record && hk2Record.gpa !== null && hk2Record.gpa !== undefined) {
        student.hk2Average = Number(hk2Record.gpa);
        student.semester2Average = Number(hk2Record.gpa);
      }
      if (cnRecord && cnRecord.gpa !== null && cnRecord.gpa !== undefined) {
        student.yearAverage = Number(cnRecord.gpa);
      }
      
      // ✅ Set student.gpa theo semester được chọn
      const semesterCode = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : (semester === 'CN' || semester === 'Cả năm' ? 'CN' : (semester || 'CN'));
      if (semesterCode === 'HK1') {
        // Nếu chọn HK1, lấy GPA từ HK1
        if (hk1Record && hk1Record.gpa !== null && hk1Record.gpa !== undefined) {
          student.gpa = hk1Record.gpa;
        } else if (!student.gpa && student.hk1Average) {
          student.gpa = student.hk1Average;
        }
      } else if (semesterCode === 'HK2') {
        // Nếu chọn HK2, lấy GPA từ HK2
        if (hk2Record && hk2Record.gpa !== null && hk2Record.gpa !== undefined) {
          student.gpa = hk2Record.gpa;
        } else if (!student.gpa && student.hk2Average) {
          student.gpa = student.hk2Average;
        }
      } else {
        // Nếu không có semester hoặc CN, lấy GPA từ CN
        if (cnRecord && cnRecord.gpa !== null && cnRecord.gpa !== undefined) {
          student.gpa = cnRecord.gpa;
        } else if (!student.gpa && student.yearAverage) {
          student.gpa = student.yearAverage;
        }
      }
      
      // ✅ Luôn lấy hạnh kiểm theo từng học kỳ (chỉ khi đã chốt)
      if (hk1Record && (hk1Record.conductStatus === 'locked' || hk1Record.conductStatus === 'approved')) {
        student.conductHK1 = hk1Record.conduct;
      }
      if (hk2Record && (hk2Record.conductStatus === 'locked' || hk2Record.conductStatus === 'approved')) {
        student.conductHK2 = hk2Record.conduct;
      }
      if (cnRecord && (cnRecord.conductStatus === 'locked' || cnRecord.conductStatus === 'approved')) {
        student.conductCN = cnRecord.conduct;
        // Nếu chưa có conduct chung, dùng CN
        if (!student.conduct) {
          student.conduct = cnRecord.conduct;
        }
      }
      
      // ✅ Lấy học lực cho từng học kỳ (luôn set nếu có)
      // QUAN TRỌNG: Set học lực từ record nếu có, không cần kiểm tra conductStatus
      // (khác với hạnh kiểm - chỉ lấy khi đã chốt)
      // Debug: Log trước khi set
      const isDebugStudent = student.studentCode === '2025100002';
      if (isDebugStudent) {
        console.log('🔍 [getAllStudentsGradesWithTrend] Before setting academicLevel:', {
          studentName: student.name,
          studentCode: student.studentCode,
          hk1Record: hk1Record ? { academicLevel: hk1Record.academicLevel } : null,
          hk2Record: hk2Record ? { academicLevel: hk2Record.academicLevel } : null,
          cnRecord: cnRecord ? { academicLevel: cnRecord.academicLevel } : null
        });
      }
      
      if (hk1Record && hk1Record.academicLevel !== null && hk1Record.academicLevel !== undefined) {
        student.academicLevelHK1 = hk1Record.academicLevel;
        if (isDebugStudent) {
          console.log('✅ [getAllStudentsGradesWithTrend] Set academicLevelHK1:', {
            studentName: student.name,
            studentCode: student.studentCode,
            hk1RecordAcademicLevel: hk1Record.academicLevel,
            studentAcademicLevelHK1: student.academicLevelHK1
          });
        }
      }
      if (hk2Record && hk2Record.academicLevel !== null && hk2Record.academicLevel !== undefined) {
        student.academicLevelHK2 = hk2Record.academicLevel;
        if (isDebugStudent) {
          console.log('✅ [getAllStudentsGradesWithTrend] Set academicLevelHK2:', {
            studentName: student.name,
            studentCode: student.studentCode,
            hk2RecordAcademicLevel: hk2Record.academicLevel,
            studentAcademicLevelHK2: student.academicLevelHK2
          });
        }
      }
      if (cnRecord && cnRecord.academicLevel !== null && cnRecord.academicLevel !== undefined) {
        student.academicLevelCN = cnRecord.academicLevel;
        if (isDebugStudent) {
          console.log('✅ [getAllStudentsGradesWithTrend] Set academicLevelCN:', {
            studentName: student.name,
            studentCode: student.studentCode,
            cnRecordAcademicLevel: cnRecord.academicLevel,
            studentAcademicLevelCN: student.academicLevelCN
          });
        }
      }
      
      // Debug: Log sau khi set tất cả
      if (isDebugStudent) {
        console.log('📊 [getAllStudentsGradesWithTrend] Final academicLevel fields:', {
          studentName: student.name,
          studentCode: student.studentCode,
          academicLevelHK1: student.academicLevelHK1,
          academicLevelHK2: student.academicLevelHK2,
          academicLevelCN: student.academicLevelCN,
          academicLevel: student.academicLevel
        });
      }
      
      // Tính điểm TB từ subjects nếu chưa có từ yearRecords (chỉ tính các môn có includeInAverage !== false)
      // Nếu semester là undefined (overview), tính cho từng học kỳ riêng biệt
      if (student.subjects && student.subjects.length > 0) {
        // Nếu semester là undefined (overview), tính điểm TB cho từng học kỳ
        if (!semester) {
          // Tính cho HK1: lấy subjects có semester === '1' hoặc 'HK1'
          const hk1Subjects = student.subjects.filter(s => {
            const subjSemester = String(s.semester || '').trim();
            const isHK1 = subjSemester === '1' || subjSemester === 'HK1' || subjSemester === 'hk1';
            return isHK1 && 
                   s.average !== null && 
                   s.average !== undefined &&
                   s.subject && 
                   s.subject.includeInAverage !== false;
          });
          if (hk1Subjects.length > 0 && (student.hk1Average === null || student.hk1Average === undefined)) {
            const hk1Avgs = hk1Subjects.map(s => s.average).filter(v => typeof v === 'number' && !isNaN(v));
            if (hk1Avgs.length > 0) {
              const calculated = hk1Avgs.reduce((a, b) => a + b, 0) / hk1Avgs.length;
              student.hk1Average = Number(calculated.toFixed(2));
              student.semester1Average = student.hk1Average;
            }
          }
          
          // Tính cho HK2: lấy subjects có semester === '2' hoặc 'HK2'
          const hk2Subjects = student.subjects.filter(s => {
            const subjSemester = String(s.semester || '').trim();
            const isHK2 = subjSemester === '2' || subjSemester === 'HK2' || subjSemester === 'hk2';
            return isHK2 && 
                   s.average !== null && 
                   s.average !== undefined &&
                   s.subject && 
                   s.subject.includeInAverage !== false;
          });
          if (hk2Subjects.length > 0 && (student.hk2Average === null || student.hk2Average === undefined)) {
            const hk2Avgs = hk2Subjects.map(s => s.average).filter(v => typeof v === 'number' && !isNaN(v));
            if (hk2Avgs.length > 0) {
              const calculated = hk2Avgs.reduce((a, b) => a + b, 0) / hk2Avgs.length;
              student.hk2Average = Number(calculated.toFixed(2));
              student.semester2Average = student.hk2Average;
            }
          }
          
          // Tính cho cả năm: lấy tất cả subjects (hoặc tính từ HK1 và HK2)
          if (student.yearAverage === null || student.yearAverage === undefined) {
            if (student.hk1Average !== null && student.hk1Average !== undefined && 
                student.hk2Average !== null && student.hk2Average !== undefined) {
              student.yearAverage = Number(((student.hk1Average + student.hk2Average) / 2).toFixed(2));
            } else {
              const allSubjects = student.subjects.filter(s => {
                return s.average !== null && 
                       s.average !== undefined &&
                       s.subject && 
                       s.subject.includeInAverage !== false;
              });
              if (allSubjects.length > 0) {
                const allAvgs = allSubjects.map(s => s.average).filter(v => typeof v === 'number' && !isNaN(v));
                if (allAvgs.length > 0) {
                  const calculated = allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length;
                  student.yearAverage = Number(calculated.toFixed(2));
                }
              }
            }
          }
        } else {
          // Nếu có semester, tính semesterAverage như cũ
          const validAverages = student.subjects
            .filter(s => {
              // Kiểm tra includeInAverage từ subject object
              const subject = s.subject || {};
              const includeInAverage = subject.includeInAverage;
              return s.average !== null && 
                     s.average !== undefined && 
                     includeInAverage !== false;
            })
            .map(s => s.average);
          if (validAverages.length > 0) {
            const calculatedAverage = validAverages.reduce((a, b) => a + b, 0) / validAverages.length;
            if (!student.semesterAverage) {
              student.semesterAverage = calculatedAverage;
            }
          }
        }
      }
      
      return student;
    });

    // ✅ Debug: Kiểm tra academicLevel fields trước khi trả về
    const debugStudent = result.find(s => s.studentCode === '2025100002');
    if (debugStudent) {
      console.log('🔍 [getAllStudentsGradesWithTrend] Before returning response:', {
        studentName: debugStudent.name,
        studentCode: debugStudent.studentCode,
        academicLevelHK1: debugStudent.academicLevelHK1,
        academicLevelHK2: debugStudent.academicLevelHK2,
        academicLevelCN: debugStudent.academicLevelCN,
        academicLevel: debugStudent.academicLevel
      });
    }

    res.json({
      success: true,
      count: result.length,
      data: result,
      filters: { schoolYear, semester, classId, subjectId, grade, keyword }
    });
  } catch (err) {
    console.error('[GradeController::getAllStudentsGradesWithTrend]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy điểm', error: err.message });
  }
};

// GET /grades/admin/statistics - Thống kê điểm theo lớp/khối/năm học
exports.getStatistics = async (req, res) => {
  try {
    const { schoolYear, semester, classId, grade } = req.query;
    console.log('📊 [getStatistics] Request params:', { schoolYear, semester, classId, grade });

    // Build query
    let classQuery = {};
    if (classId) {
      classQuery._id = classId;
    } else if (grade) {
      classQuery.grade = String(grade);
    }

    const classes = await Class.find(classQuery).lean();
    const classIds = classes.map(c => c._id);

    // ✅ Get students in these classes - Filter by currentYear if schoolYear is provided
    let studentQuery = { 
      classId: { $in: classIds },
      isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
    };
    if (schoolYear) {
      // Lấy năm học của các lớp
      const classYears = [...new Set(classes.map(c => c.year).filter(Boolean))];
      if (classYears.length === 1) {
        studentQuery.currentYear = classYears[0];
      }
    }
    
    console.log('📊 [getStatistics] Querying students with:', studentQuery);

    const students = await Student.find(studentQuery)
      .populate({
        path: 'classId',
        select: 'className classCode grade year'
      })
      .lean();

    console.log('📊 [getStatistics] Found students:', students.length);

    // ✅ Lọc lại để chỉ lấy học sinh có classId hợp lệ và đúng năm học (nếu có schoolYear)
    const validStudents2 = students.filter(s => {
      if (!s.classId) return false;
      if (schoolYear && s.classId.year && String(s.classId.year) !== String(schoolYear)) {
        return false;
      }
      return true;
    });

    console.log('📊 [getStatistics] Valid students after filter:', validStudents2.length);

    const studentIds = validStudents2.map(s => s._id);

    // Get grade summaries
    let summaryQuery = { studentId: { $in: studentIds } };
    if (schoolYear) summaryQuery.schoolYear = schoolYear;
    if (semester) summaryQuery.semester = semester;

    console.log('📊 [getStatistics] Querying summaries with:', summaryQuery);

    const summaries = await GradeSummary.find(summaryQuery)
      .populate('subjectId', 'name')
      .populate('classId', 'className grade')
      .lean();

    console.log('📊 [getStatistics] Found summaries:', summaries.length);

    // Get year records for academic level
    let yearRecordQuery = { studentId: { $in: studentIds } };
    if (schoolYear) yearRecordQuery.year = schoolYear;
    if (semester) {
      if (semester === '1') yearRecordQuery.semester = 'HK1';
      else if (semester === '2') yearRecordQuery.semester = 'HK2';
      else if (semester === 'CN') yearRecordQuery.semester = 'CN';
    }

    console.log('📊 [getStatistics] Querying yearRecords with:', yearRecordQuery);

    const yearRecords = await StudentYearRecord.find(yearRecordQuery).lean();
    console.log('📊 [getStatistics] Found yearRecords:', yearRecords.length);

    console.log('📊 [getStatistics] Starting calculation...');

    // Calculate statistics
    const stats = {
      byClass: {},
      byGrade: {},
      overall: {
        excellent: 0,
        good: 0,
        average: 0,
        weak: 0,
        total: validStudents2.length
      },
      // ✅ Thống kê hạnh kiểm
      conduct: {
        'Tốt': 0,
        'Khá': 0,
        'Trung bình': 0,
        'Yếu': 0
      },
      // ✅ Thống kê học lực
      academicLevel: {
        'Giỏi': 0,
        'Khá': 0,
        'Trung bình': 0,
        'Yếu': 0
      }
    };

    // Group by class
    classes.forEach(cls => {
      const clsStudents = validStudents2.filter(s => String(s.classId) === String(cls._id));
      const clsStudentIds = clsStudents.map(s => String(s._id));
      const clsYearRecords = yearRecords.filter(yr => clsStudentIds.includes(String(yr.studentId)));

      const excellent = clsYearRecords.filter(yr => yr.academicLevel === 'Giỏi').length;
      const good = clsYearRecords.filter(yr => yr.academicLevel === 'Khá').length;
      const average = clsYearRecords.filter(yr => yr.academicLevel === 'Trung bình').length;
      const weak = clsYearRecords.filter(yr => yr.academicLevel === 'Yếu').length;

      stats.byClass[cls.className] = {
        className: cls.className,
        classCode: cls.classCode,
        grade: cls.grade,
        total: clsStudents.length,
        excellent,
        good,
        average,
        weak
      };

      // Aggregate by grade
      if (!stats.byGrade[cls.grade]) {
        stats.byGrade[cls.grade] = {
          grade: cls.grade,
          total: 0,
          excellent: 0,
          good: 0,
          average: 0,
          weak: 0
        };
      }
      stats.byGrade[cls.grade].total += clsStudents.length;
      stats.byGrade[cls.grade].excellent += excellent;
      stats.byGrade[cls.grade].good += good;
      stats.byGrade[cls.grade].average += average;
      stats.byGrade[cls.grade].weak += weak;
    });

    try {
      // ✅ Tính toán thống kê học lực (academicLevel)
      const excellent = yearRecords.filter(yr => yr.academicLevel === 'Giỏi').length;
      const good = yearRecords.filter(yr => yr.academicLevel === 'Khá').length;
      const average = yearRecords.filter(yr => yr.academicLevel === 'Trung bình').length;
      const weak = yearRecords.filter(yr => yr.academicLevel === 'Yếu').length;

      stats.overall = {
        excellent,
        good,
        average,
        weak,
        total: validStudents2.length
      };

      // ✅ Tính toán thống kê hạnh kiểm (conduct) - chỉ lấy những record đã chốt (locked hoặc approved)
      const lockedOrApprovedRecords = yearRecords.filter(yr => 
        yr.conductStatus === 'locked' || yr.conductStatus === 'approved'
      );
      
      stats.conduct['Tốt'] = lockedOrApprovedRecords.filter(yr => yr.conduct === 'Tốt').length;
      stats.conduct['Khá'] = lockedOrApprovedRecords.filter(yr => yr.conduct === 'Khá').length;
      stats.conduct['Trung bình'] = lockedOrApprovedRecords.filter(yr => yr.conduct === 'Trung bình').length;
      stats.conduct['Yếu'] = lockedOrApprovedRecords.filter(yr => yr.conduct === 'Yếu').length;

      // ✅ Tính toán thống kê học lực (academicLevel)
      stats.academicLevel['Giỏi'] = excellent;
      stats.academicLevel['Khá'] = good;
      stats.academicLevel['Trung bình'] = average;
      stats.academicLevel['Yếu'] = weak;

      console.log('📊 [getStatistics] Final stats:', JSON.stringify(stats, null, 2));

      res.json({
        success: true,
        data: stats,
        filters: { schoolYear, semester, classId, grade }
      });
    } catch (calcError) {
      console.error('❌ [getStatistics] Calculation error:', calcError);
      res.status(500).json({
        success: false,
        message: 'Lỗi tính toán thống kê',
        error: calcError.message
      });
    }
  } catch (err) {
    console.error('[GradeController::getStatistics]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy thống kê', error: err.message });
  }
};

// GET /grades/admin/audit-log - Lịch sử nhập/sửa điểm
exports.getAuditLog = async (req, res) => {
  try {
    const { studentId, subjectId, classId, schoolYear, semester, limit = 100 } = req.query;

    let query = {};
    if (studentId) query.studentId = studentId;
    if (subjectId) query.subjectId = subjectId;
    if (classId) query.classId = classId;
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;

    const gradeItems = await GradeItem.find(query)
      .populate('studentId', 'name studentCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className')
      .populate('teacherId', 'name teacherCode')
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .lean();

    const auditLog = gradeItems.map(item => ({
      _id: item._id,
      student: item.studentId ? {
        _id: item.studentId._id,
        name: item.studentId.name,
        studentCode: item.studentId.studentCode
      } : null,
      subject: item.subjectId ? {
        _id: item.subjectId._id,
        name: item.subjectId.name,
        code: item.subjectId.code
      } : null,
      class: item.classId ? {
        _id: item.classId._id,
        className: item.classId.className
      } : null,
      component: item.component,
      score: item.score,
      teacher: item.teacherId ? {
        _id: item.teacherId._id,
        name: item.teacherId.name,
        teacherCode: item.teacherId.teacherCode
      } : null,
      // ✅ Include actor info for admin/teacher actions
      performedBy: item.performedBy || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      schoolYear: item.schoolYear,
      semester: item.semester
    }));

    res.json({
      success: true,
      count: auditLog.length,
      data: auditLog
    });
  } catch (err) {
    console.error('[GradeController::getAuditLog]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy lịch sử', error: err.message });
  }
};

// PUT /grades/admin/item/:id - Admin cập nhật điểm
exports.updateGradeItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, notes } = req.body;
    const { role, accountId } = req.user;

    if (score === undefined && !notes) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin cập nhật' });
    }

    const updateData = {};
    if (score !== undefined) {
      if (score < 0 || score > 10) {
        return res.status(400).json({ success: false, message: 'Điểm phải từ 0 đến 10' });
      }
      updateData.score = score;
    }
    if (notes !== undefined) updateData.notes = notes;
    // ✅ Track actor consistently
    updateData.performedBy = { role, accountId };
    if (role === 'teacher') {
      try {
        const TeacherModel = require('../../models/user/teacher');
        const t = await TeacherModel.findOne({ accountId }).select('_id').lean();
        if (t?._id) updateData.teacherId = t._id;
      } catch {}
    }

    const updatedItem = await GradeItem.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )
      .populate('studentId', 'name studentCode')
      .populate('subjectId', 'name')
      .populate('teacherId', 'name');

    if (!updatedItem) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm cần cập nhật' });
    }

    // Recompute summary
    await recomputeSummary({
      studentId: updatedItem.studentId,
      subjectId: updatedItem.subjectId,
      schoolYear: updatedItem.schoolYear,
      semester: updatedItem.semester
    });

    res.json({
      success: true,
      message: 'Đã cập nhật điểm thành công',
      data: updatedItem
    });
  } catch (err) {
    console.error('[GradeController::updateGradeItem]', err);
    res.status(500).json({ success: false, message: 'Không thể cập nhật điểm', error: err.message });
  }
};

// DELETE /grades/admin/item/:id - Admin xóa điểm
exports.deleteGradeItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await GradeItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm cần xóa' });
    }

    const { studentId, subjectId, schoolYear, semester } = item;

    // ✅ Xóa mềm và ghi nhận actor
    const { role, accountId } = req.user;
    await GradeItem.findByIdAndUpdate(id, { $set: { isDeleted: true, performedBy: { role, accountId } } });

    // Recompute summary
    await recomputeSummary({
      studentId,
      subjectId,
      schoolYear,
      semester
    });

    res.json({
      success: true,
      message: 'Đã xóa điểm thành công'
    });
  } catch (err) {
    console.error('[GradeController::deleteGradeItem]', err);
    res.status(500).json({ success: false, message: 'Không thể xóa điểm', error: err.message });
  }
};

/**
 * GET /grades/homeroom/all - GVCN xem tất cả điểm của lớp chủ nhiệm (tất cả môn)
 * Query: classId, schoolYear, semester
 */
exports.getHomeroomClassAllGrades = async (req, res) => {
  try {
    const { classId, schoolYear, semester } = req.query;
    const { role, accountId } = req.user;

    if (!classId || !schoolYear || !semester) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu tham số classId/schoolYear/semester' 
      });
    }

    // Kiểm tra quyền truy cập (đã được kiểm tra bởi middleware)
    const permissionContext = req.permissionContext || {};
    const isHomeroom = permissionContext.isHomeroom || false;
    const homeroomClassIds = permissionContext.homeroomClassIds || [];

    if (role === 'teacher' && isHomeroom) {
      if (!homeroomClassIds.includes(String(classId))) {
        return res.status(403).json({ 
          success: false, 
          message: 'Không phải lớp chủ nhiệm của bạn' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Không có quyền truy cập' 
      });
    }

    // ✅ Lấy thông tin lớp để lấy năm học
    const classInfo = await Class.findById(classId).select('year').lean();
    if (!classInfo) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }
    
    // ✅ Lấy tất cả học sinh trong lớp - CHỈ lấy học sinh của niên khóa tương ứng
    const students = await Student.find({ 
      classId, 
      status: 'active',
      currentYear: classInfo.year // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
    })
      .populate({
        path: 'classId',
        select: 'className classCode grade year',
        match: { year: classInfo.year } // ✅ Đảm bảo lớp thuộc năm học đúng
      })
      .lean();
    
    // ✅ Lọc lại để chỉ lấy học sinh có classId hợp lệ và đúng năm học
    const validStudents = students.filter(s => {
      if (!s.classId) return false;
      return String(s.classId.year || classInfo.year) === String(classInfo.year);
    });

    if (validStudents.length === 0) {
      return res.json({ 
        success: true, 
        count: 0, 
        data: [],
        message: 'Lớp không có học sinh nào' 
      });
    }

    const studentIds = validStudents.map(s => s._id);

    // Lấy tất cả điểm của học sinh trong lớp (tất cả môn)
    const gradeSummaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      schoolYear,
      semester
    })
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .lean();

    // ✅ Lấy yearRecords: lấy cả CN và học kỳ để có đủ dữ liệu
    const semesterCode = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : (semester || 'CN');
    const yearRecords = await StudentYearRecord.find({
      studentId: { $in: studentIds },
      year: schoolYear,
      $or: [
        { semester: semesterCode }, // Record theo semester được chọn
        { semester: 'CN' } // Record cả năm (fallback)
      ]
    })
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .lean();

    // Nhóm điểm theo học sinh
    const studentMap = new Map();
    validStudents.forEach(student => {
      studentMap.set(String(student._id), {
        _id: student._id,
        name: student.name,
        studentCode: student.studentCode,
        class: student.classId ? {
          _id: student.classId._id,
          className: student.classId.className,
          classCode: student.classId.classCode,
          grade: student.classId.grade
        } : null,
        subjects: [],
        conduct: null,
        academicLevel: null,
        gpa: null
      });
    });

    // ✅ Lấy log điểm để hiển thị người nhập gần nhất theo môn
    const GradeItemModel1 = require('../../models/grade/gradeItem');
    const latestItemsRaw1 = await GradeItemModel1.find({
      studentId: { $in: studentIds },
      classId,
      schoolYear,
      semester,
      isDeleted: { $ne: true }
    })
      .select('studentId subjectId teacherId date')
      .populate('teacherId', 'name teacherCode')
      .sort({ date: -1 })
      .lean();
    const latestMap1 = new Map();
    for (const it of latestItemsRaw1) {
      const key = `${String(it.studentId)}_${String(it.subjectId)}`;
      if (!latestMap1.has(key)) latestMap1.set(key, it);
    }

    // Thêm điểm từng môn vào học sinh
    gradeSummaries.forEach(summary => {
      const studentId = String(summary.studentId);
      if (!studentMap.has(studentId)) return;

      const student = studentMap.get(studentId);
      const lastKey = `${studentId}_${String(summary.subjectId._id || summary.subjectId)}`;
      const last = latestMap1.get(lastKey);
      student.subjects.push({
        _id: summary._id,
        subject: {
          _id: summary.subjectId._id,
          name: summary.subjectId.name,
          code: summary.subjectId.code,
          includeInAverage: summary.subjectId.includeInAverage
        },
        averages: summary.averages || {},
        average: summary.average,
        result: summary.result,
        semester: summary.semester,
        schoolYear: summary.schoolYear,
        lastUpdatedBy: last ? {
          teacher: last.teacherId ? { _id: last.teacherId._id || last.teacherId, name: last.teacherId.name, code: last.teacherId.teacherCode } : null,
          date: last.date,
        } : null
      });
    });

    // ✅ Thêm GPA, hạnh kiểm và học lực (lấy đúng theo semester được chọn)
    // Nhóm records theo học sinh để xử lý logic ưu tiên
    const recordsByStudent = new Map();
    yearRecords.forEach(record => {
      const studentId = String(record.studentId);
      if (!recordsByStudent.has(studentId)) {
        recordsByStudent.set(studentId, { hk1: null, hk2: null, cn: null });
      }
      const studentRecords = recordsByStudent.get(studentId);
      if (record.semester === 'HK1') studentRecords.hk1 = record;
      else if (record.semester === 'HK2') studentRecords.hk2 = record;
      else if (record.semester === 'CN') studentRecords.cn = record;
    });
    
    recordsByStudent.forEach((records, studentId) => {
      if (!studentMap.has(studentId)) return;
      const student = studentMap.get(studentId);
      
      // ✅ Lấy GPA từ record theo semester được chọn
      let gpaRecord = null;
      if (semesterCode === 'HK1' && records.hk1) {
        gpaRecord = records.hk1;
      } else if (semesterCode === 'HK2' && records.hk2) {
        gpaRecord = records.hk2;
      } else if (records.cn) {
        gpaRecord = records.cn;
      }
      
      if (gpaRecord && gpaRecord.gpa !== null && gpaRecord.gpa !== undefined) {
        student.gpa = gpaRecord.gpa;
      }
      
      // ✅ Lấy học lực từ record theo semester được chọn (ưu tiên record theo semester, fallback về CN)
      let academicRecord = null;
      if (semesterCode === 'HK1' && records.hk1 && records.hk1.academicLevel) {
        academicRecord = records.hk1;
      } else if (semesterCode === 'HK2' && records.hk2 && records.hk2.academicLevel) {
        academicRecord = records.hk2;
      } else if (records.cn && records.cn.academicLevel) {
        academicRecord = records.cn;
      } else if (semesterCode === 'HK1' && records.hk1) {
        academicRecord = records.hk1;
      } else if (semesterCode === 'HK2' && records.hk2) {
        academicRecord = records.hk2;
      }
      
      if (academicRecord) {
        student.academicLevel = academicRecord.academicLevel || null;
      }
      
      // ✅ Lấy hạnh kiểm: ưu tiên record theo semester (đã chốt), fallback về CN (đã chốt)
      let conductRecord = null;
      if (semesterCode === 'HK1' && records.hk1 && (records.hk1.conductStatus === 'locked' || records.hk1.conductStatus === 'approved')) {
        conductRecord = records.hk1;
      } else if (semesterCode === 'HK2' && records.hk2 && (records.hk2.conductStatus === 'locked' || records.hk2.conductStatus === 'approved')) {
        conductRecord = records.hk2;
      } else if (records.cn && (records.cn.conductStatus === 'locked' || records.cn.conductStatus === 'approved')) {
        conductRecord = records.cn;
      }
      
      if (conductRecord) {
        student.conduct = conductRecord.conduct;
      }
    });

    // ✅ Xác định tập môn bắt buộc tính ĐTB HK cho lớp (includeInAverage !== false)
    let requiredSubjectIds = new Set();
    try {
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assigns = await TeachingAssignment.find({
        classId,
        year: String(schoolYear),
        semester: String(semester)
      }).populate('subjectId', 'includeInAverage').lean();
      const subjectIds = assigns
        .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
        .map(a => String(a.subjectId._id || a.subjectId));
      subjectIds.forEach(id => requiredSubjectIds.add(id));
    } catch (e) {
      // ignore
    }
    if (requiredSubjectIds.size === 0) {
      const requiredSubjects = await Subject.find({
        grades: String(classInfo.grade),
        includeInAverage: { $ne: false }
      }).select('_id').lean();
      requiredSubjectIds = new Set(requiredSubjects.map(s => String(s._id)));
    }

    // Tính điểm trung bình học kỳ cho từng học sinh (chỉ khi đủ môn bắt buộc)
    const result = Array.from(studentMap.values()).map(student => {
      if (student.subjects && student.subjects.length > 0) {
        const finalizedIncluded = student.subjects.filter(
          s => s.average !== null && s.average !== undefined && s.subject && s.subject.includeInAverage !== false
        );
        const finalizedIds = new Set(finalizedIncluded.map(s => String(s.subject._id)));
        const hasAllRequired = requiredSubjectIds.size > 0 && [...requiredSubjectIds].every(id => finalizedIds.has(id));
        if (hasAllRequired) {
          const avgs = finalizedIncluded.map(s => s.average).filter(v => typeof v === 'number');
          if (avgs.length > 0) {
            student.semesterAverage = avgs.reduce((a, b) => a + b, 0) / avgs.length;
          }
        } else {
          student.semesterAverage = null;
        }
      }
      return student;
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      filters: { classId, schoolYear, semester }
    });
  } catch (err) {
    console.error('[GradeController::getHomeroomClassAllGrades]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Không thể lấy bảng điểm lớp chủ nhiệm', 
      error: err.message 
    });
  }
};

/* =========================================================
   📊 LẤY ĐIỂM LỚP CHỦ NHIỆM VỚI XU HƯỚNG
   - Tương tự getHomeroomClassAllGrades nhưng có thêm xu hướng
========================================================= */
exports.getHomeroomClassAllGradesWithTrend = async (req, res) => {
  try {
    const { classId, schoolYear, semester } = req.query;
    const { role, accountId } = req.user;

    if (!classId || !schoolYear || !semester) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu tham số classId/schoolYear/semester' 
      });
    }

    const permissionContext = req.permissionContext || {};
    const isHomeroom = permissionContext.isHomeroom || false;
    const homeroomClassIds = permissionContext.homeroomClassIds || [];

    if (role === 'teacher' && isHomeroom) {
      if (!homeroomClassIds.includes(String(classId))) {
        return res.status(403).json({ 
          success: false, 
          message: 'Không phải lớp chủ nhiệm của bạn' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Không có quyền truy cập' 
      });
    }

    const classInfo = await Class.findById(classId).select('year').lean();
    if (!classInfo) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }
    
    const students = await Student.find({ 
      classId, 
      status: 'active',
      currentYear: classInfo.year
    })
      .populate({
        path: 'classId',
        select: 'className classCode grade year',
        match: { year: classInfo.year }
      })
      .lean();
    
    const validStudents = students.filter(s => {
      if (!s.classId) return false;
      return String(s.classId.year || classInfo.year) === String(classInfo.year);
    });

    if (validStudents.length === 0) {
      return res.json({ 
        success: true, 
        count: 0, 
        data: [],
        message: 'Lớp không có học sinh nào' 
      });
    }

    const studentIds = validStudents.map(s => s._id);

    const gradeSummaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      schoolYear,
      semester
    })
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .lean();

    // Query StudentYearRecord: lấy cả CN và học kỳ để có đủ hạnh kiểm và học lực
    let yearRecordQuery = { studentId: { $in: studentIds }, year: schoolYear };
    // Không filter theo semester để lấy cả CN và học kỳ (hạnh kiểm thường ở CN)
    const yearRecords = await StudentYearRecord.find(yearRecordQuery)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .lean();

    const studentMap = new Map();
    validStudents.forEach(student => {
      studentMap.set(String(student._id), {
        _id: student._id,
        name: student.name,
        studentCode: student.studentCode,
        class: student.classId ? {
          _id: student.classId._id,
          className: student.classId.className,
          classCode: student.classId.classCode,
          grade: student.classId.grade
        } : null,
        subjects: [],
        conduct: null,
        academicLevel: null,
        gpa: null,
        trends: null, // Sẽ được tính sau
      });
    });

    // ✅ Lấy log điểm để hiển thị người nhập gần nhất và toàn bộ cột điểm (cùng class/year/semester)
    const GradeItemModel2 = require('../../models/grade/gradeItem');
    const gradeItemsRaw = await GradeItemModel2.find({
      studentId: { $in: studentIds },
      classId,
      schoolYear,
      semester,
      isDeleted: { $ne: true }
    })
      .select('studentId subjectId component score attempt teacherId date')
      .populate('teacherId', 'name teacherCode')
      .sort({ date: -1 })
      .lean();

    const latestMap2 = new Map();
    const gradeItemsMap = new Map();
    const gradeItemLogsMap = new Map();

    for (const item of gradeItemsRaw) {
      const key = `${String(item.studentId)}_${String(item.subjectId)}`;
      const component = item.component;
      if (!component) continue;

      if (!latestMap2.has(key)) {
        latestMap2.set(key, item);
      }

      if (!gradeItemsMap.has(key)) {
        gradeItemsMap.set(key, {});
      }
      if (!gradeItemLogsMap.has(key)) {
        gradeItemLogsMap.set(key, {});
      }

      const componentScores = gradeItemsMap.get(key);
      if (!Array.isArray(componentScores[component])) {
        componentScores[component] = [];
      }
      if (typeof item.score === 'number') {
        componentScores[component].unshift(item.score);
      }

      const componentLogs = gradeItemLogsMap.get(key);
      if (!Array.isArray(componentLogs[component])) {
        componentLogs[component] = [];
      }
      componentLogs[component].unshift({
        score: item.score,
        attempt: item.attempt,
        teacher: item.teacherId
          ? {
              _id: item.teacherId._id || item.teacherId,
              name: item.teacherId.name,
              code: item.teacherId.teacherCode,
            }
          : null,
        date: item.date,
      });
    }

    gradeSummaries.forEach(summary => {
      const studentId = String(summary.studentId);
      if (!studentMap.has(studentId)) return;

      const student = studentMap.get(studentId);
      const lastKey = `${studentId}_${String(summary.subjectId._id || summary.subjectId)}`;
      const last = latestMap2.get(lastKey);
      const gradeItems = gradeItemsMap.get(lastKey) || {};
      const gradeItemLogs = gradeItemLogsMap.get(lastKey) || {};
      student.subjects.push({
        _id: summary._id,
        subject: {
          _id: summary.subjectId._id,
          name: summary.subjectId.name,
          code: summary.subjectId.code,
          includeInAverage: summary.subjectId.includeInAverage
        },
        averages: summary.averages || {},
        average: summary.average,
        result: summary.result,
        semester: summary.semester,
        schoolYear: summary.schoolYear,
        gradeItems,
        gradeItemLogs,
        isOfficial: summary.isOfficial === true,
        officialAt: summary.officialAt || null,
        officialBy: summary.officialBy || null,
        lastUpdatedBy: last ? {
          teacher: last.teacherId ? { _id: last.teacherId._id || last.teacherId, name: last.teacherId.name, code: last.teacherId.teacherCode } : null,
          date: last.date,
        } : null
      });
    });

    // ✅ Gán GPA, hạnh kiểm và học lực cho từng học sinh (lấy đúng theo semester)
    Array.from(studentMap.values()).forEach(student => {
      const studentId = String(student._id);
      
      // ✅ Lấy GPA theo semester được chọn
      const semesterCode = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : (semester || 'CN');
      let gpaRecord = yearRecords.find(yr => 
        String(yr.studentId) === studentId &&
        yr.year === schoolYear &&
        yr.semester === semesterCode
      );
      
      // Nếu không có record theo semester, fallback về CN
      if (!gpaRecord && semesterCode !== 'CN') {
        gpaRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          yr.year === schoolYear &&
          yr.semester === 'CN'
        );
      }
      
      // Lấy GPA từ record
      if (gpaRecord && gpaRecord.gpa !== null && gpaRecord.gpa !== undefined) {
        student.gpa = gpaRecord.gpa;
      }
      
      // ✅ Lấy hạnh kiểm: ưu tiên record theo semester được chọn (đã chốt), fallback về CN (đã chốt)
      let conductRecord = null;
      if (semesterCode === 'HK1') {
        conductRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          yr.year === schoolYear &&
          yr.semester === 'HK1' &&
          (yr.conductStatus === 'locked' || yr.conductStatus === 'approved')
        );
      } else if (semesterCode === 'HK2') {
        conductRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          yr.year === schoolYear &&
          yr.semester === 'HK2' &&
          (yr.conductStatus === 'locked' || yr.conductStatus === 'approved')
        );
      }
      
      // Fallback về CN nếu không có record theo học kỳ
      if (!conductRecord) {
        conductRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          yr.year === schoolYear &&
          yr.semester === 'CN' &&
          (yr.conductStatus === 'locked' || yr.conductStatus === 'approved')
        );
      }
      
      // Lấy hạnh kiểm từ record
      if (conductRecord) {
        student.conduct = conductRecord.conduct;
      }
      
      // ✅ Lấy học lực từ record theo semester được chọn (ưu tiên record theo semester, fallback về CN)
      let academicRecord = null;
      if (semesterCode === 'HK1') {
        academicRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          yr.year === schoolYear &&
          yr.semester === 'HK1' &&
          yr.academicLevel
        );
      } else if (semesterCode === 'HK2') {
        academicRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          yr.year === schoolYear &&
          yr.semester === 'HK2' &&
          yr.academicLevel
        );
      }
      
      // Fallback về CN nếu không có record theo học kỳ
      if (!academicRecord) {
        academicRecord = yearRecords.find(yr => 
          String(yr.studentId) === studentId &&
          yr.year === schoolYear &&
          yr.semester === 'CN' &&
          yr.academicLevel
        );
      }
      
      // Nếu vẫn không có, lấy từ gpaRecord
      if (!academicRecord && gpaRecord) {
        academicRecord = gpaRecord;
      }
      
      if (academicRecord) {
        student.academicLevel = academicRecord.academicLevel || null;
      }
    });

    // ✅ Tính xu hướng cho từng học sinh (song song)
    const trendPromises = Array.from(studentMap.values()).map(async (student) => {
      const trends = await calculateStudentTrend(student._id, schoolYear, semester);
      student.trends = trends;
      return student;
    });
    await Promise.all(trendPromises);

    // ✅ Xác định tập môn bắt buộc tính ĐTB HK cho lớp (includeInAverage !== false)
    let requiredSubjectIds2 = new Set();
    try {
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assigns = await TeachingAssignment.find({
        classId,
        year: String(schoolYear),
        semester: String(semester)
      }).populate('subjectId', 'includeInAverage').lean();
      const subjectIds = assigns
        .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
        .map(a => String(a.subjectId._id || a.subjectId));
      subjectIds.forEach(id => requiredSubjectIds2.add(id));
    } catch (e) {
      // ignore
    }
    if (requiredSubjectIds2.size === 0) {
      const requiredSubjects = await Subject.find({
        grades: String(classInfo.grade),
        includeInAverage: { $ne: false }
      }).select('_id').lean();
      requiredSubjectIds2 = new Set(requiredSubjects.map(s => String(s._id)));
    }

    const result = Array.from(studentMap.values()).map(student => {
      const studentId = String(student._id);
      
      // ✅ Ưu tiên lấy semesterAverage từ GPA trong yearRecord
      const semesterCode = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : (semester || 'CN');
      const hk1Record = yearRecords.find(yr => 
        String(yr.studentId) === studentId &&
        yr.year === schoolYear &&
        yr.semester === 'HK1'
      );
      const hk2Record = yearRecords.find(yr => 
        String(yr.studentId) === studentId &&
        yr.year === schoolYear &&
        yr.semester === 'HK2'
      );
      const cnRecord = yearRecords.find(yr => 
        String(yr.studentId) === studentId &&
        yr.year === schoolYear &&
        yr.semester === 'CN'
      );
      
      // ✅ Lấy GPA từ yearRecord theo semester được chọn
      let gpaFromRecord = null;
      if (semesterCode === 'HK1' && hk1Record && hk1Record.gpa !== null && hk1Record.gpa !== undefined) {
        gpaFromRecord = hk1Record.gpa;
      } else if (semesterCode === 'HK2' && hk2Record && hk2Record.gpa !== null && hk2Record.gpa !== undefined) {
        gpaFromRecord = hk2Record.gpa;
      } else if (cnRecord && cnRecord.gpa !== null && cnRecord.gpa !== undefined) {
        gpaFromRecord = cnRecord.gpa;
      }
      
      // ✅ Nếu có GPA từ yearRecord, dùng nó làm semesterAverage
      if (gpaFromRecord !== null && gpaFromRecord !== undefined) {
        student.semesterAverage = gpaFromRecord;
      } else if (student.subjects && student.subjects.length > 0) {
        // Fallback: tính từ các môn đã công bố
        const finalizedIncluded = student.subjects.filter(
          s =>
            s.isOfficial === true &&
            s.average !== null &&
            s.average !== undefined &&
            s.subject &&
            s.subject.includeInAverage !== false
        );
        const finalizedIds = new Set(finalizedIncluded.map(s => String(s.subject._id)));
        const hasAllRequired = requiredSubjectIds2.size > 0 && [...requiredSubjectIds2].every(id => finalizedIds.has(id));
        if (hasAllRequired) {
          const avgs = finalizedIncluded.map(s => s.average).filter(v => typeof v === 'number');
          if (avgs.length > 0) {
            student.semesterAverage = avgs.reduce((a, b) => a + b, 0) / avgs.length;
          }
        } else {
          student.semesterAverage = null;
        }
      }
      
      return student;
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      filters: { classId, schoolYear, semester }
    });
  } catch (err) {
    console.error('[GradeController::getHomeroomClassAllGradesWithTrend]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Không thể lấy bảng điểm lớp chủ nhiệm', 
      error: err.message 
    });
  }
};

/**
 * GET /grades/homeroom/averages - GVCN xem điểm trung bình từng môn, điểm TB học kỳ/năm của học sinh
 * Query: classId, schoolYear, studentId (optional)
 */
exports.getHomeroomClassAverages = async (req, res) => {
  try {
    const { classId, schoolYear, studentId } = req.query;
    const { role, accountId } = req.user;

    if (!classId || !schoolYear) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu tham số classId/schoolYear' 
      });
    }

    // Kiểm tra quyền truy cập
    const permissionContext = req.permissionContext || {};
    const isHomeroom = permissionContext.isHomeroom || false;
    const homeroomClassIds = permissionContext.homeroomClassIds || [];

    if (role === 'teacher' && isHomeroom) {
      if (!homeroomClassIds.includes(String(classId))) {
        return res.status(403).json({ 
          success: false, 
          message: 'Không phải lớp chủ nhiệm của bạn' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Không có quyền truy cập' 
      });
    }

    // Lấy học sinh trong lớp
    let studentQuery = { 
      classId, 
      status: 'active',
      isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
    };
    if (studentId) {
      studentQuery._id = studentId;
    }
    const students = await Student.find(studentQuery)
      .populate('classId', 'className classCode grade')
      .lean();

    if (students.length === 0) {
      return res.json({ 
        success: true, 
        count: 0, 
        data: [] 
      });
    }

    const studentIds = students.map(s => s._id);

    // ✅ Lấy thông tin lớp để biết khối lớp (fallback required subjects)
    const classInfo2 = await Class.findById(classId).select('grade year').lean();

    // Lấy điểm tất cả môn học của học sinh (cả 2 học kỳ)
    const gradeSummaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      schoolYear
    })
      .populate('subjectId', 'name code includeInAverage')
      .lean();

    // Lấy hạnh kiểm và học lực
    const yearRecords = await StudentYearRecord.find({
      studentId: { $in: studentIds },
      year: schoolYear
    })
      .lean();

    // ✅ Xác định tập môn bắt buộc cho HK1 và HK2 (includeInAverage !== false) trước, tránh await trong map
    let requiredHK1Set = new Set();
    let requiredHK2Set = new Set();
    try {
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assigns1 = await TeachingAssignment.find({
        classId,
        year: String(schoolYear),
        semester: '1'
      }).populate('subjectId', 'includeInAverage').lean();
      assigns1
        .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
        .forEach(a => requiredHK1Set.add(String(a.subjectId._id || a.subjectId)));

      const assigns2 = await TeachingAssignment.find({
        classId,
        year: String(schoolYear),
        semester: '2'
      }).populate('subjectId', 'includeInAverage').lean();
      assigns2
        .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
        .forEach(a => requiredHK2Set.add(String(a.subjectId._id || a.subjectId)));
    } catch (e) {
      // ignore
    }
    if (requiredHK1Set.size === 0 && classInfo2?.grade) {
      const req1 = await Subject.find({ grades: String(classInfo2.grade), includeInAverage: { $ne: false } }).select('_id').lean();
      requiredHK1Set = new Set(req1.map(s => String(s._id)));
    }
    if (requiredHK2Set.size === 0 && classInfo2?.grade) {
      const req2 = await Subject.find({ grades: String(classInfo2.grade), includeInAverage: { $ne: false } }).select('_id').lean();
      requiredHK2Set = new Set(req2.map(s => String(s._id)));
    }

    // Nhóm điểm theo học sinh và môn học
    const result = students.map(student => {
      const studentId = String(student._id);
      
      // Lấy điểm học kỳ 1 và 2
      const hk1Summaries = gradeSummaries.filter(
        g => String(g.studentId) === studentId && g.semester === '1'
      );
      const hk2Summaries = gradeSummaries.filter(
        g => String(g.studentId) === studentId && g.semester === '2'
      );

      // Tính điểm trung bình từng môn
      const subjectAverages = {};
      const allSubjects = new Set([
        ...hk1Summaries.map(g => String(g.subjectId._id)),
        ...hk2Summaries.map(g => String(g.subjectId._id))
      ]);

      allSubjects.forEach(subjectIdStr => {
        const hk1Grade = hk1Summaries.find(
          g => String(g.subjectId._id) === subjectIdStr
        );
        const hk2Grade = hk2Summaries.find(
          g => String(g.subjectId._id) === subjectIdStr
        );

        const hk1Avg = hk1Grade?.average ?? null;
        const hk2Avg = hk2Grade?.average ?? null;
        // ✅ Chỉ xem là "đã công bố" khi GVBM nhấn Công bố (isOfficial)
        const hk1HasFinal = Boolean(hk1Grade?.isOfficial === true);
        const hk2HasFinal = Boolean(hk2Grade?.isOfficial === true);
        const yearAvg = (hk1Avg !== null && hk2Avg !== null) 
          ? (hk1Avg + hk2Avg) / 2 
          : null;
        const yearHasFinal = hk1HasFinal && hk2HasFinal;

        const subject = hk1Grade?.subjectId || hk2Grade?.subjectId;
        subjectAverages[subjectIdStr] = {
          subject: {
            _id: subject._id,
            name: subject.name,
            code: subject.code,
            includeInAverage: subject.includeInAverage
          },
          hk1: hk1Avg,
          hk2: hk2Avg,
          year: yearAvg,
          hk1HasFinal,
          hk2HasFinal,
          yearHasFinal
        };
      });

      // Tính điểm trung bình học kỳ dựa trên tập môn bắt buộc đã tính sẵn

      const includedSubjects = Object.values(subjectAverages).filter(s => s.subject && s.subject.includeInAverage !== false);
      // ✅ Hoàn tất khi vừa có điểm TB và đã công bố chính thức
      const finalizedHK1 = new Set(
        includedSubjects
          .filter(s => s.hk1 !== null && s.hk1 !== undefined && s.hk1HasFinal)
          .map(s => String(s.subject._id))
      );
      const finalizedHK2 = new Set(
        includedSubjects
          .filter(s => s.hk2 !== null && s.hk2 !== undefined && s.hk2HasFinal)
          .map(s => String(s.subject._id))
      );

      const hasAllHK1 = requiredHK1Set.size > 0 && [...requiredHK1Set].every(id => finalizedHK1.has(id));
      const hasAllHK2 = requiredHK2Set.size > 0 && [...requiredHK2Set].every(id => finalizedHK2.has(id));

      const hk1Averages = hasAllHK1 ? includedSubjects.map(s => s.hk1).filter(v => v !== null && v !== undefined) : [];
      const hk2Averages = hasAllHK2 ? includedSubjects.map(s => s.hk2).filter(v => v !== null && v !== undefined) : [];
      const yearAverages = hasAllHK1 && hasAllHK2 ? includedSubjects.map(s => s.year).filter(v => v !== null && v !== undefined) : [];

      const hk1Average = hk1Averages.length > 0 ? hk1Averages.reduce((a, b) => a + b, 0) / hk1Averages.length : null;
      const hk2Average = hk2Averages.length > 0 ? hk2Averages.reduce((a, b) => a + b, 0) / hk2Averages.length : null;
      const yearAverage = yearAverages.length > 0 ? yearAverages.reduce((a, b) => a + b, 0) / yearAverages.length : null;

      // Lấy hạnh kiểm và học lực
      const hk1Record = yearRecords.find(
        r => String(r.studentId) === studentId && r.semester === 'HK1'
      );
      const hk2Record = yearRecords.find(
        r => String(r.studentId) === studentId && r.semester === 'HK2'
      );
      const yearRecord = yearRecords.find(
        r => String(r.studentId) === studentId && r.semester === 'CN'
      );

      return {
        _id: student._id,
        name: student.name,
        studentCode: student.studentCode,
        class: student.classId ? {
          _id: student.classId._id,
          className: student.classId.className,
          classCode: student.classId.classCode,
          grade: student.classId.grade
        } : null,
        subjectAverages: Object.values(subjectAverages),
        averages: {
          hk1: hk1Average,
          hk2: hk2Average,
          year: yearAverage
        },
        conduct: {
          hk1: hk1Record?.conduct || null,
          hk2: hk2Record?.conduct || null,
          year: yearRecord?.conduct || null
        },
        academicLevel: {
          hk1: hk1Record?.academicLevel || null,
          hk2: hk2Record?.academicLevel || null,
          year: yearRecord?.academicLevel || null
        },
        gpa: {
          hk1: hk1Record?.gpa || null,
          hk2: hk2Record?.gpa || null,
          year: yearRecord?.gpa || null
        }
      };
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      filters: { classId, schoolYear, studentId }
    });
  } catch (err) {
    console.error('[GradeController::getHomeroomClassAverages]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Không thể lấy điểm trung bình', 
      error: err.message 
    });
  }
};

/**
 * GET /grades/homeroom/classification - GVCN xem hạnh kiểm và kết quả xếp loại học tập của lớp
 * Query: classId, schoolYear, semester
 */
exports.getHomeroomClassClassification = async (req, res) => {
  try {
    const { classId, schoolYear, semester } = req.query;
    const { role, accountId } = req.user;

    if (!classId || !schoolYear) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu tham số classId/schoolYear' 
      });
    }

    // Kiểm tra quyền truy cập
    const permissionContext = req.permissionContext || {};
    const isHomeroom = permissionContext.isHomeroom || false;
    const homeroomClassIds = permissionContext.homeroomClassIds || [];

    if (role === 'teacher' && isHomeroom) {
      if (!homeroomClassIds.includes(String(classId))) {
        return res.status(403).json({ 
          success: false, 
          message: 'Không phải lớp chủ nhiệm của bạn' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Không có quyền truy cập' 
      });
    }

    // Lấy tất cả học sinh trong lớp
    const students = await Student.find({ 
      classId, 
      status: 'active',
      isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
    })
      .populate('classId', 'className classCode grade')
      .lean();

    if (students.length === 0) {
      return res.json({ 
        success: true, 
        count: 0, 
        data: [],
        statistics: {
          conduct: { Tốt: 0, Khá: 0, 'Trung bình': 0, Yếu: 0 },
          academicLevel: { Giỏi: 0, Khá: 0, 'Trung bình': 0, Yếu: 0 }
        }
      });
    }

    const studentIds = students.map(s => s._id);

    // Lấy hạnh kiểm và học lực - lấy cả CN và học kỳ để có đủ dữ liệu
    let yearRecordQuery = { studentId: { $in: studentIds }, year: schoolYear };
    // Không filter theo semester để lấy cả CN và học kỳ (hạnh kiểm thường ở CN)
    // Sắp xếp theo updatedAt giảm dần để ưu tiên record mới nhất nếu có nhiều record
    const yearRecords = await StudentYearRecord.find(yearRecordQuery)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode')
      .sort({ updatedAt: -1 }) // ✅ Ưu tiên record mới nhất
      .lean();

    // Lấy điểm trung bình để tính học lực nếu chưa có
    const gradeSummaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      schoolYear
    })
      .populate('subjectId', 'name code includeInAverage')
      .lean();

    // Tính điểm trung bình và học lực cho từng học sinh
    const validStudents2 = students; // đảm bảo biến tồn tại (lọc ở trên đã theo class)
    const result = validStudents2.map(student => {
      const studentId = String(student._id);
      
      // ✅ Lấy hạnh kiểm theo semester được chọn, chỉ lấy khi đã chốt (locked) hoặc đã phê duyệt (approved)
      // Lưu ý: r.studentId có thể là ObjectId hoặc string, cần normalize
      let conductRecord = null;
      if (semester) {
        const semesterCode = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : semester;
        // Ưu tiên record theo semester đã chốt
        conductRecord = yearRecords.find(r => {
          const rStudentId = String(r.studentId?._id || r.studentId);
          return rStudentId === studentId &&
            r.semester === semesterCode &&
            (r.conductStatus === 'locked' || r.conductStatus === 'approved');
        });
        // Nếu không có record theo semester đã chốt, không lấy (chỉ hiển thị khi đã chốt)
      } else {
        // Nếu không có semester, lấy record CN đã chốt
        conductRecord = yearRecords.find(r => {
          const rStudentId = String(r.studentId?._id || r.studentId);
          return rStudentId === studentId &&
            r.semester === 'CN' &&
            (r.conductStatus === 'locked' || r.conductStatus === 'approved');
        });
      }
      
      // Tìm record cho học lực và GPA: theo semester được chọn hoặc CN
      // Lưu ý: r.studentId có thể là ObjectId hoặc string, cần normalize
      let record = null;
      if (semester) {
        const semesterCode = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : semester;
        if (semesterCode === 'CN') {
          // Nếu chọn CN, lấy record CN
          record = yearRecords.find(r => {
            const rStudentId = String(r.studentId?._id || r.studentId);
            return rStudentId === studentId && r.semester === 'CN';
          });
        } else {
          // Nếu chọn HK1 hoặc HK2, lấy record theo học kỳ
          record = yearRecords.find(r => {
            const rStudentId = String(r.studentId?._id || r.studentId);
            return rStudentId === studentId && r.semester === semesterCode;
          });
        }
      } else {
        // Nếu không có semester, lấy record cả năm
        record = yearRecords.find(r => {
          const rStudentId = String(r.studentId?._id || r.studentId);
          return rStudentId === studentId && r.semester === 'CN';
        });
      }

      // Tính điểm trung bình theo semester được chọn
      let gpa = record?.gpa || null;
      
      // Nếu chưa có GPA từ record, tính từ gradeSummaries (chỉ tính các môn có includeInAverage !== false)
      if (!gpa) {
        if (semester === 'CN' || !semester) {
          // Tính điểm TB cả năm từ HK1 và HK2
          const hk1Summaries = gradeSummaries.filter(
            g => String(g.studentId) === studentId && g.semester === '1'
          );
          const hk2Summaries = gradeSummaries.filter(
            g => String(g.studentId) === studentId && g.semester === '2'
          );

          const allYearAverages = [];
          const allSubjects = new Set([
            ...hk1Summaries.map(g => String(g.subjectId._id)),
            ...hk2Summaries.map(g => String(g.subjectId._id))
          ]);

          allSubjects.forEach(subjectIdStr => {
            const hk1Grade = hk1Summaries.find(
              g => String(g.subjectId._id) === subjectIdStr
            );
            const hk2Grade = hk2Summaries.find(
              g => String(g.subjectId._id) === subjectIdStr
            );

            // ✅ Chỉ tính các môn có includeInAverage !== false
            const subject = hk1Grade?.subjectId || hk2Grade?.subjectId;
            if (subject && subject.includeInAverage === false) {
              return; // Bỏ qua môn không tính điểm TB
            }

            const hk1Avg = hk1Grade?.average ?? null;
            const hk2Avg = hk2Grade?.average ?? null;
            if (hk1Avg !== null && hk2Avg !== null) {
              allYearAverages.push((hk1Avg + hk2Avg) / 2);
            }
          });

          if (allYearAverages.length > 0) {
            gpa = allYearAverages.reduce((a, b) => a + b, 0) / allYearAverages.length;
          }
        } else if (semester === '1') {
          // Tính điểm TB học kỳ 1 (chỉ tính các môn có includeInAverage !== false)
          const hk1Summaries = gradeSummaries.filter(
            g => String(g.studentId) === studentId && 
                 g.semester === '1' &&
                 g.subjectId &&
                 g.subjectId.includeInAverage !== false
          );
          const averages = hk1Summaries
            .filter(g => g.average !== null && g.average !== undefined)
            .map(g => g.average);
          if (averages.length > 0) {
            gpa = averages.reduce((a, b) => a + b, 0) / averages.length;
          }
        } else if (semester === '2') {
          // Tính điểm TB học kỳ 2 (chỉ tính các môn có includeInAverage !== false)
          const hk2Summaries = gradeSummaries.filter(
            g => String(g.studentId) === studentId && 
                 g.semester === '2' &&
                 g.subjectId &&
                 g.subjectId.includeInAverage !== false
          );
          const averages = hk2Summaries
            .filter(g => g.average !== null && g.average !== undefined)
            .map(g => g.average);
          if (averages.length > 0) {
            gpa = averages.reduce((a, b) => a + b, 0) / averages.length;
          }
        }
      }

      // ✅ Chỉ hiển thị hạnh kiểm từ record CN khi đã chốt hoặc đã phê duyệt
      let conduct = null;
      if (conductRecord) {
        if (conductRecord.conductStatus === 'locked' || conductRecord.conductStatus === 'approved') {
          conduct = conductRecord.conduct;
        }
      }

      return {
        _id: student._id,
        name: student.name,
        studentCode: student.studentCode,
        class: student.classId ? {
          _id: student.classId._id,
          className: student.classId.className,
          classCode: student.classId.classCode,
          grade: student.classId.grade
        } : null,
        conduct: conduct,
        academicLevel: record?.academicLevel || null,
        gpa: gpa,
        rank: record?.rank || null, // Rank trong lớp
        rankGrade: record?.rankGrade || null, // Rank trong khối
        semester: record?.semester || semester || null,
        year: schoolYear
      };
    });

    // Thống kê
    const statistics = {
      conduct: { Tốt: 0, Khá: 0, 'Trung bình': 0, Yếu: 0 },
      academicLevel: { Giỏi: 0, Khá: 0, 'Trung bình': 0, Yếu: 0 }
    };

    result.forEach(student => {
      if (student.conduct) {
        statistics.conduct[student.conduct] = (statistics.conduct[student.conduct] || 0) + 1;
      }
      if (student.academicLevel) {
        statistics.academicLevel[student.academicLevel] = 
          (statistics.academicLevel[student.academicLevel] || 0) + 1;
      }
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      statistics,
      filters: { classId, schoolYear, semester }
    });
  } catch (err) {
    console.error('[GradeController::getHomeroomClassClassification]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Không thể lấy kết quả xếp loại', 
      error: err.message 
    });
  }
};

/**
 * GET /grades/homeroom/report-card/:studentId/pdf
 * Xuất phiếu kết quả học tập dạng PDF cho học sinh trong lớp chủ nhiệm
 * Query: classId, schoolYear, semester ('1' | '2' | 'CN')
 */
exports.exportStudentReportCard = async (req, res) => {
  let browser = null;
  try {
    const { studentId } = req.params;
    const { classId, schoolYear, semester } = req.query;
    const { role } = req.user || {};
    const permissionContext = req.permissionContext || {};

    const setting = await Setting.findOne().lean();
    const logoAsset = await resolveSchoolLogoAsset(setting);

    const reportCard = await buildReportCardDocument({
      studentId,
      classId,
      schoolYear,
      semester,
      role,
      permissionContext,
      setting,
      logoAsset
    });

    browser = await puppeteer.launch(LAUNCH_PUPPETEER_OPTS);
    const pdfBuffer = await renderHtmlToPdf(reportCard.html, browser);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${reportCard.fileName}"`
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[GradeController::exportStudentReportCard]', err);
    const status = err?.status || 500;
    return res.status(status).json({
      success: false,
      message: err?.message || 'Không thể xuất phiếu kết quả',
      error: err?.stack || err?.message
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('Không thể đóng trình duyệt Puppeteer:', closeErr);
      }
    }
  }
};

/**
 * GET /grades/homeroom/report-card/bulk/pdf
 * Tải về toàn bộ phiếu kết quả học tập của lớp dưới dạng file ZIP
 * Query: classId, schoolYear, semester ('1' | '2' | 'CN')
 */
exports.exportClassReportCards = async (req, res) => {
  let browser = null;
  try {
    const { classId, schoolYear, semester } = req.query;
    if (!classId || !schoolYear) {
      throw createHttpError(400, 'Thiếu tham số classId/schoolYear');
    }

    const normalizedSemester = normalizeSemester(semester);
    const { role } = req.user || {};
    const permissionContext = req.permissionContext || {};

    ensureHomeroomExportPermission(role, permissionContext, classId);

    const classInfo = await Class.findById(classId)
      .populate('teacherId', 'name teacherCode')
      .lean();
    if (!classInfo) {
      throw createHttpError(404, 'Không tìm thấy lớp học');
    }

    const setting = await Setting.findOne().lean();
    const logoAsset = await resolveSchoolLogoAsset(setting);

    const students = await Student.find({
      classId,
      status: 'active',
      isDeleted: { $ne: true }
    })
      .select('_id name studentCode gender dateOfBirth')
      .sort({ name: 1 })
      .lean();

    if (!students.length) {
      throw createHttpError(404, 'Lớp chưa có học sinh đang hoạt động');
    }

    browser = await puppeteer.launch(LAUNCH_PUPPETEER_OPTS);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => {
      console.error('[GradeController::exportClassReportCards] Lỗi nén zip:', error);
      res.end();
    });

    const semesterSegment = normalizedSemester === 'CN' ? 'ca-nam' : `hk${normalizedSemester}`;
    const zipFileName = `phieu-ket-qua_${sanitizeForFileName(classInfo.className, 'lop')}_${semesterSegment}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFileName}"`
    });

    archive.pipe(res);

    for (const student of students) {
      const reportCard = await buildReportCardDocument({
        studentId: student._id,
        classId,
        schoolYear,
        semester: normalizedSemester,
        role,
        permissionContext,
        classInfo,
        student,
        setting,
        logoAsset
      });

      const pdfBuffer = await renderHtmlToPdf(reportCard.html, browser);
      archive.append(pdfBuffer, { name: reportCard.fileName });
    }

    await archive.finalize();
  } catch (err) {
    console.error('[GradeController::exportClassReportCards]', err);
    const status = err?.status || 500;
    if (!res.headersSent) {
      res.status(status).json({
        success: false,
        message: err?.message || 'Không thể xuất phiếu kết quả cho lớp',
        error: err?.stack || err?.message
      });
    } else {
      res.end();
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('Không thể đóng trình duyệt Puppeteer:', closeErr);
      }
    }
  }
};

/**
 * POST /grades/publish - GVBM công bố điểm của một lớp/môn/học kỳ
 * Body: { classId, subjectId, schoolYear, semester }
 */
exports.publishSubject = async (req, res) => {
  try {
    const { classId, subjectId, schoolYear, semester } = req.body || {};
    if (!classId || !subjectId || !schoolYear || !semester) {
      return res.status(400).json({ success: false, message: 'Thiếu classId/subjectId/schoolYear/semester' });
    }

    const { role, accountId } = req.user || {};
    // ✅ Chỉ GVBM của lớp/môn này (hoặc Admin) mới được công bố
    if (role === 'teacher') {
      const TeacherModel = require('../../models/user/teacher');
      const teacher = await TeacherModel.findOne({ accountId }).lean();
      if (!teacher) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
      }
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assignment = await TeachingAssignment.findOne({
        teacherId: teacher._id,
        subjectId,
        classId,
        year: String(schoolYear),
        semester: String(semester),
      }).lean();
      if (!assignment) {
        return res.status(403).json({ success: false, message: 'Bạn không được phân công dạy lớp/môn này' });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền công bố điểm' });
    }

    // Lấy danh sách học sinh trong lớp (đang hoạt động)
    const cls = await Class.findById(classId).select('year').lean();
    if (!cls) return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    const students = await Student.find({ classId, status: 'active', isDeleted: { $ne: true }, currentYear: cls.year })
      .select('_id')
      .lean();
    const studentIds = students.map(s => s._id);

    // ✅ Kiểm tra đã có điểm trung bình (average) cho tất cả học sinh hay chưa
    // Lưu ý: Điểm thi (final) là một loại điểm kiểm tra, không bắt buộc phải có
    // Chỉ cần có điểm trung bình (average) đã được tính là có thể công bố
    const summaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      subjectId,
      schoolYear,
      semester,
    }).lean();

    // Kiểm tra xem tất cả học sinh đã có điểm trung bình chưa
    const missingAverage = summaries.filter(s => s.average === null || s.average === undefined);
    if (missingAverage.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Còn ${missingAverage.length} học sinh chưa có điểm trung bình. Vui lòng nhập đủ điểm để hệ thống tính điểm trung bình trước khi công bố.`,
        missingCount: missingAverage.length,
      });
    }

    // Cập nhật công bố
    const result = await GradeSummary.updateMany({
      studentId: { $in: studentIds },
      subjectId,
      schoolYear,
      semester,
    }, {
      $set: {
        isOfficial: true,
        officialAt: new Date(),
        officialBy: req.user?.accountId || null,
      }
    });

    return res.json({
      success: true,
      message: 'Đã công bố điểm chính thức cho lớp/môn/học kỳ',
      modified: result.modifiedCount || result.nModified || 0,
    });
  } catch (err) {
    console.error('[GradeController::publishSubject]', err);
    res.status(500).json({ success: false, message: 'Không thể công bố điểm', error: err.message });
  }
};

/**
 * POST /grades/publish-student - GVBM công bố điểm của 1 học sinh cho 1 môn/học kỳ
 * Body: { studentId, subjectId, schoolYear, semester }
 */
exports.publishStudentGrade = async (req, res) => {
  try {
    const { studentId, subjectId, schoolYear, semester } = req.body || {};
    if (!studentId || !subjectId || !schoolYear || !semester) {
      return res.status(400).json({ success: false, message: 'Thiếu studentId/subjectId/schoolYear/semester' });
    }

    const { role, accountId } = req.user || {};
    // ✅ Chỉ GVBM của môn này (hoặc Admin) mới được công bố
    if (role === 'teacher') {
      const TeacherModel = require('../../models/user/teacher');
      const teacher = await TeacherModel.findOne({ accountId }).lean();
      if (!teacher) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
      }
      const Student = require('../../models/user/student');
      const student = await Student.findById(studentId).select('classId').lean();
      if (!student) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
      }
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assignment = await TeachingAssignment.findOne({
        teacherId: teacher._id,
        subjectId,
        classId: student.classId,
        year: String(schoolYear),
        semester: String(semester),
      }).lean();
      if (!assignment) {
        return res.status(403).json({ success: false, message: 'Bạn không được phân công dạy lớp/môn này' });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền công bố điểm' });
    }

    // ✅ Kiểm tra đã có điểm trung bình (average) hoặc kết quả (result) cho học sinh hay chưa
    const summary = await GradeSummary.findOne({
      studentId,
      subjectId,
      schoolYear,
      semester,
    })
      .populate('subjectId', 'includeInAverage')
      .lean();

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Chưa có bản ghi điểm cho học sinh này',
      });
    }

    // ✅ Kiểm tra môn có tính điểm TB hay không
    const includeInAverage = summary.subjectId?.includeInAverage;
    
    if (includeInAverage !== false) {
      // Môn tính điểm TB: cần có average
      if (summary.average === null || summary.average === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Học sinh này chưa có điểm trung bình. Vui lòng nhập đủ điểm để hệ thống tính điểm trung bình trước khi công bố.',
        });
      }
    } else {
      // Môn không tính điểm TB: cần có result (Đạt/Không đạt)
      if (!summary.result || (summary.result !== 'D' && summary.result !== 'K')) {
        return res.status(400).json({
          success: false,
          message: 'Học sinh này chưa có kết quả (Đạt/Không đạt). Vui lòng nhập đủ điểm để hệ thống tính kết quả trước khi công bố.',
        });
      }
    }

    // Cập nhật công bố
    const result = await GradeSummary.updateOne({
      studentId,
      subjectId,
      schoolYear,
      semester,
    }, {
      $set: {
        isOfficial: true,
        officialAt: new Date(),
        officialBy: req.user?.accountId || null,
      }
    });

    return res.json({
      success: true,
      message: 'Đã công bố điểm chính thức cho học sinh',
      modified: result.modifiedCount || result.nModified || 0,
    });
  } catch (err) {
    console.error('[GradeController::publishStudentGrade]', err);
    res.status(500).json({ success: false, message: 'Không thể công bố điểm', error: err.message });
  }
};

/**
 * POST /grades/homeroom/evaluate-academic
 * GVCN/Admin: Xét học lực cho cả lớp theo năm học + học kỳ đã chọn
 * Body: { classId, schoolYear, semester } with semester in ['1','2','CN']
 * Logic:
 *  - Chỉ xét khi các môn bắt buộc tính ĐTB của học kỳ đó đã công bố (isOfficial=true) đầy đủ
 *  - Tính ĐTB học kỳ (hoặc cả năm nếu 'CN') từ các môn includeInAverage đã official
 *  - Áp dụng đồng thời Cấu hình xếp loại + Môn bắt buộc tối thiểu (requiredSubjects) trong GradeConfig
 *  - Lưu kết quả vào StudentYearRecord (gpa nếu cần, academicLevel)
 */
exports.evaluateHomeroomAcademicLevel = async (req, res) => {
  try {
    const { classId, schoolYear, semester } = req.body || {};
    if (!classId || !schoolYear || !semester) {
      return res.status(400).json({ success: false, message: 'Thiếu classId/schoolYear/semester' });
    }

    // ✅ Normalize semester: '1' -> 'HK1', '2' -> 'HK2', 'CN' hoặc 'Cả năm' -> 'CN'
    const normalizedSemester = String(semester || '').trim().toUpperCase();
    const semKey = normalizedSemester === '1' || normalizedSemester === 'HK1' 
      ? 'HK1' 
      : normalizedSemester === '2' || normalizedSemester === 'HK2' 
        ? 'HK2' 
        : 'CN'; // Mặc định là 'CN' cho "Cả năm"
    const configSemester = semKey === 'CN' ? '2' : (semKey === 'HK1' ? '1' : '2');

    // Quyền: GVCN của lớp hoặc Admin
    const { role } = req.user || {};
    const permissionContext = req.permissionContext || {};
    const isHomeroom = permissionContext.isHomeroom || false;
    const homeroomClassIds = permissionContext.homeroomClassIds || [];
    if (role === 'teacher' && !(isHomeroom && homeroomClassIds.includes(String(classId)))) {
      return res.status(403).json({ success: false, message: 'Không phải lớp chủ nhiệm của bạn' });
    }
    if (role !== 'admin' && !isHomeroom) {
      return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
    }

    const cls = await Class.findById(classId).select('year grade').lean();
    if (!cls) return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });

    // Học sinh đang hoạt động cùng niên khóa lớp
    const students = await Student.find({ classId, status: 'active', isDeleted: { $ne: true }, currentYear: cls.year })
      .select('_id name studentCode')
      .lean();
    if (students.length === 0) {
      return res.json({ success: true, message: 'Lớp không có học sinh nào', updated: 0, skipped: 0, details: [] });
    }
    const studentIds = students.map(s => s._id);
    // Tạo map để tra cứu tên học sinh
    const studentMap = new Map();
    students.forEach(s => {
      studentMap.set(String(s._id), { name: s.name, studentCode: s.studentCode });
    });

    const gradeConfig = await GradeConfig.findOne({ schoolYear: String(schoolYear), semester: configSemester }).lean();

    // Xác định tập môn bắt buộc phải có điểm official trước khi xét học lực
    let requiredSubjectIds = new Set();
    if (gradeConfig?.requiredSubjects?.length) {
      gradeConfig.requiredSubjects.forEach(item => {
        if (item?.subjectId) {
          requiredSubjectIds.add(String(item.subjectId));
        }
      });
    }
    if (requiredSubjectIds.size === 0) {
      try {
        const TeachingAssignment = require('../../models/subject/teachingAssignment');
        if (semester === '1' || semester === '2') {
          const assigns = await TeachingAssignment.find({ classId, year: String(schoolYear), semester: String(semester) })
            .populate('subjectId', 'includeInAverage')
            .lean();
          assigns
            .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
            .forEach(a => requiredSubjectIds.add(String(a.subjectId._id || a.subjectId)));
        } else {
          const assigns1 = await TeachingAssignment.find({ classId, year: String(schoolYear), semester: '1' })
            .populate('subjectId', 'includeInAverage').lean();
          const assigns2 = await TeachingAssignment.find({ classId, year: String(schoolYear), semester: '2' })
            .populate('subjectId', 'includeInAverage').lean();
          [...assigns1, ...assigns2]
            .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
            .forEach(a => requiredSubjectIds.add(String(a.subjectId._id || a.subjectId)));
        }
      } catch {}
      if (requiredSubjectIds.size === 0) {
        const subs = await Subject.find({ grades: String(cls.grade), includeInAverage: { $ne: false } })
          .select('_id')
          .lean();
        requiredSubjectIds = new Set(subs.map(s => String(s._id)));
      }
    }

    // Nhóm GradeSummary theo học sinh và học kỳ
    const requiredIdsArray = [...requiredSubjectIds];
    const summariesByStudent = new Map();
    let hk1ByStudent = new Map();
    let hk2ByStudent = new Map();

    if (semester === '1' || semester === '2') {
      const summaries = await GradeSummary.find({ studentId: { $in: studentIds }, schoolYear, semester })
        .populate('subjectId', 'includeInAverage')
        .lean();
      summaries.forEach(summary => {
        const sid = String(summary.studentId);
        if (!summariesByStudent.has(sid)) summariesByStudent.set(sid, []);
        summariesByStudent.get(sid).push(summary);
      });
    } else {
      const [hk1Summaries, hk2Summaries] = await Promise.all([
        GradeSummary.find({ studentId: { $in: studentIds }, schoolYear, semester: '1' })
          .populate('subjectId', 'includeInAverage')
          .lean(),
        GradeSummary.find({ studentId: { $in: studentIds }, schoolYear, semester: '2' })
          .populate('subjectId', 'includeInAverage')
          .lean(),
      ]);

      const groupByStudent = (collection) => {
        const map = new Map();
        collection.forEach(summary => {
          const sid = String(summary.studentId);
          if (!map.has(sid)) map.set(sid, []);
          map.get(sid).push(summary);
        });
        return map;
      };

      hk1ByStudent = groupByStudent(hk1Summaries);
      hk2ByStudent = groupByStudent(hk2Summaries);
    }

    const results = [];
    let updated = 0, skipped = 0;
    for (const sid of studentIds) {
      // Lọc summaries của học sinh
      const perStudent = semester === '1' || semester === '2'
        ? (summariesByStudent.get(String(sid)) || [])
        : [];

      // Xây dựng dữ liệu môn và kiểm tra official
      const subjectMap = new Map();
      if (semester === '1' || semester === '2') {
        perStudent.forEach(s => {
          if (!s.subjectId || s.subjectId.includeInAverage === false) return;
          const subjId = String(s.subjectId._id || s.subjectId);
          subjectMap.set(subjId, {
            average: s.average,
            official: s.isOfficial === true,
          });
        });
      } else {
        const hk1 = hk1ByStudent.get(String(sid)) || [];
        const hk2 = hk2ByStudent.get(String(sid)) || [];
        const bySubj = new Map();
        hk1.forEach(s => {
          if (!s.subjectId || s.subjectId.includeInAverage === false) return;
          const id = String(s.subjectId._id || s.subjectId);
          if (!bySubj.has(id)) bySubj.set(id, { hk1: s, hk2: null });
          else bySubj.get(id).hk1 = s;
        });
        hk2.forEach(s => {
          if (!s.subjectId || s.subjectId.includeInAverage === false) return;
          const id = String(s.subjectId._id || s.subjectId);
          if (!bySubj.has(id)) bySubj.set(id, { hk1: null, hk2: s });
          else bySubj.get(id).hk2 = s;
        });
        for (const [id, pair] of bySubj.entries()) {
          const hk1Avg = pair.hk1?.average ?? null;
          const hk2Avg = pair.hk2?.average ?? null;
          const official = (pair.hk1?.isOfficial === true) && (pair.hk2?.isOfficial === true);
          let yearAvg = null;
          if (hk1Avg !== null && hk2Avg !== null) yearAvg = (hk1Avg + hk2Avg) / 2;
          else if (hk1Avg !== null) yearAvg = hk1Avg; else if (hk2Avg !== null) yearAvg = hk2Avg;
          subjectMap.set(id, { average: yearAvg, official });
        }
      }

      const included = [...subjectMap.entries()].filter(([id, v]) => v.average !== null && v.average !== undefined);
      const finalizedIds = new Set(included.filter(([id, v]) => v.official).map(([id]) => id));
      
      // ✅ Tìm các môn bắt buộc chưa công bố để hiển thị chi tiết
      const missingOfficialSubjects = requiredIdsArray.filter(id => !finalizedIds.has(id));
      const hasAllRequired = missingOfficialSubjects.length === 0;

      if (!hasAllRequired) {
        skipped++;
        const studentInfo = studentMap.get(String(sid)) || {};
        
        // ✅ Lấy tên các môn chưa công bố
        let reasonDetail = 'Chưa đủ môn bắt buộc đã công bố';
        if (missingOfficialSubjects.length > 0) {
          try {
            const Subject = require('../../models/subject/subject');
            const missingSubjects = await Subject.find({ 
              _id: { $in: missingOfficialSubjects } 
            }).select('name code').lean();
            const subjectNames = missingSubjects.map(s => s.name || s.code || 'Môn chưa xác định').join(', ');
            if (subjectNames) {
              reasonDetail = `Chưa công bố điểm các môn: ${subjectNames}`;
            }
          } catch (e) {
            // Nếu không lấy được tên môn, dùng lý do mặc định
            console.error('Lỗi khi lấy tên môn chưa công bố:', e);
          }
        }
        
        results.push({ 
          studentId: sid, 
          studentName: studentInfo.name || null,
          studentCode: studentInfo.studentCode || null,
          status: 'skipped', 
          reason: reasonDetail,
          missingSubjects: missingOfficialSubjects // Thêm danh sách ID môn chưa công bố
        });
        continue;
      }

      // GPA của kỳ đánh giá
      const averagesArr = included.map(([id, v]) => v.average).filter(v => typeof v === 'number');
      const gpa = averagesArr.length ? (averagesArr.reduce((a, b) => a + b, 0) / averagesArr.length) : null;

      // Chuẩn bị subjectAverages cho tính xếp loại
      const subjectAverages = included.map(([id, v]) => ({ subjectId: id, average: v.average }));
      let academicLevel = null;
      if (gpa !== null) {
        try {
          academicLevel = await calculateAcademicLevel(gpa, subjectAverages, schoolYear, configSemester, gradeConfig || null);
        } catch (e) {
          academicLevel = null;
        }
      }

      // Lưu vào StudentYearRecord
      const update = { gpa };
      if (academicLevel) update.academicLevel = academicLevel;
      await StudentYearRecord.findOneAndUpdate(
        { studentId: sid, year: String(schoolYear), semester: semKey },
        { $set: { ...update, classId } },
        { upsert: true, new: true }
      );
      updated++;
      results.push({ studentId: sid, status: 'updated', gpa, academicLevel });
    }

    return res.json({ success: true, updated, skipped, details: results });
  } catch (err) {
    console.error('[GradeController::evaluateHomeroomAcademicLevel]', err);
    return res.status(500).json({ success: false, message: 'Không thể xét học lực', error: err.message });
  }
};

/**
 * POST /grades/evaluate-student-academic
 * Xét học lực cho một học sinh (Admin/BGH)
 */
exports.evaluateStudentAcademicLevel = async (req, res) => {
  try {
    const { studentId, schoolYear, semester } = req.body || {};
    if (!studentId || !schoolYear || !semester) {
      return res.status(400).json({ success: false, message: 'Thiếu studentId/schoolYear/semester' });
    }

    const { role, accountId } = req.user || {};
    // Admin/BGH hoặc GVCN (giáo viên chủ nhiệm của lớp học sinh) được xét học lực
    if (role !== 'admin' && role !== 'bgh' && role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Không có quyền xét học lực' });
    }

    const semKey = semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : 'CN';
    const configSemester = semester === 'CN' ? '2' : String(semester);

    // Lấy thông tin học sinh
    const student = await Student.findById(studentId).select('_id name studentCode classId').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
    }

    const classId = student.classId;
    if (!classId) {
      return res.status(400).json({ success: false, message: 'Học sinh chưa được phân lớp' });
    }

    const cls = await Class.findById(classId).select('year grade homeroomTeacher').lean();
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }
    
    // Nếu là giáo viên, kiểm tra xem có phải GVCN của lớp học sinh không
    if (role === 'teacher') {
      const TeacherModel = require('../../models/user/teacher');
      const teacher = await TeacherModel.findOne({ accountId })
        .select('yearRoles currentHomeroomClassId homeroomClassIds')
        .lean();
      if (!teacher) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
      }
      
      // Kiểm tra năm học
      if (cls.year !== String(schoolYear)) {
        return res.status(403).json({ success: false, message: 'Năm học không khớp với lớp học' });
      }
      
      // ✅ Kiểm tra từ yearRoles (ưu tiên)
      let isHomeroom = false;
      if (teacher.yearRoles && Array.isArray(teacher.yearRoles)) {
        const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(schoolYear));
        if (yearRole && yearRole.isHomeroom && yearRole.currentHomeroomClassId) {
          if (String(yearRole.currentHomeroomClassId) === String(classId)) {
            isHomeroom = true;
          }
        }
      }
      
      // ✅ Kiểm tra từ homeroomClassIds (lịch sử)
      if (!isHomeroom && teacher.homeroomClassIds && Array.isArray(teacher.homeroomClassIds)) {
        const hasHomeroom = teacher.homeroomClassIds.some(
          id => String(id._id || id) === String(classId)
        );
        if (hasHomeroom) {
          isHomeroom = true;
        }
      }
      
      // ✅ Kiểm tra trực tiếp từ lớp học sinh (fallback)
      if (!isHomeroom && cls.homeroomTeacher) {
        if (String(cls.homeroomTeacher) === String(teacher._id)) {
          isHomeroom = true;
        }
      }
      
      if (!isHomeroom) {
        return res.status(403).json({ success: false, message: 'Bạn không phải giáo viên chủ nhiệm của lớp này' });
      }
    }

    const gradeConfig = await GradeConfig.findOne({ schoolYear: String(schoolYear), semester: configSemester }).lean();

    // Xác định tập môn bắt buộc phải có điểm official trước khi xét học lực
    let requiredSubjectIds = new Set();
    if (gradeConfig?.requiredSubjects?.length) {
      gradeConfig.requiredSubjects.forEach(item => {
        if (item?.subjectId) {
          requiredSubjectIds.add(String(item.subjectId));
        }
      });
    }
    if (requiredSubjectIds.size === 0) {
      try {
        const TeachingAssignment = require('../../models/subject/teachingAssignment');
        if (semester === '1' || semester === '2') {
          const assigns = await TeachingAssignment.find({ classId, year: String(schoolYear), semester: String(semester) })
            .populate('subjectId', 'includeInAverage')
            .lean();
          assigns
            .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
            .forEach(a => requiredSubjectIds.add(String(a.subjectId._id || a.subjectId)));
        } else {
          const assigns1 = await TeachingAssignment.find({ classId, year: String(schoolYear), semester: '1' })
            .populate('subjectId', 'includeInAverage').lean();
          const assigns2 = await TeachingAssignment.find({ classId, year: String(schoolYear), semester: '2' })
            .populate('subjectId', 'includeInAverage').lean();
          [...assigns1, ...assigns2]
            .filter(a => a.subjectId && a.subjectId.includeInAverage !== false)
            .forEach(a => requiredSubjectIds.add(String(a.subjectId._id || a.subjectId)));
        }
      } catch {}
      if (requiredSubjectIds.size === 0) {
        const Subject = require('../../models/subject/subject');
        const subs = await Subject.find({ grades: String(cls.grade), includeInAverage: { $ne: false } })
          .select('_id')
          .lean();
        requiredSubjectIds = new Set(subs.map(s => String(s._id)));
      }
    }

    // Lấy GradeSummary
    let summaries = [];
    if (semester === '1' || semester === '2') {
      summaries = await GradeSummary.find({ studentId, schoolYear, semester })
        .populate('subjectId', 'includeInAverage')
        .lean();
    } else {
      const [hk1Summaries, hk2Summaries] = await Promise.all([
        GradeSummary.find({ studentId, schoolYear, semester: '1' })
          .populate('subjectId', 'includeInAverage')
          .lean(),
        GradeSummary.find({ studentId, schoolYear, semester: '2' })
          .populate('subjectId', 'includeInAverage')
          .lean(),
      ]);
      summaries = [...hk1Summaries, ...hk2Summaries];
    }

    // Xây dựng dữ liệu môn và kiểm tra official
    const subjectMap = new Map();
    if (semester === '1' || semester === '2') {
      summaries.forEach(s => {
        if (!s.subjectId || s.subjectId.includeInAverage === false) return;
        const subjId = String(s.subjectId._id || s.subjectId);
        subjectMap.set(subjId, {
          average: s.average,
          official: s.isOfficial === true,
        });
      });
    } else {
      const bySubj = new Map();
      summaries.forEach(s => {
        if (!s.subjectId || s.subjectId.includeInAverage === false) return;
        const id = String(s.subjectId._id || s.subjectId);
        const subjSemester = s.semester;
        if (!bySubj.has(id)) {
          bySubj.set(id, { hk1: null, hk2: null });
        }
        if (subjSemester === '1' || subjSemester === 'HK1') {
          bySubj.get(id).hk1 = s;
        } else if (subjSemester === '2' || subjSemester === 'HK2') {
          bySubj.get(id).hk2 = s;
        }
      });
      for (const [id, pair] of bySubj.entries()) {
        const hk1Avg = pair.hk1?.average ?? null;
        const hk2Avg = pair.hk2?.average ?? null;
        const official = (pair.hk1?.isOfficial === true) && (pair.hk2?.isOfficial === true);
        let yearAvg = null;
        if (hk1Avg !== null && hk2Avg !== null) yearAvg = (hk1Avg + hk2Avg) / 2;
        else if (hk1Avg !== null) yearAvg = hk1Avg;
        else if (hk2Avg !== null) yearAvg = hk2Avg;
        subjectMap.set(id, { average: yearAvg, official });
      }
    }

    const included = [...subjectMap.entries()].filter(([id, v]) => v.average !== null && v.average !== undefined);
    const finalizedIds = new Set(included.filter(([id, v]) => v.official).map(([id]) => id));
    
    const requiredIdsArray = [...requiredSubjectIds];
    const missingOfficialSubjects = requiredIdsArray.filter(id => !finalizedIds.has(id));
    const hasAllRequired = missingOfficialSubjects.length === 0;

    if (!hasAllRequired) {
      let reasonDetail = 'Chưa đủ môn bắt buộc đã công bố';
      if (missingOfficialSubjects.length > 0) {
        try {
          const Subject = require('../../models/subject/subject');
          const missingSubjects = await Subject.find({ 
            _id: { $in: missingOfficialSubjects } 
          }).select('name code').lean();
          const subjectNames = missingSubjects.map(s => s.name || s.code || 'Môn chưa xác định').join(', ');
          if (subjectNames) {
            reasonDetail = `Chưa công bố điểm các môn: ${subjectNames}`;
          }
        } catch (e) {
          console.error('Lỗi khi lấy tên môn chưa công bố:', e);
        }
      }
      return res.json({ 
        success: false, 
        message: reasonDetail,
        skipped: true,
        missingSubjects: missingOfficialSubjects
      });
    }

    // GPA của kỳ đánh giá
    const averagesArr = included.map(([id, v]) => v.average).filter(v => typeof v === 'number');
    const gpa = averagesArr.length ? (averagesArr.reduce((a, b) => a + b, 0) / averagesArr.length) : null;

    // Chuẩn bị subjectAverages cho tính xếp loại
    const subjectAverages = included.map(([id, v]) => ({ subjectId: id, average: v.average }));
    let academicLevel = null;
    let academicDetails = null;
    if (gpa !== null) {
      try {
        const { calculateAcademicLevelWithDetails } = require('../../services/academicLevelService');
        const result = await calculateAcademicLevelWithDetails(gpa, subjectAverages, schoolYear, configSemester, gradeConfig || null);
        academicLevel = result.academicLevel;
        academicDetails = result.details;
      } catch (e) {
        console.error('Lỗi khi tính học lực:', e);
        academicLevel = null;
      }
    }

    // Lưu vào StudentYearRecord
    const update = { gpa };
    if (academicLevel) update.academicLevel = academicLevel;
    await StudentYearRecord.findOneAndUpdate(
      { studentId, year: String(schoolYear), semester: semKey },
      { $set: { ...update, classId } },
      { upsert: true, new: true }
    );

    return res.json({ 
      success: true, 
      message: 'Đã xét học lực thành công',
      gpa,
      academicLevel,
      academicDetails, // ✅ Thông tin chi tiết về cách xếp học lực
      studentName: student.name,
      studentCode: student.studentCode
    });
  } catch (err) {
    console.error('[GradeController::evaluateStudentAcademicLevel]', err);
    return res.status(500).json({ success: false, message: 'Không thể xét học lực', error: err.message });
  }
};

/**
 * GET /gvbm/schedule/today?days=1|2
 * Lấy lịch dạy hôm nay (và ngày mai nếu days=2) cho giáo viên bộ môn
 */
exports.getTeacherTodaySchedule = async (req, res) => {
  try {
    const { days = 1 } = req.query;
    const { role, accountId } = req.user || {};
    if (role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Chỉ giáo viên bộ môn được truy cập' });
    }
    const teacher = await Teacher.findOne({ accountId }).select('_id name').lean();
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giáo viên' });
    }

    // Xác định ngày hôm nay và ngày mai theo vi-VN
    const dayNames = ['sun','mon','tue','wed','thu','fri','sat'];
    const today = new Date();
    const daysToFetch = Math.max(1, Math.min(2, Number(days)));
    const targets = [];
    for (let i = 0; i < daysToFetch; i++) {
      const d = new Date(today.getTime());
      d.setDate(today.getDate() + i);
      targets.push({ date: d, dayKey: dayNames[d.getDay()] });
    }

    // Lấy tất cả thời khóa biểu có tiết gán teacherId trong các ngày target (năm học/học kỳ hiện hành)
    // Không có helper năm học hiện tại ở đây, lấy tất cả Schedule và lọc theo teacherId + day
    const schedules = await Schedule.find({ isDeleted: { $ne: true } })
      .populate('classId', 'className grade')
      .lean();

    const result = [];
    for (const sch of schedules) {
      for (const t of sch.timetable || []) {
        const isTargetDay = targets.some(tt => tt.dayKey === t.day);
        if (!isTargetDay) continue;
        for (const p of t.periods || []) {
          if (String(p.teacherId) === String(teacher._id)) {
            const target = targets.find(tt => tt.dayKey === t.day);
            result.push({
              date: target?.date?.toISOString(),
              day: t.day,
              period: p.period,
              subjectId: p.subjectId || null,
              subject: p.subject || '',
              class: sch.classId ? { _id: sch.classId._id, name: sch.classId.className, grade: sch.classId.grade } : null,
              year: sch.year,
              semester: sch.semester,
            });
          }
        }
      }
    }

    // Sắp xếp theo ngày -> tiết
    result.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da === db) return (a.period || 0) - (b.period || 0);
      return da - db;
    });

    return res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    console.error('[getTeacherTodaySchedule] Error', err);
    res.status(500).json({ success: false, message: 'Không thể lấy lịch dạy hôm nay', error: err.message });
  }
};