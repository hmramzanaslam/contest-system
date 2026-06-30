// server.js
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const contestRoutes = require('./routes/contests');
const questionRoutes = require('./routes/questions');
const participationRoutes = require('./routes/participation');
const leaderboardRoutes = require('./routes/leaderboard');
const historyRoutes = require('./routes/history');

const app = express();
app.use(cors());
app.use(express.json());

// ---- Rate limiting (prevents abuse / spam requests) ----
// General limiter for all API routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per IP per 15 mins
  message: { error: 'Too many requests, please slow down and try again later.' },
});
app.use('/api/', generalLimiter);

// Stricter limiter just for login/signup, to prevent brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login/signup attempts, please try again later.' },
});
app.use('/api/auth', authLimiter);

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/contests', participationRoutes); // /api/contests/:id/join, /submit, /award-prize
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/history', historyRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ---- Error handling for anything unexpected ----
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Contest System API running on http://localhost:${PORT}`));
