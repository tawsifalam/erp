export class ReservationCheckedOutEvent {
  constructor(
    public readonly organizationId: string,
    public readonly reservationId: string,
    public readonly unpaidAmount: number,
  ) {}
}
