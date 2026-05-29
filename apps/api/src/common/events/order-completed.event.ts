export class OrderCompletedEvent {
  constructor(
    public readonly orderId: string,
    public readonly branchId: string,
    public readonly organizationId: string,
    public readonly totalAmount: number,
  ) {}
}
