import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Organization from '../models/Organization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function create() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const org = await Organization.findOne({ slug: 'mundo-verde' });
        if (!org) {
            console.error('Organization "mundo-verde" not found.');
            process.exit(1);
        }
        console.log(`Found Org: ${org.name} (${org._id})`);

        const userData = {
            firstName: 'Jorge',
            lastName: 'Flores',
            email: 'jorge.flores@mundoverde.com.gt',
            password: 'admin', // The pre-save hook will hash this
            organization: org._id,
            role: 'agent',
            allowedServices: ['facturacion', 'facturas-sat'],
            active: true
        };

        // Check if user already exists
        const existing = await User.findOne({ email: userData.email });
        if (existing) {
            console.log('User already exists, updating...');
            Object.assign(existing, userData);
            await existing.save();
            console.log('User updated successfully.');
        } else {
            await User.create(userData);
            console.log('User created successfully.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

create();
