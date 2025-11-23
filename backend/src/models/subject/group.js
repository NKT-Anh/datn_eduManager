const mongoose = require('mongoose');
const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
},
{
    timestamps: true,
});

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;