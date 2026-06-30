// app.js
// Plain JavaScript - no frameworks, no build step. Just open index.html in a browser
// (with a simple local server, see README) and it talks to the backend API.

const API_BASE = 'http://localhost:4000/api';

let state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
};

// ---------- Helpers ----------

function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  t.style.background = isError ? '#b91c1c' : '#111827';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.display = 'none'), 3500);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => (v.style.display = 'none'));
  document.getElementById(`view-${name}`).style.display = 'block';
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token || '');
  localStorage.setItem('user', JSON.stringify(user || null));
  renderAuthBar();
}

function logout() {
  setSession(null, null);
  document.getElementById('navBar').style.display = 'none';
  showView('auth');
}

function renderAuthBar() {
  const bar = document.getElementById('authBar');
  const nav = document.getElementById('navBar');
  if (state.user) {
    bar.innerHTML = 'Hi, ' + state.user.name + ' <span class="role-pill">' + state.user.role + '</span>' +
      '<button id="logoutBtn" style="margin-left:10px;">Log out</button>';
    document.getElementById('logoutBtn').onclick = logout;
    nav.style.display = 'flex';
    document.getElementById('adminNavBtn').style.display = state.user.role === 'admin' ? 'inline-block' : 'none';
    document.getElementById('loginNavBarBtn').style.display = 'none';
  } else {
    bar.innerHTML = '<span>Browsing as Guest</span> <button id="loginNavBtn" style="margin-left:10px;">Log In / Sign Up</button>';
    document.getElementById('loginNavBtn').onclick = () => showView('auth');
    nav.style.display = 'flex'; // guests can still browse contests/leaderboard
    document.getElementById('adminNavBtn').style.display = 'none';
    document.getElementById('loginNavBarBtn').style.display = 'inline-block';
  }
}

// ---------- Auth ----------

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setSession(data.token, data.user);
    toast('Logged in!');
    loadContests();
    showView('contests');
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const role = document.getElementById('signupRole').value;
  try {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    setSession(data.token, data.user);
    toast('Account created!');
    loadContests();
    showView('contests');
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- Nav ----------

document.querySelectorAll('nav button[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    showView(view);
    if (view === 'contests') loadContests();
    if (view === 'history') loadHistory();
    if (view === 'admin') loadAdmin();
  });
});

document.querySelectorAll('.back-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    showView(btn.dataset.view);
    loadContests();
  });
});

// ---------- Contests list ----------

async function loadContests() {
  const list = document.getElementById('contestsList');
  list.innerHTML = 'Loading...';
  try {
    const contests = await api('/contests');
    if (contests.length === 0) {
      list.innerHTML = '<p>No contests yet.</p>';
      return;
    }
    list.innerHTML = contests
      .map((c) => {
        const vipClass = c.access_level === 'vip' ? 'vip' : '';
        const badgeText = c.access_level.toUpperCase();
        const joinLabel = c.can_join ? 'View / Join' : 'View only (locked)';
        return '<div class="contest-card ' + vipClass + '">' +
          '<span class="badge ' + vipClass + '">' + badgeText + '</span>' +
          '<h3>' + c.name + '</h3>' +
          '<p>' + (c.description || '') + '</p>' +
          '<div class="meta">Ends: ' + new Date(c.end_time).toLocaleString() + (c.prize ? ' · Prize: ' + c.prize : '') + '</div>' +
          '<button class="primary-btn" data-contest-id="' + c.id + '" data-can-join="' + c.can_join + '">' + joinLabel + '</button>' +
          '<button class="primary-btn" style="background:#6b7280; margin-left:6px;" data-leaderboard-id="' + c.id + '">Leaderboard</button>' +
          '</div>';
      })
      .join('');

    list.querySelectorAll('[data-contest-id]').forEach((btn) => {
      btn.addEventListener('click', () => openContest(btn.dataset.contestId, btn.dataset.canJoin === 'true'));
    });
    list.querySelectorAll('[data-leaderboard-id]').forEach((btn) => {
      btn.addEventListener('click', () => openLeaderboard(btn.dataset.leaderboardId));
    });
  } catch (err) {
    list.innerHTML = '<p>Error: ' + err.message + '</p>';
  }
}

// ---------- Single contest / taking the quiz ----------

