const mongoose = require('mongoose');

const curriculumSchema = new mongoose.Schema({

    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
    },

    periodperweek: {
        type: Number,
        required: true,
    },
    grade: {
        type: String,
        required: true,
        enum: ['10', '11', '12'],
    },
    // teacherId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Teacher',
    //     required: true,
    // },
    // classId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Class',
    //     required: true,
    // },
});
const Curriculum = mongoose.model('Curriculum', curriculumSchema);
module.exports = Curriculum;