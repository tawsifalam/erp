export type MenuItem = {
  id: string;
  name: string;
  price: string;
  isActive?: boolean;
  isGuestInclusionMeal?: boolean;
  categoryId?: string;
};

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder?: number;
  items: MenuItem[];
};

export type OrderLine = {
  id: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  menuItem: { name: string; id?: string };
};

export type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  paidAmount?: string;
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  reservationId?: string | null;
  lines: OrderLine[];
};

export type CartItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};
