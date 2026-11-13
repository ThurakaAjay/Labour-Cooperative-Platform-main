const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./db/connection');
const { seedDatabase, ensureAdminUser } = require('./db/seed');

// Import modular routes
const authRoutes = require('./routes/authRoutes');
const workerRoutes = require('./routes/workerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const cooperativeRoutes = require('./routes/cooperativeRoutes');
const pollRoutes = require('./routes/pollRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const geoRoutes = require('./routes/geoRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Render's (or any) reverse proxy so req.ip / rate limiting and secure
// cookies see the real client address instead of the proxy's.
app.set('trust proxy', 1);

// 1. Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Razorpay Checkout is loaded from checkout.razorpay.com and opens its
      // own iframe/popup back to Razorpay's domains during payment.
      scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      // data: uploaded/Cloudinary photos, and OSM tile subdomains for the
      // Leaflet tracking map.
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.tile.openstreetmap.org'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
      frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. Strict CORS Configuration
const defaultLocalOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://localhost:5000'
];

const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(s => s && s !== '*')
  : [];

const platformOrigins = [
  process.env.RENDER_EXTERNAL_URL,
  process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
].filter(Boolean);

const allowedOrigins = new Set([...defaultLocalOrigins, ...envOrigins, ...platformOrigins]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, same-origin static frontend)
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    // In production, if CORS_ORIGIN is not explicitly restricted, allow request origins
    if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
      return callback(null, true);
    }
    return callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
  },
  credentials: true
}));

// 3. Request Parsing. `verify` stashes the raw bytes alongside the parsed
// body so the Razorpay webhook route can HMAC-verify the exact payload
// Razorpay signed (re-stringifying req.body would not reliably match it).
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// 4. Rate Limiting to prevent DoS & Brute Force
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 1000, // max 30 in prod, 1000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-otp', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);

// 5. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/cooperative', cooperativeRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/geo', geoRoutes);

// Health Check Endpoint (Perfect for container liveness/readiness probes)
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  res.json({
    status: 'ok',
    service: 'WorkHive Enterprise API Server',
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    database: {
      engine: 'MongoDB',
      status: states[dbState] || 'unknown',
      connected: dbState === 1
    },
    timestamp: new Date().toISOString()
  });
});

// Legacy backward compatibility route for quick stats (Restricted: Administrator Only)
const { authenticate, authorizeRole } = require('./middleware/auth.middleware');
app.get('/api/stats', authenticate, authorizeRole('admin'), async (req, res) => {
  const AdminMetric = require('./models/AdminMetric');
  try {
    const metrics = await AdminMetric.findOne({ metricKey: 'primary_node_metrics' });
    res.json(metrics || {});
  } catch (err) {
    res.json({});
  }
});

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route '${req.originalUrl}' not found.`
  });
});

// Serve static frontend build (auto-detects if dist/ exists)
const distPath = path.join(__dirname, '../client/dist');
const fs = require('fs');
if (fs.existsSync(distPath)) {
  // Cache Vite's content-hashed production chunks for 1 year
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true
  }));

  // Serve non-hashed public assets (favicon, logos, robots.txt)
  app.use(express.static(distPath, {
    maxAge: '1h'
  }));

  // Catch-all: serve React app for any non-API route (supports client-side routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Centralized Global Error Handler
const errorHandler = require('./middleware/error.middleware');
app.use(errorHandler);

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL UNHANDLED REJECTION]', reason);
});

let activeServer = null;

// Initialize MongoDB & Start Server
const startServer = async () => {
  try {
    await connectDB();
    await seedDatabase();
    await ensureAdminUser();

    activeServer = app.listen(PORT, () => {
      console.log(`[WorkHive] API Server actively listening on http://localhost:${PORT}`);
    });
    return activeServer;
  } catch (err) {
    console.error('Fatal error starting WorkHive server:', err.message);
    process.exit(1);
  }
};

// Graceful Shutdown on Container Termination
const gracefulShutdown = async (signal) => {
  console.log(`\n[WorkHive] Received ${signal}. Initiating graceful shutdown...`);
  if (activeServer) {
    activeServer.close(() => {
      console.log('[WorkHive] HTTP server closed.');
    });
  }
  try {
    const mongoose = require('mongoose');
    await mongoose.connection.close(false);
    console.log('[WorkHive] MongoDB connection closed safely.');
  } catch (err) {
    console.error('[WorkHive] Error during MongoDB shutdown:', err.message);
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
