import { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabase'

export interface AuthRequest extends Request {
    userId?: string
    userRole?: string
}

export async function requireAuth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    const authHeader = req.headers.authorization ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!token) {
        res.status(401).json({ success: false, message: 'Authentication required.' })
        return
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !data.user) {
        res.status(401).json({ success: false, message: 'Invalid or expired token.' })
        return
    }

    req.userId = data.user.id
    req.userRole =
        ((data.user.app_metadata?.role as string) ?? '').toUpperCase() || undefined

    next()
}
