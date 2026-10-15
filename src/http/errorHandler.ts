import type { Response } from "express";
import {
    ConflictError,
    InsufficientFundsError,
    NotFoundError,
    ValidationError,
} from "../models/errors.js";

/**
 * Traduz o erro capturado no controller em resposta HTTP.
 *
 * O contrato é fechado: só erro de domínio tem mensagem própria; todo o resto
 * vira 500 genérico e vai para o log. É o que impede que mensagens internas
 * (erro do driver do Postgres, `TypeError` do runtime) cheguem ao cliente.
 */
export function respondError(res: Response, error: unknown): Response {
    if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
    }
    if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
    }
    if (error instanceof ConflictError) {
        return res.status(409).json({ error: error.message });
    }
    if (error instanceof InsufficientFundsError) {
        return res.status(422).json({ error: error.message });
    }

    console.error("[erro não tratado]", error);

    return res.status(500).json({ error: "Erro interno ao processar o pedido." });
}
