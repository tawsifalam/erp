export class InventoryConsumedEvent {
  constructor(
    public readonly orderId: string,
    public readonly organizationId: string,
    public readonly cogsAmount: number,
  ) {}
}
