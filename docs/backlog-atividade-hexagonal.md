# Backlog — Atividade: Arquitetura Hexagonal (Solicitação de Crédito Solidário)

**Disciplina:** Princípios e Padrões de Arquitetura (Projeto Integrador) — IFRS Campus Rio Grande
**Branch de implementação:** `entrega-3` (base: commit `0cee6a8`)
**Autor:** Roberto Fabiano Cunha da Silva
**Status:** planejado 

---

## 1. O que a atividade pede

| Elemento exigido no enunciado  | Artefato previsto neste backlog         | Onde fica                                                         |
| ------------------------------ | --------------------------------------- | ----------------------------------------------------------------- |
| Caso de uso                    | `CreateSolidarityCreditUseCase`         | `src/solidarity-credit/application/useCases/`                     |
| Porta primária (input port)    | `CreateSolidarityCreditApplication`     | `src/solidarity-credit/application/ports/`                        |
| Domínio                        | `CreditRequest`, `SolidarityEnterprise` | `src/solidarity-credit/domain/`                                   |
| Porta secundária (output port) | `CreditRequestRepository`               | `src/solidarity-credit/application/ports/`                        |
| Adaptador de entrada (driving) | `SolidarityCreditController`            | `src/solidarity-credit/adapters/http/`                            |
| Adaptador de saída (driven)    | `CreditRequestRepositoryImpl`           | `src/solidarity-credit/adapters/prisma/`                          |
| Endpoint                       | `POST /credit/solidarity`               | `src/solidarity-credit/adapters/http/solidarity-credit.routes.ts` |

Os nomes sugeridos no enunciado (`CreateSolidarityCreditUseCase`, `CreateSolidarityCreditApplication`,
`CreditRequest`, `SolidarityEnterprise`, `CreditRequestRepository`, `SolidarityCreditController`,
`CreditRequestRepositoryImpl`) são adotados **exatamente como sugeridos**, sem variação.

---

## 2. Ponto de partida — o que já existe e será reaproveitado

A `entrega-2` deixou o projeto com estes elementos, que a atividade nova reaproveita em vez de recriar:

* **`Money`** (`src/models/Money.ts`) — objeto de valor, centavos inteiros, sem float; entra por `Money.fromInput`
  (fronteira) e sai por `toDecimalString`/`toJSON` (string decimal). O valor do crédito usa este objeto.
* **`src/models/errors.ts`** — `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409),
  `InsufficientFundsError` (422). Módulo sem dependência de framework: serve ao núcleo hexagonal.
* **`src/http/validation.ts`** e **`src/http/errorHandler.ts`** — validação de fronteira e tradução de erro em
  status HTTP; o adaptador de entrada reusa os dois.
* **Padrão de escrita atômica** — `db.transaction(async (tx) => …)`, usado aqui pelo adaptador de persistência
  (nunca pelo núcleo).
* **Suíte de 21 testes** (`test/integration/api.test.ts`, `node:test` + `fetch`), que **não pode regredir**.
* **Fluxo de migrations do Prisma 8** já conhecido e validado (ver seção 6).

---

## 3. Decisão de topologia: onde o hexágono vive

**Módulo autocontido por feature.**

```
src/solidarity-credit/
├── domain/      SolidarityEnterprise, CreditRequest        (núcleo)
├── application/ ports/ + useCases/                          (núcleo)
└── adapters/    http/ (driving) + prisma/ (driven)          (borda)
```

* **A favor:** o núcleo nasce limpo — não herda a organização em camadas do módulo de contas; a fronteira do que é
  hexagonal fica visível na árvore de diretórios e é trivial de checar (um `grep` sobre duas pastas).
  É também a organização do projeto de referência  (`src/modules/access/{domain,application,adapters}`).
* **Contra:** o projeto passa a ter duas topologias convivendo (contas em camadas, crédito em hexágono).
  Aceito conscientemente como *strangler fig*: o módulo novo é a implementação de referência; migrar contas fica
  para depois (item herdado, seção 12).
* **Opção descartada:** espalhar em `src/domain`, `src/application`, `src/adapters` — misturaria o núcleo novo com
  os diretórios já usados pelas camadas (`src/models`, `src/services`, `src/repositories`) e apagaria a resposta à
  pergunta "o que é a arquitetura hexagonal neste projeto?".

---

## 4. Arquitetura alvo

```
              ┌──────────────────────── ADAPTADORES PRIMÁRIOS ─────────────────────────┐
 HTTP  ──────▶│ SolidarityCreditController  ──usa──▶  CreateSolidarityCreditApplication │
              └──────────────────────────────────┬───────────────────────────────────┘
                                                 │ (porta primária)
                                                 ▼
              ┌──────────────────────────── NÚCLEO ─────────────────────────────────────┐
              │  CreateSolidarityCreditUseCase  ──usa──▶ CreditRequest / Money / erros  │
              └──────────────────────────────────┬───────────────────────────────────┘
                                                 │ (porta secundária)
                                                 ▼
              ┌──────────────────────── ADAPTADORES SECUNDÁRIOS ────────────────────────┐
              │ CreditRequestRepositoryImpl  ──▶  Prisma 8  ──▶  PostgreSQL               │
              └──────────────────────────────────────────────────────────────────────────┘
