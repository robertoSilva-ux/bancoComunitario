/**
 * Testes de integração do módulo de crédito solidário.
 *
 * Exercitam o caminho completo — HTTP → adaptador de entrada → porta → caso de uso
 * → entidade → porta → adaptador Prisma → PostgreSQL — e conferem o que sobrou no
 * banco lendo as tabelas de volta.
 *
 * Exigem PostgreSQL acessível em `DATABASE_URL` e as migrations aplicadas.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { db } from "../../src/prisma/db.js";
import { CreditRequestRepositoryImpl } from "../../src/solidarity-credit/adapters/prisma/CreditRequestRepositoryImpl.js";
import { CreditRequest } from "../../src/solidarity-credit/domain/CreditRequest.js";
import { SolidarityEnterprise } from "../../src/solidarity-credit/domain/SolidarityEnterprise.js";
import { Money } from "../../src/models/Money.js";

let server: Server;
let baseUrl: string;

/** Documento único por teste: a suíte roda contra o banco de desenvolvimento. */
function documentoUnico(): string {
    return String(Math.floor(Math.random() * 10 ** 11)).padStart(11, "0");
}

interface ApiResponse {
    status: number;
    body: any;
}

async function solicitarCredito(corpo: unknown): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}/credit/solidarity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
    });
    const texto = await response.text();

    return { status: response.status, body: texto === "" ? null : JSON.parse(texto) };
}

/** Lê o banco diretamente: o teste de integração existe para provar a persistência. */
async function consultarBanco(document: string) {
    const enterprise = await db.orm.public.SolidarityEnterprise
        .where((e) => e.document.eq(document))
        .first();
    const requests = enterprise
        ? await db.orm.public.CreditRequest.where((r) => r.enterpriseId.eq(enterprise.id)).all()
        : [];

    return { enterprise, requests };
}

