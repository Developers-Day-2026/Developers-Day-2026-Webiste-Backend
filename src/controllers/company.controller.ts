import { Prisma } from '@prisma/client'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../config/db'

function toCompanyDto(company: {
    id: string
    userId: string
    name: string
    categoryId: string | null
    description: string | null
    website: string | null
    contactEmail: string | null
    contactPhone: string | null
    createdAt: Date
    updatedAt: Date
    category: { id: string; name: string } | null
    user: { email: string; isActive: boolean }
}) {
    return {
        id: company.id,
        userId: company.userId,
        name: company.name,
        categoryId: company.categoryId,
        categoryName: company.category?.name ?? null,
        description: company.description,
        website: company.website,
        contactEmail: company.contactEmail,
        contactPhone: company.contactPhone,
        userEmail: company.user.email,
        userIsActive: company.user.isActive,
        createdAt: company.createdAt.toISOString(),
        updatedAt: company.updatedAt.toISOString(),
    }
}

function toCategoryDto(category: {
    id: string
    name: string
    description: string | null
    createdAt: Date
    updatedAt: Date
}) {
    return {
        id: category.id,
        name: category.name,
        description: category.description,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
    }
}

// GET /companies/categories
export async function listCompanyCategories(req: AuthRequest, res: Response): Promise<void> {
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 20) || 20, 1), 100)
    const q = String(req.query.q ?? '').trim()

    const where: Prisma.CategoryWhereInput = {}

    if (q) {
        where.name = { contains: q, mode: 'insensitive' }
    }

    const [total, categories] = await Promise.all([
        prisma.category.count({ where }),
        prisma.category.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { name: 'asc' },
        }),
    ])

    const totalPages = Math.ceil(total / pageSize) || 1

    res.json({
        success: true,
        pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
        filters: {
            q: q || null,
        },
        data: categories.map(toCategoryDto),
    })
}

// GET /companies/categories/:id
export async function getCompanyCategoryById(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    const category = await prisma.category.findUnique({ where: { id } })
    if (!category) {
        res.status(404).json({ success: false, message: 'Category not found.' })
        return
    }

    res.json({ success: true, data: toCategoryDto(category) })
}

// POST /companies/categories
export async function createCompanyCategory(req: AuthRequest, res: Response): Promise<void> {
    const { name, description } = req.body as {
        name: string
        description?: string | null
    }

    try {
        const category = await prisma.category.create({
            data: {
                name,
                description: description ?? null,
            },
        })

        res.status(201).json({
            success: true,
            message: 'Category created successfully.',
            data: toCategoryDto(category),
        })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            res.status(409).json({ success: false, message: 'Category name already exists.' })
            return
        }

        console.error('[createCompanyCategory] error:', error)
        res.status(500).json({ success: false, message: 'Failed to create category.' })
    }
}

// PATCH /companies/categories/:id
export async function updateCompanyCategory(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)
    const { name, description } = req.body as {
        name?: string
        description?: string | null
    }

    try {
        const category = await prisma.category.update({
            where: { id },
            data: {
                name,
                description,
            },
        })

        res.json({
            success: true,
            message: 'Category updated successfully.',
            data: toCategoryDto(category),
        })
    } catch (error: any) {
        if (error?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Category not found.' })
            return
        }
        if (error?.code === 'P2002') {
            res.status(409).json({ success: false, message: 'Category name already exists.' })
            return
        }

        console.error('[updateCompanyCategory] error:', error)
        res.status(500).json({ success: false, message: 'Failed to update category.' })
    }
}

// DELETE /companies/categories/:id
export async function deleteCompanyCategory(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    try {
        await prisma.category.delete({ where: { id } })

        res.json({
            success: true,
            message: 'Category deleted successfully.',
        })
    } catch (error: any) {
        if (error?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Category not found.' })
            return
        }

        console.error('[deleteCompanyCategory] error:', error)
        res.status(500).json({ success: false, message: 'Failed to delete category.' })
    }
}

