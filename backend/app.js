// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const extractRoutes = require('./api/extract');
const graphRoutes = require('./api/graphs');
const gapRoutes = require('./api/gaps');
const ideaRoutes = require('./api/ideas');
const verifyRoutes = require('./api/verify');  // ← ADD THIS

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize database
require('./db/init');

// API routes
app.use('/api/extract', extractRoutes);
app.use('/api/graphs', graphRoutes);
app.use('/api/gaps', gapRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api', verifyRoutes);  // ← ADD THIS

// Health check
app.get('/api/health', (req, res) => res.json({ 
  status: 'OK',
  python_path: process.env.PYTHON_PATH || 'default',
  openai_configured: !!process.env.OPENAI_API_KEY
}));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Really Nicca API running on port ${PORT}`);
  console.log(`📊 Python path: ${process.env.PYTHON_PATH || 'default'}`);
  console.log(`🤖 OpenAI configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
});

module.exports = app;