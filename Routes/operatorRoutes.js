const express = require('express');
const router = express.Router();
const operatorController = require('../controllers/operatorController');
const passport = require('passport');
const requireSuperUser = require('../middleware/requireSuperUser');

router.use(passport.authenticate('jwt', { session: false }));

// Get payment options (available to all authenticated users)
router.get('/payment', operatorController.getPaymentOptions);

// Operator management routes (SuperUser only)
router.use(requireSuperUser);

// Create a new operator
router.post('/create', operatorController.createOperator);

// Get all operators
router.get('/', operatorController.getAllOperators);

// Update an operator
router.put('/:id', operatorController.updateOperator);

// Delete an operator
router.delete('/:id', operatorController.deleteOperator);

// Search operators
router.post('/search', operatorController.searchOperators);

module.exports = router;
