import mongoose from 'mongoose';

const SPECTRUM_URI = 'mongodb://jorgecalderon_db_user:hvV2fwG1dGcWVuAT@ac-gj52igi-shard-00-00.es7z0bi.mongodb.net:27017,ac-gj52igi-shard-00-01.es7z0bi.mongodb.net:27017,ac-gj52igi-shard-00-02.es7z0bi.mongodb.net:27017/Centralizado?authSource=admin&replicaSet=atlas-sfsy1w-shard-0&tls=true';

async function inspect() {
    console.log('Connecting to Centralizado DB...');
    await mongoose.connect(SPECTRUM_URI);
    const db = mongoose.connection.db;

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n=== COLLECTIONS ===');
    collections.forEach(c => console.log(' -', c.name));

    // For each relevant collection, get a sample document and count
    const relevantCollections = ['users', 'quality_logs', 'chat_histories_lead', 'chat_histories_rsvp', 'chat_histories'];

    for (const collName of relevantCollections) {
        const coll = db.collection(collName);
        const count = await coll.countDocuments();
        console.log(`\n=== ${collName} (total: ${count}) ===`);

        if (count > 0) {
            const sample = await coll.findOne({}, { projection: {} });
            console.log('SAMPLE KEYS:', Object.keys(sample).join(', '));
            console.log('SAMPLE DOC:');
            // Print sample but truncate long strings
            const cleanSample = {};
            for (const [k, v] of Object.entries(sample)) {
                if (typeof v === 'string' && v.length > 100) cleanSample[k] = v.substring(0, 100) + '...';
                else if (Array.isArray(v)) cleanSample[k] = `[Array(${v.length})]`;
                else if (v && typeof v === 'object' && !(v instanceof Date)) cleanSample[k] = JSON.stringify(v).substring(0, 150);
                else cleanSample[k] = v;
            }
            console.log(JSON.stringify(cleanSample, null, 2));
        }
    }

    // Check for collections NOT in the relevant list (unexpected ones)
    const unexpected = collections.filter(c => !relevantCollections.includes(c.name));
    if (unexpected.length > 0) {
        console.log('\n=== OTHER COLLECTIONS ===');
        unexpected.forEach(c => console.log(' -', c.name));
    }

    // Extra: check quality_logs structure specifically
    const qColl = db.collection('quality_logs');
    if (await qColl.countDocuments() > 0) {
        console.log('\n=== quality_logs SAMPLE (full) ===');
        const q = await qColl.findOne({});
        console.log(JSON.stringify(q, null, 2));
    }

    // Check users collection more carefully - look for 2 samples
    console.log('\n=== users SAMPLES (2 docs) ===');
    const userSamples = await db.collection('users').find({}).limit(2).toArray();
    userSamples.forEach((doc, i) => {
        console.log(`\n--- User ${i+1} ---`);
        const cleanDoc = {};
        for (const [k, v] of Object.entries(doc)) {
            if (typeof v === 'string' && v.length > 120) cleanDoc[k] = v.substring(0, 120) + '...';
            else if (Array.isArray(v)) cleanDoc[k] = `[Array(${v.length})]`;
            else if (v && typeof v === 'object' && !(v instanceof Date)) cleanDoc[k] = JSON.stringify(v).substring(0, 200);
            else cleanDoc[k] = v;
        }
        console.log(JSON.stringify(cleanDoc, null, 2));
    });

    await mongoose.disconnect();
    console.log('\nDone.');
}

inspect().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
