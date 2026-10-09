import { db } from "../prisma/db.js";
import { Account } from "../models/Account.js";

/**
 * Converte o valor decimal do Prisma (string) para número do modelo de domínio.
 * O Prisma 8 representa pg/numeric como branded string.
 */
function toNumber(value: string): number {
    return Number(value);
}

/**
 * Converte uma data do modelo de domínio para o formato string ISO
 * exigido pelo Prisma 8 (timestamptz-string).
 */
function toString(value: Date): string {
    return value.toISOString();
}

function toDate(value: string): Date {
    return new Date(value);
}

export class AccountRepository {
    /**
     * Salva uma nova conta ou atualiza uma existente no banco de dados.
     */
    public async save(account: Account): Promise<void> {
        await db.orm.public.Account.upsert({
            create: {
                id: account.id,
                holderName: account.holderName,
                document: account.document,
                balance: account.balance.toString(),
                createdAt: toString(account.createdAt),
            },
            update: {
                holderName: account.holderName,
                balance: account.balance.toString(),
            },
        });
    }

    /**
     * Busca uma conta pelo ID.
     */
    public async findById(id: string): Promise<Account | null> {
        const rawData = await db.orm.public.Account.first({ id });

        if (!rawData) {
            return null;
        }

        // Reconstrói o objeto de domínio rico a partir dos dados planos
        return new Account(
            rawData.id,
            rawData.holderName,
            rawData.document,
            toNumber(rawData.balance),
            toDate(rawData.createdAt),
        );
    }

    /**
     * Busca uma conta pelo documento (CPF/CNPJ).
     */
    public async findByDocument(document: string): Promise<Account | null> {
        const rawData = await db.orm.public.Account
            .where((a) => a.document.eq(document))
            .first();

        if (!rawData) {
            return null;
        }

        return new Account(
            rawData.id,
            rawData.holderName,
            rawData.document,
            toNumber(rawData.balance),
            toDate(rawData.createdAt),
        );
    }

    /**
     * Busca todas as contas cadastradas.
     */
    public async findAll(): Promise<Account[]> {
        const rawAccounts = await db.orm.public.Account
            .orderBy((a) => a.createdAt.desc())
            .all();

        // Mapeia cada registro para o modelo de domínio
        return rawAccounts.map(
            (rawData) =>
                new Account(
                    rawData.id,
                    rawData.holderName,
                    rawData.document,
                    toNumber(rawData.balance),
                    toDate(rawData.createdAt),
                )
        );
    }
}