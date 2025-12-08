import express from 'express';

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
router.get('/dashboard/plan', signedInOnly('main/plan.art', 'Seating Plan'));

export default router;