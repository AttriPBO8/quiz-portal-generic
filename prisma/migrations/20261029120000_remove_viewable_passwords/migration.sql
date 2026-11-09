-- Admins can no longer view passwords: drop the encrypted copy, keep only the bcrypt hash.
ALTER TABLE "User" DROP COLUMN "passwordEncrypted";
