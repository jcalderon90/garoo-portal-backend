import mongoose from 'mongoose';

const MUNDO_VERDE_URI = "mongodb+srv://jorgecalderon:oFeBnppKqA3HfNED@cluster0.vtkafrd.mongodb.net/Garoo?retryWrites=true&w=majority&appName=Cluster0";

async function test() {
    try {
        console.log('Testing connection to Mundo Verde DB...');
        await mongoose.connect(MUNDO_VERDE_URI);
        console.log('✅ Connected!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Failed:', e.message);
        process.exit(1);
    }
}

test();
