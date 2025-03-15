import express from 'express';

import loginRoutes from './login';
import logoutRoutes from './logout';
import tokenRefreshRoutes from './tokenRefresh';

const router = express.Router();

router.use('/auth', loginRoutes);
router.use('/auth', logoutRoutes);
router.use('/auth', tokenRefreshRoutes);

export default router;