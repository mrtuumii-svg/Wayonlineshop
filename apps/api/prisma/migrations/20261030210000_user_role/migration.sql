-- Хэрэглэгчийн эрх. Одоо байгаа бүх хэрэглэгч DEFAULT-аар 'user' болно — өгөгдөл устахгүй.
-- Анхны админыг `npm run make-admin -w @way/api -- <имэйл>`-ээр өгнө.
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'user';
