import mongoose from 'mongoose';

// Maps the 'users' collection in the Centralizado (Spectrum) database
const LeadSchema = new mongoose.Schema({
    manychat_id: String,
    page_id: String,
    proyecto: String,
    input_channel: String,
    nombre: String,
    correo: String,
    telefono: String,
    has_reservation: Boolean,
    datos_completos: Boolean,
    first_interaction: mongoose.Schema.Types.Mixed,
    last_interaction: mongoose.Schema.Types.Mixed,
    last_message: String,
    last_update: mongoose.Schema.Types.Mixed,
    tag_medio: String,
    utm_source_crm: String,
    conversation_ressume: mongoose.Schema.Types.Mixed,
    conversation_analysis: mongoose.Schema.Types.Mixed,
    asesoria: Boolean,
    language: String,
    consulta_pendiente: mongoose.Schema.Types.Mixed,
    CRM_Data: mongoose.Schema.Types.Mixed,
}, { collection: 'users', timestamps: false, strict: false });

export default LeadSchema;