```

**Regra de dependência (quem pode importar quem):**

| Camada         | Pode importar                            | Proibido importar                                        |
| -------------- | ---------------------------------------- | -------------------------------------------------------- |
| `domain/`      | `Money`, `errors` (núcleo compartilhado) | `express`, `@prisma/*`, `src/prisma/db.ts`, `src/http/*` |
| `application/` | `domain/`                                | `express`, `@prisma/*`, `src/prisma/db.ts`, `adapters/`  |
| `adapters/`    | tudo que precisar (é a borda)            | —                                                        |

A prova disso não é a promessa: o item **HEX-08** cria uma checagem automática que falha se `domain/` ou
`application/` importarem qualquer coisa da lista proibida.

**Composition root:** fica no arquivo de rotas do adaptador (`solidarity-credit.routes.ts`) — único ponto que
instancia `CreditRequestRepositoryImpl` e `CreateSolidarityCreditUseCase`. O controller é construído tipado pela
**porta** (`CreateSolidarityCreditApplication`), não pela classe do caso de uso: é essa assinatura que torna a
inversão de dependência visível no código.

---

## 5. Decisões de design

| #   | Decisão                                                                                                                                                                                      | Motivo / alternativa descartada                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Usar os nomes de classe sugeridos no enunciado, sem variação                                                                                                                                 | O enunciado sugere explicitamente `… ou nome equivalente`; adotar o nome sugerido elimina discussão na correção                                                                                             |
| D2  | `SolidarityCreditController` recebe `CreateSolidarityCreditApplication` (interface) no construtor                                                                                            | Se recebesse a classe concreta, a inversão de dependência existiria só no discurso                                                                                                                          |
| D3  | `CreateSolidarityCreditUseCase` recebe `CreditRequestRepository` (interface) e implementa `CreateSolidarityCreditApplication`                                                                | É o que permite testar o núcleo com um dublê em memória, sem banco                                                                                                                                          |
| D4  | A porta secundária expõe **uma unidade de trabalho**: `save(creditRequest, enterprise)`                                                                                                      | O núcleo expressa *o que* precisa ser atômico; *como* (transação do banco) é decisão do adaptador. Alternativa descartada: expor `runInTransaction(callback)` — vazaria infraestrutura para dentro da porta |
| D5  | O atributo `amount` do command é `Money`; o adaptador HTTP converte com `Money.fromInput`                                                                                                    | `Money` é objeto de valor do domínio e já é o validador de formato de dinheiro do projeto (`src/http/validation.ts` faz igual). Evita criar um segundo tipo de dinheiro na borda                            |
| D6  | Erros: reusar `src/models/errors.ts`                                                                                                                                                         | É módulo sem framework; a alternativa (criar `errors.ts` novo dentro do módulo) duplicaria os mesmos quatro erros e obrigaria o `errorHandler` a conhecer dois vocabulários                                 |
| D7  | `SolidarityEnterprise` é localizado pelo `document` e criado se não existir (`POST` cria empreendimento + solicitação)                                                                       | Um endpoint só, sem exigir cadastro prévio que o enunciado não pede. Alternativa: exigir `enterpriseId` já existente — deixaria a funcionalidade inutilizável de ponta a ponta sem um fluxo de cadastro     |
| D8  | **Não inventar** regra de negócio além do que a atividade pede: sem política de limite de crédito, sem fluxo de aprovação/recusa, sem regra de "uma solicitação pendente por empreendimento" | Regra inventada é decisão de negócio do banco comunitário, não do exercício; se for desejada, entra como item novo e precisa ser justificada                                                                |
| D9  | `status` existe no modelo com o valor inicial `"pending"`                                                                                                                                    | Um crédito tem ciclo de vida; guardar o estado agora evita uma migration nova quando a análise existir. Não há transição de estado nesta atividade                                                          |
| D10 | Dinheiro no JSON como string decimal (`"1500.00"`), igual à entrega-2                                                                                                                        | Consistência do contrato da API; evita reabrir a discussão sobre float no JSON                                                                                                                              |

---

## 6. Contrato e migration — **comandos verificados**



**Acrescentar em `src/prisma/contract.prisma`:**

```prisma
model SolidarityEnterprise {
  id             String                   @id
  name           String
  document       String                   @unique
  createdAt      TimestamptzString        @default(now())
  updatedAt      temporal.updatedAtString()
  creditRequests CreditRequest[]
}

model CreditRequest {
  id           String                   @id
  enterpriseId String
  amount       Decimal
  purpose      String
  status       String                   // "pending" nesta atividade
  createdAt    TimestamptzString        @default(now())
  updatedAt    temporal.updatedAtString()

  enterprise SolidarityEnterprise @relation(fields: [enterpriseId], references: [id])
}
```

**Sequência (Prisma 8 — não existe `migrate dev` aqui):**

```bash
npx prisma contract emit                                  # regenera contract.json e contract.d.ts (offline)
npx prisma migration plan --name add_solidarity_credit \
  --from a37ca6aabbac                                     # ATENÇÃO: --from é obrigatório (ver seção 11)
npx prisma db migrate --to <hash impresso pelo plan>       # aplica; 1 transação para o run inteiro
npx prisma db verify                                       # deve dizer "match contract"
```

**O que o plano produz** (`migrations/app/20261015T0425_add_solidarity_credit/` no ensaio), tudo `additive`:

| Operação                                                      | Objeto gerado                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `table.SolidarityEnterprise`                                  | tabela com PK em `id`, `unique(document)` → `SolidarityEnterprise_document_key` |
| `table.CreditRequest`                                         | tabela com PK em `id`, `amount numeric`, `purpose text`, `status text`          |
| `unique.SolidarityEnterprise...`                              | constraint única de `document`                                                  |
| `index.CreditRequest.CreditRequest_enterpriseId_idx_c87d438a` | índice em `enterpriseId`                                                        |
| `foreignKey.CreditRequest.CreditRequest_enterpriseId_fkey`    | FK para `SolidarityEnterprise(id)`                                              |

Nada de `data migration`: as tabelas são novas, não há dado existente a preservar.
A coluna `updatedAt` é `NOT NULL` **sem default** — o runtime do Prisma 8 a preenche (`temporal.updatedAtString()`),
comportamento confirmado no módulo de contas. Não passar `updatedAt` na mão.

---

## 7. Backlog

Legenda de tamanho: **P** = pequeno (um arquivo, sem surpresa) · **M** = médio (arquivo + teste + integração).

### HEX-01 — Contrato e migration das duas tabelas · `M`

* **Depende de:** —
* **Arquivos:** `src/prisma/contract.prisma`, `src/prisma/contract.{json,d.ts}`, `migrations/app/<nova>/`
* **Aceite:** os comandos da seção 6 rodam na ordem; `db verify` = *match contract*; FK e índice presentes;
  `db.orm.public.CreditRequest` e `db.orm.public.SolidarityEnterprise` autocompletam no editor.

### HEX-02 — Domínio: `SolidarityEnterprise` e `CreditRequest` · `P`

* **Depende de:** —
* **Arquivos:** `src/solidarity-credit/domain/SolidarityEnterprise.ts`, `.../CreditRequest.ts`
* **Regras:** nome não vazio (trim); `document` com ≥ 11 caracteres; `amount` > 0; `purpose` não vazio e ≤ 500
  caracteres; `enterpriseId` obrigatório; `status` inicial `"pending"`.
* **Aceite:** cada regra violada lança `ValidationError` com mensagem específica; nenhum arquivo de `domain/` importa
  framework (checado por HEX-08); testes de unidade passam **sem `DATABASE_URL` definida**.
* **Testes:** `test/unit/domain/solidarity-credit.test.ts`

### HEX-03 — Portas: `CreateSolidarityCreditApplication` e `CreditRequestRepository` · `P`

* **Depende de:** HEX-02
* **Arquivos:** `src/solidarity-credit/application/ports/CreateSolidarityCreditApplication.ts`,
  `.../ports/CreditRequestRepository.ts`
* **Conteúdo:** interface da porta primária (`execute(command)`) com `CreateSolidarityCreditCommand` e
  `SolidarityCreditRequestOutput`; interface da porta secundária
  (`findEnterpriseByDocument`, `save(creditRequest, enterprise)`).
* **Aceite:** são só contratos e tipos — nenhuma implementação, nenhum import de `@prisma/*` ou `express`.

### HEX-04 — Caso de uso `CreateSolidarityCreditUseCase` · `M`

* **Depende de:** HEX-02, HEX-03
* **Arquivos:** `src/solidarity-credit/application/useCases/CreateSolidarityCreditUseCase.ts`, `package.json`
  (script `test:unit`)
* **Comportamento:** busca o empreendimento pelo `document`; se não existir, cria (id `randomUUID`, data de criação
  agora); monta o `CreditRequest` com o `id` do empreendimento; persiste pela porta; devolve o output.
* **Aceite:** implementa a porta primária; recebe a porta secundária por construtor.
* **Testes (dublê em memória de `CreditRequestRepository`):** empreendimento inexistente → cria; empreendimento
  existente → reutiliza (não duplica); `amount` zero/negativo → `ValidationError`; `purpose` vazio → `ValidationError`;
  erro do repositório → propaga sem engolir. **`npm run test:unit` roda sem banco e sem `DATABASE_URL`**, e o script
  `test` passa a cobrir unidade + integração.

### HEX-05 — Adaptador de saída `CreditRequestRepositoryImpl` (Prisma) · `M`

* **Depende de:** HEX-01, HEX-03
* **Arquivos:** `src/solidarity-credit/adapters/prisma/CreditRequestRepositoryImpl.ts`
* **Comportamento:** `findEnterpriseByDocument` consulta `db.orm.public.SolidarityEnterprise`; `save` abre
  `db.transaction` e grava **empreendimento + solicitação** (upsert do empreendimento por `id`, insert da
  solicitação) — ou nada. Converte `Money` ⇄ string decimal e `Date` ⇄ ISO, no mesmo padrão dos repositórios de conta.
* **Aceite:** unicidade de `document` violada → `ConflictError` (não erro cru do driver); falha simulada na segunda
  escrita não deixa linha em `CreditRequest` nem altera o empreendimento; nenhum `Number()` no caminho do dinheiro.

### HEX-06 — Adaptador de entrada `SolidarityCreditController` + rota + composition root · `M`

* **Depende de:** HEX-04, HEX-05
* **Arquivos:** `src/solidarity-credit/adapters/http/SolidarityCreditController.ts`,
  `.../http/solidarity-credit.routes.ts`, `src/app.ts` (montar o router)
* **Comportamento:** valida o corpo com `src/http/validation.ts` (`requireString`, `requireMoney`, `optionalText`),
  chama a **porta** e responde 201; erros passam por `respondError`.
* **Contrato da resposta:**

  ```json
  {
    "message": "Solicitação de crédito solidário registrada com sucesso!",
    "creditRequest": {
      "id": "uuid", "enterpriseId": "uuid", "enterpriseName": "Cooperativa X",
      "amount": "1500.00", "purpose": "Compra de equipamentos",
      "status": "pending", "createdAt": "2026-10-16T10:00:00.000Z"
    }
  }
  ```
* **Aceite:** o construtor do controller é tipado por `CreateSolidarityCreditApplication`; o arquivo de rotas é o
  único que conhece `CreateSolidarityCreditUseCase` e `CreditRequestRepositoryImpl`.

### HEX-07 — Testes de integração do endpoint · `P`

* **Depende de:** HEX-06
* **Arquivos:** `test/integration/solidarity-credit.test.ts`
* **Casos:** 201 e linha gravada (conferida lendo de volta o banco pelo teste); mesmo `document` em dois POSTs →
  **um** empreendimento e **duas** solicitações; `amount` string/ausente/`0` → 400 sem gravar nada;
  `purpose` vazio → 400; mensagem de erro não vaza detalhe interno.
* **Aceite:** os 21 testes existentes continuam verdes.

### HEX-08 — Guarda de dependências `npm run check:hexagon` · `P`

* **Depende de:** HEX-02
* **Arquivos:** `scripts/check-hexagon.mjs`, `package.json`
* **Comportamento:** varre `src/solidarity-credit/domain` e `.../application` e falha (exit 1) se algum arquivo
  importar `express`, `@prisma/*`, `../prisma/` ou `node:http`.
* **Aceite:** sai 0 no estado correto e **sai 1** quando se acrescenta um import proibido de propósito (testar o
  teste, como foi feito com a trava de linha na entrega-3).

### HEX-09 — Documentação da arquitetura · `P`

* **Depende de:** HEX-06
* **Arquivos:** `docs/arquitetura-hexagonal.md` (novo), referência no `readme.md`
* **Conteúdo:** diagrama Mermaid do hexágono com portas e adaptadores; parágrafo justificando a granularidade das
  portas (por que uma porta de saída com dois métodos, e não duas portas); o registro das decisões D2–D4 e D7.

### HEX-10 — README do branch · `M`

* **Depende de:** HEX-01
* **Arquivos:** `readme.md`
* **Problema atual:** o README descreve só a Entrega 1 (`src/app.ts` + `src/server.ts`) e não cita Prisma,
  PostgreSQL, `.env` ou migrations — quem clonar o branch não sobe a aplicação.
* **Aceite:** passo a passo de `cp .env.example .env` → `npm install` → `npx prisma db migrate` → `npm run dev` →
  `npm test`; seção da funcionalidade de crédito com o exemplo de `curl`; exemplos de `.env`.
* **Herdado, mas agora obrigatório:** sem isso ninguém consegue exercitar as tabelas novas.

### Itens opcionais (não obrigatórios para a atividade)

* `GET /credit/solidarity` (listar solicitações) — facilita demonstrar a persistência na apresentação.
* Separar `SolidarityEnterpriseRepository` como porta própria — bom exemplo de refinamento de granularidade
  (mostra que um adaptador novo entra sem tocar no núcleo).
* Máquina de estados da solicitação (aprovar/recusar) — exige nova regra de negócio e novo endpoint.

---

## 8. Ordem de execução (fatias verticais)

| Fatia                         | Itens                          | O que fica provado no fim da fatia                                         |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| 1 — núcleo sem infraestrutura | HEX-02, HEX-03, HEX-04, HEX-08 | o caso de uso funciona e é testado **sem banco e sem HTTP**                |
| 2 — persistência              | HEX-01, HEX-05                 | a solicitação sai do Postgres e volta como entidade de domínio             |
| 3 — HTTP ponta a ponta        | HEX-06, HEX-07                 | `POST /credit/solidarity` cria as duas linhas; suíte verde                 |
| 4 — documentação              | HEX-09, HEX-10                 | o projeto é reproduzível por outra pessoa e a arquitetura está justificada |

Cada fatia termina com `npm run typecheck`, `npm test` e `npm run check:hexagon` verdes. Nada de acumular
fatias sem rodar a suíte.

---

## 9. Definition of Done da atividade

- [ ] `npx tsc --noEmit` sem erros.
- [ ] `npm test` verde — os 21 testes anteriores **e** os novos (unidade do caso de uso + integração do endpoint).
- [ ] Os testes de unidade do núcleo passam **sem `DATABASE_URL`** definida (prova de isolamento).
- [ ] `npm run check:hexagon` verde, e vermelho quando se injeta um import proibido.
- [ ] `POST /credit/solidarity` → 201 e as linhas em `SolidarityEnterprise` e `CreditRequest` conferidas por SQL.
- [ ] Segundo POST com o mesmo `document` reutiliza o empreendimento (1 empreendimento, N solicitações).
- [ ] 400 para entrada inválida, 409 para documento duplicado em corrida, sem mensagem interna vazando.
- [ ] `npx prisma db verify` = *match contract*; `migrations/` com o pacote novo commitado.
- [ ] Diagrama + decisões registrados (HEX-09) e README reproduzível (HEX-10).

---

## 10. Como verificar (copiar e colar)

```bash
# banco descartável
podman run -d --name bancopg -e POSTGRES_USER=banco -e POSTGRES_PASSWORD=banco \
  -e POSTGRES_DB=banco -p 55432:5432 docker.io/library/postgres:17-alpine
printf 'DATABASE_URL="postgresql://banco:banco@localhost:55432/banco"\n' > .env

npm install
npx prisma migration status                      # lista o pacote novo como pendente
npx prisma db migrate --to <hash do plano>
npx prisma db verify

npm run typecheck && npm run check:hexagon && npm test
npm run dev                                       # porta 3000

# caminho feliz
curl -s -X POST http://localhost:3000/credit/solidarity -H 'Content-Type: application/json' \
  -d '{"enterprise":{"name":"Cooperativa de Artesanato","document":"12345678000199"},
       "amount":1500.00,"purpose":"Compra de equipamentos"}' | python3 -m json.tool

# erro de tipo de dinheiro (deve ser 400, sem gravar)
curl -s -X POST http://localhost:3000/credit/solidarity -H 'Content-Type: application/json' \
  -d '{"enterprise":{"name":"X","document":"12345678000199"},"amount":"1500","purpose":"teste"}' -w '\n%{http_code}\n'

# o que ficou gravado
podman exec bancopg psql -U banco -d banco -c 'SELECT * FROM "SolidarityEnterprise"'
podman exec bancopg psql -U banco -d banco -c 'SELECT * FROM "CreditRequest"'

# prova de isolamento do núcleo: sem banco, a suíte de unidade roda
env -u DATABASE_URL npm run test:unit
```

---

## 11. Riscos e armadilhas (as que já custaram tempo)

1. **`prisma migration plan` sem `--from` bifurca o grafo.** O padrão é o ref `db`, que aponta para a **primeira**
   migration (`create_account`), não para a última. O plano saiu com 8 operações, incluindo **recriar a tabela
   `Transaction`** que já existe, e um aviso: *"Planning from it forks the migration graph"*.
   Use `--from a37ca6aabbac` (hash do contrato atual). Sintoma: o `db migrate` falha com "table already exists".
2. **Não existe `migrate dev` nem `db.$transaction([...])` no Prisma 8.** É `npx prisma db migrate` e
   `db.transaction(async (tx) => …)`; `tx.orm` espelha `db.orm` dentro da transação.
3. **Um run de `db migrate` é uma transação no Postgres**: falhou no meio, o run inteiro volta — depois do erro,
   `db verify` antes de tentar de novo.
4. **Nunca importar `src/prisma/db.ts` no núcleo.** É lá que moram os tipos `DbClient`/`TxClient`; importar (mesmo
   "só o tipo") amarra o caso de uso ao Prisma. É exatamente o que o HEX-08 precisa pegar.
5. **Erro de unicidade do Prisma 8** vem como `SqlQueryError` com `sqlState: "23505"` e
   `constraint: "SolidarityEnterprise_document_key"` — casar por esses campos, não por substring da mensagem.
6. **`updatedAt` é `NOT NULL` sem default**; o runtime preenche (`temporal.updatedAtString()`). Não passar na mão.
7. **Dinheiro**: reusar `Money`; nada de `Number()` no caminho do valor (foi assim que a entrega-2 corrompia saldo).
8. **Atomicidade**: as duas escritas (empreendimento + solicitação) vão na mesma `db.transaction`, no adaptador.
9. **Regressão**: os 21 testes da entrega-3 não podem quebrar; o módulo hexagonal não altera os existentes.
10. **Prisma 8 expõe só `poolOptions.connectionTimeoutMillis`/`idleTimeoutMillis`** — o resto do tuning de pool
    exige `pg.Pool` próprio via `pg:`.

---

## 12. Itens herdados (não bloqueiam esta atividade)

* Autenticação/autorização — a API é totalmente aberta.
* Composition root único para o projeto todo (hoje cada arquivo de rota monta sua cadeia).
* Portas/interfaces para o módulo de contas (DIP parcial: `AccountService` depende de classes concretas).
* `main: "index.js"` no `package.json` — o build gera `dist/server.js`.
* `.gitattributes` aponta para `src/prisma/ops.json` (caminho inexistente; os reais estão em `migrations/app/*/`).
* Documento do entregável da entrega-3 apontando para a branch (o `docs/entrega-1.txt` aponta para a `entrega-2`).
