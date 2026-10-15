import { Money } from "./Money.js";
import { InsufficientFundsError, ValidationError } from "./errors.js";

export class Account {
    constructor(
        public readonly id: string,
        public holderName: string,
        public document: string,
        private _balance: Money = Money.zero(),
        public readonly createdAt: Date = new Date()
    ) {
        this.validate();
    }

    // Regra de negócio encapsulada na própria entidade
    private validate(): void {
        if (!this.holderName || this.holderName.trim() === '') {
            throw new ValidationError("O nome do titular não pode ser vazio.");
        }
        if (!this.document || this.document.length < 11) {
            throw new ValidationError("Documento (CPF/CNPJ) inválido.");
        }
        if (this._balance.isNegative()) {
            throw new ValidationError("O saldo inicial não pode ser negativo.");
        }
    }

    // Métodos de comportamento da conta
    public deposit(amount: Money): void {
        if (amount.isZero() || amount.isNegative()) {
            throw new ValidationError("O valor do depósito deve ser maior que zero.");
        }
        this._balance = this._balance.add(amount);
    }

    public withdraw(amount: Money): void {
        if (amount.isZero() || amount.isNegative()) {
            throw new ValidationError("O valor do saque deve ser maior que zero.");
        }
        if (this._balance.isLessThan(amount)) {
            throw new InsufficientFundsError("Saldo insuficiente para realizar o saque.");
        }
        this._balance = this._balance.subtract(amount);
    }

    // Getter para ler o saldo de forma segura (sem alterar diretamente)
    public get balance(): Money {
        return this._balance;
    }
}
