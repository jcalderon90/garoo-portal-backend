import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from './models/Service.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Connected to DB: ${mongoose.connection.name}`);
        console.log(`✅ MongoDB Host: ${mongoose.connection.host}`);
        console.log(`✅ Using Collection: ${Service.collection.name}`);
        
        const services = await Service.find();
        console.log(`\n--- SERVICES FOUND (${services.length}) ---`);
        services.forEach(s => {
            console.log(`- Slug: "${s.slug}" | Active: ${s.active}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

check();
