import { Money } from "./Money.js";
import { ValidationError } from "./errors.js";

export type TransactionType = "deposit" | "withdrawal";

export class Transaction {
    constructor(
        public readonly id: string,
        public readonly accountId: string,
        public readonly type: TransactionType,
        public readonly amount: Money,
        public readonly description: string | null,
        public readonly createdAt: Date = new Date(),
    ) {
        this.validate();
    }

    private validate(): void {
        if (!this.accountId || this.accountId.trim() === "") {
            throw new ValidationError("O ID da conta é obrigatório.");
        }
        if (this.amount.isZero() || this.amount.isNegative()) {
            throw new ValidationError("O valor da transação deve ser maior que zero.");
        }
        if (this.type !== "deposit" && this.type !== "withdrawal") {
            throw new ValidationError('O tipo de transação deve ser "deposit" ou "withdrawal".');
        }
    }
}
