import { prisma } from '../config/db'

// ─── All action IDs ────────────────────

export const ALL_ACTIONS = [
    'VIEW_REGISTRATION_DETAILS',
    'VIEW_ALL_COMPETITIONS',
    'EDIT_COMPETITION_TIME',
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
] as const

export type ActionEnum = (typeof ALL_ACTIONS)[number]

// ─── Default actions per StaffRole ───────────────────────────────────────────

export const ROLE_DEFAULT_ACTIONS: Record<string, ActionEnum[]> = {
    COMPETITIONS: [
        'VIEW_REGISTRATION_DETAILS',
        'VIEW_ALL_COMPETITIONS',
        'EDIT_COMPETITION_TIME',
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
        'VIEW_ALL_COMPETITIONS',
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

/**
 * Compute the effective set of actions for a user.
 * Effective = role-default actions ∪ extra actions granted by super-admin.
 */
export async function getUserEffectiveActions(userId: string): Promise<string[]> {
    const staffProfile = await prisma.staffProfile.findUnique({
        where: { id: userId },
        select: { staffRole: true },
    })

    if (!staffProfile) return []

    const roleDefaults = ROLE_DEFAULT_ACTIONS[staffProfile.staffRole] ?? []

    const extraActions = await prisma.userAction.findMany({
        where: { userId },
        select: { action: true },
    })

    const allActions = new Set<string>([
        ...roleDefaults,
        ...extraActions.map((a: any) => a.action),
    ])

    return Array.from(allActions)
}
