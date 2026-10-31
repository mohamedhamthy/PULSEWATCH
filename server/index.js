const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'pulsewatch-dev-secret';
const dataDir = path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'store.json');

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

const defaultState = {
  users: [],
  monitors: [],
  checks: [],
  incidents: [],
};

const ensureStore = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify(defaultState, null, 2));
  }
};

const readState = () => {
  ensureStore();
  const content = fs.readFileSync(stateFile, 'utf8');
  if (!content.trim()) {
    return structuredClone(defaultState);
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    return structuredClone(defaultState);
  }
};

const writeState = (state) => {
  ensureStore();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
};

const nowIso = () => new Date().toISOString();

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: !!user.emailVerified,
  role: user.role || 'member',
  createdAt: user.createdAt,
});

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || 'member',
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

const getUserByToken = (token) => {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const state = readState();
    return state.users.find((user) => user.id === payload.id) || null;
  } catch (error) {
    return null;
  }
};

const getTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.pulsewatch_token;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }

  return null;
};

const authMiddleware = (req, res, next) => {
  const token = getTokenFromRequest(req);
  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  req.user = user;
  next();
};

const getMonitorById = (state, monitorId) =>
  state.monitors.find((monitor) => monitor.id === monitorId);

const computeStatus = (statusCode, expectedCodes) => {
  if (statusCode === null || statusCode === undefined) return 'DOWN';
  return expectedCodes.includes(Number(statusCode)) ? 'UP' : 'DOWN';
};

const createIncident = (state, monitor, status, isUp) => {
  const existingOpenIncident = state.incidents.find(
    (incident) => incident.monitorId === monitor.id && !incident.resolvedAt,
  );

  if (status === 'UP') {
    if (existingOpenIncident) {
      existingOpenIncident.resolvedAt = nowIso();
      existingOpenIncident.resolved = true;
    }
    return;
  }

  if (existingOpenIncident) {
    return;
  }

  state.incidents.unshift({
    id: crypto.randomUUID(),
    monitorId: monitor.id,
    userId: monitor.userId,
    title: `${monitor.name} is unreachable`,
    severity: 'high',
    status: 'open',
    message: `Monitor ${monitor.name} failed a health check with expected status codes ${monitor.expectedStatusCodes.join(', ')}.`,
    createdAt: nowIso(),
    resolvedAt: null,
    resolved: false,
    currentStatus: status,
    isUp,
  });
};

const persistCheck = (state, monitor, result) => {
  const newCheck = {
    id: crypto.randomUUID(),
    monitorId: monitor.id,
    userId: monitor.userId,
    status: result.status,
    url: monitor.url,
    responseTimeMs: result.responseTimeMs,
    statusCode: result.statusCode,
    error: result.error || null,
    checkedAt: result.checkedAt,
    expectedStatusCodes: monitor.expectedStatusCodes,
  };

  state.checks.unshift(newCheck);
  monitor.lastCheck = result.checkedAt;
  monitor.responseTimeMs = result.responseTimeMs;
  monitor.status = result.status;
  monitor.statusCode = result.statusCode;
  monitor.previousStatus = monitor.status;
  monitor.updatedAt = nowIso();
};

const runMonitorCheck = async (monitorId) => {
  const state = readState();
  const monitor = getMonitorById(state, monitorId);

  if (!monitor || monitor.paused) {
    return { ok: false, message: 'Monitor is unavailable or paused.' };
  }

  const checkedAt = nowIso();
  const startTime = Date.now();

  try {
    const response = await axios.get(monitor.url, {
      validateStatus: () => true,
      timeout: monitor.timeoutMs,
      maxRedirects: 6,
    });

    const rawStatus = response.status;
    const resolvedStatus = computeStatus(rawStatus, monitor.expectedStatusCodes);
    const elapsed = Date.now() - startTime;

    const result = {
      status: resolvedStatus,
      responseTimeMs: elapsed,
      statusCode: rawStatus,
      error: resolvedStatus === 'UP' ? null : `HTTP ${rawStatus}`,
      checkedAt,
    };

    persistCheck(state, monitor, result);
    createIncident(state, monitor, result.status, result.status === 'UP');
    writeState(state);

    return { ok: true, monitor, check: result };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const status = 'DOWN';
    const result = {
      status,
      responseTimeMs: elapsed,
      statusCode: null,
      error: error.message || 'Request failed',
      checkedAt,
    };

    persistCheck(state, monitor, result);
    createIncident(state, monitor, status, false);
    writeState(state);

    return { ok: true, monitor, check: result };
  }
};

