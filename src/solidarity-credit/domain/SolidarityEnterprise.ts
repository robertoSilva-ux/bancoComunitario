import { ValidationError } from "../../models/errors.js";

/**
 * Entidade de domínio: o empreendimento solidário que pleiteia o crédito.
 *
 * Sem dependência de framework, HTTP ou banco — é a entidade que o caso de uso
 * `CreateSolidarityCreditUseCase` coordena junto com a `CreditRequest`.
 */
export class SolidarityEnterprise {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly document: string,
        public readonly createdAt: Date = new Date(),
    ) {
        this.validate();
    }

    private validate(): void {
        if (!this.id || this.id.trim() === "") {
            throw new ValidationError("O ID do empreendimento solidário é obrigatório.");
        }
        if (!this.name || this.name.trim() === "") {
            throw new ValidationError("O nome do empreendimento solidário não pode ser vazio.");
        }
        // Mesma regra de identificação usada na abertura de conta: CPF (11) ou CNPJ (14).
        if (!this.document || this.document.trim().length < 11) {
            throw new ValidationError("Documento (CPF/CNPJ) do empreendimento solidário inválido.");
        }
    }
}
