import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { requireAuth } from '../middleware/auth'
import { requireAction } from '../middleware/permission'
import {
    listStaffUsers,
    getUserActions,
    updateUserActions,
} from '../controllers/user.controller'

const router = Router()

// All routes require authentication

// GET /users — list staff users (needs VIEW_ALL_PORTAL_USERS)
router.get('/', requireAuth, requireAction('VIEW_ALL_PORTAL_USERS'), listStaffUsers)

// GET /users/:id/actions — view a user's action breakdown (needs ASSIGN_ACTIONS_TO_USERS)
router.get('/:id/actions', requireAuth, requireAction('ASSIGN_ACTIONS_TO_USERS'), getUserActions)

// PUT /users/:id/actions — update a user's extra actions (needs ASSIGN_ACTIONS_TO_USERS)
const updateActionsSchema = z.object({
    actions: z.array(z.string().min(1)).default([]),
})

router.put(
    '/:id/actions',
    requireAuth,
    requireAction('ASSIGN_ACTIONS_TO_USERS'),
    validate(updateActionsSchema),
    updateUserActions
)

export default router
