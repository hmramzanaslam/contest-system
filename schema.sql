-- schema.sql
-- PostgreSQL schema for the Contest Participation System.
--
-- NOTE: The actual running project in this submission uses SQLite (via Node's
-- built-in node:sqlite module) so it works instantly with zero setup/installation.
-- This file is the equivalent PostgreSQL schema, provided as the mandatory
-- "database setup and schema" deliverable, and matches the SQLite schema 1:1.
-- To switch the backend to Postgres, run this file against a Postgres database
-- and swap db.js to use a Postgres client (e.g. "pg") instead of node:sqlite.

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','vip','normal')) DEFAULT 'normal',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE contests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('normal','vip')) DEFAULT 'normal',
  prize VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('single','multi','truefalse')),
  points INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text VARCHAR(255) NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

-- An "attempt" = one user's participation in one contest
CREATE TABLE attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  contest_id INTEGER NOT NULL REFERENCES contests(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress','submitted')) DEFAULT 'in_progress',
  score INTEGER DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMP,
  UNIQUE (user_id, contest_id) -- a user can only attempt a contest once
);

-- Stores which option(s) a user picked for each question in an attempt
CREATE TABLE answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  option_id INTEGER NOT NULL REFERENCES options(id)
);

-- Winners / prizes given out per contest
CREATE TABLE prizes (
  id SERIAL PRIMARY KEY,
  contest_id INTEGER NOT NULL REFERENCES contests(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  prize VARCHAR(255),
  awarded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (contest_id) -- only one winner per contest
);

-- Helpful indexes for performance
CREATE INDEX idx_questions_contest_id ON questions(contest_id);
CREATE INDEX idx_options_question_id ON options(question_id);
CREATE INDEX idx_attempts_contest_id ON attempts(contest_id);
CREATE INDEX idx_attempts_user_id ON attempts(user_id);
CREATE INDEX idx_answers_attempt_id ON answers(attempt_id);
