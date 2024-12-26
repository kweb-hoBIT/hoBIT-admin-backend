import express from 'express';

import authRoutes from './auth';
import loginRoutes from './login';
import tokenRefreshRoutes from './tokenRefresh';

const router = express.Router();

router.use('/', authRoutes);
router.use('/', loginRoutes);
router.use('/', tokenRefreshRoutes);

export default router;