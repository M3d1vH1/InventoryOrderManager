import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { ordersRouter } from "./routers/orders.js";
import { productsRouter } from "./routers/products.js";
import { inventoryRouter } from "./routers/inventory.js";
import { customersRouter } from "./routers/customers.js";
import { pickingRouter } from "./routers/picking.js";
import { shippingRouter } from "./routers/shipping.js";
import { settingsRouter } from "./routers/settings.js";
import { barcodeRouter } from "./routers/barcode.js";
import { dashboardRouter } from "./routers/dashboard.js";
import { suppliersRouter } from "./routers/suppliers.js";

export const appRouter = router({
  auth: authRouter,
  orders: ordersRouter,
  products: productsRouter,
  inventory: inventoryRouter,
  customers: customersRouter,
  picking: pickingRouter,
  shipping: shippingRouter,
  settings: settingsRouter,
  barcode: barcodeRouter,
  dashboard: dashboardRouter,
  suppliers: suppliersRouter,
});

export type AppRouter = typeof appRouter;
