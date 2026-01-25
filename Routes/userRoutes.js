const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const { validate } = require('../middleware/validation');
const {
  createUserSchema,
  updateUserSchema,
  searchUserSchema,
  userIdParamSchema
} = require('../validations/userValidation');

router.use(passport.authenticate('jwt', { session: false }));

// CRUD routes
router.get('/', userController.getUsers);
// Specific routes must come before parameterized routes
router.get('/getUserNames', userController.getUserNames);
router.get('/:id', validate(userIdParamSchema, 'params'), userController.getUserById);
router.post('/search', validate(searchUserSchema), userController.searchUsers);
router.post('/', validate(createUserSchema), userController.createUser);
router.put('/:id', validate(userIdParamSchema, 'params'), validate(updateUserSchema), userController.updateUser);
router.delete('/:id', validate(userIdParamSchema, 'params'), userController.deleteUser);

module.exports = router;    