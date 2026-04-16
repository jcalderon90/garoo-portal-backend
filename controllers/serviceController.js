import axios from 'axios';
import mongoose from 'mongoose';
import History from '../models/History.js';
import Service from '../models/Service.js';
import FacturaSchema from '../models/Factura.js';
import { getDynamicModel } from '../utils/connectionManager.js';

export const proxyService = async (req, res) => {
    const { serviceId } = req.params;
    const user = req.user || null;
    const organization = user?.organization || null;

    if (user && organization && !organization.activeServices.includes(serviceId)) {
        console.log(`[DEBUG] 403 REJECTED: Service ${serviceId} not in [${organization.activeServices}]`);
        return res.status(403).json({ error: `Service '${serviceId}' not active for your organization.` });
    }

    try {
        const REDTEC_BASE = process.env.N8N_BASE_URL || "https://agentsprod.redtec.ai/webhook";
        const targetUrl = `${REDTEC_BASE}/${serviceId}`;

        console.log(`🚀 Proxying ${req.method} for ${serviceId} (Public: ${!user})`);

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            params: req.query,
            headers: { 
                'Content-Type': req.headers['content-type'] || 'application/json',
            }
        });

        History.create({
            serviceId,
            organization: organization?._id || null,
            user: user?._id || null,
            inputData: req.body,
            outputData: response.data,
            status: 'success'
        }).catch(() => {});

        res.json(response.data);
    } catch (error) {
        console.error(`❌ Proxy error for ${serviceId}:`, error.message);
        
        History.create({
            serviceId,
            organization: organization?._id || null,
            user: user?._id || null,
            inputData: req.body,
            outputData: { error: error.message },
            status: 'error'
        }).catch(() => {});

        res.status(error.response?.status || 500).json({ 
            error: `Failed to process ${serviceId}`,
            details: error.message 
        });
    }
};

export const getUserServices = async (req, res) => {
    try {
        const { organization, role, allowedServices } = req.user;
        
        // 1. Obtener TODOS los servicios activos de la DB
        const allServicesInDB = await Service.find({ active: true });
        
        // 2. Determinar la lista de slugs autorizados y normalizar
        const roleNormalized = (role || '').toLowerCase();
        const orgActiveServices = (organization?.activeServices || []).map(s => s.toLowerCase().trim());
        const userAllowedServices = (allowedServices || []).map(s => s.toLowerCase().trim());

        // 3. Filtrar en MEMORIA (Seguro y robusto)
        const effectiveList = (roleNormalized === 'admin') 
            ? orgActiveServices 
            : orgActiveServices.filter(slug => userAllowedServices.includes(slug));

        // 4. Cruzar con la metadata completa
        const serviceDocs = allServicesInDB.filter(s => 
            effectiveList.includes((s.slug || '').toLowerCase().trim())
        );

        // 5. Mapear al formato final
        const services = serviceDocs.map(doc => ({
            ...doc.toObject(),
            client_name: organization?.name || 'Garoo Client'
        }));

        res.json({ services_list: services });
    } catch (error) {
        console.error('Error in getUserServices:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getHistory = async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { organization } = req.user;

        const history = await History.find({ 
            serviceId, 
            organization: organization._id 
        })
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(50);

        res.json(history);
    } catch (error) {
        console.error('Error in getHistory:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getFacturasSat = async (req, res) => {
    try {
        const { organization } = req.user;
        
        console.log('[facturas-sat] Org:', organization?.name, '| ID:', organization?._id);

        // ── Verificar que la organización tiene DB propia configurada ──
        const mongoUri = organization?.databaseConfig?.mongoUri;

        if (!mongoUri) {
            console.warn(`[facturas-sat] ⚠️  Org "${organization?.name}" no tiene databaseConfig.mongoUri configurado.`);
            return res.status(400).json({
                error: 'db_not_configured',
                message: `La organización "${organization?.name || 'desconocida'}" no tiene una base de datos configurada. Contacta al administrador.`
            });
        }

        const query = req.query;
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.pageSize) || 10;
        const skip = (page - 1) * limit;

        const filter = {};

        // Réplica exacta de la lógica de n8n "FILTERS"
        if (query.emisor) {
            filter.emisor_nombre = { "$regex": query.emisor, "$options": "i" };
        }
        if (query.nit) {
            filter.emisor_nit = { "$regex": query.nit, "$options": "i" };
        }
        
        // Filtro de Fechas (Formato ISO String manual como en n8n)
        if (query.from || query.to) {
            filter.fecha_emision = {};
            if (query.from) filter.fecha_emision.$gte = query.from + "T00:00:00.000";
            if (query.to) filter.fecha_emision.$lte = query.to + "T23:59:59.999";
        }

        if (query.serie) filter.serie = { "$regex": query.serie, "$options": "i" };
        if (query.dte) filter.numero_dte = { "$regex": query.dte, "$options": "i" };
        if (query.monto) filter.monto_total = parseFloat(query.monto);

        // Obtener el modelo dinámico vinculado a la conexión de la empresa
        let Factura;
        try {
            Factura = await getDynamicModel(mongoUri, 'Factura', FacturaSchema);
        } catch (connErr) {
            // Separar error de conexión del resto
            const isNetworkError = connErr.message?.includes('ENOTFOUND') ||
                                   connErr.message?.includes('ETIMEDOUT') ||
                                   connErr.message?.includes('connect ECONNREFUSED');

            console.error(`[facturas-sat] ❌ Error de conexión a DB de la org:`, connErr.message);
            return res.status(503).json({
                error: 'db_connection_failed',
                message: isNetworkError
                    ? 'No se pudo conectar a la base de datos de la organización. Verifica la cadena de conexión en la configuración.'
                    : `Error de base de datos: ${connErr.message}`,
            });
        }

        // Ejecución de consultas
        const [facturas, total] = await Promise.all([
            Factura.find(filter).sort({ fecha_emision: -1 }).skip(skip).limit(limit),
            Factura.countDocuments(filter)
        ]);

        console.log(`[facturas-sat] ✅ ${facturas.length} facturas devueltas (total: ${total})`);

        res.json({
            data: facturas,
            meta: {
                total,
                page,
                totalPages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('[facturas-sat] ❌ Error inesperado:', error.message);
        res.status(500).json({
            error: 'unexpected_error',
            message: error.message
        });
    }
};
