import { Injectable } from "@nestjs/common";
import { AccountingService } from "./accounting.service";
import { roundMoney } from "@erp/utils";

@Injectable()
export class AccountingListenersService {
  constructor(private readonly accounting: AccountingService) {}

  async postFoodSale(
    organizationId: string,
    orderId: string,
    totalAmount: number,
    paidAmount: number,
  ) {
    if (totalAmount <= 0) return;

    const revenue = await this.accounting.getAccountByCode(organizationId, "4100");
    if (!revenue) return;

    const paid = roundMoney(Math.min(paidAmount, totalAmount));
    const receivable = roundMoney(totalAmount - paid);
    const lines: { accountId: string; debit: number; credit: number }[] = [];

    if (paid > 0) {
      const cash = await this.accounting.getAccountByCode(organizationId, "1000");
      if (!cash) return;
      lines.push({ accountId: cash.id, debit: paid, credit: 0 });
    }

    if (receivable > 0) {
      const ar = await this.accounting.getAccountByCode(organizationId, "1300");
      if (!ar) return;
      lines.push({ accountId: ar.id, debit: receivable, credit: 0 });
    }

    lines.push({ accountId: revenue.id, debit: 0, credit: totalAmount });

    return this.accounting.createJournalEntry({
      organizationId,
      referenceType: "Order",
      referenceId: orderId,
      description: paid < totalAmount ? "F&B sale (partial payment)" : "F&B sale",
      lines,
    });
  }

  async postCogs(organizationId: string, orderId: string, amount: number) {
    if (amount <= 0) return;
    const cogs = await this.accounting.getAccountByCode(organizationId, "5000");
    const inventory = await this.accounting.getAccountByCode(organizationId, "1200");
    if (!cogs || !inventory) return;

    return this.accounting.createJournalEntry({
      organizationId,
      referenceType: "Order",
      referenceId: orderId,
      description: "Inventory consumption",
      lines: [
        { accountId: cogs.id, debit: amount, credit: 0 },
        { accountId: inventory.id, debit: 0, credit: amount },
      ],
    });
  }

  async postRoomPayment(
    organizationId: string,
    reservationId: string,
    amount: number,
  ) {
    if (amount <= 0) return;
    const cash = await this.accounting.getAccountByCode(organizationId, "1000");
    const revenue = await this.accounting.getAccountByCode(organizationId, "4000");
    if (!cash || !revenue) return;

    return this.accounting.createJournalEntry({
      organizationId,
      referenceType: "Reservation",
      referenceId: reservationId,
      description: "Room payment received",
      lines: [
        { accountId: cash.id, debit: amount, credit: 0 },
        { accountId: revenue.id, debit: 0, credit: amount },
      ],
    });
  }

  async postRoomReceivable(
    organizationId: string,
    reservationId: string,
    amount: number,
  ) {
    if (amount <= 0) return;
    const ar = await this.accounting.getAccountByCode(organizationId, "1300");
    const revenue = await this.accounting.getAccountByCode(organizationId, "4000");
    if (!ar || !revenue) return;

    return this.accounting.createJournalEntry({
      organizationId,
      referenceType: "Reservation",
      referenceId: reservationId,
      description: "Room revenue — balance on check-out",
      lines: [
        { accountId: ar.id, debit: amount, credit: 0 },
        { accountId: revenue.id, debit: 0, credit: amount },
      ],
    });
  }
}
