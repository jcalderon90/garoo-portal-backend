import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from './models/Service.js';

dotenv.config();

const ALL_SERVICES_INITIAL = [
    {
        name: "Gestor de Aplicaciones",
        slug: "applications",
        path: "/applications",
        icon: "bi bi-person-vcard",
        label: "Gestor de Aplicaciones",
        sublabel: "RocknRolla",
        description: "Sistema avanzado de filtrado y gestión de aplicaciones laborales para la selección de talento calificado.",
        color: "#3b82f6",
        bgColor: "rgba(59,130,246,0.08)"
    },
    {
        name: "Facturación",
        slug: "facturacion",
        path: "/form",
        icon: "bi bi-receipt-cutoff",
        label: "Facturación",
        sublabel: "Mundo Verde",
        description: "Módulo de gestión documental para la carga y validación de facturas SAT y documentos comerciales.",
        color: "#10b981",
        bgColor: "rgba(16,185,129,0.08)"
    },
    {
        name: "Panel de Leads",
        slug: "spectrum-leads",
        path: "/spectrum-leads",
        icon: "bi bi-graph-up-arrow",
        label: "Panel de Leads",
        sublabel: "Spectrum",
        description: "Monitoreo en tiempo real de prospectos generados por agentes de inteligencia artificial en diversos canales.",
        color: "#8b5cf6",
        bgColor: "rgba(139,92,246,0.08)"
    },
    {
        name: "Análisis de Video",
        slug: "video-analysis",
        path: "/video-analysis",
        icon: "bi bi-play-circle",
        label: "Análisis de Video",
        sublabel: "Pepsi",
        description: "Analítica detallada de contenido en video, incluyendo engagement, sentimiento y tendencias demográficas.",
        color: "#005cb4",
        bgColor: "rgba(0,92,180,0.08)"
    },
    {
        name: "Configuración de Agente",
        slug: "agent-onboarding",
        path: "/agent-onboarding",
        icon: "bi bi-robot",
        label: "Configuración de Agente",
        sublabel: "Garoo Agent",
        description: "Portal de configuración paso a paso para desplegar agentes de IA personalizados con conocimiento específico.",
        color: "#e0c800",
        bgColor: "rgba(224,200,0,0.08)"
    },
    {
        name: "Form de Llamadas",
        slug: "calling-agent-form",
        path: "/calling-form",
        icon: "bi bi-telephone-outbound",
        label: "Form de Llamadas",
        sublabel: "Voice AI",
        description: "Formulario inteligente para el registro y seguimiento de llamadas gestionadas por agentes de voz automatizados.",
        color: "#f59e0b",
        bgColor: "rgba(245,158,11,0.08)"
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        for (const s of ALL_SERVICES_INITIAL) {
            await Service.findOneAndUpdate({ slug: s.slug }, s, { upsert: true });
            console.log(`Synced: ${s.name}`);
        }

        console.log('Seed completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
}

seed();
