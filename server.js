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
// Load local env override file if present (config/.env.local). This is helpful for local dev.
require('dotenv').config({ path: path.join(__dirname, 'config', '.env.local') });
// Also load root .env if present (will not override values already set by .env.local)
require('dotenv').config();
const env = require('./config/env');

// --- Import Routes ---
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat_clean');

// --- Import Middleware ---
const protect = require('./middleware/auth');

// --- Import Socket Handler ---
const socketHandler = require('./config/socket');

// --- App Initialization ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: env.FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// --- Environment Setup ---
const isProduction = process.env.NODE_ENV === 'production';

// --- Core Middleware ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

// --- CORS configuration ---
app.use(cors({
  origin: env.FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Request logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Session and Authentication Middleware ---
const MongoStore = require('connect-mongo');

app.use(session({
  secret: env.SESSION_SECRET || process.env.SESSION_SECRET || 'your-super-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: env.MONGODB_URI || process.env.MONGODB_URI }),
  cookie: {
    secure: isProduction,     // true in production so cookies only sent over HTTPS
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// --- Static Asset Serving ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Rate Limiter for API routes ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', protect, userRoutes);
app.use('/api/chat', protect, chatRoutes);

// --- 404 Handler for API routes ---
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// --- SPA Catch-all ---
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Socket.io ---
socketHandler(io);
// expose io to route handlers
app.set('io', io);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Database Connection ---
mongoose.connect(env.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((error) => console.error('MongoDB connection error:', error));

// --- Global Error Handling ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
