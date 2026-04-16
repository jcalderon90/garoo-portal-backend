/**
 * SCRIPT: Actualizar mongoUri de una organización
 * 
 * Uso:
 *   node scripts/update-org-uri.js <slug-org> <nueva-mongo-uri>
 * 
 * Ejemplo:
 *   node scripts/update-org-uri.js mundo-verde "mongodb+srv://user:pass@cluster.mongodb.net/Garoo"
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const [,, slug, newUri] = process.argv;

if (!slug || !newUri) {
    console.error('\n❌ Uso: node scripts/update-org-uri.js <slug> <nueva-uri>\n');
    console.error('   Ejemplo: node scripts/update-org-uri.js mundo-verde "mongodb+srv://..."\n');
    process.exit(1);
}

const OrgSchema = new mongoose.Schema({
    name: String,
    slug: String,
    databaseConfig: { mongoUri: String },
}, { collection: 'organizations' });

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`\n✅ Conectado a: ${mongoose.connection.host}\n`);

    const Organization = mongoose.model('Organization', OrgSchema);

    const org = await Organization.findOne({ slug });
    if (!org) {
        console.error(`❌ No se encontró organización con slug: "${slug}"`);
        await mongoose.disconnect();
        process.exit(1);
    }

    const oldUri = org.databaseConfig?.mongoUri || '(vacío)';
    console.log(`🏢 Organización: ${org.name} (${org._id})`);
    console.log(`   URI anterior: ${oldUri.substring(0, 60)}...`);
    console.log(`   URI nueva:    ${newUri.substring(0, 60)}...`);

    org.databaseConfig = { mongoUri: newUri };
    await org.save();

    console.log('\n✅ mongoUri actualizado correctamente.\n');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
