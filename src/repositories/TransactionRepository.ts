import { db, type Client } from "../prisma/db.js";
import { Money } from "../models/Money.js";
import { Transaction, type TransactionType } from "../models/Transaction.js";

/** Linha de `Transaction` como o Prisma 8 entrega (numeric e timestamptz vêm como string). */
interface RawTransaction {
    id: string;
    accountId: string;
    type: string;
    amount: string;
    description: string | null;
    createdAt: string;
}

function toDomain(raw: RawTransaction): Transaction {
    return new Transaction(
        raw.id,
        raw.accountId,
        raw.type as TransactionType,
        Money.fromDecimal(raw.amount),
        raw.description,
        new Date(raw.createdAt),
    );
}

export class TransactionRepository {
    /**
     * Salva uma nova transação no banco de dados.
     *
     * `client` permite participar da mesma transação do banco que a atualização
     * da conta — ou as duas escritas valem, ou nenhuma.
     */
    public async save(transaction: Transaction, client: Client = db): Promise<void> {
        await client.orm.public.Transaction.create({
            id: transaction.id,
            accountId: transaction.accountId,
            type: transaction.type,
            amount: transaction.amount.toDecimalString(),
            description: transaction.description,
            createdAt: transaction.createdAt.toISOString(),
        });
    }

    /**
     * Busca todas as transações de uma conta, ordenadas por data decrescente.
     */
    public async findByAccountId(accountId: string, client: Client = db): Promise<Transaction[]> {
        const rawTransactions = await client.orm.public.Transaction
            .where((t) => t.accountId.eq(accountId))
            .orderBy((t) => t.createdAt.desc())
            .all();

        return rawTransactions.map(toDomain);
    }
}
