// backend/server.js
const express       = require('express');
const session       = require('express-session');
const cors          = require('cors');
const path          = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes    = require('./routes/auth');
const gameRoutes    = require('./routes/game');
const queryRoutes   = require('./routes/query');
const wardenRoutes  = require('./routes/warden');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());  // parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // parse form data

// Some classroom setups open the frontend from file://, which sends Origin: null.
app.use((req, res, next) => {
    if (req.headers.origin === 'null') {
        res.setHeader('Access-Control-Allow-Origin', 'null');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    }
    next();
});

app.use(cors({
    origin: true,
    credentials: true  // allow cookies (needed for sessions)
}));

// Sessions: remembers who is logged in between requests
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_change_this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,   // set to true in production with HTTPS
        httpOnly: true,  // prevent JavaScript from reading the cookie
        maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/game',  gameRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/warden', wardenRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Catch-all: serve frontend for any unmatched route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`EscapeQL backend running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});
