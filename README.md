# Contest Participation System

A full-stack contest/quiz system: users join contests, answer questions (single-select,
multi-select, true/false), get auto-scored, and the top scorer wins a prize. Includes a
leaderboard and per-user history (in-progress contests, completed contests, prizes won).

Three roles: **Admin** (manages contests/questions, awards prizes, full access),
**VIP** (full access to all contests), **Normal/signed-in** (normal contests only),
**Guest** (view-only, can't join).

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite, using Node's built-in `node:sqlite` module (no installation needed -
  no native compilation, no separate DB server to set up). An equivalent **PostgreSQL**
  schema is provided in `schema.sql` if you'd rather run it against real Postgres.
- **Frontend:** Plain HTML/CSS/JavaScript - no build tools, no npm install needed for the
  frontend, just open it in a browser.
- **Auth:** JWT tokens
- **Rate limiting:** `express-rate-limit`

## Project Structure

```
contest-system/
├── backend/
│   ├── db.js              # Database connection + table creation
│   ├── server.js          # Express app entry point
│   ├── seed.js             # Creates sample users + contests for testing
│   ├── middleware/
│   │   └── auth.js        # JWT verification + role-checking middleware
│   └── routes/
│       ├── auth.js        # signup, login
│       ├── contests.js    # create/list/view contests
│       ├── questions.js   # admin adds questions to a contest
│       ├── participation.js  # join, submit answers, award prize
│       ├── leaderboard.js # per-contest leaderboard
│       └── history.js     # user's contest history
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── schema.sql              # PostgreSQL equivalent schema
└── postman_collection.json # Importable Postman collection
```

## Setup & Run

### 1. Backend

```bash
cd backend
npm install
npm run seed     # creates sample users + 2 sample contests
npm start         # starts API on http://localhost:4000
```

Requires **Node.js 22+** (uses the built-in `node:sqlite` module). If you're on an older
Node version, see the "Using PostgreSQL instead" section below.

Sample accounts created by `npm run seed` (password for all: `password123`):

| Email | Role |
|---|---|
| admin@test.com | admin |
| vip@test.com | vip |
| normal@test.com | normal |
| normal2@test.com | normal |

Two sample contests are also created: "General Knowledge Quiz" (normal access, 3 questions)
and "VIP Movie Trivia" (VIP-only access, 1 question).

### 2. Frontend

The frontend is plain HTML/CSS/JS, so it just needs to be served as static files (it can't
be opened directly as a `file://` URL because of browser CORS rules around `fetch`):

```bash
cd frontend
python3 -m http.server 5500
```

Then open **http://localhost:5500** in your browser. (Any static file server works - e.g.
`npx serve`, VS Code's "Live Server" extension, etc.)

Make sure the backend (`http://localhost:4000`) is running at the same time - the frontend
calls it directly via `fetch`.

### 3. Using the app

- Browse contests as a Guest (view only).
- Sign up (you can pick role `normal`, `vip`, or `admin` in the sign-up form - this is only
  to make testing different roles easy for this assignment; in a real product, roles
  would be assigned by an admin, not self-selected).
- As `admin`, go to the **Admin** tab to create contests and add questions.
- As `normal`/`vip`, go to **Contests**, join one, answer the questions, and submit to see
  your score and the leaderboard.
- Check **My History** to see in-progress contests, completed contests, and prizes won.
- As `admin`, use the "Award Prize" form to award the prize to the contest's top scorer.

## API Documentation

Base URL: `http://localhost:4000/api`

All authenticated routes expect: `Authorization: Bearer <token>`

### Auth

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/auth/signup` | Public | `{ name, email, password, role? }` → returns `{ token, user }` |
| POST | `/auth/login` | Public | `{ email, password }` → returns `{ token, user }` |

### Contests

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/contests` | Public (Guest+) | Lists all contests. Each item includes `can_join` based on the caller's role. |
| GET | `/contests/:id` | Public (Guest+) | Single contest + its questions/options (correct answers never sent to the client). |
| POST | `/contests` | Admin only | Create a contest. Body: `{ name, description, access_level: 'normal'|'vip', prize, start_time, end_time }` |

### Questions

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/questions` | Admin only | Add a question to a contest. Body: `{ contest_id, question_text, question_type: 'single'|'multi'|'truefalse', points, options: [{ option_text, is_correct }] }` |

### Participation

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/contests/:id/join` | Logged-in (normal/vip/admin) | Joins a contest (checks role access + contest hasn't ended). Creates an "in_progress" attempt. |
| POST | `/contests/:id/submit` | Logged-in | Submits answers: `{ answers: [{ question_id, option_ids: [...] }] }`. Calculates and saves score. Can only be done once per contest. |
| POST | `/contests/:id/award-prize` | Admin only | Awards the prize to whichever submitted attempt has the highest score. One-time per contest. |

### Leaderboard

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/leaderboard/:contestId` | Public | Returns all submitted scores for a contest, ranked highest first. |

### History

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/history/me` | Logged-in | Returns `{ inProgress, completed, prizesWon }` for the logged-in user. |

## How scoring works

For each question, the user's submitted option(s) are compared to the question's correct
option(s). A question is marked correct only if the submitted set of options *exactly*
matches the correct set (this naturally covers single-select, multi-select, and true/false
the same way). Correct answers add that question's `points` to the score; incorrect or
unanswered questions add 0 - no penalty.

## Error handling

- Invalid/missing fields → `400`
- Not logged in (guest) trying a logged-in-only action → `401`
- Logged in but wrong role (e.g. normal user hitting an admin-only or VIP-only contest) → `403`
- Resource not found (e.g. bad contest id) → `404`
- Conflicts (e.g. duplicate signup email, re-submitting an already-submitted contest,
  awarding a prize twice) → `409`
- Unexpected errors → `500` (caught by a global error handler, never crashes the server)

## Rate limiting

- All `/api/*` routes: 200 requests per IP per 15 minutes.
- `/api/auth/*` routes (login/signup) have a stricter limit: 20 requests per IP per 15
  minutes, to make brute-force login attempts impractical.

## Database schema

See `schema.sql` for the full PostgreSQL schema (tables: `users`, `contests`, `questions`,
`options`, `attempts`, `answers`, `prizes`). The running app's SQLite version of this same
schema is created automatically in `backend/db.js` the first time the server starts.

## Using PostgreSQL instead of SQLite

This project uses SQLite for zero-setup convenience. To run it on real PostgreSQL instead:

1. Create a Postgres database and run `schema.sql` against it.
2. Install the `pg` package: `npm install pg`.
3. Replace `backend/db.js`'s connection logic with a `pg` `Pool`, and swap the
   `db.prepare(...).get/.all/.run` calls in the route files for equivalent `pool.query(...)`
   calls (the SQL itself barely changes - PostgreSQL placeholders are `$1, $2...` instead
   of `?`).

## Postman Collection

Import `postman_collection.json` into Postman. It includes:
- Sign up / login (admin, VIP, normal) - logging in auto-saves the token into collection
  variables used by the rest of the requests.
- Full contest, question, participation, leaderboard, and history flows.
- Negative/edge-case examples (e.g. normal user trying to create a contest, joining a VIP
  contest as a normal user, guest hitting a protected route, double-submitting) so you can
  see the access-control and error handling in action.

Run requests roughly in the numbered folder order (1 → 7) the first time through.
