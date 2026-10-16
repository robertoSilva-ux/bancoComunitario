/**
 * Reconhecimento de violação de constraint única do PostgreSQL.
 *
 * O driver do Prisma 8 entrega um `SqlQueryError` com `sqlState` e `constraint`
 * estruturados — é por eles que se decide, e não por trecho da mensagem (o texto
 * ao redor muda entre versões). O texto fica só como rede de segurança.
 *
 * Vive aqui, e não dentro de um repositório, porque os dois módulos que persistem
 * dados identificados por documento (contas e crédito solidário) precisam da mesma
 * regra: duas requisições simultâneas passam pela verificação prévia do serviço e
 * só o banco pode decidir qual delas vence.
 */

/** Código SQLSTATE de `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

export function isUniqueViolationOn(error: unknown, constraint: string): boolean {
    const candidato = error as { sqlState?: unknown; constraint?: unknown } | null;

    if (candidato?.sqlState === UNIQUE_VIOLATION && candidato.constraint === constraint) {
        return true;
    }

    const texto = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

    return texto.includes(constraint);
}
