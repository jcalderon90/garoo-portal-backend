import { z } from 'zod';

export const loginSchema = z.object({
    body: z.object({
        email: z.string({
            required_error: "Email es requerido para iniciar sesión",
        })
        .email("Debe ser un email válido")
        .trim()
        .toLowerCase(),

        password: z.string({
            required_error: "La contraseña es requerida",
        })
        .min(1, "La contraseña no puede estar vacía"),
    }),
});
