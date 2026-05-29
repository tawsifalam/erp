-- Staff meals as recipes: define BOM per meal type, record meal count on consumption.

CREATE TABLE "StaffMealRecipe" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "StaffMealRecipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffMealRecipeLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "StaffMealRecipeLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffMealRecipe_branchId_name_key" ON "StaffMealRecipe"("branchId", "name");

ALTER TABLE "StaffMealRecipe" ADD CONSTRAINT "StaffMealRecipe_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffMealRecipeLine" ADD CONSTRAINT "StaffMealRecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "StaffMealRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffMealRecipeLine" ADD CONSTRAINT "StaffMealRecipeLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace single-item staff meal rows with recipe-based consumption.
DELETE FROM "StaffMeal";

ALTER TABLE "StaffMeal" DROP COLUMN "inventoryItemId";
ALTER TABLE "StaffMeal" DROP COLUMN "quantity";

ALTER TABLE "StaffMeal" ADD COLUMN "branchId" TEXT NOT NULL;
ALTER TABLE "StaffMeal" ADD COLUMN "staffMealRecipeId" TEXT NOT NULL;
ALTER TABLE "StaffMeal" ADD COLUMN "mealCount" INTEGER NOT NULL;
ALTER TABLE "StaffMeal" ADD COLUMN "unitCostPerMeal" DECIMAL(12,2) NOT NULL;

ALTER TABLE "StaffMeal" ADD CONSTRAINT "StaffMeal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffMeal" ADD CONSTRAINT "StaffMeal_staffMealRecipeId_fkey" FOREIGN KEY ("staffMealRecipeId") REFERENCES "StaffMealRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
