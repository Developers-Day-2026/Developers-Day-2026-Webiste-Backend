/*
  Warnings:

  - The values [VIEW_ALL_COMPETITIONS,EDIT_COMPETITION_TIME] on the enum `Action` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `venueId` on the `Competition` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cnic]` on the table `BrandAmbassador` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cnic` to the `BrandAmbassador` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Action_new" AS ENUM ('VIEW_REGISTRATION_DETAILS', 'EDIT_COMPETITION', 'VIEW_STALL_DETAILS', 'ADD_NEW_STALL', 'EDIT_STALL', 'DELETE_STALL', 'VIEW_ALL_COMPANIES', 'ADD_NEW_COMPANY', 'ASSIGN_BOOTH', 'EDIT_COMPANY', 'DELETE_COMPANY', 'CREATE_NEW_REGISTRATION', 'UPDATE_ATTENDANCE', 'VIEW_ALL_PORTAL_USERS', 'ASSIGN_ACTIONS_TO_USERS', 'CREATE_ACCOUNTS', 'UPDATE_PARTICIPANT_RECORD', 'VIEW_AMBASSADOR_DASHBOARD', 'MANAGE_AMBASSADORS');
ALTER TABLE "UserAction" ALTER COLUMN "action" TYPE "Action_new" USING ("action"::text::"Action_new");
ALTER TYPE "Action" RENAME TO "Action_old";
ALTER TYPE "Action_new" RENAME TO "Action";
DROP TYPE "Action_old";
COMMIT;

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'AMBASSADOR_MANAGEMENT';

-- DropForeignKey
ALTER TABLE "Competition" DROP CONSTRAINT "Competition_venueId_fkey";

-- AlterTable
ALTER TABLE "BrandAmbassador" ADD COLUMN     "cnic" VARCHAR(15) NOT NULL;

-- AlterTable
ALTER TABLE "Competition" DROP COLUMN "venueId";

-- CreateTable
CREATE TABLE "_CompetitionToVenue" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CompetitionToVenue_AB_unique" ON "_CompetitionToVenue"("A", "B");

-- CreateIndex
CREATE INDEX "_CompetitionToVenue_B_index" ON "_CompetitionToVenue"("B");

-- CreateIndex
CREATE UNIQUE INDEX "BrandAmbassador_cnic_key" ON "BrandAmbassador"("cnic");

-- CreateIndex
CREATE INDEX "BrandAmbassador_cnic_idx" ON "BrandAmbassador"("cnic");

-- AddForeignKey
ALTER TABLE "_CompetitionToVenue" ADD CONSTRAINT "_CompetitionToVenue_A_fkey" FOREIGN KEY ("A") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompetitionToVenue" ADD CONSTRAINT "_CompetitionToVenue_B_fkey" FOREIGN KEY ("B") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
