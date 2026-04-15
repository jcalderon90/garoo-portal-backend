import express from 'express';
import * as serviceController from '../controllers/serviceController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// 1. RUTA ESPECÍFICA (MÁXIMA PRIORIDAD)
// Esta ruta sustituye a n8n y debe ir ANTES que cualquier ruta con ':serviceId'
router.get('/execute/facturas-sat', auth, serviceController.getFacturasSat);

// 2. Logging para depuración
router.use('/execute/:serviceId', (req, res, next) => {
    console.log(`[DEBUG] Request captured for: ${req.params.serviceId}`);
    next();
});

// 3. RUTAS GENÉRICAS
router.post('/execute/:serviceId', auth, serviceController.proxyService);
router.get('/execute/:serviceId', auth, serviceController.proxyService);

// Public execution for forms
router.post('/execute-public/:serviceId', serviceController.proxyService);

// Get authorized services for the current user's organization
router.get('/my-services', auth, serviceController.getUserServices);

// Get execution history for a service
router.get('/history/:serviceId', auth, serviceController.getHistory);

export default router;
