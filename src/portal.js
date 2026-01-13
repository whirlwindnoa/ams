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
        user: req.user
    });
});
router.get('/dashboard/events', async (req, res) => {
    if (!req.user) return res.redirect('/');

    const events = await db.all(`
        SELECT
            events.*,
            users.email AS added_by_email
        FROM events
        JOIN users ON users.id = events.added_by
        ORDER BY events.date IS NULL, events.date ASC
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
        events
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

    const logs = await db.all(`
        SELECT 
            audit_log.id,
            audit_log.action,
            audit_log.timestamp,
            users.email AS user_email
        FROM audit_log
        LEFT JOIN users ON users.id = audit_log.user_id
        ORDER BY audit_log.timestamp DESC
    `);

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
        logs
    });
});

router.get('/unapproved', async (req, res) => {
    if (!req.user) return res.redirect('/');
    if (req.user.elevation > 0) return res.redirect('/dashboard');

    res.render('unapproved.art');
});

export default router;