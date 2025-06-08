import { Router } from 'express';
import productsRouter from './products';
import ordersRouter from './orders';
import usersRouter from './users';
import categoriesRouter from './categories';
import tagsRouter from './tags';
import settingsRouter from './settings';
import rolePermissionsRouter from './rolePermissions';
import inventoryRouter from './inventory';

const router = Router();

// Mount all route modules
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/users', usersRouter);
router.use('/categories', categoriesRouter);
router.use('/tags', tagsRouter);
router.use('/settings', settingsRouter);
router.use('/role-permissions', rolePermissionsRouter);
router.use('/inventory', inventoryRouter);

export default router; 