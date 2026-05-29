import { Injectable } from "@nestjs/common";
import { AccountingService } from "./accounting.service";

@Injectable()
export class AccountingListenersService {
  constructor(private readonly accounting: AccountingService) {}

  async postFoodSale(organizationId: string, orderId: string, amount: number) {
    const cash = await this.accounting.getAccountByCode(organizationId, "1000");
    const revenue = await this.accounting.getAccountByCode(organizationId, "4100");
    if (!cash || !revenue) return;

    return this.accounting.createJournalEntry({
      organizationId,
      referenceType: "Order",
      referenceId: orderId,
      description: "F&B sale",
      lines: [
        { accountId: cash.id, debit: amount, credit: 0 },
        { accountId: revenue.id, debit: 0, credit: amount },
      ],
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
}
