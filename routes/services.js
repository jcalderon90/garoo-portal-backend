import express from 'express';
import * as serviceController from '../controllers/serviceController.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import * as serviceSchemas from '../schemas/serviceSchemas.js';

const router = express.Router();

// 2. Logging para depuración
router.use('/execute/:serviceId', (req, res, next) => {
    console.log(`[DEBUG] Request captured for: ${req.params.serviceId}`);
    next();
});

// 3. RUTAS ESPECÍFICAS (Capturadas antes que las genéricas)
router.get('/execute/facturas-sat', auth, validate(serviceSchemas.facturasSatQuerySchema), serviceController.getFacturasSat);
router.get('/integrated/facturas-sat', auth, validate(serviceSchemas.facturasSatQuerySchema), serviceController.getFacturasSat);

// 4. RUTAS GENÉRICAS
router.post('/execute/:serviceId', auth, validate(serviceSchemas.proxyServiceSchema), serviceController.proxyService);
router.get('/execute/:serviceId', auth, validate(serviceSchemas.proxyServiceSchema), serviceController.proxyService);

// Public execution for forms
router.post('/execute-public/:serviceId', serviceController.proxyService);

// Get authorized services for the current user's organization
router.get('/my-services', auth, serviceController.getUserServices);

// Get history
router.get('/history/:serviceId', auth, validate(serviceSchemas.getHistorySchema), serviceController.getHistory);

// Get users of an organization (for filters)
router.get('/org-users/:orgSlug', auth, serviceController.getOrgUsers);

export default router;
