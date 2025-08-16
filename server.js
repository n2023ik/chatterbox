const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
require('dotenv').config();

// --- Import Routes ---
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');

// --- Import Middleware ---
const protect = require('./middleware/auth'); 

// --- Import Socket Handler ---
const socketHandler = require('./config/socket');

// --- App Initialization ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// --- Environment Setup ---
const isProduction = process.env.NODE_ENV === 'production';

// --- Core Middleware ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Request logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Session and Authentication Middleware ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// --- Static Asset Serving ---
// Serve static files like CSS, JS, and images from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Rate Limiter for API routes ---
// Define the rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply the rate limiter ONLY to API routes to prevent abuse
app.use('/api/', limiter);

// --- API Routes ---
console.log('Registering API routes...');

// Test route to verify routing is working
app.get('/api/test', (req, res) => {
  console.log(' Test route hit');
  res.json({ message: 'Test route working' });
});

// Debug middleware for all API requests
app.use('/api/*', (req, res, next) => {
  console.log(` API request received: ${req.method} ${req.path}`);
  console.log(` Full URL: ${req.originalUrl}`);
  next();
});

app.use('/api/auth', authRoutes); // This mounts all auth routes, but...
console.log(' Auth routes registered at /api/auth');
app.use('/api/users', protect, userRoutes);
console.log(' User routes registered at /api/users');
app.use('/api/chat', protect, chatRoutes);
console.log(' Chat routes registered at /api/chat');

// --- 404 Handler for API routes ---
app.use('/api/*', (req, res) => {
  console.log(` API route not found: ${req.path}`);
  res.status(404).json({ message: 'API route not found' });
});

// --- Frontend Serving (SPA Catch-all) ---
// This must come AFTER your API routes and only handle non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Socket.io Connection Handler ---
socketHandler(io);

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log(' Connected to MongoDB'))
.catch((error) => console.error(' MongoDB connection error:', error));

// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
  console.log(` Visit http://localhost:${PORT}`);
});