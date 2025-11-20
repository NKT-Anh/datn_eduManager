const User = require('../models/user/user')
const Account = require('../models/user/account')
module.exports = (role) =>{
    return async (req,res,next)=>{
        try{
            const uid = req.firebaseUser.uid;
            const user = await Account.findOne({ uid });

            if (!user || user.role !== role) {
                return res.status(403).json({ message: 'Access denied' });
            }

            req.currentUser = user; 
            next();
        }
        catch(error){
            console.error('[Lỗi kiểm tra vai trò]', error);
            return res.status(500).json({message:'Lỗi server'})
        }
    }
}