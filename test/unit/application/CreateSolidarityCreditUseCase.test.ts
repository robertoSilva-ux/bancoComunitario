/**
 * Testes de unidade do caso de uso `CreateSolidarityCreditUseCase`.
 *
 * O repositório é um dublê em memória: nenhum banco, nenhum HTTP, nenhuma porta
 * aberta. Se este arquivo precisasse de `DATABASE_URL` para rodar, significaria
 * que a infraestrutura vazou para dentro do núcleo.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CreateSolidarityCreditUseCase } from "../../../src/solidarity-credit/application/useCases/CreateSolidarityCreditUseCase.js";
import type {
    CreateSolidarityCreditApplication,
    CreateSolidarityCreditCommand,
} from "../../../src/solidarity-credit/application/ports/CreateSolidarityCreditApplication.js";
import type { CreditRequestRepository } from "../../../src/solidarity-credit/application/ports/CreditRequestRepository.js";
import type { CreditRequest } from "../../../src/solidarity-credit/domain/CreditRequest.js";
import type { SolidarityEnterprise } from "../../../src/solidarity-credit/domain/SolidarityEnterprise.js";
import { Money } from "../../../src/models/Money.js";

/** Dublê (test double) da porta secundária, em memória. */
class RepositorioEmMemoria implements CreditRequestRepository {
    public readonly empreendimentos: SolidarityEnterprise[] = [];
    public readonly solicitacoes: CreditRequest[] = [];
    public erroAoSalvar: Error | null = null;
    public buscasPorDocumento = 0;

    public async findEnterpriseByDocument(document: string): Promise<SolidarityEnterprise | null> {
        this.buscasPorDocumento += 1;
        return this.empreendimentos.find((empresa) => empresa.document === document) ?? null;
    }

    public async save(creditRequest: CreditRequest, enterprise: SolidarityEnterprise): Promise<void> {
        if (this.erroAoSalvar) {
            throw this.erroAoSalvar;
        }

        if (!this.empreendimentos.some((existente) => existente.id === enterprise.id)) {
            this.empreendimentos.push(enterprise);
        }
        this.solicitacoes.push(creditRequest);
    }
}

const comando = (overrides: Partial<CreateSolidarityCreditCommand> = {}): CreateSolidarityCreditCommand => ({
    enterprise: { name: "Cooperativa de Artesanato", document: "12345678000199" },
    amount: Money.fromInput(1500, "amount"),
    purpose: "Compra de equipamentos",
    ...overrides,
});

describe("CreateSolidarityCreditUseCase", () => {
    let repositorio: RepositorioEmMemoria;
    // Anotado pela PORTA primária: se o caso de uso deixar de cumprir o contrato,
    // o `npm run typecheck` acusa aqui.
    let casoDeUso: CreateSolidarityCreditApplication;

    beforeEach(() => {
        repositorio = new RepositorioEmMemoria();
        casoDeUso = new CreateSolidarityCreditUseCase(repositorio);
    });

    it("cria o empreendimento quando o documento ainda é desconhecido", async () => {
        const saida = await casoDeUso.execute(comando());

        assert.equal(repositorio.empreendimentos.length, 1);
        assert.equal(repositorio.solicitacoes.length, 1);
        assert.equal(saida.enterpriseId, repositorio.empreendimentos[0].id);
        assert.equal(repositorio.solicitacoes[0].enterpriseId, saida.enterpriseId);
    });

    it("reusa o empreendimento existente na segunda solicitação do mesmo documento", async () => {
        const primeira = await casoDeUso.execute(comando());
        // Mesmo documento, nome diferente no corpo: vale o cadastro que já existe.
        const segunda = await casoDeUso.execute(
            comando({ enterprise: { name: "Nome Digitado Errado", document: "12345678000199" } }),
        );

        assert.equal(repositorio.empreendimentos.length, 1, "não pode duplicar o empreendimento");
        assert.equal(repositorio.solicitacoes.length, 2, "cada pedido gera uma solicitação");
        assert.equal(segunda.enterpriseId, primeira.enterpriseId);
        assert.equal(segunda.enterpriseName, "Cooperativa de Artesanato");
        assert.notEqual(segunda.id, primeira.id);
    });

    it("devolve a saída em linguagem de domínio, com o dinheiro como objeto de valor", async () => {
        const saida = await casoDeUso.execute(comando());

        assert.equal(saida.id.length > 0, true);
        assert.equal(saida.amount instanceof Money, true);
        assert.equal(saida.amount.toJSON(), "1500.00");
        assert.equal(saida.purpose, "Compra de equipamentos");
        assert.equal(saida.status, "pending");
        assert.equal(saida.createdAt instanceof Date, true);
    });

    it("recusa valor zero ou negativo sem gravar nada", async () => {
        for (const valor of [0, -1]) {
            await assert.rejects(
                () => casoDeUso.execute(comando({ amount: Money.fromInput(valor, "amount") })),
                /valor solicitado de crédito deve ser maior que zero/,
            );
        }

        assert.equal(repositorio.solicitacoes.length, 0);
    });

    it("recusa finalidade vazia sem gravar nada", async () => {
        await assert.rejects(() => casoDeUso.execute(comando({ purpose: "   " })), /finalidade/i);

        assert.equal(repositorio.solicitacoes.length, 0);
    });

    it("recusa nome de empreendimento vazio antes de consultar o repositório", async () => {
        await assert.rejects(
            () => casoDeUso.execute(comando({ enterprise: { name: "", document: "12345678000199" } })),
            /nome do empreendimento solidário não pode ser vazio/,
        );

        assert.equal(repositorio.solicitacoes.length, 0);
    });

    it("propaga erro do repositório em vez de engolir", async () => {
        repositorio.erroAoSalvar = new Error("banco fora do ar");

        await assert.rejects(() => casoDeUso.execute(comando()), /banco fora do ar/);

        assert.equal(repositorio.solicitacoes.length, 0);
    });
});
