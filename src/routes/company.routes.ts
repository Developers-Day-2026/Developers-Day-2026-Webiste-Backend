import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { requireAuth } from '../middleware/auth'
import { requireAction } from '../middleware/permission'
import {
    listCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany,
    listCompanyCategories,
    getCompanyCategoryById,
    createCompanyCategory,
    updateCompanyCategory,
    deleteCompanyCategory,
} from '../controllers/company.controller'

const router = Router()

const createCompanySchema = z.object({
    userId: z.string().uuid('userId must be a valid UUID'),
    name: z.string().min(1, 'name is required'),
    categoryId: z.string().uuid('categoryId must be a valid UUID').nullable().optional(),
    description: z.string().nullable().optional(),
    website: z.string().url('website must be a valid URL').nullable().optional(),
    contactEmail: z.string().email('contactEmail must be a valid email').nullable().optional(),
    contactPhone: z.string().nullable().optional(),
})

const createCategorySchema = z.object({
    name: z.string().min(1, 'name is required'),
    description: z.string().nullable().optional(),
})

const updateCategorySchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update.',
})

const updateCompanySchema = z.object({
    name: z.string().min(1).optional(),
    categoryId: z.string().uuid('categoryId must be a valid UUID').nullable().optional(),
    description: z.string().nullable().optional(),
    website: z.string().url('website must be a valid URL').nullable().optional(),
    contactEmail: z.string().email('contactEmail must be a valid email').nullable().optional(),
    contactPhone: z.string().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update.',
})

// GET /companies
router.get(
    '/',
    requireAuth,
    requireAction('VIEW_ALL_COMPANIES'),
    listCompanies
)

// GET /companies/:id
router.get(
    '/:id',
    requireAuth,
    requireAction('VIEW_ALL_COMPANIES'),
    getCompanyById
)

// POST /companies
router.post(
    '/',
    requireAuth,
    requireAction('ADD_NEW_COMPANY'),
    validate(createCompanySchema),
    createCompany
)

// PATCH /companies/:id
router.patch(
    '/:id',
    requireAuth,
    requireAction('EDIT_COMPANY'),
    validate(updateCompanySchema),
    updateCompany
)

// DELETE /companies/:id
router.delete(
    '/:id',
    requireAuth,
    requireAction('DELETE_COMPANY'),
    deleteCompany
)

// GET /companies/categories
router.get(
    '/categories',
    requireAuth,
    requireAction('VIEW_ALL_COMPANIES'),
    listCompanyCategories
)

// GET /companies/categories/:id
router.get(
    '/categories/:id',
    requireAuth,
    requireAction('VIEW_ALL_COMPANIES'),
    getCompanyCategoryById
)

// POST /companies/categories
router.post(
    '/categories',
    requireAuth,
    requireAction('ADD_NEW_COMPANY'),
    validate(createCategorySchema),
    createCompanyCategory
)

// PATCH /companies/categories/:id
router.patch(
    '/categories/:id',
    requireAuth,
    requireAction('EDIT_COMPANY'),
    validate(updateCategorySchema),
    updateCompanyCategory
)

// DELETE /companies/categories/:id
router.delete(
    '/categories/:id',
    requireAuth,
    requireAction('DELETE_COMPANY'),
    deleteCompanyCategory
)

export default router
