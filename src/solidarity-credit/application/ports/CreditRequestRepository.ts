import type { CreditRequest } from "../../domain/CreditRequest.js";
import type { SolidarityEnterprise } from "../../domain/SolidarityEnterprise.js";

/**
 * PORTA SECUNDÁRIA (output port) do hexágono.
 *
 * Declara o que o núcleo **precisa** para funcionar, na linguagem do domínio.
 * Quem implementa é o adaptador `CreditRequestRepositoryImpl` (Prisma/PostgreSQL);
 * o caso de uso nunca vê o adaptador.
 *
 * Granularidade escolhida (ver `docs/arquitetura-hexagonal.md`):
 *
 *  - `findEnterpriseByDocument` evita cadastrar o mesmo empreendimento duas vezes
 *    quando o mesmo documento pede crédito de novo;
 *  - `save(creditRequest, enterprise)` é **uma unidade de trabalho**: o
 *    empreendimento e a solicitação são gravados juntos ou não são. O núcleo diz
 *    *o que* precisa ser atômico; *como* (transação do banco) é decisão do
 *    adaptador — expor `runInTransaction(...)` aqui vazaria infraestrutura para
 *    dentro da porta.
 */
export interface CreditRequestRepository {
    findEnterpriseByDocument(document: string): Promise<SolidarityEnterprise | null>;

    save(creditRequest: CreditRequest, enterprise: SolidarityEnterprise): Promise<void>;
}
