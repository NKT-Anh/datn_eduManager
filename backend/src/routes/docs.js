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
router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
router.get('/me', authMiddleware , (req, res) => {
  res.json({ message: 'Token hợp lệ', user: req.user });
});

module.exports = router;
