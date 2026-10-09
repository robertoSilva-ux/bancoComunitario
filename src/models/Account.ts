export class Account {
    constructor(
        public readonly id: string,
        public holderName: string,
        public document: string,
        private _balance: number = 0,
        public readonly createdAt: Date = new Date()
    ) {
        this.validate();
    }

    // Regra de negócio encapsulada na própria entidade
    private validate(): void {
        if (!this.holderName || this.holderName.trim() === '') {
            throw new Error("O nome do titular não pode ser vazio.");
        }
        if (!this.document || this.document.length < 11) {
            throw new Error("Documento (CPF/CNPJ) inválido.");
        }
        if (this._balance < 0) {
            throw new Error("O saldo inicial não pode ser negativo.");
        }
    }

    // Métodos de comportamento da conta
    public deposit(amount: number): void {
        if (amount <= 0) {
            throw new Error("O valor do depósito deve ser maior que zero.");
        }
        this._balance += amount;
    }

    public withdraw(amount: number): void {
        if (amount <= 0) {
            throw new Error("O valor do saque deve ser maior que zero.");
        }
        if (this._balance < amount) {
            throw new Error("Saldo insuficiente para realizar o saque.");
        }
        this._balance -= amount;
    }

    // Getter para ler o saldo de forma segura (sem alterar diretamente)
    public get balance(): number {
        return this._balance;
    }
}