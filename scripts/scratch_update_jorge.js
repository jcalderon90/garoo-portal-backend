import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function updateJorge() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Connected to DB: ${mongoose.connection.name}`);

        const result = await User.findOneAndUpdate(
            { email: "jcalderon@mail.com" },
            { $addToSet: { allowedServices: "facturas-sat" } },
            { new: true }
        );

        if (result) {
            console.log('✅ Updated Jorge allowedServices:', result.allowedServices);
        } else {
            console.log('❌ User "jcalderon@mail.com" not found.');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateJorge();
