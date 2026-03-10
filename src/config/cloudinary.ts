import { v2 as cloudinary } from 'cloudinary'
import dotenv from 'dotenv'

dotenv.config()

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey    = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret)

if (!isCloudinaryConfigured) {
    console.warn(
        '[cloudinary]: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET is missing from environment. ' +
            'Payment screenshot uploads are disabled until these are configured.'
    )
} else {
    cloudinary.config({
        cloud_name: cloudName,
        api_key:    apiKey,
        api_secret: apiSecret,
        secure:     true,
    })
}

export { cloudinary, isCloudinaryConfigured }

