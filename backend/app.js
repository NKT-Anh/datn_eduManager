const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/index');
const {router} = require('./src/routes/index');
const docsRoute = require('./src/routes/docs');

const app = express();

const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:3001',
  'http://10.10.10.244:8080',
];

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
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

// Kết nối MongoDB
connectDB();

// 👉 chỉ mount /api 1 lần, docs đã nằm trong routes/index.js
app.use('/api', router);
app.use('/api/docs', docsRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
