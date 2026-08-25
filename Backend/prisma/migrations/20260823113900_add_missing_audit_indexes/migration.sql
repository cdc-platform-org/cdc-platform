-- CreateIndex
CREATE INDEX "digital_products_status_category_idx" ON "digital_products"("status", "category");

-- CreateIndex
CREATE INDEX "gigs_postedById_idx" ON "gigs"("postedById");

-- CreateIndex
CREATE INDEX "gigs_assignedFreelancerId_status_idx" ON "gigs"("assignedFreelancerId", "status");

-- CreateIndex
CREATE INDEX "users_status_createdAt_idx" ON "users"("status", "createdAt");

-- CreateIndex
CREATE INDEX "vacancies_postedById_idx" ON "vacancies"("postedById");
