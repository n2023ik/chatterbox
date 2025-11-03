const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken'); // 👈 **1. Import the JWT library**
const router = express.Router();
const protect = require('../middleware/auth');
const env = require('../config/env');

// @route   GET /api/auth/google
// @desc    Authenticate with Google
// @access  Public
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// @route   GET /api/auth/google/callback
// @desc    Google auth callback
// @access  Public
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=auth_failed`,
        session: false
    }),
    (req, res) => {
        // ✅ Only include what you need, and flatten _id
        const payload = {
            id: req.user._id.toString(),
            email: req.user.email,
            name: req.user.name,
            avatar: req.user.avatar
        };

    const token = jwt.sign(payload, env.JWT_SECRET || process.env.JWT_SECRET || 'your-super-secret-key', { expiresIn: '1d' });

    res.redirect(`${env.FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}?token=${token}`);
    }
);

// @route   GET /api/auth/logout
// @desc    Logout user (this is now handled client-side by deleting the token)
// @access  Public
router.post('/logout', (req, res) => {
    // Server-side logout for token-based auth is often just a confirmation.
    // The client is responsible for deleting the token.
    res.json({ success: true, message: "Logout acknowledged." });
});


// @route   POST /api/auth/verify
// @desc    Verify user's token and return user data
// @access  Private
// This route now needs to be protected by a middleware that verifies the JWT
// (For simplicity, we are assuming the middleware 'protect' from your server.js does this)
router.post('/verify', protect, (req, res) => {
    // If you have a middleware that verifies the token and attaches the user,
    // you can simply return the user data.
    if (req.user) {
        res.json({
            success: true,
            user: req.user
        });
    } else {
        // This part is typically handled by the auth middleware itself
        res.status(401).json({
            success: false,
            message: 'Not authenticated or token invalid'
        });
    }
});

module.exports = router;