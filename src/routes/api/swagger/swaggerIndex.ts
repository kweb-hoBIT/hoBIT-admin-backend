import express from 'express';
import getswaggerRoutes from './getswagger';

const router = express.Router();

router.use('/swagger.json', getswaggerRoutes);

export default router;