import { prisma } from '../config/db'

// ─── All action IDs ────────────────────

export const ALL_ACTIONS = [
    'VIEW_REGISTRATION_DETAILS',
    'EDIT_COMPETITION',
    'VIEW_STALL_DETAILS',
    'ADD_NEW_STALL',
    'EDIT_STALL',
    'DELETE_STALL',
    'VIEW_ALL_COMPANIES',
    'ADD_NEW_COMPANY',
    'ASSIGN_BOOTH',
    'EDIT_COMPANY',
    'DELETE_COMPANY',
    'CREATE_NEW_REGISTRATION',
    'UPDATE_ATTENDANCE',
    'VIEW_ALL_PORTAL_USERS',
    'ASSIGN_ACTIONS_TO_USERS',
    'CREATE_ACCOUNTS',
    'UPDATE_PARTICIPANT_RECORD',
    'VIEW_AMBASSADOR_DASHBOARD',
    'MANAGE_AMBASSADORS',
] as const

export type ActionEnum = (typeof ALL_ACTIONS)[number]

// ─── Default actions per StaffRole ───────────────────────────────────────────

export const ROLE_DEFAULT_ACTIONS: Record<string, ActionEnum[]> = {
    COMPETITIONS: [
        'VIEW_REGISTRATION_DETAILS',
        'EDIT_COMPETITION',
    ],
    FOOD: [
        'VIEW_STALL_DETAILS',
        'ADD_NEW_STALL',
        'EDIT_STALL',
        'DELETE_STALL',
    ],
    GR: [
        'VIEW_ALL_COMPANIES',
        'ADD_NEW_COMPANY',
        'ASSIGN_BOOTH',
        'EDIT_COMPANY',
        'DELETE_COMPANY',
    ],
    PR: [
        'VIEW_REGISTRATION_DETAILS',
        'CREATE_NEW_REGISTRATION',
        'UPDATE_ATTENDANCE',
    ],
    EXCOM: [
        'VIEW_ALL_PORTAL_USERS',
        'VIEW_REGISTRATION_DETAILS',
    ],
    AMBASSADOR_MANAGEMENT: [
        'VIEW_AMBASSADOR_DASHBOARD',
        'MANAGE_AMBASSADORS',
    ],
    SUPERADMIN: [...ALL_ACTIONS],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function actionToKebab(action: string): string {
    return action.toLowerCase().replace(/_/g, '-')
}

export function kebabToAction(kebab: string): string {
    return kebab.toUpperCase().replace(/-/g, '_')
}

export function actionsToKebab(actions: string[]): string[] {
    return actions.map(actionToKebab)
}

// ─── In-memory permission cache ──────────────────────────────────────────────
// Avoids repeated Prisma lookups for every request that goes through
// requireAction.

interface CachedActions {
    actions: string[]
    canonicalUserId: string
    cachedAt: number
}

function readPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name]
    if (!raw) return fallback
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const actionsCache = new Map<string, CachedActions>()
const ACTIONS_CACHE_TTL_MS = readPositiveIntEnv('ACTIONS_CACHE_TTL_MS', 5 * 60 * 1000)

function buildActionsCacheKey(authUserId: string, authUserEmail?: string): string {
    return `${authUserId}::${(authUserEmail ?? '').toLowerCase()}`
}

const permissionSelect = {
    id: true,
    email: true,
    staffProfile: {
        select: { staffRole: true },
    },
    grantedActions: {
        select: { action: true },
    },
} as const

/**
 * Invalidate the cached actions for a specific user.
 * Call this after a super-admin grants / revokes actions.
 */
export function invalidateUserActionsCache(userId: string): void {
    for (const [cacheKey, cacheEntry] of actionsCache) {
        if (cacheEntry.canonicalUserId === userId || cacheKey.startsWith(`${userId}::`)) {
            actionsCache.delete(cacheKey)
        }
    }
}

/**
 * Compute the effective set of actions for a user.
 * Effective = role-default actions ∪ extra actions granted by super-admin.
 * Results are cached in-memory for ACTIONS_CACHE_TTL_MS.
 */
export async function getUserEffectiveActions(authUserId: string, authUserEmail?: string): Promise<string[]> {
    const cacheKey = buildActionsCacheKey(authUserId, authUserEmail)
    const cached = actionsCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < ACTIONS_CACHE_TTL_MS) {
        return cached.actions
    }

    let user = await prisma.user.findUnique({
        where: { id: authUserId },
        select: permissionSelect,
    })

    // Some legacy accounts authenticate with a Supabase user ID that does not
    // match the Prisma user ID. Fall back to email so permissions still resolve.
    if ((!user || !user.staffProfile) && authUserEmail) {
        user = await prisma.user.findUnique({
            where: { email: authUserEmail },
            select: permissionSelect,
        })
    }

    if (!user || !user.staffProfile) {
        actionsCache.set(cacheKey, {
            actions: [],
            canonicalUserId: authUserId,
            cachedAt: Date.now(),
        })
        return []
    }

    const roleDefaults = ROLE_DEFAULT_ACTIONS[user.staffProfile.staffRole] ?? []

    const allActions = new Set<string>([
        ...roleDefaults,
        ...user.grantedActions.map((a: { action: string }) => a.action),
    ])

    const result = Array.from(allActions)
    const cacheEntry: CachedActions = {
        actions: result,
        canonicalUserId: user.id,
        cachedAt: Date.now(),
    }

    actionsCache.set(cacheKey, cacheEntry)

    const canonicalKey = buildActionsCacheKey(user.id, user.email)
    if (canonicalKey !== cacheKey) {
        actionsCache.set(canonicalKey, cacheEntry)
    }

    return result
}
