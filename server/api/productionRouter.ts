import { Router } from 'express';
import {
  getDashboardStats,
  getRawMaterials,
  getRawMaterial,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial
} from './production';

const router = Router();

// Dashboard routes
router.get('/dashboard-stats', getDashboardStats);

// Raw materials routes
router.get('/raw-materials', getRawMaterials);
router.get('/raw-materials/:id', getRawMaterial);
router.post('/raw-materials', createRawMaterial);
router.patch('/raw-materials/:id', updateRawMaterial);
router.delete('/raw-materials/:id', deleteRawMaterial);

export default router;