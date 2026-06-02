import { MongoClient } from 'mongodb';

const URI = 'mongodb://jorgecalderon_db_user:hvV2fwG1dGcWVuAT@ac-gj52igi-shard-00-00.es7z0bi.mongodb.net:27017,ac-gj52igi-shard-00-01.es7z0bi.mongodb.net:27017,ac-gj52igi-shard-00-02.es7z0bi.mongodb.net:27017/Centralizado?authSource=admin&replicaSet=atlas-sfsy1w-shard-0&tls=true';
const client = new MongoClient(URI);

async function main() {
    await client.connect();
    const db = client.db('Centralizado');

    // 1. Campos de un doc en 'users'
    console.log('\n=== CAMPOS DE users ===');
    const u = await db.collection('users').findOne({});
    if (u) console.log(Object.keys(u).join(', '));
    else console.log('VACIA');

    // 1b. Valores distintos de input_channel
    console.log('\n=== VALORES input_channel ===');
    const channels = await db.collection('users').distinct('input_channel');
    channels.forEach(v => console.log(' -', v));

    // 1c. conversation_ressume vs conversation_resume
    console.log('\n=== CAMPO resumen ===');
    const doble  = await db.collection('users').countDocuments({ conversation_ressume: { $exists: true } });
    const simple = await db.collection('users').countDocuments({ conversation_resume:  { $exists: true } });
    console.log('conversation_ressume (doble s):', doble);
    console.log('conversation_resume (simple s):', simple);

    // 2. quality_logs: campos y manychat_id
    console.log('\n=== CAMPOS quality_logs ===');
    const ql = await db.collection('quality_logs').findOne({});
    if (ql) console.log(Object.keys(ql).join(', '));
    else console.log('VACIA o NO EXISTE');

    // 3. chat_histories_lead
    console.log('\n=== chat_histories_lead ===');
    const ch = await db.collection('chat_histories_lead').findOne({});
    if (ch) {
        console.log('Campos doc:', Object.keys(ch).join(', '));
        console.log('sessionId sample:', ch.sessionId);
        if (ch.messages?.length > 0) {
            console.log('mensaje[0] campos:', Object.keys(ch.messages[0]).join(', '));
            console.log('mensaje[0]:', JSON.stringify(ch.messages[0]).slice(0, 200));
        }
    } else console.log('VACIA o NO EXISTE');

    // 4. chat_histories y chat_histories_rsvp
    for (const col of ['chat_histories', 'chat_histories_rsvp']) {
        console.log(`\n=== ${col} ===`);
        const doc = await db.collection(col).findOne({});
        if (doc) {
            console.log('Campos:', Object.keys(doc).join(', '));
            console.log('sessionId sample:', doc.sessionId);
            if (doc.messages?.length > 0) {
                console.log('mensaje[0] campos:', Object.keys(doc.messages[0]).join(', '));
            }
        } else console.log('VACIA o NO EXISTE');
    }

    // 5. Colecciones disponibles
    console.log('\n=== COLECCIONES EN BD ===');
    const cols = await db.listCollections().toArray();
    cols.forEach(c => console.log(' -', c.name));
}

main().catch(console.error).finally(() => client.close());
