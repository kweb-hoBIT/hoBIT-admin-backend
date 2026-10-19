import express from 'express';

import signupRoutes from './signup';
import deleteAccountRoutes from './deleteAccount';
import findUserRoutes from './findUser';
import updatePasswordRoutes from './updatePassword';
import checkUsernameRoutes from './checkUsername';
import meRoutes from './me';

const router = express.Router();

router.use('/users', checkUsernameRoutes);
router.use('/users', meRoutes);
router.use('/users', signupRoutes);
router.use('/users', deleteAccountRoutes);
router.use('/users', findUserRoutes);
router.use('/users', updatePasswordRoutes);

export default router;