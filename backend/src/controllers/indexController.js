const mongoose = require('mongoose');

exports.checkMongoConnection = (req, res) => {
  const state = mongoose.connection.readyState;
  // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  let status = '';
  switch (state) {
    case 0:
      status = 'disconnected';
      break;
    case 1:
      status = 'connected';
      break;
    case 2:
      status = 'connecting';
      break;
    case 3:
      status = 'disconnecting';
      break;
    default:
      status = 'unknown';
  }
  res.json({ status });
};