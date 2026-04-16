/**
 * SCRIPT DE DIAGNÓSTICO - Verificar configuración de organizaciones
 * Uso: node scripts/check-org-db.js
 * 
 * Muestra: nombre, slug, activeServices y databaseConfig de cada org.
 * Permite identificar si falta el mongoUri de Mundo Verde.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI no está definida en .env');
    process.exit(1);
}

const OrgSchema = new mongoose.Schema({
    name: String,
    slug: String,
    activeServices: [String],
    databaseConfig: {
        mongoUri: String
    },
    settings: { type: Map, of: mongoose.Schema.Types.Mixed }
}, { collection: 'organizations' });

async function main() {
    console.log('\n🔍 Conectando a la DB principal...');
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Conectado a: ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

    const Organization = mongoose.model('Organization', OrgSchema);
    const orgs = await Organization.find({}).lean();

    if (orgs.length === 0) {
        console.log('⚠️  No se encontraron organizaciones en la base de datos.');
    }

    console.log(`📋 ORGANIZACIONES ENCONTRADAS: ${orgs.length}\n`);
    console.log('═'.repeat(70));

    for (const org of orgs) {
        const hasMongoUri = !!org.databaseConfig?.mongoUri;
        const uriPreview = hasMongoUri 
            ? org.databaseConfig.mongoUri.substring(0, 50) + '...'
            : '⚠️  NO CONFIGURADO';

        console.log(`\n🏢 ${org.name} (slug: ${org.slug})`);
        console.log(`   ID:              ${org._id}`);
        console.log(`   Servicios:       [${(org.activeServices || []).join(', ') || 'ninguno'}]`);
        console.log(`   mongoUri:        ${uriPreview}`);
        
        if (hasMongoUri) {
            // Intentar extraer el cluster del URI
            const clusterMatch = org.databaseConfig.mongoUri.match(/@([^/]+)/);
            const cluster = clusterMatch ? clusterMatch[1] : 'desconocido';
            console.log(`   Cluster MongoDB: ${cluster}`);
        }
        console.log('─'.repeat(70));
    }

    console.log('\n✅ Diagnóstico completo.\n');

    // Prueba de conexión para cada org que tenga mongoUri
    for (const org of orgs) {
        if (!org.databaseConfig?.mongoUri) {
            console.log(`\n⚠️  [${org.name}] Sin mongoUri - saltando prueba de conexión.`);
            continue;
        }

        console.log(`\n🔌 Probando conexión para [${org.name}]...`);
        try {
            const conn = await mongoose.createConnection(org.databaseConfig.mongoUri, {
                serverSelectionTimeoutMS: 5000,
            }).asPromise();
            const dbName = conn.name;
            const host = conn.host;
            await conn.close();
            console.log(`   ✅ Éxito → DB: ${dbName} en ${host}`);
        } catch (err) {
            console.log(`   ❌ Fallo → ${err.message}`);
        }
    }

    await mongoose.disconnect();
    console.log('\n🔒 Desconectado. Listo.\n');
}

main().catch(err => {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
});
