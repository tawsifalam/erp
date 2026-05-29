export class ReservationPaymentEvent {
  constructor(
    public readonly organizationId: string,
    public readonly reservationId: string,
    public readonly deltaPaid: number,
  ) {}
}
