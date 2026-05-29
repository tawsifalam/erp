export class ReservationCheckedInEvent {
  constructor(
    public readonly reservationId: string,
    public readonly roomId: string,
    public readonly branchId: string,
  ) {}
}
