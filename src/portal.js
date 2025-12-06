import express from 'express';

const router = express.Router();

// landing pages (unauthorized people)
router.get('/login', async (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    res.render('login.art');
});

router.get('/register', async (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    res.render('register.art');
});

router.get('/', async (req, res) => {
    res.render('index.art');
});

// dashboard pages (authorized people)
router.get('/dashboard', async (req, res) => {
    if (!req.user) return res.error('Log in to view this page');
    res.render('main/dashboard.art', {
        title: 'Dashboard',
        user: req.user
    });
});

router.get('/dashboard/plan', async (req, res) => {
    if (!req.user) return res.error('Log in to view this page');
    res.render('main/seating_plan.art', {
        title: 'Seating Plan',
        user: req.user
    });
});

export default router;