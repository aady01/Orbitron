/*
  Warnings:

  - You are about to drop the column `tpye` on the `Node` table. All the data in the column will be lost.
  - Added the required column `type` to the `Node` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Node" DROP COLUMN "tpye",
ADD COLUMN     "type" "NodeType" NOT NULL;