async function openContest(id, canJoin) {
  showView('contest-detail');
  const box = document.getElementById('contestDetail');
  box.innerHTML = 'Loading...';
  try {
    const c = await api('/contests/' + id);

    if (!state.user) {
      box.innerHTML = '<h2>' + c.name + '</h2><p>' + c.description + '</p>' +
        '<p><strong>Please log in or sign up to participate.</strong></p>';
      return;
    }
    if (!canJoin) {
      box.innerHTML = '<h2>' + c.name + '</h2><p>' + c.description + '</p>' +
        "<p><strong>This is a VIP-only contest. You don't have access.</strong></p>";
      return;
    }

    box.innerHTML =
      '<h2>' + c.name + '</h2>' +
      '<p>' + c.description + '</p>' +
      '<button class="primary-btn" id="joinBtn">Join Contest</button>' +
      '<div id="quizArea"></div>';

    document.getElementById('joinBtn').addEventListener('click', async () => {
      try {
        await api('/contests/' + id + '/join', { method: 'POST' });
        toast('Joined! Answer the questions below and submit.');
        renderQuiz(c);
      } catch (err) {
        toast(err.message, true);
      }
    });
  } catch (err) {
    box.innerHTML = '<p>Error: ' + err.message + '</p>';
  }
}

function renderQuiz(contest) {
  const area = document.getElementById('quizArea');
  const questionsHtml = contest.questions
    .map((q) => {
      const inputType = q.question_type === 'multi' ? 'checkbox' : 'radio';
      const optionsHtml = q.options
        .map((o) => '<label><input type="' + inputType + '" name="q_' + q.id + '" value="' + o.id + '" /> ' + o.option_text + '</label>')
        .join('');
      return '<div class="question-block" data-question-id="' + q.id + '">' +
        '<strong>' + q.question_text + '</strong> <span class="hint">(' + q.points + ' pt' + (q.points > 1 ? 's' : '') + ')</span>' +
        optionsHtml +
        '</div>';
    })
    .join('');

  area.innerHTML = questionsHtml + '<button class="primary-btn" id="submitQuizBtn">Submit Answers</button>';

  document.getElementById('submitQuizBtn').addEventListener('click', async () => {
    const answers = contest.questions.map((q) => {
      const checked = Array.from(
        document.querySelectorAll('input[name="q_' + q.id + '"]:checked')
      ).map((el) => Number(el.value));
      return { question_id: q.id, option_ids: checked };
    });

    try {
      const result = await api('/contests/' + contest.id + '/submit', {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      area.innerHTML = '<h3>You scored: ' + result.score + ' points 🎉</h3>' +
        '<button class="primary-btn" data-leaderboard-id="' + contest.id + '">View Leaderboard</button>';
      area.querySelector('[data-leaderboard-id]').addEventListener('click', (e) =>
        openLeaderboard(e.target.dataset.leaderboardId)
      );
    } catch (err) {
      toast(err.message, true);
    }
  });
}

// ---------- Leaderboard ----------

async function openLeaderboard(contestId) {
  showView('leaderboard');
  const box = document.getElementById('leaderboardContent');
  box.innerHTML = 'Loading...';
  try {
    const data = await api('/leaderboard/' + contestId);
    if (data.leaderboard.length === 0) {
      box.innerHTML = '<h2>' + data.contest + ' - Leaderboard</h2><p>No submissions yet.</p>';
      return;
    }
    const rows = data.leaderboard
      .map((r) => '<tr><td>#' + r.rank + '</td><td>' + r.name + '</td><td>' + r.score + '</td></tr>')
      .join('');
    box.innerHTML = '<h2>' + data.contest + ' - Leaderboard</h2>' +
      '<table><tr><th>Rank</th><th>Name</th><th>Score</th></tr>' + rows + '</table>';
  } catch (err) {
    box.innerHTML = '<p>Error: ' + err.message + '</p>';
  }
}

// ---------- History ----------

async function loadHistory() {
  const box = document.getElementById('historyContent');
  box.innerHTML = 'Loading...';
  try {
    const data = await api('/history/me');

    const inProgressHtml = data.inProgress.length
      ? data.inProgress.map((c) => '<p>' + c.name + ' — joined ' + new Date(c.started_at).toLocaleString() + '</p>').join('')
      : '<p class="hint">None right now.</p>';

    const completedHtml = data.completed.length
      ? '<table><tr><th>Contest</th><th>Score</th><th>Submitted</th></tr>' +
        data.completed.map((c) => '<tr><td>' + c.name + '</td><td>' + c.score + '</td><td>' + new Date(c.submitted_at).toLocaleString() + '</td></tr>').join('') +
        '</table>'
      : '<p class="hint">None yet.</p>';

    const prizesHtml = data.prizesWon.length
      ? data.prizesWon.map((p) => '<p>' + p.name + ': <strong>' + p.prize + '</strong></p>').join('')
      : '<p class="hint">No prizes yet — keep playing!</p>';

    box.innerHTML =
      '<div class="card"><h3>In-Progress Contests</h3>' + inProgressHtml + '</div>' +
      '<div class="card"><h3>Completed Contests</h3>' + completedHtml + '</div>' +
      '<div class="card"><h3>Prizes Won 🏆</h3>' + prizesHtml + '</div>';
  } catch (err) {
    box.innerHTML = '<p>Error: ' + err.message + '</p>';
  }
}

// ---------- Admin ----------

async function loadAdmin() {
  try {
    const contests = await api('/contests');
    const opts = contests.map((c) => '<option value="' + c.id + '">' + c.name + '</option>').join('');
    document.getElementById('qContestId').innerHTML = opts;
    document.getElementById('awardContestId').innerHTML = opts;
  } catch (err) {
    toast(err.message, true);
  }
  renderOptionBuilder();
}

document.getElementById('createContestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/contests', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('cName').value,
        description: document.getElementById('cDescription').value,
        access_level: document.getElementById('cAccessLevel').value,
        prize: document.getElementById('cPrize').value,
        start_time: new Date(document.getElementById('cStart').value).toISOString(),
        end_time: new Date(document.getElementById('cEnd').value).toISOString(),
      }),
    });
    toast('Contest created!');
    e.target.reset();
    loadAdmin();
  } catch (err) {
    toast(err.message, true);
  }
});

