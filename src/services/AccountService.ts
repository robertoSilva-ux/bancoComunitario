import { Account } from "../models/Account.js";
import { Transaction } from "../models/Transaction.js";
import { Money } from "../models/Money.js";
import { ConflictError, NotFoundError } from "../models/errors.js";
import { AccountRepository } from "../repositories/AccountRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";
import { db } from "../prisma/db.js";
import { randomUUID } from "node:crypto"; // Para gerar IDs únicos universalmente

// Interface que define o formato dos dados que chegam para criar a conta (DTO)
// O dinheiro já chega como objeto de valor: a conversão da entrada é da fronteira HTTP.
export interface CreateAccountDTO {
    holderName: string;
    document: string;
    initialBalance?: Money;
}

export class AccountService {
    // Injetamos os repositórios no construtor para desacoplar o código
    constructor(
        private accountRepository: AccountRepository,
        private transactionRepository: TransactionRepository
    ) { }

    /**
     * Abre a conta e, havendo saldo inicial, grava o lançamento que o justifica.
     *
     * Conta e lançamento ficam numa única transação do banco: sem isso o extrato
     * não fechava com o saldo (o saldo inicial não tinha origem registrada) e uma
     * falha no meio deixava a conta gravada sem o histórico correspondente.
     */
    public async createAccount(data: CreateAccountDTO): Promise<Account> {
        const initialBalance = data.initialBalance ?? Money.zero();

        return db.transaction(async (tx) => {
            // 1. Regra de negócio: Verificar se já existe uma conta com o mesmo documento (CPF/CNPJ)
            const existingAccount = await this.accountRepository.findByDocument(data.document, tx);
            if (existingAccount) {
                throw new ConflictError("Já existe uma conta cadastrada com este documento.");
            }

            // 2. Instanciar o Objeto de Domínio Rico (as validações da classe Account rodam aqui)
            const newAccount = new Account(
                randomUUID(),
                data.holderName,
                data.document,
                initialBalance,
                new Date()
            );

            // 3. Salvar a conta; uma corrida com outra requisição de mesmo documento
            //    estoura a constraint única e o repositório traduz em ConflictError.
            await this.accountRepository.save(newAccount, tx);

            // 4. Registrar a origem do saldo inicial, para o extrato reconciliar
            if (!initialBalance.isZero()) {
                const openingTransaction = new Transaction(
                    randomUUID(),
                    newAccount.id,
                    "deposit",
                    initialBalance,
                    "Saldo inicial",
                    new Date()
                );
                await this.transactionRepository.save(openingTransaction, tx);
            }

            return newAccount;
        });
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
     *
     * A leitura com trava, a alteração do saldo e a gravação do lançamento rodam
     * dentro de uma transação: qualquer falha (inclusive a validação do domínio)
     * desfaz tudo, e duas operações simultâneas na mesma conta são serializadas.
     */
    public async deposit(
        accountId: string,
        amount: Money,
        description: string | null = null,
    ): Promise<{ transaction: Transaction; balance: Money }> {
        return db.transaction(async (tx) => {
            const account = await this.accountRepository.findByIdForUpdate(accountId, tx);
            if (!account) {
                throw new NotFoundError("Conta não encontrada.");
            }

            account.deposit(amount);
            await this.accountRepository.save(account, tx);

            const transaction = new Transaction(
                randomUUID(),
                accountId,
                "deposit",
                amount,
                description,
                new Date(),
            );
            await this.transactionRepository.save(transaction, tx);

            return { transaction, balance: account.balance };
        });
    }

    /**
     * Realiza um saque de uma conta.
     */
    public async withdraw(
        accountId: string,
        amount: Money,
        description: string | null = null,
    ): Promise<{ transaction: Transaction; balance: Money }> {
        return db.transaction(async (tx) => {
            const account = await this.accountRepository.findByIdForUpdate(accountId, tx);
            if (!account) {
                throw new NotFoundError("Conta não encontrada.");
            }

            account.withdraw(amount);
            await this.accountRepository.save(account, tx);

            const transaction = new Transaction(
                randomUUID(),
                accountId,
                "withdrawal",
                amount,
                description,
                new Date(),
            );
            await this.transactionRepository.save(transaction, tx);

            return { transaction, balance: account.balance };
        });
    }

    /**
     * Retorna o extrato de uma conta (saldo + transações).
     */
    public async getStatement(
        accountId: string,
    ): Promise<{ holderName: string; balance: Money; transactions: Transaction[] }> {
        const account = await this.accountRepository.findById(accountId);
        if (!account) {
            throw new NotFoundError("Conta não encontrada.");
        }

        const transactions = await this.transactionRepository.findByAccountId(accountId);

        return {
            holderName: account.holderName,
            balance: account.balance,
            transactions,
        };
    }
}
