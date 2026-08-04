-- CreateTable
CREATE TABLE "manual_certificates" (
    "id" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "studentNameKa" TEXT NOT NULL,
    "studentNameEn" TEXT,
    "studentEmail" TEXT NOT NULL,
    "courseTitleKa" TEXT NOT NULL,
    "courseTitleEn" TEXT,
    "instructorName" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "issuedByAdminId" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manual_certificates_verificationCode_key" ON "manual_certificates"("verificationCode");
