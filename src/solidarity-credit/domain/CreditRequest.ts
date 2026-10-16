import { Money } from "../../models/Money.js";
import { ValidationError } from "../../models/errors.js";

/**
 * Ciclo de vida da solicitação. Nesta atividade existe apenas o estado inicial;
 * o tipo foi deixado aberto (`| "…"`) para a análise do crédito entrar depois
 * sem precisar de migration nem de reescrita do domínio.
 */
export type CreditRequestStatus = "pending";

/** Limite de tamanho da finalidade — evita que o campo vire um despejo de texto. */
const TAMANHO_MAXIMO_FINALIDADE = 500;

/**
 * Entidade de domínio: a solicitação de crédito solidário.
 *
 * Guarda as invariantes da solicitação (valor positivo, finalidade obrigatória,
 * vínculo com um empreendimento) sem saber como ela será persistida.
 */
export class CreditRequest {
    constructor(
        public readonly id: string,
        public readonly enterpriseId: string,
        public readonly amount: Money,
        public readonly purpose: string,
        public readonly status: CreditRequestStatus = "pending",
        public readonly createdAt: Date = new Date(),
    ) {
        this.validate();
    }

    private validate(): void {
        if (!this.id || this.id.trim() === "") {
            throw new ValidationError("O ID da solicitação de crédito é obrigatório.");
        }
        if (!this.enterpriseId || this.enterpriseId.trim() === "") {
            throw new ValidationError(
                "A solicitação de crédito precisa estar vinculada a um empreendimento solidário."
            );
        }
        if (this.amount.isZero() || this.amount.isNegative()) {
            throw new ValidationError("O valor solicitado de crédito deve ser maior que zero.");
        }
        if (!this.purpose || this.purpose.trim() === "") {
            throw new ValidationError("A finalidade do crédito é obrigatória.");
        }
        if (this.purpose.trim().length > TAMANHO_MAXIMO_FINALIDADE) {
            throw new ValidationError(
                `A finalidade do crédito deve ter no máximo ${TAMANHO_MAXIMO_FINALIDADE} caracteres.`
            );
        }
    }
}
