const mongoose = require("mongoose")

const systemSettingSchema = new mongoose.Schema({
    key : {
        type: String,
        require: true,
        unique: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed, // any full kiểu
        require:true,
    },
    updateAt:{
        type: Date,
        default:Date.now,
    },

})

const SystemSetting = mongoose.model("SystemSetting" , systemSettingSchema);
module.exports = SystemSetting