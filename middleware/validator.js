export const validate = (schema) => async (req, res, next) => {
    try {
        // Validamos el query, body y params según el schema que provenga de la ruta
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        return next();
    } catch (error) {
        // ZodError estructurado y seguro
        if (error.name === 'ZodError') {
            const formattedErrors = error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            }));

            // Rechazamos inmediatamente antes de alcanzar el Controller o DB/n8n
            return res.status(400).json({
                error: 'validation_error',
                message: 'Parámetros inválidos o incompletos enviados en la petición',
                details: formattedErrors,
            });
        }
        
        return res.status(500).json({ error: 'Fallo interno en validación de esquema' });
    }
};
