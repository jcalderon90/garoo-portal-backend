import mongoose from 'mongoose';

const FacturaSchema = new mongoose.Schema({
    emisor_nombre: String,
    emisor_nit: String,
    fecha_emision: String,
    serie: String,
    numero_dte: String,
    monto_total: Number,
    moneda: { type: String, default: 'Q' },
    files_url: {
        pdfLink: String,
        xmlLink: String
    },
    portal_user: mongoose.Schema.Types.Mixed // Puede ser un String (nombre) o un Object {nombre, correo, _id}
}, { collection: 'factura', timestamps: true });

export default FacturaSchema;
