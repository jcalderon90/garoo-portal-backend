import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const OrganizationSchema = new mongoose.Schema({
    name: String,
    slug: String,
    activeServices: [String]
});

const ServiceSchema = new mongoose.Schema({
    name: String,
    slug: String,
    active: Boolean
});

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Organization = mongoose.model('Organization', OrganizationSchema);
        const Service = mongoose.model('Service', ServiceSchema);

        const orgs = await Organization.find();
        console.log('\n--- ORGANIZATIONS ---');
        orgs.forEach(o => {
            console.log(`- ${o.name} (${o.slug}): ${o.activeServices.join(', ')}`);
        });

        const services = await Service.find();
        console.log('\n--- SERVICES ---');
        services.forEach(s => {
            console.log(`- ${s.name} (${s.slug}): ${s.active ? 'Active' : 'Inactive'}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

check();
