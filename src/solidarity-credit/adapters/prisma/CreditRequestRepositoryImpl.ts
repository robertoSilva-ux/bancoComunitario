import { db, type Client } from "../../../prisma/db.js";
import { Money } from "../../../models/Money.js";
import { ConflictError } from "../../../models/errors.js";
import { isUniqueViolationOn } from "../../../prisma/uniqueConstraint.js";
import { CreditRequest, type CreditRequestStatus } from "../../domain/CreditRequest.js";
import { SolidarityEnterprise } from "../../domain/SolidarityEnterprise.js";
import type { CreditRequestRepository } from "../../application/ports/CreditRequestRepository.js";

/** Constraint única de `SolidarityEnterprise.document` no PostgreSQL. */
const DOCUMENTO_UNICO = "SolidarityEnterprise_document_key";

/** Linha de `SolidarityEnterprise` como o Prisma 8 entrega. */
interface RawEnterprise {
    id: string;
    name: string;
    document: string;
    createdAt: string;
}

function toDomain(raw: RawEnterprise): SolidarityEnterprise {
    return new SolidarityEnterprise(raw.id, raw.name, raw.document, new Date(raw.createdAt));
}

/**
 * ADAPTADOR SECUNDÁRIO (driven adapter): implementa a porta `CreditRequestRepository`
 * sobre o Prisma 8 / PostgreSQL.
 *
 * É a única peça do módulo que conhece banco de dados. O núcleo enxerga apenas a
 * interface da porta; trocar PostgreSQL por outro mecanismo significa escrever outro
 * adaptador, sem tocar em caso de uso, domínio ou controller.
 *
 * O saldo/valor trafega como string decimal (`Money.toDecimalString`), nunca como
 * número de ponto flutuante — mesma regra do módulo de contas.
 */
export class CreditRequestRepositoryImpl implements CreditRequestRepository {
    public async findEnterpriseByDocument(document: string): Promise<SolidarityEnterprise | null> {
        const raw = await db.orm.public.SolidarityEnterprise
            .where((enterprise) => enterprise.document.eq(document))
            .first();

        return raw ? toDomain(raw) : null;
    }

    /**
     * Unidade de trabalho da porta: empreendimento e solicitação são gravados na
     * **mesma transação** do banco. Se a segunda escrita falhar, a primeira volta —
     * o contrário deixaria um empreendimento cadastrado sem solicitação nenhuma.
     */
    public async save(creditRequest: CreditRequest, enterprise: SolidarityEnterprise): Promise<void> {
        try {
            await db.transaction(async (tx) => {
                await this.saveEnterprise(enterprise, tx);
                await this.saveCreditRequest(creditRequest, tx);
            });
        } catch (error) {
            throw this.toRepositoryError(error);
        }
    }

    private async saveEnterprise(enterprise: SolidarityEnterprise, client: Client): Promise<void> {
        await client.orm.public.SolidarityEnterprise.upsert({
            create: {
                id: enterprise.id,
                name: enterprise.name,
                document: enterprise.document,
                createdAt: enterprise.createdAt.toISOString(),
            },
            update: {
                name: enterprise.name,
            },
        });
    }

    private async saveCreditRequest(creditRequest: CreditRequest, client: Client): Promise<void> {
        await client.orm.public.CreditRequest.create({
            id: creditRequest.id,
            enterpriseId: creditRequest.enterpriseId,
            amount: creditRequest.amount.toDecimalString(),
            purpose: creditRequest.purpose,
            status: creditRequest.status,
            createdAt: creditRequest.createdAt.toISOString(),
        });
    }

    /** Traduz erro de infraestrutura no erro de domínio correspondente. */
    private toRepositoryError(error: unknown): unknown {
        if (isUniqueViolationOn(error, DOCUMENTO_UNICO)) {
            return new ConflictError(
                "Este empreendimento solidário já está cadastrado com outro identificador; " +
                "repita a solicitação para vincular ao cadastro existente."
            );
        }

        return error;
    }
}
