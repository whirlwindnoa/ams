import express from 'express';
import db from './db.js';

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

// dashboard pages (authorized people)
router.get('/dashboard', signedInOnly('main/dashboard.art', 'Dashboard'));
router.get('/dashboard/plan', signedInOnly('main/seating_plan.art', 'Seating Plan'));

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

    console.log(events);

    res.render('main/events.art', {
        title: 'Events',
        user: req.user,
        events
    });
});

export default router;