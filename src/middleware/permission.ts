import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { getUserEffectiveActions } from '../utils/actions'

/**
 * Factory that returns middleware enforcing the caller has a specific action.
 * Must be placed AFTER `requireAuth` in the middleware chain.
 *
 * @param action  The SCREAMING_SNAKE action name (must match the Prisma `Action` enum).
 */
export function requireAction(action: string) {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.userId) {
            res.status(401).json({ success: false, message: 'Authentication required.' })
            return
        }

        const effectiveActions = await getUserEffectiveActions(req.userId)

        if (!effectiveActions.includes(action)) {
            res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action.',
            })
            return
        }

        next()
    }
}
