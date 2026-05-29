import type { MovementType } from "./enums";
export interface CreateInventoryItemDto {
    name: string;
    sku: string;
    unit: string;
    lowStockThreshold?: number;
}
export interface CreateMovementDto {
    itemId: string;
    movementType: MovementType;
    quantity: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
}
export interface CreateRecipeLineDto {
    inventoryItemId: string;
    quantity: number;
}
export interface CreateRecipeDto {
    menuItemId: string;
    lines: CreateRecipeLineDto[];
}
