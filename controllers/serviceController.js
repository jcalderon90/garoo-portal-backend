import axios from 'axios';
import mongoose from 'mongoose';
import History from '../models/History.js';
import Service from '../models/Service.js';
import FacturaSchema from '../models/Factura.js';
import LeadSchema from '../models/Lead.js';
import { getDynamicModel } from '../utils/connectionManager.js';

export const proxyService = async (req, res) => {
    const { serviceId } = req.params;
    const user = req.user || null;
    const organization = user?.organization || null;

    const isAdmin = (user?.role || '').toLowerCase() === 'admin';

    if (!isAdmin && user && organization) {
        // Normalización de IDs: n8n usa 'facturas' pero la DB suele tener 'facturacion'
        const checkId = serviceId === 'facturas' ? 'facturacion' : serviceId;
        
        const hasOrgAccess = organization.activeServices.includes(serviceId) || organization.activeServices.includes(checkId);
        if (!hasOrgAccess) {
            console.log(`[DEBUG] 403 REJECTED: Service ${serviceId}/${checkId} not in [${organization.activeServices}]`);
            return res.status(403).json({ error: `Service '${serviceId}' not active for your organization.` });
        }

        const hasUserAccess = user.allowedServices?.includes(serviceId) || user.allowedServices?.includes(checkId);
        if (!hasUserAccess) {
            console.log(`[DEBUG] 403 REJECTED: Service ${serviceId}/${checkId} not in user allowedServices [${user.allowedServices}]`);
            return res.status(403).json({ error: `Service '${serviceId}' not allowed for your user account.` });
        }
    }

    try {
        const REDTEC_BASE = process.env.N8N_BASE_URL || "https://agentsprod.redtec.ai/webhook";
        const targetUrl = `${REDTEC_BASE}/${serviceId}`;

        console.log(`🚀 Proxying ${req.method} for ${serviceId} (Public: ${!user})`);

        const headers = { 
            'Content-Type': req.headers['content-type'] || 'application/json',
        };

        // Forward content-length if present (vital for streams)
        if (req.headers['content-length']) {
            headers['content-length'] = req.headers['content-length'];
        }

        // Inyectar datos del usuario para que n8n los conozca
        if (user) {
            headers['x-portal-user-id'] = user._id.toString();
            headers['x-portal-user-name'] = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            headers['x-portal-user-email'] = user.email;
        }

        console.log(`[DEBUG] Proxying to: ${targetUrl}`);
        console.log(`[DEBUG] Headers:`, JSON.stringify(headers));

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req, // Enviamos el stream original (incluye archivos)
            params: req.query,
            headers,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            decompress: false // Avoid automatic decompression if possible
        });

        const mergedInputData = { 
            ...req.query, 
            ...(typeof req.body === 'object' ? req.body : {}) 
        };

        History.create({
            serviceId,
            organization: organization?._id || null,
            user: user?._id || null,
            inputData: mergedInputData,
            outputData: response.data,
            status: 'success'
        }).catch(() => {});

        res.json(response.data);
    } catch (error) {
        console.error(`❌ Proxy error for ${serviceId}:`, error.message);
        
        const mergedInputData = { 
            ...req.query, 
            ...(typeof req.body === 'object' ? req.body : {}) 
        };

        History.create({
            serviceId,
            organization: organization?._id || null,
            user: user?._id || null,
            inputData: mergedInputData,
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
        const { organization, role, _id } = req.user;

        const isAdmin = (role || '').toLowerCase() === 'admin';

        if (!isAdmin) {
            if (!organization?.activeServices?.includes(serviceId)) {
                return res.status(403).json({ error: `Service '${serviceId}' not active for your organization.` });
            }
            if (!req.user.allowedServices?.includes(serviceId)) {
                return res.status(403).json({ error: `Service '${serviceId}' not allowed for your user account.` });
            }
        }

        const query = { 
            serviceId, 
            organization: organization._id 
        };

        // Si no es admin, solo ver sus propias ejecuciones
        if (!isAdmin) {
            query.user = _id;
        }

        const history = await History.find(query)
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
        const { organization, role, allowedServices } = req.user;
        const isAdmin = (role || '').toLowerCase() === 'admin';
        
        console.log(`[facturas-sat] User org: ${organization?.name} | Role: ${role} | Admin: ${isAdmin}`);

        if (!isAdmin) {
            const hasOrgAccess = organization?.activeServices?.includes('facturas-sat') || organization?.activeServices?.includes('facturacion');
            const hasUserAccess = allowedServices?.includes('facturas-sat') || allowedServices?.includes('facturacion');
            
            if (!hasOrgAccess) {
                return res.status(403).json({ error: `Service 'facturas-sat' not active for your organization.` });
            }
            if (!hasUserAccess) {
                return res.status(403).json({ error: `Service 'facturas-sat' not allowed for your user account.` });
            }
        }

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

        // Función para escapar caracteres especiales de Regex
        const escapeRegExp = (string) => {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        // Réplica exacta de la lógica de n8n "FILTERS"
        if (query.emisor) {
            filter.emisor_nombre = { "$regex": escapeRegExp(query.emisor), "$options": "i" };
        }
        if (query.nit) {
            filter.emisor_nit = { "$regex": escapeRegExp(query.nit), "$options": "i" };
        }
        
        // Filtro de Fechas (Formato ISO String manual como en n8n)
        if (query.from || query.to) {
            filter.fecha_emision = {};
            if (query.from) filter.fecha_emision.$gte = query.from + "T00:00:00.000";
            if (query.to) filter.fecha_emision.$lte = query.to + "T23:59:59.999";
        }

        if (query.serie) filter.serie = { "$regex": escapeRegExp(query.serie), "$options": "i" };
        if (query.dte) filter.numero_dte = { "$regex": escapeRegExp(query.dte), "$options": "i" };
        if (query.monto) filter.monto_total = parseFloat(query.monto);

        // Nuevo Filtro: Usuario que envió (portal_user)
        if (query.user) {
            const userRegex = { "$regex": escapeRegExp(query.user), "$options": "i" };
            filter.$or = [
                { portal_user: userRegex },
                { "portal_user.nombre": userRegex }
            ];
        }

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

        // 2. Construcción de Pipeline de Agregación para Cruce y Filtros
        const isTrue = (val) => {
            const v = Array.isArray(val) ? val[0] : val;
            return v === "true" || v === true || v === "1";
        };
        const isFalse = (val) => {
            const v = Array.isArray(val) ? val[0] : val;
            return v === "false" || v === false || v === "0";
        };

        console.log(`[facturas-sat] Filtrando - Matched: ${query.matched} | Odoo: ${query.confirmed}`);

        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "formulario",
                    let: { nit: "$emisor_nit", serie: "$serie", nro: "$numero_dte" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$NIT", "$$nit"] },
                                        { $eq: ["$SERIE", "$$serie"] },
                                        { $eq: ["$NRO_FACTURA", "$$nro"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "form_info"
                }
            },
            {
                $addFields: {
                    formDoc: { $arrayElemAt: ["$form_info", 0] }
                }
            },
            {
                $addFields: {
                    calculatedMatched: { $cond: { if: { $gt: [{ $size: "$form_info" }, 0] }, then: true, else: { $ifNull: ["$matched", false] } } },
                    calculatedConfirmed: { $cond: { if: { $gt: [{ $size: "$form_info" }, 0] }, then: true, else: { $ifNull: ["$confirmed", false] } } }
                }
            }
        ];

        // Filtros post-cruce (Matched / Confirmed)
        if (query.matched !== undefined && query.matched !== "") {
            if (isTrue(query.matched)) {
                pipeline.push({ $match: { calculatedMatched: true } });
            } else if (isFalse(query.matched)) {
                pipeline.push({ $match: { calculatedMatched: false } });
            }
        }

        if (query.confirmed !== undefined && query.confirmed !== "") {
            if (isTrue(query.confirmed)) {
                pipeline.push({ $match: { calculatedConfirmed: true } });
            } else if (isFalse(query.confirmed)) {
                pipeline.push({ $match: { calculatedConfirmed: false } });
            }
        }

        // Facet para obtener total y datos paginados
        pipeline.push({
            $facet: {
                metadata: [{ $count: "total" }],
                data: [
                    { $sort: { fecha_emision: -1 } },
                    { $skip: skip },
                    { $limit: limit }
                ]
            }
        });

        // Debug: Log del pipeline final
        // console.log("[facturas-sat] Pipeline:", JSON.stringify(pipeline, null, 2));

        const results = await Factura.aggregate(pipeline);
        let facturas = results[0]?.data || [];
        const total = results[0]?.metadata[0]?.total || 0;

        // 3. Opcional - Cruce con el Historial del Portal para saber quién envió qué
        // Buscamos los registros en History (Cluster Principal) para esta organización
        // Nota: Solo buscamos los últimos logs para optimizar
        try {
            const orgId = isAdmin && req.query.orgSlug ? 
                (await mongoose.model('Organization').findOne({ slug: req.query.orgSlug }))?._id : 
                organization?._id;

            if (orgId) {
                const recentHistory = await History.find({
                    organization: orgId,
                    serviceId: 'facturacion', // El ID del formulario de envío
                    status: 'success'
                })
                .populate('user', 'firstName lastName')
                .sort({ createdAt: -1 })
                .limit(200) // Suficiente para cubrir la página actual y más
                .lean();

            }

            // Cruzar datos: Emparejar por NIT y Serie (que vienen en inputData del form)
            facturas = facturas.map(inv => {
                let userName = null;
                if (inv.portal_user) {
                    userName = typeof inv.portal_user === 'object' ? inv.portal_user.nombre : inv.portal_user;
                }

                // No retornar aquí, seguir para buscar en historial si userName es null
                let finalUser = userName;
                const historyScope = typeof recentHistory !== 'undefined' ? recentHistory : [];
                if (!finalUser) {
                    const submission = historyScope.find(h => {
                        const input = h.inputData || {};
                        const histNit = String(input.nit || '').trim();
                        const histSerie = String(input.serie || '').trim();
                        return histNit === inv.emisor_nit && histSerie === inv.serie;
                    });
                    
                    if (submission?.user) {
                        finalUser = `${submission.user.firstName || ''} ${submission.user.lastName || ''}`.trim();
                    }
                }

                // Retornar siempre con los campos calculados sobrescritos para el frontend
                return {
                    ...inv,
                    matched: inv.calculatedMatched,
                    confirmed: inv.calculatedConfirmed,
                    portal_user: finalUser || null
                };
            });
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

export const getOrgUsers = async (req, res) => {
    try {
        const { orgSlug } = req.params;
        const user = req.user;

        // 1. Obtener la organización por slug
        const Organization = mongoose.model('Organization');
        const org = await Organization.findOne({ slug: orgSlug });
        
        if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

        // 2. Seguridad: Permitir si es Admin O si pertenece a esa org
        const isAdmin = (user?.role || '').toLowerCase() === 'admin';
        
        // Extraer ID de la organización del usuario (puede venir como objeto o string)
        const userOrgId = user?.organization?._id?.toString() || user?.organization?.toString();
        const targetOrgId = org._id.toString();

        const belongsToOrg = userOrgId === targetOrgId;

        if (!isAdmin && !belongsToOrg) {
            console.log(`[DEBUG] 403 Rejected OrgUsers: UserOrg(${userOrgId}) !== TargetOrg(${targetOrgId})`);
            return res.status(403).json({ error: 'No tienes permisos para ver usuarios de esta organización' });
        }

        // 3. Obtener usuarios (solo campos necesarios)
        const User = mongoose.model('User');
        const users = await User.find({ organization: org._id })
            .select('firstName lastName email')
            .sort({ firstName: 1 });

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Normalize channel string from DB ("whatsapp") to display format ("WhatsApp")
const normalizeChannel = (raw) => {
    const c = (raw || '').toLowerCase();
    if (c.includes('whatsapp') || c === 'wa') return 'WhatsApp';
    if (c.includes('instagram') || c === 'ig') return 'Instagram';
    if (c.includes('facebook') || c.includes('fb') || c.includes('mess')) return 'Facebook';
    if (c.includes('web')) return 'Web';
    return raw || 'Otro';
};

// Map DB document (users collection) to the shape the frontend expects
const mapLeadDoc = (doc) => ({
    id: doc._id?.toString(),
    user_id: doc.manychat_id,
    name: doc.nombre || null,
    whatsapp_name: doc.nombre || null,
    phone: doc.telefono || null,
    email: doc.correo || null,
    input_channel: normalizeChannel(doc.input_channel),
    emocion_detectada: doc._emocion || null,
    has_reservation: doc.has_reservation || false,
    first_interaction: doc.first_interaction || null,
    last_interaction: doc.last_interaction || doc.last_update || null,
    palabra_clave: doc._palabra_clave || null,
    resumen_breve: doc.conversation_ressume?.Resumen || null,
    proyecto: doc.proyecto || null,
    datos_completos: doc.datos_completos || false,
    tag_medio: doc.tag_medio || null,
});

export const getSpectrumLeads = async (req, res) => {
    try {
        const { organization, role, allowedServices } = req.user;
        const isAdmin = (role || '').toLowerCase() === 'admin';

        if (!isAdmin) {
            const hasOrgAccess = organization?.activeServices?.includes('spectrum-leads');
            const hasUserAccess = allowedServices?.includes('spectrum-leads');
            if (!hasOrgAccess) {
                return res.status(403).json({ error: "Service 'spectrum-leads' not active for your organization." });
            }
            if (!hasUserAccess) {
                return res.status(403).json({ error: "Service 'spectrum-leads' not allowed for your user account." });
            }
        }

        const targetMongoUri = organization?.databaseConfig?.mongoUri;
        if (!targetMongoUri) {
            return res.status(400).json({
                error: 'db_not_configured',
                message: `La organización "${organization?.name}" no tiene base de datos configurada.`
            });
        }

        let Lead;
        try {
            Lead = await getDynamicModel(targetMongoUri, 'Lead', LeadSchema);
        } catch (connErr) {
            console.error('[spectrum-leads] ❌ DB connection error:', connErr.message);
            return res.status(503).json({
                error: 'db_connection_failed',
                message: 'No se pudo conectar a la base de datos de Spectrum.'
            });
        }

        const query = req.query;
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.pageSize) || 10;
        const skip = (page - 1) * limit;

        const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Build filter
        const filter = {};

        if (query.search?.trim()) {
            const re = { $regex: escapeRegExp(query.search.trim()), $options: 'i' };
            filter.$or = [{ nombre: re }, { manychat_id: re }, { telefono: re }];
        }

        if (query.channel && query.channel !== '') {
            // DB stores lowercase, frontend sends title case
            filter.input_channel = { $regex: escapeRegExp(query.channel), $options: 'i' };
        }

        if (query.reservation !== undefined && query.reservation !== '') {
            filter.has_reservation = query.reservation === 'true';
        }

        // Aggregation: join quality_logs to get emocion/intencion data
        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: 'quality_logs',
                    let: { mid: '$manychat_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$manychat_id', '$$mid'] } } },
                        { $sort: { fecha_analisis: -1 } },
                        { $limit: 1 }
                    ],
                    as: '_quality'
                }
            },
            {
                $addFields: {
                    _emocion: { $arrayElemAt: ['$_quality.intencion_detectada', 0] },
                    _palabra_clave: { $arrayElemAt: ['$_quality.funnel_stage', 0] }
                }
            }
        ];

        // Apply emotion filter post-lookup if requested
        if (query.emotion && query.emotion !== '') {
            pipeline.push({
                $match: {
                    _emocion: { $regex: escapeRegExp(query.emotion), $options: 'i' }
                }
            });
        }

        // Count + paginate in one facet
        pipeline.push({
            $facet: {
                metadata: [{ $count: 'total' }],
                data: [
                    { $sort: { last_interaction: -1, last_update: -1, timestamp: -1 } },
                    { $skip: skip },
                    { $limit: limit }
                ]
            }
        });

        const results = await Lead.aggregate(pipeline);
        const leads = (results[0]?.data || []).map(mapLeadDoc);
        const total = results[0]?.metadata[0]?.total || 0;

        console.log(`[spectrum-leads] ✅ ${leads.length} leads devueltos (total: ${total})`);

        res.json({
            leads,
            total,
            meta: {
                page,
                totalPages: Math.ceil(total / limit) || 1,
                totalCount: total
            }
        });
    } catch (error) {
        console.error('[spectrum-leads] ❌ Error inesperado:', error.message);
        res.status(500).json({ error: 'unexpected_error', message: error.message });
    }
};