let optionCount = 0;
function renderOptionBuilder() {
  optionCount = 0;
  const builder = document.getElementById('optionsBuilder');
  builder.innerHTML = '';
  addOptionRow();
  addOptionRow();
}
function addOptionRow() {
  optionCount++;
  const builder = document.getElementById('optionsBuilder');
  const row = document.createElement('div');
  row.className = 'option-row';
  row.innerHTML =
    '<input type="text" placeholder="Option text" class="opt-text" />' +
    '<label><input type="checkbox" class="opt-correct" /> Correct</label>';
  builder.appendChild(row);
}
document.getElementById('addOptionBtn').addEventListener('click', addOptionRow);

document.getElementById('qType').addEventListener('change', (e) => {
  if (e.target.value === 'truefalse') {
    const builder = document.getElementById('optionsBuilder');
    builder.innerHTML =
      '<div class="option-row"><input type="text" class="opt-text" value="True" readonly /><label><input type="checkbox" class="opt-correct" /> Correct</label></div>' +
      '<div class="option-row"><input type="text" class="opt-text" value="False" readonly /><label><input type="checkbox" class="opt-correct" /> Correct</label></div>';
  } else {
    renderOptionBuilder();
  }
});

document.getElementById('addQuestionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const options = Array.from(document.querySelectorAll('#optionsBuilder .option-row')).map((row) => ({
    option_text: row.querySelector('.opt-text').value,
    is_correct: row.querySelector('.opt-correct').checked,
  }));

  try {
    await api('/questions', {
      method: 'POST',
      body: JSON.stringify({
        contest_id: Number(document.getElementById('qContestId').value),
        question_text: document.getElementById('qText').value,
        question_type: document.getElementById('qType').value,
        points: Number(document.getElementById('qPoints').value) || 1,
        options,
      }),
    });
    toast('Question added!');
    e.target.reset();
    renderOptionBuilder();
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('awardPrizeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contestId = document.getElementById('awardContestId').value;
  try {
    const result = await api('/contests/' + contestId + '/award-prize', { method: 'POST' });
    document.getElementById('awardResult').innerHTML =
      '<p>Prize awarded to user #' + result.winnerUserId + ' (score: ' + result.score + ')</p>';
    toast('Prize awarded!');
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- Init ----------

renderAuthBar();
showView('contests');
loadContests();
