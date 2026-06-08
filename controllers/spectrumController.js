import mongoose from 'mongoose';
import { getDynamicModel } from '../utils/connectionManager.js';
import SpectrumLeadSchema from '../models/SpectrumLead.js';

const SPECTRUM_URI = () => {
    const uri = process.env.SPECTRUM_MONGO_URI;
    if (!uri) throw new Error('SPECTRUM_MONGO_URI not configured');
    return uri;
};

const checkAccess = (user, organization) => {
    const isAdmin = (user?.role || '').toLowerCase() === 'admin';
    if (isAdmin) return null;
    if (!organization?.activeServices?.includes('spectrum-leads')) {
        return { status: 403, message: "Service 'spectrum-leads' not active for your organization." };
    }
    if (!user?.allowedServices?.includes('spectrum-leads')) {
        return { status: 403, message: "Service 'spectrum-leads' not allowed for your user account." };
    }
    return null;
};

// Schema genérico para las 3 colecciones de chat (se registran con distintos nombres)
const chatSchema = (collection) =>
    new mongoose.Schema(
        { sessionId: String, messages: [mongoose.Schema.Types.Mixed] },
        { strict: false, collection }
    );

const getChatModel = (collectionName) =>
    getDynamicModel(SPECTRUM_URI(), `SpectrumChat_${collectionName}`, chatSchema(collectionName));

// Catálogo de proyectos: mapea el código (PMAR, PVV...) a su nombre legible
const projectSchema = new mongoose.Schema(
    { code: String, name: String, crm_code: String, mongodb_db: String },
    { strict: false, collection: 'projects' }
);
const getProjectsModel = () => getDynamicModel(SPECTRUM_URI(), 'SpectrumProject', projectSchema);

// Construye un mapa { CODIGO_MAYUS: 'Nombre legible' } a partir de la colección projects.
// users.proyecto viene en mayúsculas (PMAR), mientras projects.code está en minúsculas;
// indexamos por crm_code, mongodb_db y code (todos normalizados a mayúsculas) para cubrir variantes.
const buildProjectNameMap = async () => {
    const docs = await getProjectsModel().then(M => M.find({}).lean());
    const map = {};
    for (const p of docs) {
        if (!p.name) continue;
        for (const key of [p.crm_code, p.mongodb_db, p.code]) {
            if (key) map[String(key).toUpperCase()] = p.name;
        }
    }
    return map;
};

// Normaliza el campo proyecto: null, "", "null" → null (un único bucket "Sin proyecto")
const PROYECTO_NORM = {
    $let: {
        vars: { p: { $trim: { input: { $ifNull: [{ $toString: '$proyecto' }, ''] } } } },
        in: { $cond: [{ $in: ['$$p', ['', 'null', 'NULL', 'undefined']] }, null, '$$p'] },
    },
};

// Cuenta como "cita" tener ≥1 registro en appointments (fuente de verdad real,
// en vez del flag has_reservation que está desincronizado). Incluye todos los tipos.
const APPOINTMENTS_LOOKUP = [
    {
        $lookup: {
            from: 'appointments',
            localField: 'manychat_id',
            foreignField: 'manychat_id',
            as: '_appts',
        },
    },
    { $addFields: { has_appt: { $gt: [{ $size: '$_appts' }, 0] } } },
];

// Mapea documento (ya enriquecido con quality_info) al contrato del frontend
const mapLead = (doc) => ({
    user_id:           doc.manychat_id,
    name:              doc.nombre || null,
    whatsapp_name:     doc.nombre || null,
    phone:             doc.telefono || null,
    email:             doc.correo || null,
    input_channel:     doc.input_channel || null,
    has_reservation:   doc.has_reservation || false,
    first_interaction: doc.first_interaction || null,
    last_interaction:  doc.last_interaction || null,
    last_message:      doc.last_message || null,
    proyecto:          doc.proyecto || null,
    resumen_breve:     doc.conversation_ressume?.Resumen || null,
    // Desde quality_logs (análisis de IA por conversación)
    emocion_detectada: doc.quality_info?.intencion_detectada || null,
    palabra_clave:     doc.quality_info?.funnel_stage || null,
    puntuacion:        doc.quality_info?.puntuacion || null,
    recomendacion:     doc.quality_info?.recomendacion || null,
});