const seedDemoData = () => {
  const state = readState();

  if (state.users.length > 0 || state.monitors.length > 0) {
    return state;
  }

  const adminEmail = 'admin@pulsewatch.app';
  const passwordHash = bcrypt.hashSync('PulseWatch123!', 10);
  const adminUser = {
    id: 'user-demo-admin',
    name: 'PulseWatch Admin',
    email: adminEmail,
    passwordHash,
    emailVerified: true,
    role: 'admin',
    createdAt: nowIso(),
    verificationToken: null,
  };

  const monitorA = {
    id: 'monitor-docs',
    userId: adminUser.id,
    name: 'PulseWatch Docs',
    url: 'https://example.com',
    status: 'UP',
    lastCheck: nowIso(),
    responseTimeMs: 220,
    statusCode: 200,
    intervalMs: 300000,
    timeoutMs: 12000,
    expectedStatusCodes: [200, 201, 202, 204, 301, 302],
    tags: ['docs', 'marketing'],
    alertPreferences: ['email'],
    paused: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const monitorB = {
    id: 'monitor-api',
    userId: adminUser.id,
    name: 'PulseWatch API',
    url: 'https://httpbin.org/status/200',
    status: 'UP',
    lastCheck: nowIso(),
    responseTimeMs: 340,
    statusCode: 200,
    intervalMs: 300000,
    timeoutMs: 15000,
    expectedStatusCodes: [200, 204],
    tags: ['api', 'production'],
    alertPreferences: ['email', 'slack'],
    paused: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  state.users = [adminUser];
  state.monitors = [monitorA, monitorB];
  state.checks = [
    {
      id: crypto.randomUUID(),
      monitorId: monitorA.id,
      userId: adminUser.id,
      status: 'UP',
      url: monitorA.url,
      responseTimeMs: 220,
      statusCode: 200,
      error: null,
      checkedAt: nowIso(),
      expectedStatusCodes: monitorA.expectedStatusCodes,
    },
    {
      id: crypto.randomUUID(),
      monitorId: monitorB.id,
      userId: adminUser.id,
      status: 'UP',
      url: monitorB.url,
      responseTimeMs: 340,
      statusCode: 200,
      error: null,
      checkedAt: nowIso(),
      expectedStatusCodes: monitorB.expectedStatusCodes,
    },
  ];
  state.incidents = [];

  writeState(state);
  return state;
};

seedDemoData();

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: nowIso() });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  const trimmedName = (name || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPassword = String(password || '');

  if (!trimmedName || !trimmedEmail || !trimmedPassword) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (trimmedPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  if (!/[A-Z]/.test(trimmedPassword) || !/[0-9]/.test(trimmedPassword)) {
    return res.status(400).json({
      message: 'Password must include one uppercase letter and one number.',
    });
  }

  const state = readState();
  const existingUser = state.users.find((user) => user.email.toLowerCase() === trimmedEmail);

  if (existingUser) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const verificationToken = crypto.randomBytes(20).toString('hex');
  const newUser = {
    id: crypto.randomUUID(),
    name: trimmedName,
    email: trimmedEmail,
    passwordHash: bcrypt.hashSync(trimmedPassword, 10),
    emailVerified: false,
    role: 'member',
    createdAt: nowIso(),
    verificationToken,
  };

  state.users.push(newUser);
  writeState(state);

  const token = signToken(newUser);
  res.cookie('pulsewatch_token', token, cookieOptions);

  return res.status(201).json({
    message: 'Account created. Verify your email to continue.',
    verificationToken,
    user: safeUser(newUser),
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedPassword = String(password || '');

  if (!trimmedEmail || !trimmedPassword) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const state = readState();
  const user = state.users.find((item) => item.email.toLowerCase() === trimmedEmail);

  if (!user || !bcrypt.compareSync(trimmedPassword, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (!user.emailVerified) {
    return res.status(403).json({ message: 'Please verify your email before logging in.' });
  }

  const token = signToken(user);
  res.cookie('pulsewatch_token', token, cookieOptions);

  return res.json({
    message: 'Login successful.',
    user: safeUser(user),
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('pulsewatch_token');
  return res.json({ message: 'Logged out successfully.' });
});

app.get('/api/auth/me', (req, res) => {
  const token = getTokenFromRequest(req);
  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  return res.json({ user: safeUser(user) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  const trimmedEmail = String(email || '').trim().toLowerCase();

  if (!trimmedEmail) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const state = readState();
  const user = state.users.find((item) => item.email.toLowerCase() === trimmedEmail);

  if (!user) {
    return res.json({
      message: 'If an account is registered, a reset link has been generated.',
      resetToken: null,
    });
  }

  const resetToken = crypto.randomBytes(18).toString('hex');
  user.resetToken = resetToken;
  user.resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  writeState(state);

  return res.json({
    message: 'If an account is registered, a reset link has been generated.',
    resetToken,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body || {};
  const trimmedPassword = String(password || '');

  if (!token || !trimmedPassword) {
    return res.status(400).json({ message: 'Reset token and password are required.' });
  }

  if (trimmedPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  const state = readState();
  const user = state.users.find((item) => item.resetToken === token);

  if (!user) {
    return res.status(400).json({ message: 'Reset token is invalid or expired.' });
  }

  if (user.resetExpiresAt && new Date(user.resetExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ message: 'Reset token has expired.' });
  }

  user.passwordHash = bcrypt.hashSync(trimmedPassword, 10);
  user.resetToken = null;
  user.resetExpiresAt = null;
  writeState(state);

  return res.json({ message: 'Password updated successfully.' });
});

app.post('/api/auth/verify-email', (req, res) => {
  const { token } = req.body || {};

  if (!token) {
    return res.status(400).json({ message: 'Verification token is required.' });
  }

  const state = readState();
  const user = state.users.find((item) => item.verificationToken === token);

  if (!user) {
    return res.status(400).json({ message: 'Verification token is invalid.' });
  }

  user.emailVerified = true;
  user.verificationToken = null;
  writeState(state);

  return res.json({ message: 'Email verified successfully.', user: safeUser(user) });
});

app.get('/api/dashboard/overview', authMiddleware, (req, res) => {
  const state = readState();
  const monitors = state.monitors.filter((monitor) => monitor.userId === req.user.id);
  const totalMonitors = monitors.length;
  const healthyMonitors = monitors.filter((monitor) => monitor.status === 'UP').length;
  const downMonitors = monitors.filter((monitor) => monitor.status === 'DOWN').length;
  const openIncidents = state.incidents.filter(
    (incident) => incident.userId === req.user.id && !incident.resolvedAt,
  ).length;

  const totalLatency = monitors
    .map((monitor) => Number(monitor.responseTimeMs || 0))
    .reduce((sum, value) => sum + value, 0);
  const averageResponseTime = totalMonitors ? Math.round(totalLatency / totalMonitors) : 0;
  const availability = totalMonitors ? ((healthyMonitors / totalMonitors) * 100).toFixed(1) : '0.0';

  const monitorIds = monitors.map((monitor) => monitor.id);
  const recentChecks = state.checks
    .filter((check) => monitorIds.includes(check.monitorId))
    .slice(0, 12)
    .map((check) => ({
      id: check.id,
      monitorName: monitors.find((monitor) => monitor.id === check.monitorId)?.name || 'Unknown',
      status: check.status,
      responseTimeMs: check.responseTimeMs,
      checkedAt: check.checkedAt,
      statusCode: check.statusCode,
    }));

  const incidentSummary = state.incidents
    .filter((incident) => incident.userId === req.user.id)
    .slice(0, 4)
    .map((incident) => ({
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.resolvedAt ? 'resolved' : 'open',
      monitor: monitors.find((monitor) => monitor.id === incident.monitorId)?.name || 'Unknown',
      createdAt: incident.createdAt,
    }));

  const availabilityTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const label = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
    const dayChecks = state.checks.filter((check) => {
      if (!monitorIds.includes(check.monitorId)) return false;
      const checkDate = new Date(check.checkedAt);
      return (
        checkDate.getDate() === date.getDate() &&
        checkDate.getMonth() === date.getMonth() &&
        checkDate.getFullYear() === date.getFullYear()
      );
    });

    const uptime = dayChecks.length
      ? ((dayChecks.filter((check) => check.status === 'UP').length / dayChecks.length) * 100).toFixed(0)
      : 100;

    return { date: label, uptime: Number(uptime) };
  });

  const responseTimeTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const label = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
    const dayChecks = state.checks.filter((check) => {
      if (!monitorIds.includes(check.monitorId)) return false;
      const checkDate = new Date(check.checkedAt);
      return (
        checkDate.getDate() === date.getDate() &&
        checkDate.getMonth() === date.getMonth() &&
        checkDate.getFullYear() === date.getFullYear()
      );
    });

    const responseTime = dayChecks.length
      ? Math.round(dayChecks.reduce((sum, check) => sum + (check.responseTimeMs || 0), 0) / dayChecks.length)
      : 0;

    return { date: label, responseTime };
  });

  return res.json({
    totalMonitors,
    healthyMonitors,
    downMonitors,
    openIncidents,
    availability: Number(availability),
    averageResponseTime,
    recentChecks,
    incidentSummary,
    availabilityTrend,
    responseTimeTrend,
    monitors,
  });
});

app.get('/api/monitors', authMiddleware, (req, res) => {
  const state = readState();
  const monitors = state.monitors
    .filter((monitor) => monitor.userId === req.user.id)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return res.json({ monitors });
});

app.post('/api/monitors', authMiddleware, async (req, res) => {
  const { name, url, intervalMs, timeoutMs, expectedStatusCodes, tags, alertPreferences } = req.body || {};

  if (!name || !url) {
    return res.status(400).json({ message: 'Monitor name and URL are required.' });
  }

  const state = readState();
  const newMonitor = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    name: String(name).trim(),
    url: String(url).trim(),
    status: 'PENDING',
    lastCheck: null,
    responseTimeMs: 0,
    statusCode: null,
    intervalMs: Number(intervalMs || 300000),
    timeoutMs: Number(timeoutMs || 10000),
    expectedStatusCodes: Array.isArray(expectedStatusCodes) && expectedStatusCodes.length
      ? expectedStatusCodes.map(Number)
      : [200, 201, 204],
    tags: Array.isArray(tags) ? tags.map(String).slice(0, 10) : [],
    alertPreferences: Array.isArray(alertPreferences) ? alertPreferences.map(String) : ['email'],
    paused: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  state.monitors.push(newMonitor);
  writeState(state);

  await runMonitorCheck(newMonitor.id);

  const refreshed = readState();
  const created = refreshed.monitors.find((monitor) => monitor.id === newMonitor.id);
  return res.status(201).json({ monitor: created });
});

app.get('/api/monitors/:id', authMiddleware, (req, res) => {
  const state = readState();
  const monitor = state.monitors.find(
    (item) => item.id === req.params.id && item.userId === req.user.id,
  );

  if (!monitor) {
    return res.status(404).json({ message: 'Monitor not found.' });
  }

  const checks = state.checks
    .filter((check) => check.monitorId === monitor.id)
    .slice(0, 20)
    .map((check) => ({
      ...check,
      status: check.status,
    }));

  return res.json({ monitor, checks });
});

app.patch('/api/monitors/:id', authMiddleware, (req, res) => {
  const state = readState();
  const monitor = state.monitors.find(
    (item) => item.id === req.params.id && item.userId === req.user.id,
  );

  if (!monitor) {
    return res.status(404).json({ message: 'Monitor not found.' });
  }

  const { name, url, intervalMs, timeoutMs, expectedStatusCodes, tags, alertPreferences } = req.body || {};

  if (name) monitor.name = String(name).trim();
  if (url) monitor.url = String(url).trim();
  if (intervalMs) monitor.intervalMs = Number(intervalMs);
  if (timeoutMs) monitor.timeoutMs = Number(timeoutMs);
  if (expectedStatusCodes) {
    monitor.expectedStatusCodes = Array.isArray(expectedStatusCodes)
      ? expectedStatusCodes.map(Number)
      : [200, 204];
  }
  if (tags) monitor.tags = Array.isArray(tags) ? tags.map(String) : [];
  if (alertPreferences) monitor.alertPreferences = Array.isArray(alertPreferences) ? alertPreferences.map(String) : ['email'];
  monitor.updatedAt = nowIso();

  writeState(state);
  return res.json({ monitor });
});

app.patch('/api/monitors/:id/toggle', authMiddleware, (req, res) => {
  const state = readState();
  const monitor = state.monitors.find(
    (item) => item.id === req.params.id && item.userId === req.user.id,
  );

  if (!monitor) {
    return res.status(404).json({ message: 'Monitor not found.' });
  }

  monitor.paused = !monitor.paused;
  monitor.status = monitor.paused ? 'PAUSED' : 'PENDING';
  monitor.updatedAt = nowIso();
  writeState(state);

  return res.json({ monitor });
});

app.delete('/api/monitors/:id', authMiddleware, (req, res) => {
  const state = readState();
  const index = state.monitors.findIndex(
    (item) => item.id === req.params.id && item.userId === req.user.id,
  );

  if (index === -1) {
    return res.status(404).json({ message: 'Monitor not found.' });
  }

  state.monitors.splice(index, 1);
  state.checks = state.checks.filter((check) => check.monitorId !== req.params.id);
  state.incidents = state.incidents.filter((incident) => incident.monitorId !== req.params.id);
  writeState(state);

  return res.json({ message: 'Monitor deleted successfully.' });
});

app.post('/api/monitors/:id/check', authMiddleware, async (req, res) => {
  const state = readState();
  const monitor = state.monitors.find(
    (item) => item.id === req.params.id && item.userId === req.user.id,
  );

  if (!monitor) {
    return res.status(404).json({ message: 'Monitor not found.' });
  }

  const result = await runMonitorCheck(monitor.id);
  return res.json(result);
});

cron.schedule('*/60 * * * * *', async () => {
  const state = readState();

  for (const monitor of state.monitors) {
    if (!monitor.paused) {
      await runMonitorCheck(monitor.id);
    }
  }
});

app.listen(PORT, () => {
  console.log(`PulseWatch API running on http://localhost:${PORT}`);
});
