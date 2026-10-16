import type { Money } from "../../../models/Money.js";
import type { CreditRequestStatus } from "../../domain/CreditRequest.js";

/**
 * PORTA PRIMÁRIA (input port) do hexágono.
 *
 * É o contrato que o adaptador de entrada (`SolidarityCreditController`) usa para
 * acionar o núcleo — e por isso ele **não** conhece HTTP: nada de `Request`,
 * `Response`, Express ou NestJS aqui.
 *
 * O adaptador de entrada monta o `CreateSolidarityCreditCommand` (convertendo o
 * corpo HTTP, reusando `Money.fromInput` para o valor) e o caso de uso
 * `CreateSolidarityCreditUseCase` implementa esta interface.
 */

/** Dados do empreendimento que chegam com a solicitação. */
export interface SolidarityEnterpriseInput {
    name: string;
    document: string;
}

/** Intenção de negócio: solicitar crédito solidário. */
export interface CreateSolidarityCreditCommand {
    enterprise: SolidarityEnterpriseInput;
    amount: Money;
    purpose: string;
}

/** Resultado devolvido pelo núcleo — em linguagem de domínio, não de banco. */
export interface SolidarityCreditRequestOutput {
    id: string;
    enterpriseId: string;
    enterpriseName: string;
    amount: Money;
    purpose: string;
    status: CreditRequestStatus;
    createdAt: Date;
}

export interface CreateSolidarityCreditApplication {
    execute(command: CreateSolidarityCreditCommand): Promise<SolidarityCreditRequestOutput>;
}
