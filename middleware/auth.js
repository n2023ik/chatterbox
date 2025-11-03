const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

      const env = require('../config/env');
      // Verify token
      const decoded = jwt.verify(token, env.JWT_SECRET);

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
    console.error('Auth middleware error:', error);
    
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
  const env = require('../config/env');
  const decoded = jwt.verify(token, env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-googleId');
        
        if (user) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = authMiddleware; // Step 1: Exports the function
module.exports.optionalAuth = optionalAuth; // Step 2: Adds a new property to the exported function
