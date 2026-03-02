/*
  Warnings:

  - You are about to drop the column `markedBy` on the `CompetitionAttendance` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `StaffProfile` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - Added the required column `staffRole` to the `StaffProfile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('PARTICIPANT', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPERADMIN', 'PR', 'GR', 'FOOD', 'EXCOM', 'COMPETITIONS');

-- DropIndex
DROP INDEX "User_role_idx";

-- AlterTable
ALTER TABLE "CompetitionAttendance" DROP COLUMN "markedBy",
ADD COLUMN     "markedByUserId" TEXT;

-- AlterTable
ALTER TABLE "StaffProfile" DROP COLUMN "role",
ADD COLUMN     "staffRole" "StaffRole" NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "type" "UserType" NOT NULL DEFAULT 'PARTICIPANT';

-- DropEnum
DROP TYPE "AppRole";

-- CreateIndex
CREATE INDEX "CompetitionAttendance_markedByUserId_idx" ON "CompetitionAttendance"("markedByUserId");

-- CreateIndex
CREATE INDEX "StaffProfile_staffRole_idx" ON "StaffProfile"("staffRole");

-- CreateIndex
CREATE INDEX "User_type_idx" ON "User"("type");

-- AddForeignKey
ALTER TABLE "CompetitionAttendance" ADD CONSTRAINT "CompetitionAttendance_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
