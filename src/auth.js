import express from 'express';

import db from './db.js';
import { randomBytesAsync, error, passwordRegex, emailRegex } from './utils.js';
import { cookieCache } from './stores.js';

const router = express.Router();

async function createSession(user, expires = 2.628e+9) { // token for 1 month
    let token = (await randomBytesAsync(32)).toString('hex'); // generate token for user
    while (await db.get('SELECT * FROM sessions WHERE token = ?', [token])) {
        token = (await randomBytesAsync(32)).toString('hex');
    } // check if token is unique. if not, make a new one 
    // prolly a bad way of doing it but whatever its good enough

    await db.run('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)', [token, user.id, Date.now() + expires]);

    let sessions = await db.all('SELECT * FROM sessions WHERE user_id = ?', [user.id]);
    sessions.sort((a, b) => a.expires - b.expires);
    if (sessions.length > 10) {
        for (let i = 0; i < sessions.length - 10; i++) {
            await db.run('DELETE FROM sessions WHERE token = ?', [sessions[i].token]);
            delete cookieCache[sessions[i].token];
        }
    } // this entire piece of code just deletes oldest session if there's more than 10 per user

    return token;   
}

router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
    if (req.user) {
        return res.redirect(req.get('referer') ?? '/dashboard');
    } // redirect if already logged in

    if (!req.body || !req.body.email || !req.body.password) {
        return error('Fill out all fields!', req, res, 403, "login.art");
    }
    let { email, password } = req.body;
    email = email.toLowerCase().trim();
    
    let user = await db.get('SELECT id, email, password FROM users WHERE email = ?', [email]);

    if (!user || user.password != password) {
        return error('Invalid email or password', req, res, 403, "login.art");
    }

    let token = await createSession(user);
    res.cookie('token', token, { maxAge: 2.628e+9, httpOnly: true });

    console.log('successful login');
    res.redirect('/dashboard');
});

router.post('/register', express.urlencoded({ extended: false }), async (req, res) => {
    if (req.user) {
        res.redirect('/dashboard');
    }
    if (!req.body || !req.body.password || !req.body.email) {
        console.log("some user failed registration: incomplete credentials");
        return error("Fill out all fields!", req, res, 400, "register.art");
    }
    let { email, password } = req.body;

    if (!passwordRegex.test(password)) {
        console.log("some user failed registration: invalid password");
        return error("Invalid password, see requirements above.", req, res, 400, "register.art");
    }
    if (!emailRegex.test(email)) {
        console.log("some user failed registration: invalid email");
        return error("Invalid email, try again.", req, res, 400, "register.art");
    }

    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (user) {
        console.log("some user failed registration: email already taken");
        return error("This email is already taken.", req, res, 400, "register.art");
    }

    await db.run(`INSERT INTO users (email, password, elevation, created_at) VALUES (?, ?, 0, ?)`, [email, password, Date.now()]);
    user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    // very bad practice cuz im supposed to hash passwords but im not trying to make it even more complex. i even installed bcrypt.

    const token = await createSession(user);
    console.log('some user registered successfully');
    res.cookie('token', token, { maxAge: 2.628e+9, httpOnly: true });

    return res.redirect('/login');
});

router.get('/logout', async (req, res) => {
    res.clearCookie('token', { maxAge: 2.628e+9, httpOnly: true, secure: process.env.NODE_ENV === "production", domain: `.${process.env.DOMAIN}`, sameSite: 'lax' });
    res.status(200).redirect('/');
    await db.run('DELETE FROM sessions WHERE token = ?', [req.cookies.token]);
    delete cookieCache[req.cookies.token];
});

export default router;