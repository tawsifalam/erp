import type { OrderStatus, PaymentStatus } from "./enums";
export interface CreateMenuCategoryDto {
    name: string;
    sortOrder?: number;
}
export interface CreateMenuItemDto {
    categoryId: string;
    name: string;
    price: number;
    isActive?: boolean;
}
export interface CreateOrderLineDto {
    menuItemId: string;
    quantity: number;
    unitPrice: number;
}
export interface CreateOrderDto {
    lines: CreateOrderLineDto[];
    tableNumber?: string;
    notes?: string;
}
export interface UpdateOrderStatusDto {
    status: OrderStatus;
    paymentStatus?: PaymentStatus;
    paidAmount?: number;
}
