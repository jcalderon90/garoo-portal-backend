import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './models/Organization.js';
import User from './models/User.js';

dotenv.config();

const SLUG_MAPPING = {
    'form': 'facturacion',
    'mundo-verde-invoices': 'facturacion',
    'outbound-call-form': 'calling-agent-form',
    'spectrum': 'spectrum-leads',
    'video': 'video-analysis',
    'onboarding': 'agent-onboarding'
};

async function migrateAll() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Connected for Global Migration`);

        // 1. MIGRAR ORGANIZACIONES
        const orgs = await Organization.find();
        for (let org of orgs) {
            let updatedServices = org.activeServices.map(s => SLUG_MAPPING[s.toLowerCase().trim()] || s.toLowerCase().trim());
            // Eliminar duplicados
            updatedServices = [...new Set(updatedServices)];
            
            await Organization.findByIdAndUpdate(org._id, { activeServices: updatedServices });
            console.log(`🏢 Org "${org.name}" updated.`);
        }

        // 2. MIGRAR USUARIOS
        const users = await User.find();
        for (let user of users) {
            let updatedAllowed = (user.allowedServices || []).map(s => SLUG_MAPPING[s.toLowerCase().trim()] || s.toLowerCase().trim());
            updatedAllowed = [...new Set(updatedAllowed)];
            
            await User.findByIdAndUpdate(user._id, { allowedServices: updatedAllowed });
            console.log(`👤 User "${user.email}" updated.`);
        }

        console.log('✅ Global Permission Migration Complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration Error:', error);
        process.exit(1);
    }
}

migrateAll();