export const getDashboard = async (req, res) => {
    const user = req.user;
    const org  = user?.organization;

    const accessError = checkAccess(user, org);
    if (accessError) return res.status(accessError.status).json({ error: accessError.message });

    const { from, to } = req.query;

    try {
        const Lead = await getDynamicModel(SPECTRUM_URI(), 'SpectrumLead', SpectrumLeadSchema);

        // last_interaction is stored as ISO string ("2026-06-01T13:15:48.916-06:00"), not as Date.
        // Use string comparison — ISO 8601 is lexicographically sortable.
        const dateFilter = {};
        if (from) dateFilter.$gte = from;
        if (to)   dateFilter.$lte = to + 'T99';
        const match = Object.keys(dateFilter).length ? { last_interaction: dateFilter } : {};

        const [summary, byProject, byChannelRaw, projectNames] = await Promise.all([
            Lead.aggregate([
                { $match: match },
                ...APPOINTMENTS_LOOKUP,
                { $group: {
                    _id:         null,
                    total_leads: { $sum: 1 },
                    total_fase2: { $sum: { $cond: [{ $eq: ['$fase_2', true] }, 1, 0] } },
                    total_fase1: { $sum: { $cond: [{ $ne:  ['$fase_2', true] }, 1, 0] } },
                    total_citas: { $sum: { $cond: ['$has_appt', 1, 0] } },
                }},
            ]),
            Lead.aggregate([
                { $match: match },
                ...APPOINTMENTS_LOOKUP,
                { $group: {
                    _id:   PROYECTO_NORM,
                    leads:    { $sum: 1 },
                    citas:    { $sum: { $cond: ['$has_appt', 1, 0] } },
                    // Leads por fase (fase_2 === true → Fase 2; resto → Fase 1)
                    f1_leads: { $sum: { $cond: [{ $ne:  ['$fase_2', true] }, 1, 0] } },
                    f2_leads: { $sum: { $cond: [{ $eq: ['$fase_2', true] }, 1, 0] } },
                    // Citas por fase (lead con cita Y de esa fase)
                    f1_citas: { $sum: { $cond: [{ $and: [{ $ne: ['$fase_2', true] }, '$has_appt'] }, 1, 0] } },
                    f2_citas: { $sum: { $cond: [{ $and: [{ $eq: ['$fase_2', true] }, '$has_appt'] }, 1, 0] } },
                }},
                { $sort: { leads: -1 } },
            ]),
            Lead.aggregate([
                { $match: match },
                { $group: { _id: '$input_channel', count: { $sum: 1 } } },
            ]),
            buildProjectNameMap(),
        ]);

        const s = summary[0] || { total_leads: 0, total_fase1: 0, total_fase2: 0, total_citas: 0 };
        const convRate = s.total_leads > 0
            ? Math.round((s.total_citas / s.total_leads) * 100)
            : 0;

        const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

        // Totales por fase (denominador de los % de cada fase)
        const pt = byProject.reduce((a, p) => {
            a.f1_leads += p.f1_leads; a.f2_leads += p.f2_leads;
            a.f1_citas += p.f1_citas; a.f2_citas += p.f2_citas;
            return a;
        }, { f1_leads: 0, f2_leads: 0, f1_citas: 0, f2_citas: 0 });

        const by_project = byProject.map(p => {
            const code = p._id; // ya normalizado: código real o null
            return {
                proyecto:  code || 'S/C',
                nombre:    code ? (projectNames[code.toUpperCase()] || code) : 'Sin clasificar / abandonados',
                // Campos planos (vistas Barras y Tarjetas)
                leads:     p.leads,
                leads_pct: pct(p.leads, s.total_leads),
                citas:     p.citas,
                citas_pct: pct(p.citas, p.leads),
                fase1:     p.f1_leads,
                fase2:     p.f2_leads,
                // Desglose por fase (vista Tabla): Conv. = citas/leads, % respecto al total de la fase
                fase1_detail: {
                    leads:     p.f1_leads,
                    citas:     p.f1_citas,
                    conv:      pct(p.f1_citas, p.f1_leads),
                    leads_pct: pct(p.f1_leads, pt.f1_leads),
                    citas_pct: pct(p.f1_citas, pt.f1_leads),
                },
                fase2_detail: {
                    leads:     p.f2_leads,
                    citas:     p.f2_citas,
                    conv:      pct(p.f2_citas, p.f2_leads),
                    leads_pct: pct(p.f2_leads, pt.f2_leads),
                    citas_pct: pct(p.f2_citas, pt.f2_leads),
                },
            };
        });

        // Fila Total de la tabla por fase
        const phase_totals = {
            fase1: {
                leads:     pt.f1_leads,
                citas:     pt.f1_citas,
                conv:      pct(pt.f1_citas, pt.f1_leads),
                leads_pct: 100,
                citas_pct: pct(pt.f1_citas, pt.f1_leads),
            },
            fase2: {
                leads:     pt.f2_leads,
                citas:     pt.f2_citas,
                conv:      pct(pt.f2_citas, pt.f2_leads),
                leads_pct: 100,
                citas_pct: pct(pt.f2_citas, pt.f2_leads),
            },
        };

        const by_channel = Object.fromEntries(
            byChannelRaw.filter(c => c._id).map(c => [c._id, c.count])
        );

        console.log(`[spectrum] ✅ getDashboard: ${s.total_leads} leads, ${s.total_citas} citas`);

        res.json({
            summary: {
                total_leads:     s.total_leads,
                total_fase1:     s.total_fase1,
                total_fase2:     s.total_fase2,
                total_citas:     s.total_citas,
                conversion_rate: convRate,
            },
            by_project,
            phase_totals,
            by_channel,
        });
    } catch (err) {
        console.error('[spectrum] ❌ getDashboard:', err.message);
        res.status(500).json({ error: err.message });
    }
};

