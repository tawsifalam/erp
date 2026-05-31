import type { InclusionConsumptionSource, InclusionType } from "./enums";

export interface InclusionRecipeLineDto {
  inventoryItemId: string;
  quantity: number;
}

export interface UpsertInclusionRecipeDto {
  id?: string;
  name: string;
  inclusionType: InclusionType;
  lines: InclusionRecipeLineDto[];
}

export interface InclusionPackageRuleDto {
  id?: string;
  inclusionType: InclusionType;
  inclusionRecipeId: string;
  quantityPerGuestPerNight?: number | null;
  quantityPerGuestPerStay?: number | null;
  autoIssueOnCheckIn?: boolean;
  sortOrder?: number;
}

export interface CreateInclusionPackageDto {
  name: string;
  isDefault?: boolean;
  isActive?: boolean;
  rules?: InclusionPackageRuleDto[];
}

export interface UpdateInclusionPackageDto {
  name?: string;
  isDefault?: boolean;
  isActive?: boolean;
  rules?: InclusionPackageRuleDto[];
}

export interface ConsumeInclusionDto {
  inclusionType: InclusionType;
  inclusionRecipeId: string;
  quantity: number;
}

export interface ReservationAllowanceView {
  id: string;
  inclusionType: InclusionType;
  inclusionRecipeId: string;
  recipeName: string;
  entitledQty: number;
  consumedQty: number;
  remainingQty: number;
  unitLabel: string;
}

export interface InclusionConsumptionView {
  id: string;
  quantity: number;
  source: InclusionConsumptionSource;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
  recipeName: string;
  inclusionType: InclusionType;
}
