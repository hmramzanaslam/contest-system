// routes/leaderboard.js
const express = require('express');
const db = require('../db');
const { identify } = require('../middleware/auth');

const router = express.Router();

// GET leaderboard for a contest - sorted by highest score first
// Open to everyone (even guests) to view, per typical contest behavior
router.get('/:contestId', identify, (req, res) => {
  const contestId = req.params.contestId;
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
  if (!contest) return res.status(404).json({ error: 'Contest not found.' });

  const rows = db
    .prepare(
      `SELECT u.id as user_id, u.name, a.score, a.submitted_at
       FROM attempts a
       JOIN users u ON u.id = a.user_id
       WHERE a.contest_id = ? AND a.status = 'submitted'
       ORDER BY a.score DESC, a.submitted_at ASC`
    )
    .all(contestId);

  const leaderboard = rows.map((r, i) => ({ rank: i + 1, ...r }));
  res.json({ contest: contest.name, leaderboard });
});

module.exports = router;
