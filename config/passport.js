const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');

module.exports = function(passport) {
  // --- Google OAuth 2.0 Strategy ---
  // This strategy is used for the initial login with Google.
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || '/api/auth/callback/google'
  },
  async (accessToken, refreshToken, profile, done) => {
    console.log('🔑 GoogleStrategy: Google login callback fired');
    console.log('🔑 Google profile:', profile);
    const newUser = {
      googleId: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value,
      avatar: profile.photos[0].value,
      lastSeen: new Date()
    };

    try {
      let user = await User.findOneAndUpdate(
        { googleId: profile.id },
        newUser,
        { new: true, upsert: true }
      );
      console.log('🔑 User upserted in MongoDB:', user);
      done(null, user);
    } catch (error) {
      console.error('❌ Error in Google Strategy:', error);
      done(error, null);
    }
  }));

  // --- JSON Web Token (JWT) Strategy ---
  // This strategy is used to protect API endpoints. It verifies the token from the Authorization header.
  const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'your-secret-key'
  };

  passport.use(new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      console.log('🔒 JWTStrategy: Verifying token payload:', jwt_payload);
      const user = await User.findById(jwt_payload.id);
      if (user) {
        console.log('🔒 JWTStrategy: User found:', user.email);
        return done(null, user);
      } else {
        console.log('🔒 JWTStrategy: User not found for id:', jwt_payload.id);
        return done(null, false);
      }
    } catch (error) {
      console.error('❌ Error in JWT Strategy:', error);
      return done(error, false);
    }
  }));

  // --- Session Management ---
  // These are required for persistent login sessions (used by Google OAuth flow).
  
  // Stores the user ID in the session.
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Retrieves the full user object from the database using the ID from the session.
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
