import express from 'express';

import authRoutes from './auth';
import loginRoutes from './login';
import tokenRefreshRoutes from './tokenRefresh';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/auth', loginRoutes);
router.use('/auth', tokenRefreshRoutes);

export default router;