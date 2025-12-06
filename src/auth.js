import express from 'express';

import db from './db.js';
import utils from './utils.js';
import { cookieCache } from './stores.js';

const router = express.Router();

router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
    if (!req.body || !req.body.username || !req.body.password) {
        return res.error('Missing username or password', 403);
    }
    let { username, password } = req.body;
    username = username.toLowerCase().trim();
    
    let user = await db.get('SELECT id, username, password, email FROM users WHERE username = ?', [username]);

    if (!user) {
        return res.error('Invalid username or password.', 403);
    }

    if (user.password != password) {
        return res.error('Invalid username or password.', 403);
    }

    let sessions = await db.all('SELECT * FROM sessions WHERE user_id = ?', [user.id]);
    if(sessions.length > 10) {
        await db.run('DELETE FROM sessions WHERE user_id = ?', [user.id]);
    }

    let token = (await utils.randomBytesAsync(32)).toString('hex'); // generate token for user
    while (await db.get('SELECT * FROM sessions WHERE token = ?', [token])) {
        token = (await utils.randomBytesAsync(32)).toString('hex');
    } // check if token is unique. if not, make a new one

    await db.run('INSERT INTO sessions (token, user_id, expires, ip, date) VALUES (?, ?, ?, ?, ?)', [token, user.id, Date.now() + 2.628e+9, req.IP, Date.now()]);
    res.cookie('token', token, { maxAge: 2.628e+9, httpOnly: true, secure: process.env.NODE_ENV === "production", domain: `.${process.env.DOMAIN}`, sameSite: 'lax' });

    console.log('successful login');
    res.redirect('/dashboard');
});

router.post('/register', express.urlencoded({ extended: false }), async (req, res) => {
    if (!req.body) {
        return res.error('Invalid form submission.', 400);
      }

    let { username, email, password } = req.body;

    if (!username || !email || !password) {
    return res.error('All fields are required.', 400);
    }

    username = username.toLowerCase().trim();
    email = email.toLowerCase().trim();

    if (username.length < 3 || username.length > 32) {
    return res.error('Username must be between 3 and 32 characters.', 400);
    }

    const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);

    if (existing) {
        return res.error('An account with that username or email already exists.', 400);
    }

    await db.run('INSERT INTO users (username, password, email, is_admin) VALUES (?, ?, ?, 0)', [username, password, email]);
    const user = await db.get('SELECT id, username, password, email FROM users WHERE username = ?',[username]);

    if (!user) {
    return res.error('Error creating account. Please try again.', 500);
    }

    let sessions = await db.all('SELECT * FROM sessions WHERE user_id = ?', [user.id]);

    if (sessions.length > 10) {
        await db.run('DELETE FROM sessions WHERE user_id = ?', [user.id]);
    }

    let token = (await utils.randomBytesAsync(32)).toString('hex');
    while (await db.get('SELECT * FROM sessions WHERE token = ?', [token])) {
        token = (await utils.randomBytesAsync(32)).toString('hex');
    }

    const expires = Date.now() + 2.628e9;

    await db.run('INSERT INTO sessions (token, user_id, expires, ip, date) VALUES (?, ?, ?, ?, ?)', [token, user.id, expires, req.IP, Date.now()]);

    res.cookie('token', token, { maxAge: 2.628e9, httpOnly: true, secure: process.env.NODE_ENV === 'production', domain: `.${process.env.DOMAIN}`, sameSite: 'lax'});

    console.log('successful register + login');
    res.redirect('/dashboard');
});

router.get('/logout', async (req, res) => {
    res.clearCookie('token', { maxAge: 2.628e+9, httpOnly: true, secure: process.env.NODE_ENV === "production", domain: `.${process.env.DOMAIN}`, sameSite: 'lax' });
    res.status(200).redirect('/');
    await db.run('DELETE FROM sessions WHERE token = ?', [req.cookies.token]);
    delete cookieCache[req.cookies.token];
});

export default router;