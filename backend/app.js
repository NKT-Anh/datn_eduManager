const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/index');
const {router} = require('./src/routes/index');
const docsRoute = require('./src/routes/docs');
const autoAuditLog = require('./src/middlewares/autoAuditLogMiddleware');

const app = express();

// ✅ Cấu hình CORS từ environment variables
// Format: CORS_ORIGINS=http://localhost:8080,http://localhost:8081,http://localhost:3001
const corsOriginsEnv = process.env.CORS_ORIGINS;
const allowedOrigins = corsOriginsEnv 
  ? corsOriginsEnv.split(',').map(origin => origin.trim())
  : [
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:3001',
      'http://10.10.10.244:8080',
    ];

console.log('✅ [CORS] Allowed origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    console.log('[CORS check] Origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'x-school-year', 'x-school-year-code'],
  credentials: true,
  methods: ['GET', 'POST','PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

// Kết nối MongoDB
connectDB();

// ✅ Khởi tạo backup scheduler
try {
  const { initBackupScheduler } = require('./src/jobs/backupScheduler');
  initBackupScheduler();
} catch (error) {
  console.warn('⚠️ [Backup Scheduler] Không thể khởi tạo:', error.message);
}

// 👉 chỉ mount /api 1 lần, docs đã nằm trong routes/index.js
app.use('/api', router);
app.use('/api/docs', docsRoute);

// Health check
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Global error logger (prints stack for debugging)
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled error:', {
    message: err?.message,
    stack: err?.stack,
    path: req?.path,
    method: req?.method,
    body: req?.body
  });
  res.status(err?.status || 500).json({ message: err?.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
