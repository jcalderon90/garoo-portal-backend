/**
 * TEST DE CONEXIÓN REMOTA - Ejecutar en el servidor de producción
 * Uso: node scripts/test-remote-connection.js
 *
 * Verifica si el servidor puede alcanzar MongoDB Atlas
 * y si env vars están correctas.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns/promises';

const ORG_MONGO_URI = "mongodb+srv://jorgecalderon:oFeBnppKqA3HfNED@cluster0.vtkafrd.mongodb.net/Garoo";

async function main() {
    console.log('\n🔍 === TEST DE CONECTIVIDAD PRODUCCIÓN ===\n');

    // 1. Verificar variables de entorno
    console.log('📋 Variables de entorno:');
    console.log(`   MONGO_URI:     ${process.env.MONGO_URI ? '✅ Definida' : '❌ NO DEFINIDA'}`);
    console.log(`   PORT:          ${process.env.PORT || '5000 (default)'}`);
    console.log(`   NODE_ENV:      ${process.env.NODE_ENV || 'no definido'}`);
    console.log(`   CORS_ORIGIN:   ${process.env.CORS_ORIGIN || 'no definido'}`);
    console.log('');

    // 2. DNS lookup de Atlas
    const atlasHost = 'cluster0.vtkafrd.mongodb.net';
    console.log(`🌐 Resolviendo DNS de "${atlasHost}"...`);
    try {
        const addresses = await dns.lookup(atlasHost);
        console.log(`   ✅ DNS resuelto → ${addresses.address}`);
    } catch (dnsErr) {
        console.log(`   ❌ DNS FALLO → ${dnsErr.message}`);
        console.log(`   ⚠️  Este es el ERR_NAME_NOT_RESOLVED. El servidor no puede alcanzar Atlas.`);
        console.log(`   💡 Solución: Verificar reglas de firewall y lista de IPs permitidas en Atlas.`);
    }
    console.log('');

    // 3. Intentar conexión directa al URI de la org
    console.log('🔌 Intentando conexión a DB de Mundo Verde...');
    try {
        const conn = await mongoose.createConnection(ORG_MONGO_URI, {
            serverSelectionTimeoutMS: 8000,
        }).asPromise();
        console.log(`   ✅ Conectado → DB: ${conn.name} | Host: ${conn.host}`);
        await conn.close();
    } catch (err) {
        console.log(`   ❌ Fallo → ${err.message}`);
        
        if (err.message.includes('Authentication failed')) {
            console.log('   💡 Las credenciales del URI de Mundo Verde son incorrectas.');
            console.log('   💡 Actualiza databaseConfig.mongoUri en la DB de producción.');
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT')) {
            console.log('   💡 El servidor no puede alcanzar Atlas. Revisa:');
            console.log('      1. Network Access en MongoDB Atlas: agrega la IP del servidor.');
            console.log('      2. Verificar firewall/iptables en el servidor VPS.');
            console.log('      3. Las conexiones salientes al puerto 27017 estén abiertas.');
        }
    }

    console.log('\n🔒 Test completo.\n');
    process.exit(0);
}

main().catch(err => {
    console.error('Error fatal:', err.message);
    process.exit(1);
});