function corpoValido(document: string, valor: unknown = 1500) {
    return {
        enterprise: { name: "Cooperativa de Artesanato", document },
        amount: valor,
        purpose: "Compra de equipamentos para a produção",
    };
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

describe("POST /credit/solidarity", () => {
    it("registra a solicitação, cria o empreendimento e devolve 201", async () => {
        const document = documentoUnico();
        const response = await solicitarCredito(corpoValido(document));

        assert.equal(response.status, 201, JSON.stringify(response.body));
        assert.equal(response.body.creditRequest.amount, "1500.00");
        assert.equal(response.body.creditRequest.status, "pending");
        assert.equal(response.body.creditRequest.enterpriseName, "Cooperativa de Artesanato");
        assert.equal(response.body.creditRequest.purpose, "Compra de equipamentos para a produção");
        assert.ok(response.body.creditRequest.id.length > 0);
        assert.ok(!Number.isNaN(Date.parse(response.body.creditRequest.createdAt)));
    });

    it("persiste empreendimento e solicitação no banco", async () => {
        const document = documentoUnico();
        const response = await solicitarCredito(corpoValido(document, 250.75));
        const { enterprise, requests } = await consultarBanco(document);

        assert.ok(enterprise, "o empreendimento deveria ter sido gravado");
        assert.equal(enterprise.name, "Cooperativa de Artesanato");
        assert.equal(enterprise.document, document);

        assert.equal(requests.length, 1);
        assert.equal(requests[0].id, response.body.creditRequest.id);
        assert.equal(requests[0].enterpriseId, enterprise.id);
        assert.equal(requests[0].amount, "250.75", "valor gravado como string decimal exata");
        assert.equal(requests[0].purpose, "Compra de equipamentos para a produção");
        assert.equal(requests[0].status, "pending");
    });

    it("reusa o empreendimento quando o mesmo documento pede crédito de novo", async () => {
        const document = documentoUnico();

        const primeira = await solicitarCredito(corpoValido(document));
        const segunda = await solicitarCredito({
            ...corpoValido(document),
            enterprise: { name: "Nome Digitado Errado", document },
        });

        assert.equal(primeira.status, 201);
        assert.equal(segunda.status, 201);
        assert.equal(
            segunda.body.creditRequest.enterpriseId,
            primeira.body.creditRequest.enterpriseId,
            "o segundo pedido deve apontar para o empreendimento já existente"
        );
        assert.equal(
            segunda.body.creditRequest.enterpriseName,
            "Cooperativa de Artesanato",
            "vale o cadastro existente, não o nome reenviado"
        );

        const { enterprise, requests } = await consultarBanco(document);
        assert.ok(enterprise);
        assert.equal(requests.length, 2, "cada pedido gera uma solicitação");
    });
});

describe("validação de fronteira", () => {
    // Repare no caminho: a fronteira HTTP recusa antes do domínio (defesa em
    // profundidade). A regra "finalidade do crédito é obrigatória", que vive na
    // entidade `CreditRequest`, é exercitada nos testes de unidade do domínio —
    // por onde passaria um adaptador de entrada diferente, sem `requireString`.
    const casos: Array<{ nome: string; corpo: (document: string) => unknown; esperado: RegExp }> = [
        { nome: "valor em string", corpo: (d) => corpoValido(d, "1500"), esperado: /amount/ },
        { nome: "valor ausente", corpo: (d) => ({ enterprise: { name: "X", document: d }, purpose: "p" }), esperado: /amount/ },
        { nome: "valor booleano", corpo: (d) => corpoValido(d, true), esperado: /amount/ },
        { nome: "valor zero", corpo: (d) => corpoValido(d, 0), esperado: /maior que zero/i },
        { nome: "valor negativo", corpo: (d) => corpoValido(d, -10), esperado: /maior que zero/i },
        { nome: "valor fora de faixa", corpo: (d) => corpoValido(d, 1e308), esperado: /amount/ },
        { nome: "finalidade vazia", corpo: (d) => ({ ...corpoValido(d), purpose: "   " }), esperado: /purpose/i },
        { nome: "empreendimento ausente", corpo: (d) => ({ amount: 100, purpose: "p" }), esperado: /enterprise\.name/ },
        { nome: "nome do empreendimento vazio", corpo: (d) => ({ ...corpoValido(d), enterprise: { name: "", document: d } }), esperado: /enterprise\.name/ },
        { nome: "documento curto", corpo: (d) => ({ ...corpoValido(d), enterprise: { name: "X", document: d.slice(0, 3) } }), esperado: /documento/i },
    ];

    for (const caso of casos) {
        it(`recusa ${caso.nome} com 400 e não grava nada`, async () => {
            const document = documentoUnico();
            const response = await solicitarCredito(caso.corpo(document));

            assert.equal(response.status, 400, `${caso.nome}: veio ${response.status} ${JSON.stringify(response.body)}`);
            assert.match(response.body.error, caso.esperado);
            assert.doesNotMatch(
                response.body.error,
                /invalid input syntax|reading '|toString|Prisma|SqlQueryError/i,
                "mensagem interna não pode vazar para o cliente"
            );

            const { enterprise, requests } = await consultarBanco(document);
            assert.equal(enterprise, null, "requisição recusada não pode criar empreendimento");
            assert.equal(requests.length, 0, "requisição recusada não pode criar solicitação");
        });
    }
});

describe("CreditRequestRepositoryImpl — unidade de trabalho da porta", () => {
    it("não deixa empreendimento órfão quando a gravação da solicitação falha", async () => {
        const adaptador = new CreditRequestRepositoryImpl();

        // 1. Um cenário válido, gravado com sucesso.
        const documentoOriginal = documentoUnico();
        const empreendimentoOriginal = new SolidarityEnterprise(
            randomUUID(), "Cooperativa de Artesanato", documentoOriginal,
        );
        const solicitacaoOriginal = new CreditRequest(
            randomUUID(), empreendimentoOriginal.id, Money.fromInput(1500, "amount"), "Compra de equipamentos",
        );
        await adaptador.save(solicitacaoOriginal, empreendimentoOriginal);

        // 2. Segunda tentativa sabotada: empreendimento NOVO, mas solicitação com id
        //    já existente — a segunda escrita da transação viola a chave primária.
        //    Sem transação, o empreendimento novo ficaria gravado sem solicitação.
        const documentoNovo = documentoUnico();
        const empreendimentoNovo = new SolidarityEnterprise(
            randomUUID(), "Cooperativa Nova", documentoNovo,
        );
        const solicitacaoDuplicada = new CreditRequest(
            solicitacaoOriginal.id, empreendimentoNovo.id, Money.fromInput(200, "amount"), "Compra de insumos",
        );

        await assert.rejects(() => adaptador.save(solicitacaoDuplicada, empreendimentoNovo));

        const novo = await consultarBanco(documentoNovo);
        assert.equal(novo.enterprise, null, "o empreendimento não pode ficar gravado sem a solicitação");
        assert.equal(novo.requests.length, 0);

        const original = await consultarBanco(documentoOriginal);
        assert.equal(original.requests.length, 1, "a solicitação anterior continua intacta");
        assert.equal(original.requests[0].amount, "1500.00");
    });

    it("encontra o empreendimento pelo documento para reuso", async () => {
        const adaptador = new CreditRequestRepositoryImpl();
        const documento = documentoUnico();

        assert.equal(await adaptador.findEnterpriseByDocument(documento), null);

        const empreendimento = new SolidarityEnterprise(randomUUID(), "Cooperativa de Reciclagem", documento);
        const solicitacao = new CreditRequest(
            randomUUID(), empreendimento.id, Money.fromInput(300, "amount"), "Compra de prensa",
        );
        await adaptador.save(solicitacao, empreendimento);

        const encontrado = await adaptador.findEnterpriseByDocument(documento);
        assert.ok(encontrado);
        assert.equal(encontrado.id, empreendimento.id);
        assert.equal(encontrado.name, "Cooperativa de Reciclagem");
        assert.equal(encontrado.document, documento);
        assert.equal(encontrado.createdAt instanceof Date, true);
    });
});
