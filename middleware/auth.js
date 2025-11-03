const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    // Verify token using centralized env JWT secret
    const decoded = jwt.verify(token, env.JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key');

    // Get user from database
    const user = await User.findById(decoded.id).select('-googleId');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid, user not found'
      });
    }

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    // Only log server-side errors; token errors return a clear 401
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Optional auth middleware - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      if (token) {
        const decoded = jwt.verify(token, env.JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id).select('-googleId');

        if (user) {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
