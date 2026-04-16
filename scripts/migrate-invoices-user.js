/**
 * SCRIPT: Migrar facturas existentes a un usuario portal por defecto
 * 
 * Uso:
 *   node scripts/migrate-invoices-user.js <slug-org> <nombre-usuario>
 * 
 * Ejemplo:
 *   node scripts/migrate-invoices-user.js mundo-verde "Mundo Verde (Migrado)"
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import FacturaSchema from '../models/Factura.js';
import { getDynamicModel } from '../utils/connectionManager.js';

const [,, slug, portalUserName] = process.argv;

if (!slug || !portalUserName) {
    console.error('\n❌ Uso: node scripts/migrate-invoices-user.js <slug> <nombre-usuario>\n');
    process.exit(1);
}

const OrgSchema = new mongoose.Schema({
    slug: String,
    databaseConfig: { mongoUri: String },
}, { collection: 'organizations' });

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const Organization = mongoose.model('Organization', OrgSchema);

    const org = await Organization.findOne({ slug });
    if (!org || !org.databaseConfig?.mongoUri) {
        console.error(`❌ Org "${slug}" no encontrada o sin URI.`);
        process.exit(1);
    }

    console.log(`🔌 Conectando a DB de ${slug}...`);
    const Factura = await getDynamicModel(org.databaseConfig.mongoUri, 'Factura', FacturaSchema);

    // Actualizar todas las facturas que NO tengan portal_user todavía
    const result = await Factura.updateMany(
        { portal_user: { $exists: false } },
        { $set: { portal_user: portalUserName } }
    );

    console.log(`\n✅ Proceso completado.`);
    console.log(`   - Facturas actualizadas: ${result.modifiedCount}`);
    
    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
