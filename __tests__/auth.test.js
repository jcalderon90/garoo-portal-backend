import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import authRoutes from '../routes/auth.js';

// Mock dependencies
vi.mock('../controllers/authController.js', () => ({
    login: async (req, res) => res.json({ token: 'mocked_token' }),
    me: async (req, res) => res.json({ email: 'test@garoo.ai' }),
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Validation Middleware', () => {
    it('debe rechazar el login si falta el email', async () => {
        const response = await request(app).post('/api/auth/login').send({
            password: 'secretpassword'
        });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('validation_error');
        // Validar que específicamente falló el email
        expect(response.body.details.some(err => err.field.includes('email'))).toBe(true);
    });

    it('debe rechazar el login si la contraseña está vacía', async () => {
        const response = await request(app).post('/api/auth/login').send({
            email: 'test@garoo.ai',
            password: ''
        });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('validation_error');
        expect(response.body.details.some(err => err.field.includes('password'))).toBe(true);
    });

    it('debe permitir la solicitud si los datos son correctos', async () => {
        const response = await request(app).post('/api/auth/login').send({
            email: 'test@garoo.ai',
            password: 'secretpassword'
        });
        
        expect(response.status).toBe(200);
        expect(response.body.token).toBe('mocked_token');
    });
});
