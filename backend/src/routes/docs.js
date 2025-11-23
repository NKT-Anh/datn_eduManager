// const express = require('express');
// const router = express.Router();
// const path = require('path');
// const { routers } = require('./index'); // mảng { group, router }

// // Trả JSON API list (chỉ route cha)
// router.get('/list', (req, res) => {
//   const apiList = routers.flatMap(r => {
//     // Lấy các layer route trực tiếp của router (không đâm vào router con)
//     return r.router.stack
//       .filter(layer => layer.route) // chỉ layer có route trực tiếp
//       .map(layer => ({
//         path: `/api/${r.group}${layer.route.path}`.replace(/\/+/g, '/'),
//         methods: Object.keys(layer.route.methods).map(m => m.toUpperCase()), // method
//         group: r.group,
//         description: r.description || 'Không có mô tả', // lấy description từ routers
//       }));
//   });

//   res.json(apiList);
// });

// // Trả HTML
// router.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '../public/docs.html'));
// });

// module.exports = router;

// src/routes/docs.js
const express = require('express');
const router = express.Router();
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { routers } = require('./index'); // mảng routers {group, router, description}
const authMiddleware   = require('../middlewares/authMiddleware');

// Swagger config
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart School Management API',
      version: '1.0.0',
      description: 'API documentation for Smart School Management System',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [], // sẽ thêm endpoint động bên dưới
};

const swaggerSpec = swaggerJsdoc(options);

// ✅ Tạo dynamically API docs từ routers
routers.forEach((r) => {
  r.router.stack.forEach((layer) => {
    if (layer.route) {
      const path = `/api/${r.group}${layer.route.path}`.replace(/\/+/g, '/');
      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());

      methods.forEach((method) => {
        swaggerSpec.paths[path] = swaggerSpec.paths[path] || {};
        swaggerSpec.paths[path][method.toLowerCase()] = {
          tags: [r.group],
          summary: r.description || 'Không có mô tả',
          responses: {
            200: { description: 'OK' },
            401: { description: 'Unauthorized' },
          },
          security: [{ bearerAuth: [] }],
        };
      });
    }
  });
});

// 📄 Swagger UI route (public, có nút Authorize)
const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Smart School API Documentation',
  swaggerOptions: {
    persistAuthorization: true, // ✅ Lưu token khi refresh
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// 📜 JSON route để xem API list
router.get('/list', (req, res) => {
  const apiList = routers.flatMap((r) => {
    return r.router.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: `/api/${r.group}${layer.route.path}`.replace(/\/+/g, '/'),
        methods: Object.keys(layer.route.methods).map((m) => m.toUpperCase()),
        group: r.group,
        description: r.description || 'Không có mô tả',
      }));
  });
  res.json(apiList);
});

// 📄 Optional: route test token
router.get('/me', authMiddleware, (req, res) => {
  res.json({ 
    message: 'Token hợp lệ', 
    user: {
      accountId: req.user.accountId,
      email: req.user.email,
      role: req.user.role,
      teacherFlags: req.user.teacherFlags,
    }
  });
});

// 📄 Route để test token (không cần auth, chỉ để xem format)
router.get('/test-token', (req, res) => {
  const authHeader = req.headers.authorization;
  let tokenInfo = {
    hasHeader: !!authHeader,
    format: 'Bearer <your-token>',
    example: 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    note: 'Token sẽ được lưu tự động khi bạn nhập vào Swagger UI',
    instructions: [
      '1. Click nút "Authorize" ở góc trên bên phải',
      '2. Nhập token của bạn (có thể có hoặc không có prefix "Bearer")',
      '3. Click "Authorize" để lưu token',
      '4. Token sẽ được tự động gửi kèm mọi request',
      '5. Để lấy token từ frontend: localStorage.getItem("token") hoặc từ backendUser?.idToken'
    ]
  };

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      tokenInfo.tokenLength = token?.length || 0;
      tokenInfo.isValidFormat = true;
      tokenInfo.preview = token ? token.substring(0, 20) + '...' : 'Empty';
    } else {
      tokenInfo.isValidFormat = false;
      tokenInfo.error = 'Token phải có format: Bearer <token>';
    }
  }

  res.json(tokenInfo);
});

module.exports = router;
