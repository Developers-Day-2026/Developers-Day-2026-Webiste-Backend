import { Router } from 'express'
import { RegistrationStatus } from '@prisma/client'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { requireAuth } from '../middleware/auth'
import { requireAction } from '../middleware/permission'
import {
    listStalls,
    getStallById,
    createStall,
    updateStall,
    deleteStall,
} from '../controllers/stall.controller'

const router = Router()

const registrationStatusSchema = z.nativeEnum(RegistrationStatus)

const createStallSchema = z.object({
    userId: z.string().uuid('userId must be a valid UUID'),
    stallName: z.string().min(1, 'stallName is required'),
    menuDetails: z.string().nullable().optional(),
    paymentStatus: registrationStatusSchema.optional(),
    stallLocation: z.string().nullable().optional(),
})

const updateStallSchema = z.object({
    stallName: z.string().min(1).optional(),
    menuDetails: z.string().nullable().optional(),
    paymentStatus: registrationStatusSchema.optional(),
    stallLocation: z.string().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update.',
})

// GET /stalls
router.get(
    '/',
    requireAuth,
    requireAction('VIEW_STALL_DETAILS'),
    listStalls
)

// GET /stalls/:id
router.get(
    '/:id',
    requireAuth,
    requireAction('VIEW_STALL_DETAILS'),
    getStallById
)

// POST /stalls
router.post(
    '/',
    requireAuth,
    requireAction('ADD_NEW_STALL'),
    validate(createStallSchema),
    createStall
)

// PATCH /stalls/:id
router.patch(
    '/:id',
    requireAuth,
    requireAction('EDIT_STALL'),
    validate(updateStallSchema),
    updateStall
)

// DELETE /stalls/:id
router.delete(
    '/:id',
    requireAuth,
    requireAction('DELETE_STALL'),
    deleteStall
)

export default router
