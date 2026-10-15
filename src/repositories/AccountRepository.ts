import { db, type Client } from "../prisma/db.js";
import { Account } from "../models/Account.js";
import { Money } from "../models/Money.js";
import { ConflictError } from "../models/errors.js";

/** Linha de `Account` como o Prisma 8 entrega (numeric e timestamptz vêm como string). */
interface RawAccount {
    id: string;
    holderName: string;
    document: string;
    balance: string;
    createdAt: string;
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

/**
 * Reconstrói o objeto de domínio rico a partir dos dados planos.
 *
 * O saldo volta por `Money.fromDecimal` (string -> centavos inteiros): não existe
 * mais nenhum `Number()` no caminho, que era por onde o valor persistido perdia
 * precisão (`0.30000000000000004`) e por onde o `NaN` entrava no domínio.
 */
function toDomain(rawData: RawAccount): Account {
    return new Account(
        rawData.id,
        rawData.holderName,
        rawData.document,
        Money.fromDecimal(rawData.balance),
        toDate(rawData.createdAt),
    );
}

/**
 * Reconhece a violação da constraint única de `document`.
 *
 * O driver entrega um `SqlQueryError` com `sqlState`/`constraint` estruturados
 * (é o que se usa aqui); o texto da mensagem fica só como rede de segurança.
 */
function isDuplicateDocumentError(error: unknown): boolean {
    const candidate = error as { sqlState?: unknown; constraint?: unknown } | null;

    if (candidate?.sqlState === "23505" && candidate.constraint === "Account_document_key") {
        return true;
    }

    const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return text.includes("Account_document_key");
}

/**
 * Traduz a violação da constraint única de `document` (PostgreSQL 23505) no erro
 * de domínio correspondente. O pré-check do service cobre o caso comum; isto cobre
 * a corrida entre duas requisições simultâneas, em que só o banco pode decidir.
 */
function toSaveError(error: unknown): unknown {
    if (isDuplicateDocumentError(error)) {
        return new ConflictError("Já existe uma conta cadastrada com este documento.");
    }

    return error;
}

export class AccountRepository {
    /**
     * Salva uma nova conta ou atualiza uma existente no banco de dados.
     *
     * `client` permite que a escrita participe de uma transação do banco
     * (`db.transaction`), garantindo que a conta e o lançamento gravem juntos.
     */
    public async save(account: Account, client: Client = db): Promise<void> {
        try {
            await client.orm.public.Account.upsert({
                create: {
                    id: account.id,
                    holderName: account.holderName,
                    document: account.document,
                    balance: account.balance.toDecimalString(),
                    createdAt: toString(account.createdAt),
                },
                update: {
                    holderName: account.holderName,
                    balance: account.balance.toDecimalString(),
                },
            });
        } catch (error) {
            throw toSaveError(error);
        }
    }

    /**
     * Busca uma conta pelo ID.
     */
    public async findById(id: string, client: Client = db): Promise<Account | null> {
        const rawData = await client.orm.public.Account.first({ id });

        return rawData ? toDomain(rawData) : null;
    }

    /**
     * Busca uma conta pelo ID travando a linha (`FOR NO KEY UPDATE`) até o fim da
     * transação. É o que impede dois saques simultâneos de lerem o mesmo saldo e
     * ambos passarem na verificação: o segundo espera o primeiro commitar.
     *
     * `forNoKeyUpdate` em vez de `forUpdate` porque a mesma transação insere um
     * `Transaction` com chave estrangeira para a linha travada — o `FOR UPDATE`
     * conflita com a checagem de FK e travaria a própria gravação.
     */
    public async findByIdForUpdate(id: string, client: Client): Promise<Account | null> {
        const rawData = await client.orm.public.Account
            .where((a) => a.id.eq(id))
            .forNoKeyUpdate()
            .first();

        return rawData ? toDomain(rawData) : null;
    }

    /**
     * Busca uma conta pelo documento (CPF/CNPJ).
     */
    public async findByDocument(document: string, client: Client = db): Promise<Account | null> {
        const rawData = await client.orm.public.Account
            .where((a) => a.document.eq(document))
            .first();

        return rawData ? toDomain(rawData) : null;
    }

    /**
     * Busca todas as contas cadastradas.
     */
    public async findAll(client: Client = db): Promise<Account[]> {
        const rawAccounts = await client.orm.public.Account
            .orderBy((a) => a.createdAt.desc())
            .all();

        return rawAccounts.map(toDomain);
    }
}
