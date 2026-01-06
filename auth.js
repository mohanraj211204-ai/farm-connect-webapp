const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../routes/User');
const OTPService = require('../utils/otpService');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      username: user.username, 
      role: user.role,
      fullName: user.fullName 
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number'
      });
    }
    
    // Generate and send OTP
    const otp = OTPService.generateOTP();
    const result = await OTPService.sendOTP(mobile, otp);
    
    if (result.success) {
      OTPService.storeOTP(mobile, otp);
      return res.json({
        success: true,
        message: 'OTP sent successfully'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
    
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Register with OTP verification
router.post('/register', async (req, res) => {
  try {
    const { username, mobile, password, fullName, role, location, otp } = req.body;
    
    // Validate inputs
    if (!username || !mobile || !password || !fullName || !role || !otp) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Verify OTP
    const verification = OTPService.verifyOTP(mobile, otp);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }
    
    // Check duplicate username
    const existingUser = await User.findOne({ 
      $or: [{ username }, { mobile }] 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.username === username ? 
          'Username already taken' : 'Mobile number already registered'
      });
    }
    
    // Create user
    const user = new User({
      username,
      mobile,
      password,
      fullName,
      role,
      location: location || { district: '', state: '' },
      isVerified: true
    });
    
    await user.save();
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        location: user.location
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        location: user.location,
        rating: user.rating
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

module.exports = router;