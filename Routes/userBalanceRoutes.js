const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');

router.use(passport.authenticate('jwt', { session: false }));

router.get('/', userController.getUserBalances);

module.exports = router;
