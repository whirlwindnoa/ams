import express from 'express';
import db from './db.js';

import { error } from './utils.js';

const router = express.Router();

function signedOutOnly(page) {
    return async (req, res) => {
        if (req.user) return res.redirect('/dashboard');
        res.render(page);
    }
}

function signedInOnly(page, title) {
    return async (req, res) => {
        if (!req.user) return res.redirect('/');
        res.render(page, {
            title,
            user: req.user
        });
    }
}

router.get('/dashboard/venues', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.elevation < 1) return error('You do not have permission to view this page.', req, res, 403);

  const venues = await db.all(`
    SELECT id, name, location, capacity, image
    FROM venues
    ORDER BY name ASC
  `);

  return res.render('main/venues.art', {
    title: 'Venues',
    user: req.user,
    venues
  });
});


// landing pages (unauthorized people)
router.get('/login', signedOutOnly('login.art'));
router.get('/register', signedOutOnly('register.art'));
router.get('/', signedOutOnly('index.art'));

router.get('/dashboard', async (req, res) => {
    if (!req.user) return res.redirect('/');

    const now = Date.now();

    const events = await db.all(`
        SELECT *
        FROM events
        WHERE date IS NOT NULL
          AND date >= ?
          AND status IS NOT 'cancelled'
        ORDER BY date ASC
        LIMIT 5
    `, [now]);

    const venues = await db.all(`
        SELECT id, name, location, capacity, image
        FROM venues
        ORDER BY id DESC
        LIMIT 5
    `); 

    events.forEach(ev => {
        const d = new Date(ev.date);

        ev.dateStr =
            d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');

        ev.timeStr =
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    });

    res.render('main/dashboard.art', {
        title: 'Dashboard',
        events,
        venues,
        user: req.user
    });
});
router.get('/dashboard/events', async (req, res) => {
    if (!req.user) return res.redirect('/');

    const events = await db.all(`
        SELECT
            events.*,
            users.email AS added_by_email,
            venues.name AS venue_name
        FROM events
        JOIN users ON users.id = events.added_by
        LEFT JOIN venues ON venues.id = events.venue
        ORDER BY events.date IS NULL, events.date ASC
    `);

    const venues = await db.all(`
        SELECT id, name
        FROM venues
        ORDER BY name ASC
    `);

    events.forEach(ev => {
        if (!ev.date) return;

        const d = new Date(ev.date);

        ev.dateStr =
            d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');

        ev.timeStr =
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    });

    res.render('main/events.art', {
        title: 'Events',
        user: req.user,
        events,
        venues
    });
});

router.get('/dashboard/users', async (req, res) => {
    if (!req.user) return res.redirect('/'); 
    if (req.user.elevation < 2) return error('You do not have permission to view this page.', req, res, 403);

    const users = await db.all(`
        SELECT id, email, elevation, created_at
        FROM users
        ORDER BY id ASC
    `);

    users.forEach(u => {
        if (!u.created_at) return;

        const d = new Date(u.created_at);

        u.dateStr =
            d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');

        u.timeStr =
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    });

    res.render('main/users.art', {
        title: 'Users',
        user: req.user,
        users
    });
});

router.get('/dashboard/log', async (req, res) => {
    if (!req.user) return res.redirect('/');
    if (req.user.elevation < 1) return error('You do not have permission to view this page.', req, res, 403);

    const pageSize = 15;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    const totalRow = await db.get('SELECT COUNT(*) AS cnt FROM audit_log');
    const total = totalRow?.cnt || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const safePage = Math.min(page, totalPages);
    const safeOffset = (safePage - 1) * pageSize;

    const logs = await db.all(`
        SELECT
            audit_log.id,
            audit_log.action,
            audit_log.timestamp,
            users.email AS user_email
        FROM audit_log
        LEFT JOIN users ON users.id = audit_log.user_id
        ORDER BY audit_log.timestamp DESC
        LIMIT ? OFFSET ?
    `, [pageSize, safeOffset]);

    logs.forEach(log => {
    const d = new Date(log.timestamp);
    log.dateStr =
        d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');

    log.timeStr =
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
    });

    res.render('main/audit_log.art', {
        title: 'Audit Log',
        user: req.user,
        logs,
        page: safePage,
        totalPages,
        total,
        pageSize
    });
});

router.get('/dashboard/venues', async (req, res) => {
    if (!req.user) return res.redirect('/login');

    const venues = await db.all(`
        SELECT id, name, location, capacity, image
        FROM venues
        ORDER BY name ASC
    `);

    res.render('main/venues.art', {
        title: 'Venues',
        user: req.user,
        venues
    });
});

router.get('/unapproved', async (req, res) => {
    if (!req.user) return res.redirect('/');
    if (req.user.elevation > 0) return res.redirect('/dashboard');

    res.render('unapproved.art');
});

export default router;