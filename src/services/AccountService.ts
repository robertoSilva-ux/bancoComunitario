import { Account } from "../models/Account.js";
import { Transaction } from "../models/Transaction.js";
import { AccountRepository } from "../repositories/AccountRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";
import { randomUUID } from "node:crypto"; // Para gerar IDs únicos universalmente

// Interface que define o formato dos dados que chegam para criar a conta (DTO)
export interface CreateAccountDTO {
    holderName: string;
    document: string;
    initialBalance?: number;
}

export class AccountService {
    // Injetamos os repositórios no construtor para desacoplar o código
    constructor(
        private accountRepository: AccountRepository,
        private transactionRepository: TransactionRepository
    ) { }

    public async createAccount(data: CreateAccountDTO): Promise<Account> {
        // 1. Regra de negócio: Verificar se já existe uma conta com o mesmo documento (CPF/CNPJ)
        const existingAccount = await this.accountRepository.findByDocument(data.document);
        if (existingAccount) {
            throw new Error("Já existe uma conta cadastrada com este documento.");
        }

        // 2. Gerar um ID único para a nova conta
        const accountId = randomUUID();

        // 3. Instanciar o nosso Objeto de Domínio Rico (aqui as validações da classe Account rodam)
        const newAccount = new Account(
            accountId,
            data.holderName,
            data.document,
            data.initialBalance || 0, // Se não passar saldo, começa com 0
            new Date()
        );

        // 4. Salvar utilizando o repositório
        await this.accountRepository.save(newAccount);

        // 5. Retornar a conta criada
        return newAccount;
    }
    /**
     * Retorna todas as contas registradas no sistema.
     */
    public async getAllAccounts(): Promise<Account[]> {
        const accounts = await this.accountRepository.findAll();
        return accounts;
    }

    /**
     * Realiza um depósito em uma conta.
     */
    public async deposit(
        accountId: string,
        amount: number,
        description?: string,
    ): Promise<{ transaction: Transaction; balance: number }> {
        const account = await this.accountRepository.findById(accountId);
        if (!account) {
            throw new Error("Conta não encontrada.");
        }

        account.deposit(amount);
        await this.accountRepository.save(account);

        const transaction = new Transaction(
            randomUUID(),
            accountId,
            "deposit",
            amount,
            description || null,
            new Date(),
        );
        await this.transactionRepository.save(transaction);

        return { transaction, balance: account.balance };
    }

    /**
     * Realiza um saque de uma conta.
     */
    public async withdraw(
        accountId: string,
        amount: number,
        description?: string,
    ): Promise<{ transaction: Transaction; balance: number }> {
        const account = await this.accountRepository.findById(accountId);
        if (!account) {
            throw new Error("Conta não encontrada.");
        }

        account.withdraw(amount);
        await this.accountRepository.save(account);

        const transaction = new Transaction(
            randomUUID(),
            accountId,
            "withdrawal",
            amount,
            description || null,
            new Date(),
        );
        await this.transactionRepository.save(transaction);

        return { transaction, balance: account.balance };
    }

    /**
     * Retorna o extrato de uma conta (saldo + transações).
     */
    public async getStatement(
        accountId: string,
    ): Promise<{ holderName: string; balance: number; transactions: Transaction[] }> {
        const account = await this.accountRepository.findById(accountId);
        if (!account) {
            throw new Error("Conta não encontrada.");
        }

        const transactions = await this.transactionRepository.findByAccountId(accountId);

        return {
            holderName: account.holderName,
            balance: account.balance,
            transactions,
        };
    }
}