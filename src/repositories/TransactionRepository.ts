import { db } from "../prisma/db.js";
import { Transaction } from "../models/Transaction.js";

export class TransactionRepository {
    /**
     * Salva uma nova transação no banco de dados.
     */
    public async save(transaction: Transaction): Promise<void> {
        await db.orm.public.Transaction.create({
            id: transaction.id,
            accountId: transaction.accountId,
            type: transaction.type,
            amount: transaction.amount.toString(),
            description: transaction.description,
            createdAt: transaction.createdAt.toISOString(),
        });
    }

    /**
     * Busca todas as transações de uma conta, ordenadas por data decrescente.
     */
    public async findByAccountId(accountId: string): Promise<Transaction[]> {
        const rawTransactions = await db.orm.public.Transaction
            .where((t) => t.accountId.eq(accountId))
            .orderBy((t) => t.createdAt.desc())
            .all();

        return rawTransactions.map(
            (raw) =>
                new Transaction(
                    raw.id,
                    raw.accountId,
                    raw.type as "deposit" | "withdrawal",
                    Number(raw.amount),
                    raw.description,
                    new Date(raw.createdAt),
                )
        );
    }
}