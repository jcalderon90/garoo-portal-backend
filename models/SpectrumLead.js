import mongoose from 'mongoose';

const SpectrumLeadSchema = new mongoose.Schema({
    manychat_id: String,
    nombre: String,
    apellidos: String,
    telefono: String,
    correo: String,
    input_channel: String,
    has_reservation: Boolean,
    first_interaction: mongoose.Schema.Types.Mixed,
    last_interaction: mongoose.Schema.Types.Mixed,
    last_message: String,
    proyecto: String,
    conversation_ressume: mongoose.Schema.Types.Mixed,
    fase_2: Boolean,
}, { strict: false, collection: 'users' });

export default SpectrumLeadSchema;
