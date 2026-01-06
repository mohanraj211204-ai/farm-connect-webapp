// Simple OTP service for development
// In production, integrate with SMS service like TextLocal, Twilio, etc.

const otpStore = new Map();

class OTPService {
  // Generate 6-digit OTP
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send OTP (Mock function for development)
  static async sendOTP(mobileNumber, otp) {
    console.log(`[DEV] OTP for ${mobileNumber}: ${otp}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      message: 'OTP sent successfully (Development Mode)'
    };
  }

  // Store OTP with expiry (10 minutes)
  static storeOTP(mobile, otp) {
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(mobile, { otp, expiry });
    
    // Auto cleanup after expiry
    setTimeout(() => {
      otpStore.delete(mobile);
    }, 10 * 60 * 1000);
    
    return true;
  }

  // Verify OTP
  static verifyOTP(mobile, userOTP) {
    const stored = otpStore.get(mobile);
    
    if (!stored) {
      return { valid: false, message: 'OTP expired or not found' };
    }

    if (Date.now() > stored.expiry) {
      otpStore.delete(mobile);
      return { valid: false, message: 'OTP expired' };
    }

    if (stored.otp === userOTP) {
      otpStore.delete(mobile);
      return { valid: true, message: 'OTP verified successfully' };
    }

    return { valid: false, message: 'Invalid OTP' };
  }
}

module.exports = OTPService;