import mongoose from 'mongoose';
import FacturaSchema from '../models/Factura.js';

const connections = {};

/**
 * Gets or creates a connection to a specific MongoDB instance
 * @param {string} mongoUri - The connection string
 * @returns {Promise<mongoose.Connection>}
 */
export const getConnection = async (mongoUri) => {
    if (connections[mongoUri]) {
        return connections[mongoUri];
    }

    try {
        // MongoDB Driver v4+ ya no acepta useNewUrlParser ni useUnifiedTopology
        // (son el comportamiento por defecto y pasar las opciones lanza MongoParseError)
        const conn = await mongoose.createConnection(mongoUri).asPromise();

        connections[mongoUri] = conn;
        
        // Log successful connection
        console.log(`Successfully connected to dynamic database: ${mongoUri.split('@')[1] || 'hidden-uri'}`);

        return conn;
    } catch (error) {
        console.error(`Error connecting to dynamic database: ${error.message}`);
        throw error;
    }
};

/**
 * Returns a model bound to a specific connection
 * @param {string} mongoUri - The connection string
 * @param {string} modelName - The name of the model
 * @param {mongoose.Schema} schema - The schema
 * @returns {Promise<mongoose.Model>}
 */
export const getDynamicModel = async (mongoUri, modelName, schema) => {
    const conn = await getConnection(mongoUri);
    // Verificar si el modelo ya está registrado en esta conexión específica
    if (conn.models[modelName]) {
        return conn.models[modelName];
    }
    return conn.model(modelName, schema);
};
