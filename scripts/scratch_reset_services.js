import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from './models/Service.js';

dotenv.config();

async function resetServices() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Connected to DB: ${mongoose.connection.name}`);

        // 1. DROP COLLECTION
        try {
            await mongoose.connection.collection('services').drop();
            console.log('🗑️ Collection "services" dropped!');
        } catch (e) {
            console.log('⚠️ Collection already empty or not found.');
        }

        // 2. RE-SEED
        const servicesToSeed = [
          {
            name: 'Form de Llamadas',
            slug: 'calling-agent-form',
            description: 'Accede al formulario inteligente para el registro y gestión de llamadas de agentes.',
            icon: 'bi-headset',
            color: '#FF5733',
            bgColor: 'rgba(255, 87, 51, 0.1)',
            path: '/calling-agent-form',
            active: true
          },
          {
            name: 'Facturación Mundo Verde',
            slug: 'facturacion',
            description: 'Gestión y consulta de facturas para la operación de Mundo Verde.',
            icon: 'bi-file-earmark-text',
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.1)',
            path: '/mundo-verde/invoices',
            active: true
          },
          {
            name: 'Spectrum Leads',
            slug: 'spectrum-leads',
            description: 'Visualización y gestión de leads estratégicos para Spectrum.',
            icon: 'bi-graph-up-arrow',
            color: '#3b82f6',
            bgColor: 'rgba(59, 130, 246, 0.1)',
            path: '/spectrum/leads',
            active: true
          },
          {
            name: 'Análisis de Video',
            slug: 'video-analysis',
            description: 'Herramienta avanzada de procesamiento y análisis de contenido de video.',
            icon: 'bi-camera-video',
            color: '#8b5cf6',
            bgColor: 'rgba(139, 92, 246, 0.1)',
            path: '/video-analysis',
            active: true
          },
          {
            name: 'Gestión de Aplicaciones',
            slug: 'applications',
            description: 'Administración centralizada de todas las solicitudes y aplicaciones del sistema.',
            icon: 'bi-app-indicator',
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.1)',
            path: '/applications',
            active: true
          },
          {
            name: 'Onboarding de Agentes',
            slug: 'agent-onboarding',
            description: 'Portal dedicado para el seguimiento y gestión de nuevos agentes.',
            icon: 'bi-person-plus',
            color: '#ec4899',
            bgColor: 'rgba(236, 72, 153, 0.1)',
            path: '/agent-onboarding',
            active: true
          }
        ];

        await Service.insertMany(servicesToSeed);
        console.log(`✅ ${servicesToSeed.length} services seeded successfully!`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during reset:', error);
        process.exit(1);
    }
}

resetServices();
