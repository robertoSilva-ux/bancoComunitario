/**
 * Testes de integração da API — batem no HTTP e conferem o que sobrou no banco.
 *
 * Cobrem o caminho feliz e, principalmente, os casos que corrompiam o saldo na
 * versão anterior (valor de tipo errado, valor ausente, fora de faixa, saque sem
 * saldo) e a atomicidade entre a conta e o lançamento.
 *
 * Exigem um PostgreSQL acessível em `DATABASE_URL` e as migrations aplicadas
 * (`npx prisma db migrate`).
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { db } from "../../src/prisma/db.js";
import { AccountRepository } from "../../src/repositories/AccountRepository.js";
import { TransactionRepository } from "../../src/repositories/TransactionRepository.js";
import { AccountService } from "../../src/services/AccountService.js";
import { Account } from "../../src/models/Account.js";
import { Money } from "../../src/models/Money.js";
import { Transaction } from "../../src/models/Transaction.js";
import { ConflictError } from "../../src/models/errors.js";

let server: Server;
let baseUrl: string;

/** Documento único por teste: a suíte roda contra o banco de desenvolvimento. */
function uniqueDocument(): string {
    return String(Math.floor(Math.random() * 10 ** 11)).padStart(11, "0");
}

interface ApiResponse {
    status: number;
    body: any;
}

async function api(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();

    return { status: response.status, body: text === "" ? null : JSON.parse(text) };
}

async function openAccount(initialBalance?: number): Promise<any> {
    const response = await api("POST", "/accounts", {
        holderName: "Titular de Teste",
        document: uniqueDocument(),
        ...(initialBalance === undefined ? {} : { initialBalance }),
    });

    assert.equal(
        response.status,
        201,
        `esperava 201 ao abrir a conta, veio ${response.status}: ${JSON.stringify(response.body)}`
    );

    return response.body.account;
}

async function statement(accountId: string): Promise<any> {
    const response = await api("GET", `/accounts/${accountId}/statement`);
    assert.equal(response.status, 200, `esperava 200 no extrato, veio ${response.status}`);

    return response.body;
}

before(async () => {
    assert.ok(process.env["DATABASE_URL"], "DATABASE_URL não definida (copie .env.example para .env)");

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address();
    assert.ok(address !== null && typeof address !== "string", "servidor de teste não subiu");
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
    );
    await db.close();
});

describe("abertura de conta", () => {
    it("devolve 201 e o saldo como string decimal", async () => {
        const account = await openAccount(100);

        assert.equal(account.balance, "100.00");
        assert.equal(typeof account.balance, "string");
    });

    it("registra o saldo inicial como lançamento, para o extrato fechar", async () => {
        const account = await openAccount(150);
        const extract = await statement(account.id);

        assert.equal(extract.balance, "150.00");
        assert.equal(extract.transactions.length, 1);
        assert.equal(extract.transactions[0].type, "deposit");
        assert.equal(extract.transactions[0].amount, "150.00");
        assert.equal(extract.transactions[0].description, "Saldo inicial");
    });

    it("sem saldo inicial, a conta começa zerada e sem lançamento", async () => {
        const account = await openAccount();
        const extract = await statement(account.id);

        assert.equal(account.balance, "0.00");
        assert.equal(extract.transactions.length, 0);
    });

    it("recusa documento repetido com 409", async () => {
        const account = await openAccount();
        const response = await api("POST", "/accounts", {
            holderName: "Outro Titular",
            document: account.document,
        });

        assert.equal(response.status, 409);
        assert.match(response.body.error, /já existe uma conta/i);
    });

    it("recusa campos ausentes ou em branco com 400 explicando o campo", async () => {
        const semNome = await api("POST", "/accounts", { document: uniqueDocument() });
        const nomeVazio = await api("POST", "/accounts", { holderName: "   ", document: uniqueDocument() });
        const semDocumento = await api("POST", "/accounts", { holderName: "Fulano" });
        const documentoCurto = await api("POST", "/accounts", { holderName: "Fulano", document: "123" });

        assert.equal(semNome.status, 400);
        assert.match(semNome.body.error, /holderName/);
        assert.equal(nomeVazio.status, 400);
        assert.equal(semDocumento.status, 400);
        assert.equal(documentoCurto.status, 400);
        assert.match(documentoCurto.body.error, /documento/i);
    });

    it("recusa saldo inicial negativo ou de tipo errado", async () => {
        const negativo = await api("POST", "/accounts", {
            holderName: "Fulano",
            document: uniqueDocument(),
            initialBalance: -50,
        });
        const string = await api("POST", "/accounts", {
            holderName: "Fulano",
            document: uniqueDocument(),
            initialBalance: "50",
        });

        assert.equal(negativo.status, 400);
        assert.match(negativo.body.error, /não pode ser negativo/i);
        assert.equal(string.status, 400);
        assert.match(string.body.error, /deve ser um número/);
    });

    it("traduz a violação de unicidade do banco em conflito de domínio", async () => {
        // Caminho que o pré-check do service não cobre: duas requisições simultâneas
        // passam pelo pré-check e só o banco decide. Aqui a gravação é chamada direto
        // no repositório, sem pré-check, para forçar a constraint única.
        const existente = await openAccount();
        const duplicada = new Account(
            randomUUID(),
            "Titular Duplicado",
            existente.document,
            Money.zero(),
            new Date()
        );

        await assert.rejects(
            () => new AccountRepository().save(duplicada),
            (error: unknown) => error instanceof ConflictError,
            "violação de unicidade deve virar ConflictError, não erro cru do driver"
        );
    });
});

