// routes/history.js
const express = require('express');
const db = require('../db');
const { identify, requireLogin } = require('../middleware/auth');

const router = express.Router();

// GET /api/history/me -> everything about the logged-in user's contest activity
router.get('/me', identify, requireLogin, (req, res) => {
  const userId = req.user.id;

  const inProgress = db
    .prepare(
      `SELECT c.id as contest_id, c.name, c.end_time, a.started_at
       FROM attempts a JOIN contests c ON c.id = a.contest_id
       WHERE a.user_id = ? AND a.status = 'in_progress'
       ORDER BY a.started_at DESC`
    )
    .all(userId);

  const completed = db
    .prepare(
      `SELECT c.id as contest_id, c.name, a.score, a.submitted_at
       FROM attempts a JOIN contests c ON c.id = a.contest_id
       WHERE a.user_id = ? AND a.status = 'submitted'
       ORDER BY a.submitted_at DESC`
    )
    .all(userId);

  const prizesWon = db
    .prepare(
      `SELECT c.id as contest_id, c.name, p.prize, p.awarded_at
       FROM prizes p JOIN contests c ON c.id = p.contest_id
       WHERE p.user_id = ?
       ORDER BY p.awarded_at DESC`
    )
    .all(userId);

  res.json({ inProgress, completed, prizesWon });
});

module.exports = router;
