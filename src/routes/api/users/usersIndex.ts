import express from 'express';

import signupRoutes from './signup';
import deleteAccount from './deleteAccount';

const router = express.Router();

router.use('/users', signupRoutes);
router.use('/users', deleteAccount);

export default router;