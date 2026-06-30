// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// SIGN UP
// Anyone can sign up. role defaults to 'normal' unless explicitly set
// (in a real app, 'admin'/'vip' would be set by an admin, not self-chosen -
// we allow it here ONLY to make testing different roles easy for this assignment)
router.post('/signup', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const allowedRoles = ['normal', 'vip', 'admin'];
  const finalRole = allowedRoles.includes(role) ? role : 'normal';

  const hashed = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hashed, finalRole);

  const user = { id: info.lastInsertRowid, name, role: finalRole };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({ message: 'Account created.', token, user });
});

// LOG IN
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = { id: row.id, name: row.name, role: row.role };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

  res.json({ message: 'Logged in.', token, user });
});

module.exports = router;
