import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { requireAction } from '../middleware/permission'
import {
    listPrQueries,
    createPrQuery,
    updatePrQueryStatus,
    deletePrQuery,
} from '../controllers/prQuery.controller'

const router = Router()

// GET /pr-queries
router.get(
    '/',
    requireAuth,
    requireAction('MANAGE_PR_QUERIES'),
    listPrQueries
)

// POST /pr-queries
router.post(
    '/',
    requireAuth,
    requireAction('MANAGE_PR_QUERIES'),
    createPrQuery
)

// PATCH /pr-queries/:id/status
router.patch(
    '/:id/status',
    requireAuth,
    requireAction('MANAGE_PR_QUERIES'),
    updatePrQueryStatus
)

// DELETE /pr-queries/:id
router.delete(
    '/:id',
    requireAuth,
    requireAction('MANAGE_PR_QUERIES'),
    deletePrQuery
)

export default router
