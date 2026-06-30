// routes/questions.js
const express = require('express');
const db = require('../db');
const { identify, requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

// ADD a question (with its options) to a contest - admin only
// Body example:
// {
//   "contest_id": 1,
//   "question_text": "What is 2+2?",
//   "question_type": "single",       // 'single' | 'multi' | 'truefalse'
//   "points": 1,
//   "options": [
//     { "option_text": "3", "is_correct": false },
//     { "option_text": "4", "is_correct": true }
//   ]
// }
router.post('/', identify, requireLogin, requireRole('admin'), (req, res) => {
  const { contest_id, question_text, question_type, points, options } = req.body;

  if (!contest_id || !question_text || !question_type || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({
      error: 'contest_id, question_text, question_type and at least 2 options are required.',
    });
  }
  if (!['single', 'multi', 'truefalse'].includes(question_type)) {
    return res.status(400).json({ error: "question_type must be 'single', 'multi' or 'truefalse'." });
  }

  const contest = db.prepare('SELECT id FROM contests WHERE id = ?').get(contest_id);
  if (!contest) return res.status(404).json({ error: 'Contest not found.' });

  const correctCount = options.filter((o) => o.is_correct).length;
  if (correctCount === 0) {
    return res.status(400).json({ error: 'At least one option must be marked correct.' });
  }
  if (question_type !== 'multi' && correctCount > 1) {
    return res.status(400).json({ error: 'Only "multi" questions can have more than one correct option.' });
  }

  const insertQuestion = db.prepare(
    'INSERT INTO questions (contest_id, question_text, question_type, points) VALUES (?, ?, ?, ?)'
  );
  const insertOption = db.prepare(
    'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)'
  );

  // Run as a single transaction so we never end up with a question that has no options
  let questionId;
  try {
    db.exec('BEGIN');
    const qInfo = insertQuestion.run(contest_id, question_text, question_type, points || 1);
    questionId = Number(qInfo.lastInsertRowid);
    for (const opt of options) {
      insertOption.run(questionId, opt.option_text, opt.is_correct ? 1 : 0);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.status(201).json({ message: 'Question added.', questionId });
});

module.exports = router;