// GET /companies
export async function listCompanies(req: AuthRequest, res: Response): Promise<void> {
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 20) || 20, 1), 100)
    const q = String(req.query.q ?? '').trim()
    const userId = String(req.query.userId ?? '').trim()
    const categoryId = String(req.query.categoryId ?? '').trim()
    const userIsActiveRaw = String(req.query.userIsActive ?? '').trim().toLowerCase()

    const where: Prisma.CompanyWhereInput = {}
    const and: Prisma.CompanyWhereInput[] = []

    if (q) {
        and.push({
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { website: { contains: q, mode: 'insensitive' } },
                { contactEmail: { contains: q, mode: 'insensitive' } },
                { contactPhone: { contains: q, mode: 'insensitive' } },
                { user: { email: { contains: q, mode: 'insensitive' } } },
                { category: { name: { contains: q, mode: 'insensitive' } } },
            ],
        })
    }

    if (userId) {
        and.push({ userId })
    }

    if (categoryId) {
        and.push({ categoryId })
    }

    if (userIsActiveRaw) {
        if (userIsActiveRaw !== 'true' && userIsActiveRaw !== 'false') {
            res.status(400).json({ success: false, message: 'userIsActive must be true or false.' })
            return
        }
        and.push({ user: { isActive: userIsActiveRaw === 'true' } })
    }

    if (and.length > 0) {
        where.AND = and
    }

    const [total, companies] = await Promise.all([
        prisma.company.count({ where }),
        prisma.company.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                category: { select: { id: true, name: true } },
                user: { select: { email: true, isActive: true } },
            },
            orderBy: { name: 'asc' },
        }),
    ])

    const totalPages = Math.ceil(total / pageSize) || 1

    res.json({
        success: true,
        pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
        filters: {
            q: q || null,
            userId: userId || null,
            categoryId: categoryId || null,
            userIsActive: userIsActiveRaw || null,
        },
        data: companies.map(toCompanyDto),
    })
}

// GET /companies/:id
export async function getCompanyById(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    const company = await prisma.company.findUnique({
        where: { id },
        include: {
            category: { select: { id: true, name: true } },
            user: { select: { email: true, isActive: true } },
        },
    })

    if (!company) {
        res.status(404).json({ success: false, message: 'Company not found.' })
        return
    }

    res.json({ success: true, data: toCompanyDto(company) })
}

// POST /companies
export async function createCompany(req: AuthRequest, res: Response): Promise<void> {
    const {
        userId,
        name,
        categoryId,
        description,
        website,
        contactEmail,
        contactPhone,
    } = req.body as {
        userId: string
        name: string
        categoryId?: string | null
        description?: string | null
        website?: string | null
        contactEmail?: string | null
        contactPhone?: string | null
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
        res.status(404).json({ success: false, message: 'User not found.' })
        return
    }

    if (categoryId) {
        const category = await prisma.category.findUnique({ where: { id: categoryId } })
        if (!category) {
            res.status(400).json({ success: false, message: 'Invalid categoryId.' })
            return
        }
    }

    try {
        const company = await prisma.company.create({
            data: {
                userId,
                name,
                categoryId: categoryId ?? null,
                description: description ?? null,
                website: website ?? null,
                contactEmail: contactEmail ?? null,
                contactPhone: contactPhone ?? null,
            },
            include: {
                category: { select: { id: true, name: true } },
                user: { select: { email: true, isActive: true } },
            },
        })

        res.status(201).json({
            success: true,
            message: 'Company created successfully.',
            data: toCompanyDto(company),
        })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            res.status(409).json({ success: false, message: 'This user is already assigned to a company.' })
            return
        }

        console.error('[createCompany] error:', error)
        res.status(500).json({ success: false, message: 'Failed to create company.' })
    }
}

// PATCH /companies/:id
export async function updateCompany(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)
    const {
        name,
        categoryId,
        description,
        website,
        contactEmail,
        contactPhone,
    } = req.body as {
        name?: string
        categoryId?: string | null
        description?: string | null
        website?: string | null
        contactEmail?: string | null
        contactPhone?: string | null
    }

    if (categoryId) {
        const category = await prisma.category.findUnique({ where: { id: categoryId } })
        if (!category) {
            res.status(400).json({ success: false, message: 'Invalid categoryId.' })
            return
        }
    }

    try {
        const company = await prisma.company.update({
            where: { id },
            data: {
                name,
                categoryId,
                description,
                website,
                contactEmail,
                contactPhone,
            },
            include: {
                category: { select: { id: true, name: true } },
                user: { select: { email: true, isActive: true } },
            },
        })

        res.json({
            success: true,
            message: 'Company updated successfully.',
            data: toCompanyDto(company),
        })
    } catch (error: any) {
        if (error?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Company not found.' })
            return
        }

        console.error('[updateCompany] error:', error)
        res.status(500).json({ success: false, message: 'Failed to update company.' })
    }
}

// DELETE /companies/:id
export async function deleteCompany(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    try {
        await prisma.company.delete({ where: { id } })

        res.json({
            success: true,
            message: 'Company deleted successfully.',
        })
    } catch (error: any) {
        if (error?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Company not found.' })
            return
        }

        console.error('[deleteCompany] error:', error)
        res.status(500).json({ success: false, message: 'Failed to delete company.' })
    }
}