describe("depósito", () => {
    it("soma o valor e devolve o saldo atualizado", async () => {
        const account = await openAccount(100);
        const response = await api("POST", `/accounts/${account.id}/deposits`, {
            amount: 50,
            description: "feira",
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.balance, "150.00");
        assert.equal(response.body.transaction.amount, "50.00");
        assert.equal((await statement(account.id)).balance, "150.00");
    });

    it("soma centavos sem desvio de ponto flutuante", async () => {
        const account = await openAccount(0);

        await api("POST", `/accounts/${account.id}/deposits`, { amount: 0.1 });
        await api("POST", `/accounts/${account.id}/deposits`, { amount: 0.2 });

        const extract = await statement(account.id);
        assert.equal(extract.balance, "0.30");
        assert.equal(extract.transactions[0].amount, "0.20");
        assert.equal(extract.transactions[1].amount, "0.10");
    });

    it("recusa valor em string sem alterar o saldo (antes concatenava: 15 + \"7\" = 157)", async () => {
        const account = await openAccount(15);
        const response = await api("POST", `/accounts/${account.id}/deposits`, { amount: "7" });

        assert.equal(response.status, 400);
        assert.match(response.body.error, /deve ser um número/);
        assert.equal((await statement(account.id)).balance, "15.00");
    });

    it("recusa depósito sem valor sem gravar NaN (antes corrompia o saldo na base)", async () => {
        const account = await openAccount(100);
        const response = await api("POST", `/accounts/${account.id}/deposits`, {
            description: "sem valor",
        });

        assert.equal(response.status, 400);
        assert.match(response.body.error, /amount/);

        const extract = await statement(account.id);
        assert.equal(extract.balance, "100.00");
        assert.equal(extract.transactions.length, 1, "nenhum lançamento deveria ter sido gravado");
    });

    it("recusa booleano, array e valor fora de faixa", async () => {
        const account = await openAccount(10);
        const valores = [true, [1, 2], 1e308, 10.005, "10"];

        for (const amount of valores) {
            const response = await api("POST", `/accounts/${account.id}/deposits`, { amount });
            assert.equal(response.status, 400, `amount=${JSON.stringify(amount)} deveria ser 400`);
            assert.doesNotMatch(response.body.error, /invalid input syntax|toString|NaN/);
        }

        assert.equal((await statement(account.id)).balance, "10.00");
    });

    it("recusa valor zero ou negativo com 400", async () => {
        const account = await openAccount(10);

        const zero = await api("POST", `/accounts/${account.id}/deposits`, { amount: 0 });
        const negativo = await api("POST", `/accounts/${account.id}/deposits`, { amount: -10 });

        assert.equal(zero.status, 400);
        assert.match(zero.body.error, /maior que zero/i);
        assert.equal(negativo.status, 400);
    });
});

describe("saque", () => {
    it("debita o saldo e grava o lançamento", async () => {
        const account = await openAccount(100);
        const response = await api("POST", `/accounts/${account.id}/withdrawals`, {
            amount: 30.5,
            description: "compra na feira",
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.balance, "69.50");

        const extract = await statement(account.id);
        assert.equal(extract.transactions[0].type, "withdrawal");
        assert.equal(extract.transactions[0].amount, "30.50");
    });

    it("recusa saque acima do saldo com 422 e não altera nada", async () => {
        const account = await openAccount(100);
        const response = await api("POST", `/accounts/${account.id}/withdrawals`, { amount: 600 });

        assert.equal(response.status, 422);
        assert.match(response.body.error, /saldo insuficiente/i);

        const extract = await statement(account.id);
        assert.equal(extract.balance, "100.00");
        assert.equal(extract.transactions.length, 1, "saque recusado não pode gerar lançamento");
    });

    it("dois saques simultâneos via HTTP não furam o saldo", async () => {
        // Guarda de ponta a ponta. Vale saber que este teste NÃO força a janela de
        // concorrência: se as duas requisições não se sobrepuserem no banco, ele
        // passa mesmo sem a trava de leitura. Quem força a sobreposição é o teste
        // "a leitura com trava serializa transações sobrepostas", em `concorrência`.
        const account = await openAccount(100);

        const [primeiro, segundo] = await Promise.all([
            api("POST", `/accounts/${account.id}/withdrawals`, { amount: 60 }),
            api("POST", `/accounts/${account.id}/withdrawals`, { amount: 60 }),
        ]);

        const status = [primeiro.status, segundo.status].sort((a, b) => a - b);
        assert.deepEqual(status, [200, 422]);
        assert.equal((await statement(account.id)).balance, "40.00");
    });
});

describe("extrato e rotas", () => {
    it("responde 404 de domínio para conta inexistente", async () => {
        const depósito = await api("POST", "/accounts/nao-existe/deposits", { amount: 10 });
        const saque = await api("POST", "/accounts/nao-existe/withdrawals", { amount: 10 });
        const extrato = await api("GET", "/accounts/nao-existe/statement");

        for (const response of [depósito, saque, extrato]) {
            assert.equal(response.status, 404);
            assert.match(response.body.error, /conta não encontrada/i);
        }
    });

    it("responde 404 em JSON para rota ou método inexistente", async () => {
        const rota = await api("GET", "/rota-inexistente");
        const metodo = await api("DELETE", "/accounts/qualquer");

        assert.equal(rota.status, 404);
        assert.match(rota.body.error, /rota não encontrada/i);
        assert.equal(metodo.status, 404);
    });

    it("não vaza mensagem interna em erro de valor inválido", async () => {
        const account = await openAccount(10);
        const response = await api("POST", `/accounts/${account.id}/deposits`, { amount: "abc" });

        assert.equal(response.status, 400);
        assert.equal(response.body.error, 'O campo "amount" deve ser um número.');
    });
});

describe("atomicidade", () => {
    it("não altera o saldo quando a gravação do lançamento falha", async () => {
        const account = await openAccount(100);

        // Repositório de transações sabotado: a segunda escrita da operação falha.
        // O saldo não pode ter sido gravado, senão a conta fica sem lastro no extrato.
        const transactionRepositoryQuebrado = {
            save: async () => {
                throw new Error("falha simulada na gravação do lançamento");
            },
            findByAccountId: async () => [],
        } as unknown as TransactionRepository;

        const service = new AccountService(new AccountRepository(), transactionRepositoryQuebrado);

        await assert.rejects(() => service.deposit(account.id, Money.fromInput(50, "amount")));

        const extract = await statement(account.id);
        assert.equal(extract.balance, "100.00");
        assert.equal(extract.transactions.length, 1);
    });
});

describe("concorrência", () => {
    it("a leitura com trava serializa transações sobrepostas na mesma conta", async () => {
        // Cada transação lê o saldo, espera (abrindo de propósito a janela de
        // sobreposição) e só então grava. Sem a trava de leitura, as duas leem
        // 100,00, as duas aceitam o saque de 60,00 e a conta fica com 120,00
        // sacados — o saldo deixa de fechar com o extrato.
        const account = await openAccount(100);
        const accountRepository = new AccountRepository();
        const transactionRepository = new TransactionRepository();

        const sacarComEspera = async () => {
            return db.transaction(async (tx) => {
                const conta = await accountRepository.findByIdForUpdate(account.id, tx);
                assert.ok(conta, "conta deveria existir");

                await new Promise((resolve) => setTimeout(resolve, 200));

                conta.withdraw(Money.fromInput(60, "amount"));
                await accountRepository.save(conta, tx);
                await transactionRepository.save(
                    new Transaction(
                        randomUUID(),
                        account.id,
                        "withdrawal",
                        Money.fromInput(60, "amount"),
                        null,
                        new Date()
                    ),
                    tx
                );
            });
        };

        const resultados = await Promise.allSettled([sacarComEspera(), sacarComEspera()]);
        const aceitos = resultados.filter((r) => r.status === "fulfilled").length;

        assert.equal(aceitos, 1, "só um saque pode ser aceito: o segundo lê o saldo já debitado");

        const extract = await statement(account.id);
        assert.equal(extract.balance, "40.00");
        assert.equal(
            extract.transactions.filter((t: { type: string }) => t.type === "withdrawal").length,
            1
        );
    });
});
