import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Service from '../models/Service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const usersToAdd = [
    { name: 'Jorge Flores', email: 'jorge.flores@mundoverde.com.gt' },
    { name: 'Rocio Torres', email: 'rocio.torres@mundoverde.com.gt' },
    { name: 'Yazmín Rodas', email: 'yasmin.rodas@mundoverde.com.gt' },
    { name: 'Venancio Gómez', email: 'venancio.gomez@mundoverde.com.gt' },
    { name: 'Rony Morán', email: 'rony.moran@mundoverde.com.gt' },
    { name: 'Ana Hernández', email: 'ana.hernandez@mundoverde.com.gt' },
    { name: 'Vivian Valenzuela', email: 'vivian.valenzuela@mundoverde.com.gt' },
    { name: 'Katherine García', email: 'aux.conta01@mundoverde.com.gt' }
];

async function run() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            throw new Error('MONGO_URI not found in environment variables');
        }

        console.log('🔗 Conectando a MongoDB...');
        await mongoose.connect(uri);
        console.log('✅ Conectado con éxito');

        // Buscar la organización Mundo Verde
        const org = await Organization.findOne({ name: /Mundo Verde/i });
        if (!org) {
            console.error('❌ Organización "Mundo Verde" no encontrada. Por favor asegúrate de que el nombre sea correcto.');
            process.exit(1);
        }
        console.log(`🏢 Organización: ${org.name} (${org._id})`);

        // Obtener servicios activos para asignar (por defecto damos acceso a facturacion y agent-onboarding)
        const services = await Service.find({ active: true });
        const allowedServices = services.map(s => s.slug);
        console.log(`🛠️ Servicios a asignar: ${allowedServices.join(', ')}`);

        for (const userData of usersToAdd) {
            const email = userData.email.toLowerCase().trim();
            let user = await User.findOne({ email });
            
            const [firstName, ...lastNameParts] = userData.name.split(' ');
            const lastName = lastNameParts.join(' ');

            if (user) {
                console.log(`🟡 Actualizando usuario: ${email}`);
                user.password = 'admin'; // El pre-save hook lo hasheará
                user.organization = org._id;
                user.allowedServices = allowedServices;
                user.firstName = firstName;
                user.lastName = lastName;
                user.role = 'agent';
                await user.save();
            } else {
                console.log(`🟢 Creando usuario: ${email}`);
                user = new User({
                    email,
                    password: 'admin',
                    firstName,
                    lastName,
                    organization: org._id,
                    role: 'agent',
                    allowedServices: allowedServices
                });
                await user.save();
            }
        }

        console.log('\n🚀 PROCESO COMPLETADO EXITOSAMENTE');
        console.log('-----------------------------------');
        console.log('Credenciales para todos:');
        console.log('Email: [su correo]');
        console.log('Password: admin');
        console.log('-----------------------------------');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ ERROR FATAL:', error.message);
        process.exit(1);
    }
}

run();
