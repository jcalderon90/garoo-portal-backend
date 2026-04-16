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

        const headers = { 
            'Content-Type': req.headers['content-type'] || 'application/json',
        };

        // Inyectar datos del usuario para que n8n los conozca
        if (user) {
            headers['x-portal-user-id'] = user._id.toString();
            headers['x-portal-user-name'] = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            headers['x-portal-user-email'] = user.email;
        }

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            params: req.query,
            headers
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
        const { organization, role } = req.user;
        const isAdmin = (role || '').toLowerCase() === 'admin';
        
        console.log(`[facturas-sat] User org: ${organization?.name} | Role: ${role} | Admin: ${isAdmin}`);

        let targetMongoUri = organization?.databaseConfig?.mongoUri;

        // Si es admin y pasa un orgSlug específico, buscar esa org en la DB
        if (isAdmin && req.query.orgSlug) {
            const Organization = mongoose.model('Organization');
            const targetOrg = await Organization.findOne({ slug: req.query.orgSlug }).lean();

            if (!targetOrg) {
                return res.status(404).json({
                    error: 'org_not_found',
                    message: `No se encontró la organización con slug: "${req.query.orgSlug}"`
                });
            }

            targetMongoUri = targetOrg.databaseConfig?.mongoUri;
            console.log(`[facturas-sat] Admin targeting org: ${targetOrg.name} (${req.query.orgSlug})`);
        }

        if (!targetMongoUri) {
            const orgName = req.query.orgSlug || organization?.name || 'desconocida';
            console.warn(`[facturas-sat] ⚠️  Org "${orgName}" no tiene databaseConfig.mongoUri configurado.`);
            return res.status(400).json({
                error: 'db_not_configured',
                message: `La organización "${orgName}" no tiene una base de datos configurada. Contacta al administrador.`
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

        // 1. Obtener el modelo dinámico vinculado a la conexión de la empresa
        let Factura;
        try {
            Factura = await getDynamicModel(targetMongoUri, 'Factura', FacturaSchema);
        } catch (connErr) {
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

        // 2. Ejecución de consultas de facturas
        const [facturasRaw, total] = await Promise.all([
            Factura.find(filter).sort({ fecha_emision: -1 }).skip(skip).limit(limit).lean(),
            Factura.countDocuments(filter)
        ]);

        // 3. Opcional - Cruce con el Historial del Portal para saber quién envió qué
        // Buscamos los registros en History (Cluster Principal) para esta organización
        // Nota: Solo buscamos los últimos logs para optimizar
        let facturas = facturasRaw;
        try {
            const orgId = isAdmin && req.query.orgSlug ? 
                (await mongoose.model('Organization').findOne({ slug: req.query.orgSlug }))?._id : 
                organization?._id;

            if (orgId) {
                const recentHistory = await History.find({
                    organization: orgId,
                    serviceId: 'facturas', // El ID del formulario de envío
                    status: 'success'
                })
                .populate('user', 'firstName lastName')
                .sort({ createdAt: -1 })
                .limit(200) // Suficiente para cubrir la página actual y más
                .lean();

                // Cruzar datos: Emparejar por NIT y Serie (que vienen en inputData del form)
                facturas = facturasRaw.map(inv => {
                    // Si ya tiene portal_user (por script o n8n), lo usamos directamente
                    if (inv.portal_user) return inv;

                    const submission = recentHistory.find(h => {
                        const input = h.inputData || {};
                        // Normalizamos para comparar
                        const histNit = String(input.nit || '').trim();
                        const histSerie = String(input.serie || '').trim();
                        return histNit === inv.emisor_nit && histSerie === inv.serie;
                    });

                    return {
                        ...inv,
                        portal_user: submission?.user ? 
                            `${submission.user.firstName || ''} ${submission.user.lastName || ''}`.trim() : 
                            null
                    };
                });
            }
        } catch (histError) {
            console.warn('[facturas-sat] Error al cruzar con historial:', histError.message);
            // No bloqueamos la respuesta, enviamos facturas sin info de usuario
        }

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


