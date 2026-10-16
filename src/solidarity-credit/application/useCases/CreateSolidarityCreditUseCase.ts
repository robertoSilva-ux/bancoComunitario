import { randomUUID } from "node:crypto";
import { CreditRequest } from "../../domain/CreditRequest.js";
import { SolidarityEnterprise } from "../../domain/SolidarityEnterprise.js";
import type {
    CreateSolidarityCreditApplication,
    CreateSolidarityCreditCommand,
    SolidarityCreditRequestOutput,
} from "../ports/CreateSolidarityCreditApplication.js";
import type { CreditRequestRepository } from "../ports/CreditRequestRepository.js";

/**
 * CASO DE USO: solicitar crédito solidário.
 *
 * Coordena a operação: localiza (ou cria) o empreendimento solidário pelo
 * documento, monta a `CreditRequest` e pede a persistência pela porta de saída.
 *
 * Depende **apenas** das interfaces do núcleo: nenhum import de Express, Prisma
 * ou `src/prisma/db.ts`. É o que permite exercitar o caminho inteiro nos testes de
 * unidade com um repositório em memória, sem banco de dados.
 *
 * (`node:crypto` é a biblioteca padrão do runtime, não um framework: a geração de
 * id não amarra o núcleo a nenhuma infraestrutura. Uma variante mais purista
 * injetaria um gerador de id por porta — anotada como item opcional no backlog.)
 */
export class CreateSolidarityCreditUseCase implements CreateSolidarityCreditApplication {
    constructor(private readonly creditRequestRepository: CreditRequestRepository) {}

    public async execute(command: CreateSolidarityCreditCommand): Promise<SolidarityCreditRequestOutput> {
        // 1. Regra: o crédito é sempre vinculado a um empreendimento identificado
        //    pelo documento; se for a primeira solicitação, o empreendimento nasce aqui.
        const enterprise = await this.findOrCreateEnterprise(
            command.enterprise.name,
            command.enterprise.document,
        );

        // 2. A entidade valida as próprias invariantes (valor positivo, finalidade, vínculo).
        const creditRequest = new CreditRequest(
            randomUUID(),
            enterprise.id,
            command.amount,
            command.purpose,
        );

        // 3. Persistência atômica de empreendimento + solicitação, pela porta de saída.
        await this.creditRequestRepository.save(creditRequest, enterprise);

        return {
            id: creditRequest.id,
            enterpriseId: enterprise.id,
            enterpriseName: enterprise.name,
            amount: creditRequest.amount,
            purpose: creditRequest.purpose,
            status: creditRequest.status,
            createdAt: creditRequest.createdAt,
        };
    }

    private async findOrCreateEnterprise(name: string, document: string): Promise<SolidarityEnterprise> {
        const existing = await this.creditRequestRepository.findEnterpriseByDocument(document);

        if (existing) {
            return existing;
        }

        return new SolidarityEnterprise(randomUUID(), name, document);
    }
}
