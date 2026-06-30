// routes/participation.js
const express = require('express');
const db = require('../db');
const { identify, requireLogin } = require('../middleware/auth');

const router = express.Router();

function canAccess(userRole, contestAccessLevel) {
  if (userRole === 'admin' || userRole === 'vip') return true;
  if (userRole === 'normal') return contestAccessLevel === 'normal';
  return false;
}

// JOIN a contest -> creates an "in_progress" attempt
router.post('/:contestId/join', identify, requireLogin, (req, res) => {
  const contestId = req.params.contestId;
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
  if (!contest) return res.status(404).json({ error: 'Contest not found.' });

  if (!canAccess(req.user.role, contest.access_level)) {
    return res.status(403).json({ error: 'You are not allowed to join this contest.' });
  }

  const now = new Date();
  if (now > new Date(contest.end_time)) {
    return res.status(400).json({ error: 'This contest has already ended.' });
  }

  const existing = db
    .prepare('SELECT * FROM attempts WHERE user_id = ? AND contest_id = ?')
    .get(req.user.id, contestId);
  if (existing) {
    return res.status(200).json({ message: 'You already joined this contest.', attempt: existing });
  }

  const info = db
    .prepare('INSERT INTO attempts (user_id, contest_id, status) VALUES (?, ?, ?)')
    .run(req.user.id, contestId, 'in_progress');

  res.status(201).json({ message: 'Joined contest.', attemptId: info.lastInsertRowid });
});

// SUBMIT answers for a contest -> calculates score, marks attempt as submitted
// Body: { "answers": [ { "question_id": 1, "option_ids": [3] }, { "question_id": 2, "option_ids": [5,6] } ] }
router.post('/:contestId/submit', identify, requireLogin, (req, res) => {
  const contestId = req.params.contestId;
  const { answers } = req.body;

  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers (array) is required.' });
  }

  const attempt = db
    .prepare('SELECT * FROM attempts WHERE user_id = ? AND contest_id = ?')
    .get(req.user.id, contestId);

  if (!attempt) {
    return res.status(400).json({ error: 'You have not joined this contest yet.' });
  }
  if (attempt.status === 'submitted') {
    return res.status(409).json({ error: 'You have already submitted this contest.' });
  }

  const questions = db.prepare('SELECT * FROM questions WHERE contest_id = ?').all(contestId);
  const insertAnswer = db.prepare(
    'INSERT INTO answers (attempt_id, question_id, option_id) VALUES (?, ?, ?)'
  );

  let score = 0;
  try {
    db.exec('BEGIN');

    for (const q of questions) {
      const submitted = answers.find((a) => Number(a.question_id) === q.id);
      if (!submitted || !Array.isArray(submitted.option_ids) || submitted.option_ids.length === 0) {
        continue; // unanswered question = no points, no penalty
      }

      // Save what the user picked (for history/audit)
      for (const optId of submitted.option_ids) {
        insertAnswer.run(attempt.id, q.id, optId);
      }

      const correctOptionIds = db
        .prepare('SELECT id FROM options WHERE question_id = ? AND is_correct = 1')
        .all(q.id)
        .map((o) => o.id);

      const submittedSet = [...new Set(submitted.option_ids.map(Number))].sort();
      const correctSet = [...correctOptionIds].sort();

      // Correct only if the user picked EXACTLY the correct set (handles single, multi, true/false the same way)
      const isCorrect =
        submittedSet.length === correctSet.length &&
        submittedSet.every((id, i) => id === correctSet[i]);

      if (isCorrect) score += q.points;
    }

    db.prepare(
      `UPDATE attempts SET status = 'submitted', score = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(score, attempt.id);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.json({ message: 'Contest submitted.', score });
});

// Award prize to the top scorer of a contest (call this once the contest has ended)
// In a real production app this would run automatically via a scheduled job;
// here it's a manual admin-triggered endpoint to keep things simple.
router.post('/:contestId/award-prize', identify, requireLogin, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only an admin can award prizes.' });
  }
  const contestId = req.params.contestId;
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
  if (!contest) return res.status(404).json({ error: 'Contest not found.' });

  const already = db.prepare('SELECT * FROM prizes WHERE contest_id = ?').get(contestId);
  if (already) return res.status(409).json({ error: 'Prize already awarded for this contest.' });

  const topScorer = db
    .prepare(
      `SELECT * FROM attempts WHERE contest_id = ? AND status = 'submitted' ORDER BY score DESC, submitted_at ASC LIMIT 1`
    )
    .get(contestId);

  if (!topScorer) {
    return res.status(400).json({ error: 'No submitted attempts found for this contest yet.' });
  }

  db.prepare('INSERT INTO prizes (contest_id, user_id, prize) VALUES (?, ?, ?)').run(
    contestId,
    topScorer.user_id,
    contest.prize || 'Winner'
  );

  res.json({ message: 'Prize awarded.', winnerUserId: topScorer.user_id, score: topScorer.score });
});

module.exports = router;
