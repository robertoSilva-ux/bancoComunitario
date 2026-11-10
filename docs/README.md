# Documentação — Banco Comunitário

Índice da documentação do projeto. Separa **o que foi decidido** (ADRs) de **como o sistema está
desenhado** (C4) e do **registro de cada entrega** (`entrega-*.txt`/`.md`).

```
docs/
├── README.md                    # este índice
├── visao-arquitetural.md        # escopo, stakeholders, restrições, decisões adotadas
├── arquitetura/
│   └── c4.md                    # C4 níveis 1, 2 e 3 (Mermaid — a fonte dos diagramas)
├── adr/
│   ├── README.md                # índice dos ADRs, regras e template
│   ├── 0001-camadas-com-dominio-rico.md
│   ├── 0002-credito-solidario-hexagonal.md
│   ├── 0003-postgresql-unico-prisma-migrations.md
│   └── 0004-autenticacao-jwt-por-perfis.md
├── entrega-1.txt                # proposta arquitetural (Entrega 2 da disciplina)
├── visao_geral.md               # princípio, justificativa e fluxo (texto original da Entrega 1)
├── arquitetura-hexagonal.md     # desenho e verificação do módulo hexagonal de crédito
├── backlog-atividade-hexagonal.md
└── entrega-documentacao.md      # consolidação submetida (visão + C4 + 4 ADRs)
```

## Mapa da entrega de documentação

| Exigido no enunciado | Artefato | Onde |
|---|---|---|
| Visão arquitetural (escopo, stakeholders, restrições, decisões já adotadas) | documento | [`visao-arquitetural.md`](./visao-arquitetural.md) |
| C4 Nível 1 — Contexto | diagrama Mermaid (semântica C4) | [`arquitetura/c4.md` §2](./arquitetura/c4.md#2-nível-1--diagrama-de-contexto) |
| C4 Nível 2 — Contêineres | diagrama Mermaid (semântica C4) | [`arquitetura/c4.md` §3](./arquitetura/c4.md#3-nível-2--diagrama-de-contêineres) |
| C4 Nível 3 — Componentes (API/backend) | dois recortes + tabela de dependências | [`arquitetura/c4.md` §4](./arquitetura/c4.md#4-nível-3--diagrama-de-componentes) |
| 4 ADRs (título, contexto, decisão, status, consequências) | 4 arquivos + índice | [`adr/`](./adr/README.md) |
| Link do repositório e branch utilizada | nesta página e na consolidação | abaixo |
| Consolidação para submissão | documento único | [`entrega-documentacao.md`](./entrega-documentacao.md) |

**Repositório:** <https://github.com/robertoSilva-ux/bancoComunitario>
**Branch da entrega:** `entrega-4`

## Por que ADR e por que C4

* **C4** responde *o que existe*: pessoas, sistemas, contêineres e componentes, em níveis de
  abstração consistentes. Um diagrama só de caixas não diz por que PostgreSQL, nem qual atributo de
  qualidade pesou.
* **ADR** responde *por que ficou assim*: forças, alternativas descartadas, consequências assumidas.
  Sem ele, a decisão vive na cabeça de quem escreveu o código e é refeita a cada seis meses.
* Juntos formam o "decision log" do projeto: o C4 mostra o resultado, o ADR mostra o caminho.

## Regras de manutenção

1. **Diagrama e mudança no mesmo commit.** Nível novo de C4 desatualizado mente com aparência de
   fonte primária.
2. **A seção "o que este diagrama ainda não tem" é dívida com prazo**: a cada incremento, releia e
   apague as linhas que o código acabou de tornar falsas.
3. **ADR aceito não se edita** — ADR novo com status "Substituída por". Ver [`adr/README.md`](./adr/README.md).
4. **Mermaid é a fonte; PNG não é versionado.** Imagem exportada envelhece em paralelo ao texto.
5. **Tudo em português**, com nomes de arquivo/rota em inglês, como no código.

## Pendências conhecidas

* O `readme.md` da raiz ainda não aponta para esta pasta (falta a seção "Documentação de arquitetura").
* `docs/visao_geral.md` diz que o extrato é "ordenado cronologicamente" e o código ordena `desc` —
  divergência a corrigir no texto, não no código.
* `.gitattributes` referencia `src/prisma/ops.json`, que não existe.
