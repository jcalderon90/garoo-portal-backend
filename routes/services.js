import express from 'express';
import * as serviceController from '../controllers/serviceController.js';
import * as spectrumController from '../controllers/spectrumController.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import * as serviceSchemas from './schemas/service.schema.js';

const router = express.Router();

// 2. Logging para depuración
router.use('/execute/:serviceId', (req, res, next) => {
    console.log(`[DEBUG] Request captured for: ${req.params.serviceId}`);
    next();
});

// 3. RUTAS ESPECÍFICAS (Capturadas antes que las genéricas)
router.get('/execute/facturas-sat', auth, validate(serviceSchemas.facturasSatQuerySchema), serviceController.getFacturasSat);
router.get('/integrated/facturas-sat', auth, validate(serviceSchemas.facturasSatQuerySchema), serviceController.getFacturasSat);

// Spectrum — directo a MongoDB (sin pasar por n8n)
router.get('/execute/spectrum-dashboard', auth, spectrumController.getDashboard);
router.get('/execute/spectrum-leads',     auth, spectrumController.getLeads);
router.post('/execute/lead-chat',         auth, spectrumController.getLeadChat);

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
