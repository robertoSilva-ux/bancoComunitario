import { ValidationError } from "./errors.js";

/**
 * Objeto de valor de dinheiro.
 *
 * Representação interna: **centavos inteiros**. Nenhuma operação aritmética passa
 * por ponto flutuante, o que elimina os três defeitos que corrompiam o saldo:
 *
 *  - concatenação de string: `15 + "7"` gravava `157` em vez de somar;
 *  - `NaN`: `NaN < valor` é sempre `false`, o que desligava a verificação de saldo;
 *  - desvio de precisão: `0.1 + 0.2` era gravado como `0.30000000000000004`.
 *
 * O valor entra por `fromInput` (fronteira HTTP, valida tipo e formato), sai por
 * `toDecimalString` (coluna `numeric` do banco) e por `toJSON` (resposta da API).
 */
export class Money {
    /** R$ 999.999.999.999,99 — teto que mantém toda a aritmética exata em centavos. */
    private static readonly MAX_CENTS = 99_999_999_999_999;

    private constructor(private readonly cents: number) {}

    /**
     * Fronteira HTTP: aceita somente `number` do JSON, com no máximo 2 casas decimais.
     * String, booleano, array, `null`, `NaN`, `Infinity` e notação científica são
     * recusados com mensagem explícita, apontando o campo.
     */
    public static fromInput(value: unknown, field: string): Money {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new ValidationError(`O campo "${field}" deve ser um número.`);
        }

        const cents = Money.parseCents(value.toString());
        if (cents === null) {
            throw new ValidationError(
                `O campo "${field}" deve ser um valor monetário com no máximo 2 casas ` +
                `decimais, até R$ 999.999.999.999,99.`
            );
        }

        return new Money(cents);
    }

    /**
     * Leitura do banco de dados (`numeric` chega como string pelo Prisma 8).
     * Um valor aqui fora de formato é dado corrompido, não entrada inválida:
     * por isso lança `Error` comum (viraria 500), e não `ValidationError` (400).
     */
    public static fromDecimal(raw: string): Money {
        const cents = Money.parseCents(raw);
        if (cents === null) {
            throw new Error(`Valor monetário inválido no banco de dados: "${raw}".`);
        }

        return new Money(cents);
    }

    public static zero(): Money {
        return new Money(0);
    }

    /** Aritmética inteira exata; retorna um novo `Money` (objeto de valor é imutável). */
    public add(other: Money): Money {
        return new Money(this.cents + other.cents);
    }

    public subtract(other: Money): Money {
        return new Money(this.cents - other.cents);
    }

    public isZero(): boolean {
        return this.cents === 0;
    }

    public isNegative(): boolean {
        return this.cents < 0;
    }

    public isLessThan(other: Money): boolean {
        return this.cents < other.cents;
    }

    public equals(other: Money): boolean {
        return this.cents === other.cents;
    }

    /** `"157.00"` — formato gravado na coluna `numeric`. */
    public toDecimalString(): string {
        const absolute = Math.abs(this.cents);
        const units = Math.floor(absolute / 100);
        const fraction = (absolute % 100).toString().padStart(2, "0");

        return `${this.cents < 0 ? "-" : ""}${units}.${fraction}`;
    }

    /** `JSON.stringify` chama este método: o dinheiro sai como string decimal na API. */
    public toJSON(): string {
        return this.toDecimalString();
    }

    public toString(): string {
        return this.toDecimalString();
    }

    /**
     * Converte um literal numérico já formatado em centavos, por manipulação de
     * dígitos — nunca por `Math.round(valor * 100)`, que reintroduz o erro de
     * ponto flutuante (`0.1 * 100 === 10.000000000000002`).
     *
     * Retorna `null` para qualquer formato fora de `[-]digitos[.d[d]]` ou acima do teto.
     */
    private static parseCents(raw: string): number | null {
        const match = /^(-?)(\d{1,13})(?:\.(\d{1,2}))?$/.exec(raw.trim());
        if (match === null) {
            return null;
        }

        const [, sign, units, fraction = ""] = match;
        const cents = Number(units) * 100 + Number(fraction.padEnd(2, "0"));

        if (cents > Money.MAX_CENTS) {
            return null;
        }

        return sign === "-" ? -cents : cents;
    }
}
