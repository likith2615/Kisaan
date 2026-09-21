import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import apiRouter from './api.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Kisan Saathi Backend API', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', apiRouter);

// Serve static frontend assets from dist in production
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`🌾 Kisan Saathi Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} is already in use. The Kisan Saathi API server is ALREADY RUNNING in the background on http://localhost:${PORT}`);
    console.log(`💡 You can directly start the frontend with: npm run dev`);
  } else {
    console.error('Server error:', err);
  }
});

// Process resilience against transient errors & unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('⚠️ [Server Warning] Uncaught Exception:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [Server Warning] Unhandled Rejection:', reason?.message || reason);
});


