import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkCollections() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('--- COLLECTIONS IN DATABASE ---');
        collections.forEach(c => console.log(`- ${c.name}`));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkCollections();
