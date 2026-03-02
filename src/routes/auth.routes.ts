import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { registerStaff } from '../controllers/auth.controller'

const router = Router()

const registerSchema = z
    .object({
        fullName: z.string().min(1, 'Full name is required').max(100),
        email: z
            .string()
            .regex(
                /^[kilp](20|21|22|23|24|25)\d{4}@nu\.edu\.pk$/,
                'Must be a valid NU email e.g. k230691@nu.edu.pk'
            ),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
        role: z.enum(['excom', 'pr', 'gr', 'food', 'cs', 'superadmin'], {
            error: 'Invalid role selected.',
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match.',
        path: ['confirmPassword'],
    })

// POST /auth/register
router.post('/register', validate(registerSchema), registerStaff)

export default router