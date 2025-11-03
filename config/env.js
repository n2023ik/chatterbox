// Centralized environment/config validation
const required = ['JWT_SECRET', 'SESSION_SECRET', 'MONGODB_URI'];
const missing = required.filter(k => !process.env[k]);

if (missing.length) {
  console.warn(`Warning: missing required env vars: ${missing.join(', ')}. Using defaults for local dev, but set them for production.`);
}

// BACKEND_URL should be the fully qualified URL where this server is reachable (include protocol and port if needed)
// Example: http://localhost:3000 or https://your-app.example.com
const BACKEND_URL = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'please-change-this-jwt-secret',
  SESSION_SECRET: process.env.SESSION_SECRET || 'please-change-this-session-secret',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  BACKEND_URL,
  // Make CALLBACK_URL an absolute URL by default so OAuth providers receive the exact URI
  CALLBACK_URL: process.env.CALLBACK_URL || `${BACKEND_URL.replace(/\/$/, '')}/api/auth/google/callback`
};
