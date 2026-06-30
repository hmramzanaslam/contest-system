// seed.js
// Run with: npm run seed
// Creates sample users and a sample contest so you can test immediately.

const bcrypt = require('bcryptjs');
const db = require('./db');

const password = bcrypt.hashSync('password123', 10);

function upsertUser(name, email, role) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const info = db
    .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run(name, email, password, role);
  return info.lastInsertRowid;
}

const adminId = upsertUser('Admin User', 'admin@test.com', 'admin');
const vipId = upsertUser('Vicky VIP', 'vip@test.com', 'vip');
const normalId = upsertUser('Nora Normal', 'normal@test.com', 'normal');
const normal2Id = upsertUser('Norman Two', 'normal2@test.com', 'normal');

console.log('Seeded users (all passwords: password123):');
console.log('  admin@test.com   (admin)');
console.log('  vip@test.com     (vip)');
console.log('  normal@test.com  (normal)');
console.log('  normal2@test.com (normal)');

// Only create the sample contest if it doesn't already exist
const existingContest = db.prepare("SELECT id FROM contests WHERE name = 'General Knowledge Quiz'").get();

if (!existingContest) {
  const start = new Date();
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const contestInfo = db
    .prepare(
      `INSERT INTO contests (name, description, access_level, prize, start_time, end_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'General Knowledge Quiz',
      'A fun quiz open to all signed-in users.',
      'normal',
      '$50 Gift Card',
      start.toISOString(),
      end.toISOString(),
      adminId
    );
  const contestId = contestInfo.lastInsertRowid;

  const insertQ = db.prepare(
    'INSERT INTO questions (contest_id, question_text, question_type, points) VALUES (?, ?, ?, ?)'
  );
  const insertOpt = db.prepare(
    'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)'
  );

  // Q1: single-select
  let q = insertQ.run(contestId, 'What is the capital of France?', 'single', 1);
  insertOpt.run(q.lastInsertRowid, 'Paris', 1);
  insertOpt.run(q.lastInsertRowid, 'London', 0);
  insertOpt.run(q.lastInsertRowid, 'Berlin', 0);

  // Q2: true/false
  q = insertQ.run(contestId, 'The earth orbits the sun.', 'truefalse', 1);
  insertOpt.run(q.lastInsertRowid, 'True', 1);
  insertOpt.run(q.lastInsertRowid, 'False', 0);

  // Q3: multi-select
  q = insertQ.run(contestId, 'Which of these are primary colors?', 'multi', 2);
  insertOpt.run(q.lastInsertRowid, 'Red', 1);
  insertOpt.run(q.lastInsertRowid, 'Green', 0);
  insertOpt.run(q.lastInsertRowid, 'Blue', 1);
  insertOpt.run(q.lastInsertRowid, 'Purple', 0);

  console.log(`Seeded contest "General Knowledge Quiz" (id ${contestId}) with 3 questions.`);

  // A VIP-only contest too, to demonstrate access control
  const vipContestInfo = db
    .prepare(
      `INSERT INTO contests (name, description, access_level, prize, start_time, end_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'VIP Movie Trivia',
      'Exclusive contest for VIP members only.',
      'vip',
      'Free Movie Tickets',
      start.toISOString(),
      end.toISOString(),
      adminId
    );
  const vipContestId = vipContestInfo.lastInsertRowid;

  q = insertQ.run(vipContestId, 'Who directed Inception?', 'single', 1);
  insertOpt.run(q.lastInsertRowid, 'Christopher Nolan', 1);
  insertOpt.run(q.lastInsertRowid, 'Steven Spielberg', 0);
  insertOpt.run(q.lastInsertRowid, 'James Cameron', 0);

  console.log(`Seeded contest "VIP Movie Trivia" (id ${vipContestId}) with 1 question.`);
} else {
  console.log('Sample contests already exist, skipping.');
}

console.log('Seeding complete.');
