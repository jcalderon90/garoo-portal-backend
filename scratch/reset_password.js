import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function reset() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'jorge.flores@mundoverde.com.gt';
        const user = await User.findOne({ email });

        if (!user) {
            console.error('Usuario no encontrado.');
            process.exit(1);
        }

        user.password = 'admin'; // El pre-save hook se encargará del hash
        await user.save();

        console.log('✅ Contraseña reseteada exitosamente para:', email);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

reset();
