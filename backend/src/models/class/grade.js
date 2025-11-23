const mongoose = require('mongoose')

const gradeSchema = new mongoose.Schema({
    name:{
        type:String,
        require:true,
    },
      code: {
    type: String,
    unique: true,          // đảm bảo không trùng mã
    required: false,  
  },
    level:{
        type: String, 
        enum: ["primary", "secondary", "high"], 
        default: "high" ,
    },
    order: { type: Number, default: 1 },
    description: { type: String },
},
{ timestamps: true })


const Grade = mongoose.model('Grade', gradeSchema);

module.exports = Grade; 