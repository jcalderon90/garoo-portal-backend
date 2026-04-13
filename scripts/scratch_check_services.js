import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from './models/Service.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        const services = await Service.find();
        console.log(`\n--- SERVICES IN DATABASE (${services.length}) ---`);
        services.forEach(s => {
            console.log(`- Name: "${s.name}" | Slug: "${s.slug}" | Active: ${s.active}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

check();
