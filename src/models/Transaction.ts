export class Transaction {
    constructor(
        public readonly id: string,
        public readonly accountId: string,
        public readonly type: "deposit" | "withdrawal",
        public readonly amount: number,
        public readonly description: string | null,
        public readonly createdAt: Date = new Date(),
    ) {
        this.validate();
    }

    private validate(): void {
        if (!this.accountId || this.accountId.trim() === "") {
            throw new Error("O ID da conta é obrigatório.");
        }
        if (this.amount <= 0) {
            throw new Error("O valor da transação deve ser maior que zero.");
        }
        if (this.type !== "deposit" && this.type !== "withdrawal") {
            throw new Error('O tipo de transação deve ser "deposit" ou "withdrawal".');
        }
    }
}