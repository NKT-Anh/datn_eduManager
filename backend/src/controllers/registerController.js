const User = require('../models/user/user');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
  const { username, password, email } = req.body;
  console.log('Register input:', { username, email });
  try {
    const existingUser = await User.findOne({ $or: [ { username }, { email } ] });
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, email, isEmailVerified: false });
    await newUser.save();
    console.log('User registered:', newUser);
    res.status(201).json({ message: 'User registered successfully', userId: newUser._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}; 