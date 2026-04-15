import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Organization from '../models/Organization.js';
import User from '../models/User.js';

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`Connected to DB: ${mongoose.connection.name}`);

        const org = await Organization.findOne({ name: /Mundo Verde/i });
        if (org) {
            console.log(`Org: ${org.name}`);
            console.log(`Active Services: ${JSON.stringify(org.activeServices)}`);
            
            if (!org.activeServices.includes("facturas-sat")) {
                console.log("Adding facturas-sat to org activeServices...");
                org.activeServices.push("facturas-sat");
                await org.save();
                console.log("Org updated.");
            }
        }

        const user = await User.findOne({ email: "jcalderon@mail.com" });
        if (user) {
            console.log(`User: ${user.email}`);
            console.log(`Allowed Services: ${JSON.stringify(user.allowedServices)}`);
            if (!user.allowedServices.includes("facturas-sat")) {
                 console.log("Adding facturas-sat to user allowedServices...");
                 user.allowedServices.push("facturas-sat");
                 await user.save();
                 console.log("User updated.");
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

check();
