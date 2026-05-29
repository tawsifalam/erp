export interface JournalLineInput {
    accountId: string;
    debit: number;
    credit: number;
}
export interface CreateJournalEntryDto {
    lines: JournalLineInput[];
    referenceType?: string;
    referenceId?: string;
    description?: string;
}
export interface CreateAccountDto {
    code: string;
    name: string;
    type: string;
}
