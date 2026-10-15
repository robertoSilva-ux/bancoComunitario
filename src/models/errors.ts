/**
 * Erros de domínio tipados.
 *
 * Os controllers decidem o status HTTP por `instanceof`, nunca por trecho da
 * mensagem: era o `error.message.includes("não encontrada")` que transformava
 * qualquer falha de infraestrutura em 404 e misturava regra de negócio com HTTP.
 *
 * Qualquer erro que **não** seja destes vira 500 com mensagem genérica, e a
 * mensagem real (erro do driver, stack) fica no log do servidor.
 */

/** Erro de domínio: previsto, com mensagem segura para o cliente. */
export class DomainError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

/** Entrada inválida na fronteira ou invariante de negócio violada -> 400. */
export class ValidationError extends DomainError {}

/** Recurso inexistente -> 404. */
export class NotFoundError extends DomainError {}

/** Conflito com o estado atual (documento já cadastrado) -> 409. */
export class ConflictError extends DomainError {}

/** Saldo insuficiente para a operação -> 422. */
export class InsufficientFundsError extends DomainError {}
