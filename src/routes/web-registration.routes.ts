import { Router } from 'express'
import { createPublicRegistration } from '../controllers/webRegistration.controller'
import { parsePaymentScreenshot, uploadPaymentProof } from '../middleware/uploadPaymentProof'

const router = Router()

router.post(
    '/',
    parsePaymentScreenshot,
    uploadPaymentProof,
    createPublicRegistration
)

export default router

