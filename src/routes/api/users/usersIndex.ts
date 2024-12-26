import express from 'express';

import signupRoutes from './signup';
import deleteAccount from './deleteAccount';

const router = express.Router();

router.use('/', signupRoutes);
router.use('/', deleteAccount);

export default router;