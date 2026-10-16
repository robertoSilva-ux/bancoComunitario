/**
 * Testes de unidade do domínio do crédito solidário.
 *
 * Não importam nada de infraestrutura: rodam por `npm run test:unit`, sem banco
 * e sem `DATABASE_URL` — é essa a prova de que o núcleo está isolado.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreditRequest } from "../../../src/solidarity-credit/domain/CreditRequest.js";
import { SolidarityEnterprise } from "../../../src/solidarity-credit/domain/SolidarityEnterprise.js";
import { Money } from "../../../src/models/Money.js";
import { ValidationError } from "../../../src/models/errors.js";

const empresa = (nome = "Cooperativa de Artesanato", documento = "12345678000199") =>
    new SolidarityEnterprise("empresa-1", nome, documento);

const pedido = (valor = 1500, finalidade = "Compra de equipamentos") =>
    new CreditRequest("pedido-1", "empresa-1", Money.fromInput(valor, "amount"), finalidade);

describe("SolidarityEnterprise", () => {
    it("aceita um empreendimento com nome e documento válidos", () => {
        const enterprise = empresa();

        assert.equal(enterprise.name, "Cooperativa de Artesanato");
        assert.equal(enterprise.document, "12345678000199");
    });

    it("recusa nome vazio", () => {
        assert.throws(() => empresa("   "), (error: unknown) => error instanceof ValidationError);
        assert.throws(() => empresa("   "), /nome do empreendimento solidário não pode ser vazio/);
    });

    it("recusa documento com menos de 11 caracteres", () => {
        assert.throws(() => empresa("Cooperativa", "123"), /Documento \(CPF\/CNPJ\)/);
    });
});

describe("CreditRequest", () => {
    it("nasce com status pendente e valor em objeto de valor", () => {
        const request = pedido();

        assert.equal(request.status, "pending");
        assert.equal(request.amount.toJSON(), "1500.00");
        assert.equal(request.createdAt instanceof Date, true);
    });

    it("recusa valor zero ou negativo", () => {
        assert.throws(() => pedido(0), /valor solicitado de crédito deve ser maior que zero/);
        assert.throws(() => pedido(-100), /valor solicitado de crédito deve ser maior que zero/);
    });

    it("recusa finalidade vazia", () => {
        assert.throws(() => pedido(1500, "  "), /finalidade do crédito é obrigatória/);
    });

    it("recusa finalidade acima de 500 caracteres", () => {
        assert.throws(() => pedido(1500, "a".repeat(501)), /no máximo 500 caracteres/);
    });

    it("recusa solicitação sem vínculo com empreendimento", () => {
        assert.throws(
            () => new CreditRequest("pedido-1", "", Money.fromInput(1500, "amount"), "Compra de equipamentos"),
            /precisa estar vinculada a um empreendimento solidário/
        );
    });
});
