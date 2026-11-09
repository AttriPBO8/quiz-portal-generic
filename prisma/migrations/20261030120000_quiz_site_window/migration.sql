-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "quizSiteOpensAt" TIMESTAMP(3),
    "quizSiteClosesAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

