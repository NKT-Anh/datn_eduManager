const mongoose = require('mongoose');
const accountSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    // username: { type: String, required: true, unique: true },
    // password: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    role:{
        type:String,
        enum:['admin','student','teacher','parent'],
        required:true,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const Account = mongoose.model('Account', accountSchema);
module.exports = Account;