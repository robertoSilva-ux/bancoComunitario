import { Money } from "../models/Money.js";
import { ValidationError } from "../models/errors.js";

/**
 * Validação de fronteira: o único lugar que olha para `req.body` cru.
 *
 * Sem isso, `undefined`, `"10"`, `true` e `[1,2]` atravessavam o controller e
 * quebravam as invariantes de dinheiro dentro do domínio (concatenação, `NaN`).
 * Cada função devolve o tipo já pronto para o domínio ou lança `ValidationError`.
 */

/** Texto obrigatório, sem espaços nas pontas. */
export function requireString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim() === "") {
        throw new ValidationError(`O campo "${field}" é obrigatório e deve ser um texto.`);
    }

    return value.trim();
}

/** Texto opcional: ausente ou vazio vira `null` (a coluna aceita NULL). */
export function optionalText(value: unknown, field: string): string | null {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== "string") {
        throw new ValidationError(`O campo "${field}" deve ser um texto.`);
    }

    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

/** Valor monetário obrigatório; o formato é responsabilidade do objeto de valor. */
export function requireMoney(value: unknown, field: string): Money {
    return Money.fromInput(value, field);
}

/** Valor monetário opcional: ausente vira zero (conta nova começa sem saldo). */
export function optionalMoney(value: unknown, field: string): Money {
    if (value === undefined || value === null) {
        return Money.zero();
    }

    return Money.fromInput(value, field);
}
