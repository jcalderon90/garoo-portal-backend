import mongoose from 'mongoose';
import Organization from '../models/Organization.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const result = await Organization.findOneAndUpdate(
            { name: /Mundo Verde/i },
            { $addToSet: { activeServices: 'facturas-sat' } },
            { new: true }
        );
        console.log('✅ Permisos actualizados:', result.activeServices);
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
};
run();
