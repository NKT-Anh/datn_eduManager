const admin = require('firebase-admin');
const serviceAccount = require('./key_admin.json'); // <-- file của bạn

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = admin;