export const getLeads = async (req, res) => {
    const user = req.user;
    const organization = user?.organization;

    const accessError = checkAccess(user, organization);
    if (accessError) return res.status(accessError.status).json({ error: accessError.message });

    try {
        const Lead = await getDynamicModel(SPECTRUM_URI(), 'SpectrumLead', SpectrumLeadSchema);

        const { search, channel, emotion, reservation } = req.query;
        const page     = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, parseInt(req.query.pageSize) || 10);
        const skip     = (page - 1) * pageSize;

        const matchFilter = {};

        if (search?.trim()) {
            const regex = { $regex: search.trim(), $options: 'i' };
            matchFilter.$or = [{ nombre: regex }, { telefono: regex }, { correo: regex }];
        }

        if (channel && channel !== 'Todos') {
            matchFilter.input_channel = { $regex: channel, $options: 'i' };
        }

        if (reservation && reservation !== '') {
            matchFilter.has_reservation = reservation === 'true';
        }

        const pipeline = [
            { $match: matchFilter },
            // Join con el análisis de calidad más reciente por lead
            {
                $lookup: {
                    from: 'quality_logs',
                    let: { mid: '$manychat_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$manychat_id', '$$mid'] } } },
                        { $sort: { fecha_analisis: -1 } },
                        { $limit: 1 },
                    ],
                    as: 'quality',
                },
            },
            { $addFields: { quality_info: { $arrayElemAt: ['$quality', 0] } } },
        ];

        // Filtro por emoción/intención (post-lookup)
        if (emotion && emotion !== 'Todas') {
            pipeline.push({
                $match: { 'quality_info.intencion_detectada': { $regex: emotion, $options: 'i' } },
            });
        }

        // Facet: total + datos paginados
        pipeline.push({
            $facet: {
                metadata: [{ $count: 'total' }],
                data: [
                    { $sort: { last_interaction: -1 } },
                    { $skip: skip },
                    { $limit: pageSize },
                ],
            },
        });

        const results  = await Lead.aggregate(pipeline);
        const docs     = results[0]?.data || [];
        const total    = results[0]?.metadata[0]?.total || 0;
        const leads    = docs.map(mapLead);
        const totalPages = Math.ceil(total / pageSize) || 1;

        console.log(`[spectrum] ✅ ${leads.length} leads (total: ${total})`);

        res.json({ leads, total, meta: { page, totalPages, totalCount: total } });
    } catch (err) {
        console.error('[spectrum] ❌ getLeads:', err.message);
        res.status(500).json({ error: err.message });
    }
};

export const getLeadChat = async (req, res) => {
    const user = req.user;
    const organization = user?.organization;

    const accessError = checkAccess(user, organization);
    if (accessError) return res.status(accessError.status).json({ error: accessError.message });

    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id requerido' });

    try {
        const sid = String(user_id);

        // Obtener los 3 modelos de chat en paralelo
        const [ChatLead, ChatRsvp, ChatMain] = await Promise.all([
            getChatModel('chat_histories_lead'),
            getChatModel('chat_histories_rsvp'),
            getChatModel('chat_histories'),
        ]);

        // Consultar los 3 historiales en paralelo
        const [leadRec, rsvpRec, mainRec] = await Promise.all([
            ChatLead.findOne({ sessionId: sid }).lean(),
            ChatRsvp.findOne({ sessionId: sid }).lean(),
            ChatMain.findOne({ sessionId: sid }).lean(),
        ]);

        // Combinar en orden lógico: captación → reserva → orquestador
        // Filtrar mensajes tipo 'tool' del orquestador (internos del agente, no relevantes para el usuario)
        const allMessages = [
            ...(leadRec?.messages || []),
            ...(rsvpRec?.messages  || []),
            ...(mainRec?.messages  || []).filter(m => m.type !== 'tool'),
        ];

        console.log(`[spectrum] ✅ ${allMessages.length} mensajes combinados para ${sid}`);

        res.json({ chat: allMessages });
    } catch (err) {
        console.error('[spectrum] ❌ getLeadChat:', err.message);
        res.status(500).json({ error: err.message });
    }
};
