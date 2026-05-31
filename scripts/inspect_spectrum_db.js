/**
 * Inspecciona la BD Centralizado de Spectrum
 * Uso: node scripts/inspect_spectrum_db.js
 */
import mongoose from 'mongoose';

// Hosts resueltos del SRV record (Node.js no puede hacer querySrv en este entorno)
const SPECTRUM_URI = "mongodb://jorgecalderon_db_user:hvV2fwG1dGcWVuAT@ac-gj52igi-shard-00-00.es7z0bi.mongodb.net:27017,ac-gj52igi-shard-00-01.es7z0bi.mongodb.net:27017,ac-gj52igi-shard-00-02.es7z0bi.mongodb.net:27017/Centralizado?ssl=true&authSource=admin&replicaSet=atlas-sfsy1w-shard-0";

async function main() {
    console.log('\n🔗 Conectando a Centralizado (Spectrum)...');
    const conn = await mongoose.createConnection(SPECTRUM_URI).asPromise();
    console.log(`✅ Conectado → DB: ${conn.name}\n`);

    const collections = await conn.db.listCollections().toArray();
    console.log(`📋 COLECCIONES (${collections.length}):`);
    collections.forEach(c => console.log(`   - ${c.name}`));

    // Simular el pipeline que usará getSpectrumLeads (página 1, sin filtros)
    console.log('\n🧪 SIMULANDO QUERY del endpoint /spectrum-leads (página 1):');
    const pipeline = [
        { $match: {} },
        {
            $lookup: {
                from: 'quality_logs',
                let: { mid: '$manychat_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$manychat_id', '$$mid'] } } },
                    { $sort: { fecha_analisis: -1 } },
                    { $limit: 1 }
                ],
                as: '_quality'
            }
        },
        {
            $addFields: {
                _emocion: { $arrayElemAt: ['$_quality.intencion_detectada', 0] },
                _palabra_clave: { $arrayElemAt: ['$_quality.funnel_stage', 0] }
            }
        },
        {
            $facet: {
                metadata: [{ $count: 'total' }],
                data: [
                    { $sort: { last_interaction: -1 } },
                    { $skip: 0 },
                    { $limit: 3 }
                ]
            }
        }
    ];
    const results = await conn.db.collection('users').aggregate(pipeline).toArray();
    const total = results[0]?.metadata[0]?.total || 0;
    const docs = results[0]?.data || [];
    console.log(`Total leads: ${total}`);
    console.log('Primeros 3 docs (campos relevantes):');
    docs.forEach(d => {
        console.log(`  - ${d.nombre} | canal: ${d.input_channel} | reserva: ${d.has_reservation} | emocion: ${d._emocion || 'n/a'} | funnel: ${d._palabra_clave || 'n/a'}`);
    });

    await conn.close();
    console.log('\n✅ Listo.\n');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
