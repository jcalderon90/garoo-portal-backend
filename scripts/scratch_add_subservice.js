import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './models/Organization.js';

dotenv.config();

async function addSubService() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Connected to DB: ${mongoose.connection.name}`);

        // Añadir 'facturas-sat' a Mundo Verde para que el proxy funcione
        const result = await Organization.findOneAndUpdate(
            { name: "Mundo Verde" },
            { $addToSet: { activeServices: "facturas-sat" } },
            { new: true }
        );

        if (result) {
            console.log('✅ Updated Mundo Verde activeServices:', result.activeServices);
        } else {
            console.log('❌ Organization "Mundo Verde" not found.');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addSubService();
