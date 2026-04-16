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
    portal_user: String // Nombre del usuario que envió la factura
}, { collection: 'factura', timestamps: true });

export default FacturaSchema;
