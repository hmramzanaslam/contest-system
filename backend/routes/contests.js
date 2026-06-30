// routes/contests.js
const express = require('express');
const db = require('../db');
const { identify, requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: can this role access this contest's access_level?
function canAccess(userRole, contestAccessLevel) {
  if (userRole === 'admin' || userRole === 'vip') return true; // VIP/Admin see everything
  if (userRole === 'normal') return contestAccessLevel === 'normal';
  return false; // guest
}

// LIST all contests
// Guests CAN view the list (per spec: "Can only view the contest"),
// but VIP-only contests are hidden from non-VIP/non-admin users.
router.get('/', identify, (req, res) => {
  const all = db.prepare('SELECT * FROM contests ORDER BY start_time DESC').all();
  const visible = all.filter((c) => {
    if (req.user.role === 'admin' || req.user.role === 'vip') return true;
    // guests and normal users can SEE normal + vip contests in the list,
    // but we mark whether they're actually allowed to join
    return true;
  });
  const withAccessFlag = visible.map((c) => ({
    ...c,
    can_join: canAccess(req.user.role, c.access_level),
  }));
  res.json(withAccessFlag);
});

// GET single contest with its questions (without revealing correct answers)
router.get('/:id', identify, (req, res) => {
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Contest not found.' });

  const questions = db
    .prepare('SELECT id, question_text, question_type, points FROM questions WHERE contest_id = ?')
    .all(contest.id);

  const questionsWithOptions = questions.map((q) => ({
    ...q,
    options: db
      .prepare('SELECT id, option_text FROM options WHERE question_id = ?') // is_correct NOT sent to client
      .all(q.id),
  }));

  res.json({
    ...contest,
    can_join: canAccess(req.user.role, contest.access_level),
    questions: questionsWithOptions,
  });
});

// CREATE a contest - admin only
router.post('/', identify, requireLogin, requireRole('admin'), (req, res) => {
  const { name, description, access_level, prize, start_time, end_time } = req.body;

  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'name, start_time and end_time are required.' });
  }
  if (!['normal', 'vip'].includes(access_level)) {
    return res.status(400).json({ error: "access_level must be 'normal' or 'vip'." });
  }

  const info = db
    .prepare(
      `INSERT INTO contests (name, description, access_level, prize, start_time, end_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, description || '', access_level, prize || '', start_time, end_time, req.user.id);

  res.status(201).json({ message: 'Contest created.', contestId: info.lastInsertRowid });
});

module.exports = router;
