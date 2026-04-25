-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RegistrationStatus" ADD VALUE 'WITHDRAWN';
ALTER TYPE "RegistrationStatus" ADD VALUE 'DISSOLVED';
ALTER TYPE "RegistrationStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "isLaptopRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SignupOtpLink" ALTER COLUMN "updatedAt" DROP DEFAULT;
