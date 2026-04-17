import express from 'express';
import * as authController from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import { loginSchema } from './schemas/auth.schema.js';

const router = express.Router();

router.post('/login', validate(loginSchema), authController.login);
router.get('/me', auth, authController.me);

export default router;
