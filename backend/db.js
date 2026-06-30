// db.js
// This file sets up our database and creates all the tables we need.
// We use SQLite because it needs NO installation - it's just a file (contest.db)
// To use real PostgreSQL instead, see the README - the schema.sql file has the
// equivalent PostgreSQL version.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'contest.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- CREATE TABLES ----------

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','vip','normal')) DEFAULT 'normal',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  access_level TEXT NOT NULL CHECK(access_level IN ('normal','vip')) DEFAULT 'normal',
  prize TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK(question_type IN ('single','multi','truefalse')),
  points INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  option_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0, -- 1 = correct, 0 = wrong
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- An "attempt" = one user's participation in one contest
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  contest_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('in_progress','submitted')) DEFAULT 'in_progress',
  score INTEGER DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (contest_id) REFERENCES contests(id),
  UNIQUE(user_id, contest_id) -- a user can only attempt a contest once
);

-- Stores which option(s) a user picked for each question in an attempt
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (option_id) REFERENCES options(id)
);

-- Winners / prizes given out per contest
CREATE TABLE IF NOT EXISTS prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  prize TEXT,
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contest_id) REFERENCES contests(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(contest_id) -- only one winner per contest
);
`);

module.exports = db;
