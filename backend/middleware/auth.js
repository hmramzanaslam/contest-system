// middleware/auth.js
// This is the "gatekeeper" of the app. It checks WHO is making a request
// (by reading a JWT token) and WHAT they're allowed to do (by checking role).

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';

// Step 1: Figure out who is calling (Guest if no token, otherwise decode the token)
function identify(req, res, next) {
  const header = req.headers.authorization; // expects "Bearer <token>"
  if (!header) {
    req.user = { role: 'guest' }; // no token = guest
    return next();
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, role }
  } catch (err) {
    req.user = { role: 'guest' }; // bad/expired token = treat as guest
  }
  next();
}

// Step 2: Block guests entirely (must be logged in - any role)
function requireLogin(req, res, next) {
  if (!req.user || req.user.role === 'guest') {
    return res.status(401).json({ error: 'Please sign up / log in to do this.' });
  }
  next();
}

// Step 3: Only allow specific roles (e.g. ['admin'] or ['admin','vip'])
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    next();
  };
}

module.exports = { identify, requireLogin, requireRole, JWT_SECRET };
