const Group = require('../../models/subject/group');

exports.getAllGroups = async (req, res) => {
    try {
        const groups = await Group.find();
        res.status(200).json(groups);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
exports.createGroups = async (req,res)=>{
    try{
        const group = new Groups(req.body);
        const saveGroup = await group.save();
        res.status(201).json(saveGroup);
    }
    catch(error){
        res.status(400).json({message:error.message})
    }


}
