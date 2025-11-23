const mongoose = require('mongoose');
const User = require('./user');

const adminSchema = new mongoose.Schema({
  permissions:{type: String}
});

const Admin = User.discriminator('Admin', adminSchema);
module.exports = Admin; 