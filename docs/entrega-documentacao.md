# Banco Comunitário — Entrega de documentação arquitetural

**Visão arquitetural, modelo C4 (níveis 1 a 3) e 4 ADRs**

| | |
|---|---|
| **Entrega** | Documentação arquitetural — no Moodle: *"Entrega 3 : Documentação"*; no material da aula: *"Entrega 4 — visão arquitetural: C4 + ADR"* |
| **Autor** | Roberto Fabiano Cunha da Silva |
| **Disciplina** | Princípios e Padrões de Arquitetura — Projeto Integrador (IFRS Campus Rio Grande) |
| **Data** | 10/11/2026 |
| **Repositório** | <https://github.com/robertoSilva-ux/bancoComunitario> |
| **Branch** | `entrega-4` |
| **Documentos de origem** | [`docs/visao-arquitetural.md`](visao-arquitetural.md), [`docs/arquitetura/c4.md`](arquitetura/c4.md), [`docs/adr/`](adr/README.md) |

**Sumário**

1. Visão arquitetural
2. Documentação C4 — contexto, contêineres e componentes
3. Architecture Decision Records (ADR-0001 a ADR-0004)
4. Identificação do repositório e da branch

---

## 1. Visão arquitetural

### 1.1 Escopo

O Banco Comunitário é uma **API REST** que sustenta os serviços financeiros solidários de um banco
comunitário. O escopo funcional declarado na disciplina abrange crédito para empreendimentos
solidários, crédito para consumo familiar sem juros, cartão popular solidário, conta corrente com
extrato, depósito, saque, pagamento de contas de consumo, recebimento de benefícios, gestão de
gerentes e prestação de contas diária/semanal à comunidade.

O que está **implementado e verificável** no repositório:

| Capacidade | Endpoint | Onde |
|---|---|---|
| Abertura de conta corrente | `POST /accounts` | `src/controllers/AccountController.ts` → `src/services/AccountService.ts` |
| Listagem de contas | `GET /accounts` | idem |
| Depósito | `POST /accounts/:id/deposits` | `src/controllers/OperationController.ts` |
| Saque com verificação de saldo | `POST /accounts/:id/withdrawals` | idem |
| Extrato com saldo consolidado | `GET /accounts/:id/statement` | idem |
| Solicitação de crédito solidário | `POST /credit/solidarity` | `src/solidarity-credit/` |
| Verificação técnica | `GET /`, `GET /health` | `src/app.ts` |

Estão **fora do que o sistema faz hoje**: cartão de crédito popular, pagamento de contas de consumo,
recebimento de benefícios, gestão de gerentes, prestação de contas periódica, autenticação e
interface web. O diagrama de contexto registra os dois sistemas externos dessas capacidades como
*previstos*, e a §2.4 lista todas as ausências.

### 1.2 Principais stakeholders

| Stakeholder | Interesse | O que espera da arquitetura |
|---|---|---|
| **Morador / empreendedor solidário** | Abrir conta, movimentar, consultar extrato, pedir crédito | Resposta rápida e previsível; extrato que fecha com o saldo; valor monetário exato |
| **Gerente de conta** (associação comunitária) | Acompanhar contas e extratos, apoiar o associado | Consultas consistentes; no futuro, operar em nome do associado com trilha de auditoria |
| **Conselho gestor / comunidade** | Prestação de contas diária e semanal | Histórico íntegro e auditável; relatórios que dispensem recontar o caixa |
| **Equipe de desenvolvimento** (1 pessoa, no contexto da disciplina) | Evoluir o sistema semana a semana | Fronteiras explícitas entre módulos; regra de dependência verificável por comando |
| **Professor / avaliador** | Verificar aderência às decisões propostas | Documentação do estado real, com trade-offs justificados |

O stakeholder que mais pressiona a arquitetura é o **conselho gestor**: prestação de contas exige que
saldo e lançamentos nunca divirjam. É a origem do requisito de integridade que sustenta os ADRs 0001
e 0003.

### 1.3 Restrições relevantes

| Restrição | Origem | Efeito na arquitetura |
|---|---|---|
| Prazo semanal, **um único desenvolvedor** | Projeto Integrador | Nada de infraestrutura com custo de operação dedicada; conceito novo entra por módulo, não por reescrita |
| Stack fixada: **Node.js + TypeScript + Express**, PostgreSQL, Prisma | Guia da disciplina | Framework HTTP e ORM são detalhes de borda; o domínio é escrito sem eles |
| Entrega em **branch por semana** | Enunciado do Projeto Integrador | Arquitetura evolui por incremento; cada decisão é datada no `git log` |
| **Prisma 8 em RC** (`8.0.0-rc.22`), contrato gerado a partir de PSL | Estado da ferramenta na entrega | Artefatos gerados (`contract.json`/`contract.d.ts`) são versionados; migration exige `--from`, senão o grafo bifurca |
| Sem infraestrutura própria: banco local, sem CI, sem homologação | Orçamento e escopo acadêmico | Verificação por script (`typecheck`, `test`, `check:hexagon`), não por pipeline |
| Apenas dados fictícios | LGPD / ética | Autenticação é decisão de projeto, não urgência operacional — daí o ADR-0004 em estado *Proposta* |
| API **HTTP/JSON apenas**, sem frontend no repositório | Escopo da disciplina | O C4 mostra o consumidor como pessoa e o portal web como contêiner previsto |

### 1.4 Principais decisões e características arquiteturais já adotadas

1. **Camadas com domínio rico no núcleo de contas** (ADR-0001): `routes → controllers → service →
   repositories`, com `Account`, `Transaction` e `Money` como objetos de domínio sem framework.
2. **Crédito solidário em arquitetura hexagonal como módulo autocontido** (ADR-0002):
   `src/solidarity-credit/{domain,application,adapters}`, com portas primária e secundária e a regra
   de dependência verificada por `npm run check:hexagon`.
3. **PostgreSQL único, Prisma 8, migrations versionadas, atomicidade no adaptador** (ADR-0003):
   `numeric` para dinheiro, `db.transaction` em conta + lançamento, `forNoKeyUpdate` na leitura para
   saque.
4. **Dinheiro é objeto de valor, não número**: `src/models/Money.ts` guarda centavos inteiros, entra
   por `Money.fromInput`, sai por `toDecimalString` (coluna `numeric`) e `toJSON` (string decimal).
5. **Fronteira de validação explícita**: entrada validada em `src/http/validation.ts`; erros de
   domínio tipados (400/404/409/422) mapeados por `instanceof` em `src/http/errorHandler.ts`.
6. **As duas topologias convivem de propósito** (*strangler fig*): o módulo novo nasce limpo e a
   migração do módulo de contas é trabalho posterior, com a suíte atual como rede de segurança.
7. **Não existe autenticação**: decisão registrada como proposta no ADR-0004, com a API hoje exposta
   sem controle de acesso — a maior dívida arquitetural do projeto.

---

## 2. Documentação C4

Os três níveis exigidos, em Mermaid, versionados junto com o código em
[`docs/arquitetura/c4.md`](arquitetura/c4.md) (o `.md` é a fonte; não há PNG no repositório, porque
imagem exportada envelhece em paralelo ao diagrama).

| Nível | Pergunta que responde | Quando precisa mudar |
|---|---|---|
| 1 — Contexto | Com quem o banco comunitário conversa e onde termina a fronteira? | entra ator, sistema externo ou integração nova |
| 2 — Contêineres | Quais blocos executáveis/armazenamentos existem e como se comunicam? | nasce contêiner, muda tecnologia ou protocolo |
| 3 — Componentes | Como a API é composta por dentro e quem pode depender de quem? | muda fronteira de módulo, camada ou porta |

Convenção: **todo relacionamento tem verbo no presente do indicativo**. Nó marcado `previsto` **não
existe no código** — está no desenho porque o escopo declarado do banco comunitário o exige, e o
rótulo deixa isso explícito em vez de fingir que já foi entregue.

**Notação.** Os três níveis usam `flowchart` do Mermaid com a semântica do C4: `subgraph` para a
fronteira do sistema, forma/cor por tipo de elemento (pessoa, sistema, contêiner, armazenamento,
externo) e relacionamentos com verbo. A notação nativa `C4Context`/`C4Container` posiciona os nós pela
ordem de declaração e fazia setas atravessarem caixas (verificado renderizando); o modelo C4 é
independente de notação, e a §4.4 de `docs/arquitetura/c4.md` registra a razão da troca.

### 2.1 Nível 1 — Diagrama de Contexto

Fronteira do sistema, pessoas/atores, sistemas externos e relacionamentos.

```mermaid
flowchart TB
    MORADOR(["Morador / empreendedor solidário<br/>[Pessoa]<br/>Associado da comunidade"])
    GERENTE(["Gerente de conta<br/>[Pessoa]<br/>Funcionário da associação"])
    CONSELHO(["Conselho gestor<br/>[Pessoa]<br/>Acompanha a prestação de contas"])

    subgraph BANK["Banco Comunitário — fronteira do sistema"]
        SISTEMA["Banco Comunitário<br/>[Sistema de software]<br/>Contas, depósitos, saques, extrato e crédito solidário"]
    end

    EMAIL["Serviço de e-mail<br/>[Sistema externo · previsto]<br/>Notifica operações e crédito"]
    CONVENIOS["API de convênios<br/>[Sistema externo · previsto]<br/>Consulta e paga contas de consumo"]

    MORADOR -->|"Movimenta conta"| SISTEMA
    GERENTE -->|"Consulta contas"| SISTEMA
    CONSELHO -->|"Consulta extrato"| SISTEMA
    SISTEMA -->|"Envia notificação"| EMAIL
    SISTEMA -->|"Paga convênios"| CONVENIOS

    classDef person fill:#1565c0,stroke:#0d47a1,color:#fff
    classDef system fill:#1e88e5,stroke:#1565c0,color:#fff
    classDef external fill:#90a4ae,stroke:#607d8b,color:#fff
    class MORADOR,GERENTE,CONSELHO person
    class SISTEMA system
    class EMAIL,CONVENIOS external```

**Elementos e relações**

| Origem | Destino | Relacionamento (rótulo do diagrama) | O que a interação significa |
|---|---|---|---|
| Morador / empreendedor solidário | Banco Comunitário | Movimenta conta | Depósito, saque e consulta de extrato da própria conta (HTTPS/JSON) |
| Gerente de conta | Banco Comunitário | Consulta contas | Acompanha contas e extratos dos associados (HTTPS/JSON) |
| Conselho gestor / comunidade | Banco Comunitário | Consulta extrato | Confere as movimentações do período para a prestação de contas |
| Banco Comunitário | Serviço de e-mail *(previsto)* | Envia notificação | Informa operação realizada e decisão de crédito (SMTP/HTTPS) |
| Banco Comunitário | API de convênios *(previsto)* | Paga convênios | Consulta e quita contas de consumo do associado (HTTPS/JSON) |

**Notas de leitura.** A fronteira desenhada é o Banco Comunitário como um todo; como não há
interface web nem aplicativo no repositório, os três atores acessam por cliente HTTP. Os rótulos do
diagrama são curtos de propósito (legibilidade); a coluna da direita diz o que cada interação
significa quando o verbo sozinho não basta. O conselho gestor consome hoje o mesmo
endpoint de extrato que o gerente — não existe relatório de prestação de contas próprio. Os dois
sistemas externos são `previsto`; quando existirem, entram como adaptador, sem tocar no núcleo
(ADR-0002). Serviços de infraestrutura (DNS, TLS, hospedagem) ficam fora de propósito: o C4 de
contexto representa software, não topologia de rede.

### 2.2 Nível 2 — Diagrama de Contêineres

Blocos executáveis/deployáveis e armazenamentos de dados, com responsabilidade, tecnologia e
relacionamentos.

```mermaid
flowchart TB
    MORADOR(["Morador / empreendedor<br/>[Pessoa]"])

    subgraph BANK["Banco Comunitário — fronteira do sistema"]
        API["API REST<br/>[Contêiner: Node.js + Express 5 + TypeScript]<br/>Expõe contas, operações e crédito solidário"]
        DB[("Banco de dados<br/>[Contêiner: PostgreSQL 15]<br/>Contas, lançamentos e crédito")]
        MIG["Runner de migrations<br/>[Contêiner: Prisma 8 CLI]<br/>Aplica migrations e verifica o schema"]
    end

    MORADOR -->|"Envia requisição HTTPS/JSON"| API
    API -->|"Lê e grava — SQL"| DB
    MIG -->|"Aplica migrations — SQL"| DB

    classDef person fill:#1565c0,stroke:#0d47a1,color:#fff
    classDef container fill:#1e88e5,stroke:#1565c0,color:#fff
    classDef data fill:#ffb74d,stroke:#ef6c00,color:#000
    class MORADOR person
    class API,MIG container
    class DB data```

| Contêiner | Responsabilidade | Tecnologia | Estado |
|---|---|---|---|
| **API REST** | Único processo executável. Recebe HTTP, valida a entrada, executa os casos de uso (`AccountService` em camadas; `CreateSolidarityCreditUseCase` no hexágono) e serializa JSON. | Node.js, Express 5.2, TypeScript 7, `tsx` em dev | existente |
| **Banco de dados** | Estado durável: `Account`, `Transaction`, `SolidarityEnterprise`, `CreditRequest`. Guarda as invariantes que só o banco garante (unicidade de documento, `numeric` para dinheiro). | PostgreSQL 15+ | existente |
| **Runner de migrations** | Aplica `migrations/app/<timestamp>_<nome>` e gera `contract.prisma` → `contract.json`/`contract.d.ts`, que são versionados. Não roda automaticamente em produção. | Prisma 8 CLI | existente |
| **Portal web do cliente** | Interface para associado e gerente consumirem a API. | não decidido | **previsto — fora do diagrama** |
| **Serviço de notificações** | Traduz eventos de operação em e-mail/SMS, fora do caminho da requisição. | não decidido | **previsto — fora do diagrama** |

**Decisões de fronteira que este nível torna visíveis.** (a) **Um único armazenamento para todos os
módulos** — contas e crédito compartilham instância e schema `public`; o isolamento é feito no código,
pela guarda de dependência (custo registrado no ADR-0003). (b) **Nada de broker hoje**: não há fila
nem worker no código; a notificação aparece apenas como sistema externo *previsto* no nível 1, e a
introdução de fila será decisão própria.
(c) **O portal não fala com o banco** — se existir, consome a API, que é o único ponto de escrita.

### 2.3 Nível 3 — Diagrama de Componentes (contêiner API)

Dois recortes, porque um desenho único com 12 componentes vira ilegível: os rótulos das arestas caem
sobre as caixas. Cada recorte responde uma pergunta diferente — **mesma semântica do C4**, com layout
sob controle (`flowchart` + `subgraph` + `classDef`).

#### 2.3.1 Recorte A — caminho de uma requisição no módulo de contas

Pergunta: *o que acontece entre `POST /accounts/:id/withdrawals` e o `UPDATE` no PostgreSQL?*

```mermaid
flowchart TB
    R["routes/<br/>account · operation"]
    C["controllers/<br/>AccountController<br/>OperationController"]
    V["http/validation.ts"]
    S["services/<br/>AccountService"]
    A["Account"]
    T["Transaction"]
    M["Money"]
    ER["models/errors.ts"]
    AIR["http/errorHandler.ts"]
    AR["AccountRepository"]
    TR["TransactionRepository"]
    U["prisma/uniqueConstraint.ts"]
    P["prisma/db.ts<br/>Prisma 8 · transaction()"]
    DB[("PostgreSQL")]

    R --> C
    C --> V
    V --> S
    S --> A
    S --> T
    A --> M
    T --> M
    S -->|"erro de domínio"| ER
    ER --> AIR
    C --> AIR
    S --> AR
    S --> TR
    AR --> U
    AR --> P
    TR --> P
    P -->|"SQL"| DB

    classDef http fill:#e3f2fd,stroke:#1565c0,color:#0d2b45
    classDef app fill:#e8f5e9,stroke:#2e7d32,color:#0d2b14
    classDef core fill:#f1f8e9,stroke:#558b2f,color:#1b2a0e
    classDef pers fill:#fff8e1,stroke:#ef6c00,color:#3b2300
    classDef data fill:#eceff1,stroke:#37474f,color:#0d1a1f
    class R,C,V,AIR http
    class S app
    class A,T,M,ER core
    class AR,TR,U,P pers
    class DB data
```

| Componente | Arquivo | Responsabilidade | Depende de |
|---|---|---|---|
| Rotas / composition root | `src/routes/account.routes.ts`, `operation.routes.ts` | Declarar rotas e instanciar repositórios → service → controller | controllers, services, repositories (classes concretas) |
| Controllers | `src/controllers/AccountController.ts`, `OperationController.ts` | Fronteira HTTP: valida campos, chama o service, monta JSON e status | `AccountService`, `http/validation`, `http/errorHandler` |
| Validação de fronteira | `src/http/validation.ts` | Converte `unknown` do corpo em tipos confiáveis, com mensagem por campo | — (só a lib padrão) |
| Serviço de aplicação | `src/services/AccountService.ts` | Orquestra o caso de uso: duplicidade, instância de domínio, transação, gravação de conta + lançamento | domínio, repositórios, `db.transaction` |
| Domínio | `src/models/Account.ts`, `Transaction.ts`, `Money.ts`, `errors.ts` | Invariantes: saldo não nasce negativo, saque não excede saldo, valor positivo, dinheiro em centavos. Sem framework. | `Money`, erros tipados |
| Repositórios | `src/repositories/AccountRepository.ts`, `TransactionRepository.ts` | Traduzem domínio ↔ linha; aceitam `Client` (global ou transacional); traduzem 23505 em `ConflictError` | `prisma/db.ts`, `prisma/uniqueConstraint.ts` |
| Client de persistência | `src/prisma/db.ts` | Instancia o client Prisma 8 a partir de `contract.json`; expõe `DbClient`/`TxClient`/`Client` | PostgreSQL, `DATABASE_URL` |
| Tratamento de erro | `src/http/errorHandler.ts` | Erro tipado → status por `instanceof`; desconhecido → 500 genérico, erro real só no log | `models/errors.ts` |

**Custo visível neste recorte** (registrado no ADR-0001): `AccountService` importa `db` e abre a
transação, e as rotas instanciam classes concretas. No módulo de contas a inversão de dependência é
**parcial** — o serviço depende de `AccountRepository` (classe), não de uma porta.

#### 2.3.2 Recorte B — módulo de crédito solidário: hexágono, composição e núcleo compartilhado

Pergunta: *como o módulo hexagonal se conecta ao resto sem que o núcleo veja infraestrutura?*

```mermaid
flowchart TB
    subgraph IN["Adaptadores primários"]
        RT["solidarity-credit.routes.ts"]
        CT["SolidarityCreditController"]
    end

    subgraph COREX["Núcleo da aplicação"]
        PI(["«porta»<br/>CreateSolidarityCreditApplication"])
        UC["CreateSolidarityCreditUseCase"]
        D1["CreditRequest"]
        D2["SolidarityEnterprise"]
        PO(["«porta»<br/>CreditRequestRepository"])
    end

    subgraph OUT["Adaptadores secundários"]
        IM["CreditRequestRepositoryImpl"]
        P["prisma/db.ts"]
        DB[("PostgreSQL")]
    end

    GUARD{{"check:hexagon"}}

    RT --> CT
    CT -->|"chama"| PI
    PI -. "implementada por" .-> UC
    UC --> D1
    UC --> D2
    UC -->|"consome"| PO
    PO -. "implementada por" .-> IM
    IM --> P
    P --> DB
    GUARD -. "verifica" .-> COREX

    classDef http fill:#e3f2fd,stroke:#1565c0,color:#0d2b45
    classDef core fill:#e8f5e9,stroke:#2e7d32,color:#0d2b14
    classDef port fill:#f3e5f5,stroke:#6a1b9a,color:#2a0d33
    classDef pers fill:#fff8e1,stroke:#ef6c00,color:#3b2300
    classDef ext fill:#eceff1,stroke:#546e7a,color:#0d1a1f
    class RT,CT http
    class UC,D1,D2 core
    class PI,PO port
    class IM,P pers
    class DB,GUARD ext```

**Seta sólida = chamada; seta pontilhada = implementação ou dependência de tipo.** O núcleo não aponta
para fora: são os adaptadores que apontam para as portas.

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| Composition root | `adapters/http/solidarity-credit.routes.ts` | Único lugar que conhece as implementações: monta repositório → caso de uso → controller e registra `POST /credit/solidarity` |
| Adaptador primário | `adapters/http/SolidarityCreditController.ts` | Traduz HTTP em `CreateSolidarityCreditCommand`; **tipado pela porta**, não pela classe do caso de uso |
| Porta primária | `application/ports/CreateSolidarityCreditApplication.ts` | Contrato de entrada (`execute(command)`), em linguagem de domínio, sem `Request`/`Response` |
| Caso de uso | `application/useCases/CreateSolidarityCreditUseCase.ts` | Localiza ou cria o empreendimento, constrói `CreditRequest`, delega a persistência atômica |
| Domínio | `domain/CreditRequest.ts`, `domain/SolidarityEnterprise.ts` | Invariantes do crédito: valor positivo, finalidade, vínculo com empreendimento |
| Porta secundária | `application/ports/CreditRequestRepository.ts` | `findEnterpriseByDocument` + `save(creditRequest, enterprise)` como **unidade de trabalho** |
| Adaptador secundário | `adapters/prisma/CreditRequestRepositoryImpl.ts` | Implementa a porta sobre Prisma 8; a transação (`db.transaction`) mora aqui |
| Guarda de dependência | `scripts/check-hexagon.mjs` | Falha com exit 1 se `domain/`/`application/` importarem Express, `@prisma/*`, `src/prisma/`, `src/http/` ou `adapters/` |

#### 2.3.3 Regra de dependência em forma de tabela

| De → para | Pode? | Por quê |
|---|---|---|
| `adapters/http` → porta primária | ✅ | Adaptador de entrada depende da abstração do núcleo |
| `adapters/http` → `useCases` | ❌ | O composition root instancia, mas o controller **não** importa a classe do caso de uso |
| `adapters/prisma` → porta secundária e domínio | ✅ | Adaptador de saída traduz entre porta/domínio e banco |
| `application` → `domain` | ✅ | Direção natural do núcleo |
| `application`/`domain` → `express`, `@prisma/*`, `src/prisma/`, `src/http/`, `adapters/` | ❌ | **Verificado por `npm run check:hexagon`** |
| `application`/`domain` → `models/Money`, `models/errors` | ✅ | Núcleo compartilhado: valor monetário e vocabulário de erro |
| módulo de contas ↔ `solidarity-credit` | ❌ hoje | Não há dependência entre os módulos; só compartilham `models/` e `prisma/` |
| domínio → `node:crypto` | ✅ (com nota) | Biblioteca padrão do runtime, não framework; gerador de id por porta é item opcional de backlog |

O **Nível 4 (código)** não foi produzido: o enunciado não o exige, e o `contract.d.ts` gerado pelo
Prisma já documenta o formato exato das estruturas persistidas.

### 2.4 O que este diagrama ainda não tem

Ausências do **estado atual** — cada linha é também uma dívida: quando o incremento existir, a linha
sai no mesmo commit do código.

* **Autenticação e autorização**: todos os endpoints são públicos; não há usuário, sessão, token nem
  perfil (ADR-0004, estado *Proposta*).
* **Interface de usuário**: sem portal web ou aplicativo no repositório; o nível 2 os mostra como
  `previsto`.
* **Integrações externas**: nenhum adaptador de e-mail, SMS, convênios ou pagamento existe — os dois
  sistemas externos do nível 1 são `previsto`.
* **Comunicação assíncrona**: sem fila, broker ou worker; tudo executa no ciclo da requisição.
* **Ciclo de vida do crédito**: só a criação da solicitação; sem análise, aprovação, recusa,
  desembolso, parcelas, limite ou listagem (`status` fica sempre em `"pending"`).
* **Serviços do escopo não implementados**: cartão popular, pagamento de contas de consumo,
  benefícios, gestão de gerentes, prestação de contas diária/semanal.
* **Observabilidade**: sem log estruturado, métrica ou tracing; única saída é `console.error` no
  middleware de erro.
* **Deploy e CI**: sem pipeline, contêiner de aplicação ou homologação; verificação é manual.
* **Composition root único do projeto**: cada arquivo de rota monta a própria cadeia (ADR-0001).

---
## 3. Architecture Decision Records

Quatro decisões arquiteturais significativas do projeto. O registro canônico de cada uma está em
[`docs/adr/`](adr/README.md); abaixo está a consolidação submetida. Em caso de divergência, o arquivo
em `docs/adr/` vence.

| # | Decisão | Status | Data |
|---|---|---|---|
| 0001 | Núcleo de contas em camadas com domínio rico e injeção de dependência | Aceita | 2026-10-09 |
| 0002 | Crédito solidário isolado em módulo hexagonal, sem converter o projeto inteiro | Aceita | 2026-10-15 |
| 0003 | Um único PostgreSQL com Prisma 8, migrations versionadas e atomicidade no adaptador | Aceita | 2026-10-09 |
| 0004 | Autenticação por token de acesso curto com perfis e autorização no caso de uso | Proposta | 2026-11-10 |

### 3.1 ADR-0001 — Núcleo de contas em camadas com domínio rico e injeção de dependência

**Status:** Aceita · **Data:** 2026-10-09 · **Decisores:** Roberto Fabiano Cunha da Silva

#### Contexto

O Banco Comunitário precisa de conta corrente, depósito, saque e extrato, e a disciplina exige
justificar a arquitetura antes de implementar. As forças em jogo:

* **As regras são estáveis, a infraestrutura não.** Como a conta funciona, o que é saldo insuficiente
  e o que o extrato precisa mostrar mudam pouco; o framework HTTP, a biblioteca de banco e o formato
  de armazenamento mudam com frequência.
* **Integridade é o atributo de qualidade central.** Prestação de contas à comunidade quebra se saldo
  e lançamentos divergirem ou se o valor for arredondado em algum ponto.
* **Modificabilidade e testabilidade** são o que a disciplina avalia: trocar a persistência deve ser
  trabalho local; exercitar regra de negócio não deve exigir banco no ar.
* **Restrições:** um desenvolvedor, entrega semanal, stack fixada (Node.js + TypeScript + Express +
  PostgreSQL/Prisma), sem infraestrutura de apoio.

#### Decisão

O módulo de contas é organizado em **quatro camadas com domínio rico e injeção de dependência por
construtor**:

1. **Apresentação** — `src/routes/` (rota + instanciação de dependências) e `src/controllers/`
   (fronteira HTTP). Sem regra de negócio, sem importar Prisma.
2. **Aplicação** — `src/services/AccountService.ts`: verifica duplicidade, instancia o domínio, abre a
   transação e grava conta + lançamento.
3. **Domínio** — `src/models/`: `Account` e `Transaction` com invariantes nos próprios métodos
   (`deposit`, `withdraw`), `Money` como objeto de valor em centavos e `errors.ts` com o vocabulário de
   erro tipado (400/404/409/422). Nenhum import de framework.
4. **Persistência** — `src/repositories/` traduzindo linha ↔ entidade, e `src/prisma/db.ts` como único
   ponto que conhece o client Prisma 8.

A entrada é validada em `src/http/validation.ts` **antes** de virar domínio, e todo erro tipado é
traduzido em status HTTP por `instanceof` em `src/http/errorHandler.ts`.

O que a decisão **não** inclui, de propósito: portas/interfaces para os repositórios de contas,
*composition root* único do projeto e injeção do client de banco — reconhecidos como dívida abaixo.

#### Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Hexagonal completa em todo o projeto desde o início | Cerimônia alta (duas portas por caso de uso, DTO, *mapper*) para uma entrega em que a fronteira de crédito ainda não existia |
| Modelo anêmico (regra no service) | Invariantes em `if`s espalhados; testar saldo insuficiente exigiria banco ou mock, contrariando a testabilidade |
| Microsserviços por domínio | Complexidade operacional desproporcional a um time de uma pessoa e domínio em consolidação |
| Framework com injeção automática (NestJS) | Esconderia a direção das dependências atrás de decoradores — o oposto do que a disciplina pede para justificar |

#### Consequências

**Positivas:** fronteira legível (mostra onde está regra, HTTP e SQL); domínio testável sem banco;
dinheiro correto por construção (`Money` elimina `float`, e o saldo inicial gera o lançamento que o
justifica, então o extrato fecha com o saldo); trocar ORM/banco afeta só a persistência.

**Negativas / custos:** a camada de aplicação **conhece o Prisma** (`AccountService` importa `db` e
chama `db.transaction`); **DIP parcial** (o serviço recebe classes, não interfaces); **composition root
duplicado** entre `account.routes.ts` e `operation.routes.ts`; mapeamento manual `toDomain`/`toString`
repetido em cada repositório; a guarda `check:hexagon` **não** cobre este módulo.

**Riscos e mitigação:** lógica de persistência vazar para as entidades → revisão a cada incremento, com
o módulo hexagonal como referência de onde fica a linha; duas cadeias de composição divergirem → a
suíte de integração exercita as duas rotas; migrar contas para hexagonal custar mais que o previsto →
migração incremental (*strangler*), com a suíte atual como rede (registrado em
`docs/arquitetura-hexagonal.md` §8).

**Arquivos:** `src/routes/`, `src/controllers/`, `src/services/AccountService.ts`, `src/models/`,
`src/repositories/`, `src/http/`. Commit `9626186`.

### 3.2 ADR-0002 — Isolar o crédito solidário em módulo hexagonal, sem converter o projeto inteiro

**Status:** Aceita · **Data:** 2026-10-15 · **Decisores:** Roberto Fabiano Cunha da Silva

#### Contexto

A atividade da semana pede arquitetura hexagonal (Ports and Adapters) para o crédito solidário. O
projeto já tem o módulo de contas em camadas (ADR-0001), com suíte de integração e domínio em
funcionamento.

* **A fronteira do crédito é nova e vai mudar.** Análise, aprovação, recusa, desembolso, parcelas,
  score e notificação não estão decididos. É o tipo de módulo em que trocar infraestrutura deve ser
  barato.
* **A disciplina cobra isolamento verificável, não declarado.** Interface que existe só para agradar o
  diagrama não prova nada; a regra precisa falhar em algum comando quando for violada.
* **Reescrever o projeto inteiro custaria a suíte existente e o prazo de uma semana**, sem benefício
  proporcional: o módulo de contas já atende aos seus requisitos de qualidade.
* **Risco declarado de conviver com duas topologias:** sem documentação, o código apodrece em dois
  estilos meio aplicados.
* **Restrições:** um desenvolvedor; sem mensageria; o módulo novo precisa reaproveitar `Money` e os
  erros tipados para não criar um segundo vocabulário.

#### Decisão

O crédito solidário é entregue como **módulo autocontido em arquitetura hexagonal** em
`src/solidarity-credit/`, convivendo com o módulo de contas em camadas (*strangler fig*: a topologia
nova entra por módulo, não por reescrita):

* `domain/` — `CreditRequest`, `SolidarityEnterprise`, sem framework;
* `application/ports/` — **porta primária** `CreateSolidarityCreditApplication` e **porta secundária**
  `CreditRequestRepository`, cujo `save(creditRequest, enterprise)` declara uma **unidade de trabalho**:
  as duas escritas são atômicas ou não acontecem;
* `application/useCases/CreateSolidarityCreditUseCase` — implementa a porta primária, consome a
  secundária;
* `adapters/http/` — `SolidarityCreditController` tipado **pela porta**, não pela classe do caso de uso,
  e `solidarity-credit.routes.ts` como *composition root* único do módulo;
* `adapters/prisma/CreditRequestRepositoryImpl` — implementa a porta sobre Prisma 8; a transação mora
  aqui, não na porta.

A regra de dependência é **verificada por comando**: `npm run check:hexagon` retorna 1 se algum arquivo
de `domain/`/`application/` importar `express`, `@prisma/*`, `src/prisma/`, `src/http/`, `node:http` ou
`adapters/`. `npm run test:unit` roda domínio e caso de uso com repositório em memória, **sem
`DATABASE_URL`** — se a infraestrutura vazasse, a suíte pararia de rodar. Os nomes de classe seguem
literalmente os do enunciado.

#### Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Converter o projeto inteiro para hexagonal agora | Reescrever contas sem ganho imediato, consumindo o prazo e arriscando a suíte que já cobre os requisitos do módulo |
| Hexagonal "de fachada" (interfaces criadas, controller dependendo da classe) | A inversão existiria no diagrama e não no código; nenhuma troca de adaptador seria possível |
| Duas portas secundárias (solicitação + empreendimento) | Sugeriria duas operações independentes, e a atomicidade acabaria no caso de uso falando de transação |
| Extrair o crédito para um processo/serviço separado | Rede, deploy e consistência eventual para um domínio com um endpoint |
| Manter camadas iguais às de contas | Não cumpriria a atividade e perderia o argumento de testabilidade sem banco nas fronteiras |

#### Consequências

**Positivas:** trocar a persistência do crédito é escrever um adaptador novo e editar **uma linha** do
composition root; o núcleo é exercitado sem banco; a fronteira é visível na árvore de diretórios e
verificável por comando; a unidade de trabalho mantém a atomicidade no adaptador; o módulo serve de
referência para migrar contas depois.

**Negativas / custos:** **duas topologias convivem** (`src/services/` em camadas e
`src/solidarity-credit/application/` hexagonal); **mais arquivos por caso de uso** (porta, caso de uso,
dois DTOs, dois adaptadores); **a guarda é textual** (lê especificadores de import com expressão
regular — import dinâmico passaria); o núcleo usa `node:crypto` para gerar id (biblioteca padrão, não
framework; variante purista por porta ficou como item opcional); o reconhecimento do erro 23505 foi
extraído para `src/prisma/uniqueConstraint.ts` e é usado pelos dois módulos — acoplamento aceito e
explícito.

**Riscos e mitigação:** divergência de padrão entre módulos → `docs/arquitetura-hexagonal.md` declara
qual padrão vale onde, e a migração de contas está no backlog; guarda burlada por import indireto →
revisão + `test:unit` sem banco; crescimento do módulo sem novos casos de uso → cada caso novo exige
porta e teste próprios.

**Arquivos:** `src/solidarity-credit/`, `scripts/check-hexagon.mjs`, `package.json`
(`check:hexagon`, `test:unit`), `test/unit/`, `docs/arquitetura-hexagonal.md`. Commits `0cee6a8` e
`abae468`.

### 3.3 ADR-0003 — Um único PostgreSQL com Prisma 8, migrations versionadas e atomicidade no adaptador

**Status:** Aceita · **Data:** 2026-10-09 · **Decisores:** Roberto Fabiano Cunha da Silva

#### Contexto

* **Prestação de contas exige que saldo e lançamentos nunca divirjam.** Conta criada sem o lançamento
  de saldo inicial produz extrato que não fecha; duas requisições simultâneas com o mesmo CPF produzem
  duas contas.
* **Dinheiro não pode passar por ponto flutuante.** A primeira versão usava `Number()` no caminho do
  valor e produzia `0.30000000000000004` no extrato.
* **A evolução do schema precisa ser auditável** — não um `db push` que reescreve o banco.
* **Restrições:** um desenvolvedor; PostgreSQL 15+ local ou em contêiner, sem administrador de banco;
  **Prisma 8 em RC** com contrato gerado a partir de PSL; sem janela de manutenção.
* A aula sugere como decisão plausível "um PostgreSQL com schema por módulo"; aqui foi avaliada a
  versão mais simples — uma instância, um schema, isolamento no código.

#### Decisão

1. **Uma instância PostgreSQL, schema `public`**, com `Account`, `Transaction`, `SolidarityEnterprise`
   e `CreditRequest` juntas. Sem schema por módulo, sem banco por módulo.
2. **Dinheiro é `numeric`**, trafegando como string decimal entre domínio (`Money`, centavos inteiros)
   e banco (`toDecimalString`). Nenhum `float`/`double` no caminho do valor.
3. **`src/prisma/contract.prisma` é a fonte do schema**; `contract.json` e `contract.d.ts` são gerados e
   **versionados**, para que um clone rode sem regenerar nada.
4. **Migrations versionadas** em `migrations/app/<timestamp>_<nome>`, cada uma com `migration.json` +
   `ops.json` (operações com `precheck`, `execute`, `postcheck`) e snapshot em `migrations/snapshots/`.
   Plano gerado com `prisma migration plan --from <snapshot>`; sem `--from` o grafo bifurca.
5. **Migrations aditivas** (criar tabela/índice): sem *data migration* até hoje.
6. **A atomicidade fica no adaptador**: `db.transaction(...)` envolve conta + lançamento inicial em
   `AccountService.createAccount` e empreendimento + solicitação em
   `CreditRequestRepositoryImpl.save`. A porta declara *o que* é atômico; o *como* é do adaptador.
7. **A leitura para saque usa `forNoKeyUpdate`**, travando a linha durante a transação sem bloquear a
   inserção de lançamentos na mesma conta.
8. **A violação de unicidade vira erro de domínio**: `src/prisma/uniqueConstraint.ts` reconhece o
   SQLSTATE 23505 pela constraint e os repositórios devolvem `ConflictError` — o pré-check cobre o caso
   comum, a constraint decide a corrida.

#### Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Schema por módulo (`accounts`, `credit`) na mesma instância | Reforçaria a fronteira no banco, mas exigiria `search_path`/qualificação em todo acesso e complicaria as migrations; o isolamento avaliado é o de código, verificado por `check:hexagon`. Custo aceito: não há barreira de banco entre módulos |
| Um banco por módulo/serviço | Duas conexões, dois backups, transação distribuída para operações hoje locais |
| `prisma db push` em vez de migrations | Apaga a história: o schema do banco seria o que estivesse no disco de quem rodou por último |
| ORM maduro (TypeORM, Sequelize) ou SQL puro com `pg` | Menos risco de versão RC, mas reescrever a persistência custaria mais que conviver com o RC |
| Dinheiro em `float` com arredondamento na borda | Erro acumulado no extrato — inaceitável para prestação de contas |
| Transação exposta na porta (`runInTransaction`) | Vazaria infraestrutura para o núcleo hexagonal (ADR-0002) |

#### Consequências

**Positivas:** custo operacional mínimo (um banco, um backup, uma conexão); atomicidade real nas duas
operações compostas; extrato fecha com o saldo; histórico auditável de migrations
(`prisma migration status`); dinheiro exato de ponta a ponta; corrida de documento resolvida no banco.

**Negativas / custos:** **acoplamento ao mesmo SGBD** — um problema na instância derruba contas e
crédito juntos, e nada impede fisicamente o módulo de crédito de ler a tabela `Account`; **Prisma 8 é
RC**, então upgrade pode quebrar o contrato, e o `contract.d.ts` gerado passa de mil linhas e polui o
diff; **`type` e `status` são `text`, não enum/`CHECK`** — a restrição "deposit | withdrawal" vive só no
domínio; **`--from` explícito** é passo manual que já causou grafo bifurcado quando esquecido; **sem
backup automatizado** nem política de retenção (aceitável com dados fictícios, não com dados reais).

**Riscos e mitigação:** migration sem `--from` bifurca o grafo → procedimento no README +
`prisma migration status` antes de aplicar; upgrade do Prisma RC quebra o contrato → contrato
versionado e upgrade em branch própria com a suíte de integração como critério; acesso cruzado entre
módulos → revisão de código e guarda de imports; valor inválido em `type`/`status` por escrita externa
→ `CHECK`/enum em migration aditiva quando houver escrita fora da aplicação.

**Arquivos:** `src/prisma/contract.prisma`, `contract.json`/`contract.d.ts`, `src/prisma/db.ts`,
`src/prisma/uniqueConstraint.ts`, `migrations/app/*`, `migrations/snapshots/*`,
`src/services/AccountService.ts`, `src/models/Money.ts`. Commit `0cee6a8`.

### 3.4 ADR-0004 — Autenticação por token de acesso curto com perfis e autorização no caso de uso

**Status:** **Proposta — não implementada** · **Data:** 2026-11-10 · **Decisores:** Roberto Fabiano
Cunha da Silva

> **Aviso de estado:** hoje **todos os endpoints são públicos**. Qualquer cliente que alcance a porta
> cria conta, deposita, saca e solicita crédito. A ausência está registrada na §2.4 e este ADR existe
> para que a decisão não seja improvisada no meio de outra tarefa.

#### Contexto

* **Integridade e rastreabilidade:** a tabela `Transaction` não guarda *quem* executou a operação. Sem
  identidade não há trilha de auditoria, e prestação de contas pressupõe saber quem lançou o quê.
* **A separação de papéis já está no negócio:** o associado movimenta a própria conta; o gerente apoia o
  associado; o conselho gestor lê e não escreve. Hoje os três são o mesmo cliente anônimo.
* **Restrições:** um desenvolvedor, entrega semanal, dados fictícios, nenhuma infraestrutura de
  identidade disponível. **Autenticação malfeita é pior que a ausência:** cria sensação de proteção e
  esconde o risco.

#### Decisão

Quando aceita, o Banco Comunitário passa a autenticar por **token de acesso de vida curta (JWT, 15
minutos) com refresh token rotativo**:

1. **Módulo de identidade próprio em arquitetura hexagonal** (`src/identity/{domain,application,adapters}`, a criar),
   seguindo o ADR-0002: autenticação não entra dentro do módulo de contas.
2. **Senha com `argon2id`** calibrado para ~100 ms; hash e *pepper* fora do banco.
3. **`HS256` no início, com migração para `RS256`** quando houver mais de um serviço validando token;
   segredo em variável de ambiente, com rotação documentada.
4. **Perfis (`associado`, `gerente`, `auditor`) como claim**, e **autorização decidida no caso de uso**,
   não no controller: "o associado só movimenta a própria conta" é regra de negócio e mora no núcleo; o
   middleware apenas popula `request.actor`.
5. **Negação por padrão**: middleware de autenticação em todas as rotas, com lista explícita de rotas
   públicas (`/`, `/health`). Rota nova nasce protegida.
6. **Refresh em cookie `HttpOnly` + `SameSite=Strict`** com rotação e detecção de reuso; token de acesso
   nunca em `localStorage`.
7. **Identidade na trilha de auditoria**: `Transaction` e `CreditRequest` ganham `createdBy` em migration
   aditiva — sem isso a autenticação não entrega o requisito que a motivou.

#### Alternativas consideradas

| Alternativa | Por que não (agora) |
|---|---|
| Sessão em cookie com estado no servidor | Revogável de imediato, mas exige armazenamento compartilhado quando houver mais de um processo; plano B se revogação imediata virar requisito |
| OAuth2/OIDC com provedor externo (Keycloak, Auth0) | Mais seguro e menos código, mas adiciona um serviço e um fluxo inteiros para um projeto de uma pessoa sem usuários reais |
| Chave de API estática | Identifica integração, não pessoa; sem perfil, sem expiração, sem atribuição a um associado |
| mTLS | Resolve serviço-a-serviço, não o associado no cliente HTTP; exige PKI |
| Manter público | Inaceitável com dados reais; aceito apenas enquanto os dados são fictícios e a ausência está declarada |

#### Consequências

**Positivas:** token sem estado escala sem sessão compartilhada; perfis no token deixam a autorização
legível junto da regra que ela protege; refresh rotativo com detecção de reuso dá revogação prática sem
*denylist* permanente; abre caminho para `createdBy`.

**Negativas / custos:** **revogação de token de acesso é por expiração** (15 min) — desligar um usuário
exige refresh store ou *denylist*, ou seja, parte do estado volta; **complexidade real** (emissão,
rotação, hashing, middlewares, testes negativos, gestão de segredo) — é a maior entrega isolada que
falta; **superfície nova de erro de segurança** (algoritmo aceito, `aud`/`iss`, *clock skew*, CSRF);
**custo no caminho da requisição** (verificação de assinatura; `argon2id` no login); **impacto em tudo
que existe** — a suíte de integração passa hoje sem credencial e passa a precisar de token.

**Riscos e mitigação:** implementação insegura dar falsa proteção → bateria de testes **negativos** antes
de habilitar (sem token 401, token de outro perfil 403, token expirado 401, refresh reusado revoga);
token em `localStorage` e XSS → acesso em memória, refresh em cookie `HttpOnly` + `SameSite=Strict`;
segredo vazado → `.env` fora do versionamento e rotação documentada; autenticação "de fachada" →
regra de perfil no caso de uso, com teste unitário sem HTTP; decisão adiada indefinidamente → a ausência
está declarada na §2.4 e o item entra no backlog com critério de aceite.

**Referências:** `src/app.ts` (nenhum middleware de autenticação hoje), `src/prisma/contract.prisma`
(tabelas sem `createdBy`), `src/solidarity-credit/` (padrão de módulo a reusar em `src/identity/`).

---

## 4. Identificação do repositório e da branch

| | |
|---|---|
| **Repositório** | <https://github.com/robertoSilva-ux/bancoComunitario> |
| **Branch desta entrega** | [`entrega-4`](https://github.com/robertoSilva-ux/bancoComunitario/tree/entrega-4) |
| **Branch anterior** | [`entrega-3`](https://github.com/robertoSilva-ux/bancoComunitario/tree/entrega-3) — módulo de crédito solidário em arquitetura hexagonal |

**Onde cada artefato está no repositório**

| Exigido | Caminho |
|---|---|
| Visão arquitetural | `docs/visao-arquitetural.md` (consolidado nesta §1) |
| C4 Nível 1 — Contexto | `docs/arquitetura/c4.md` §2 (nesta §2.1) |
| C4 Nível 2 — Contêineres | `docs/arquitetura/c4.md` §3 (nesta §2.2) |
| C4 Nível 3 — Componentes | `docs/arquitetura/c4.md` §4 (nesta §2.3) |
| 4 ADRs | `docs/adr/0001` a `0004` (consolidados nesta §3) |
| Índice da documentação | `docs/README.md` |
| Desenho e verificação do hexágono | `docs/arquitetura-hexagonal.md` |

**Sobre a numeração.** No Moodle a atividade aparece como *"Entrega 3 : Documentação"*, e o material
da aula a apresenta como *"Entrega 4 — visão arquitetural: C4 + ADR"*. No repositório ela vive na
branch `entrega-4`, porque a branch `entrega-3` foi usada pela atividade de arquitetura hexagonal.

**Como verificar o que os ADRs afirmam.** Resultado medido nesta máquina em 10/11/2026
(Node.js 24.18, `node_modules` instalado):

| Comando | O que prova | Resultado |
|---|---|---|
| `npm run check:hexagon` | o núcleo não importa framework, Prisma, `src/http` nem adaptadores (ADR-0002) | `✔ núcleo hexagonal isolado (5 arquivos em 2 diretórios)` |
| `npm run typecheck` | `tsc --noEmit` + `tsc -p tsconfig.test.json`, cobrindo `src` e `test` | sem erros |
| `npm run test:unit` | domínio e caso de uso rodam **sem banco** | 15 testes, 15 passando, 0 falhas |
| `npm test` | unidade + integração (exige PostgreSQL e `DATABASE_URL`) | não executado aqui: esta máquina não tem PostgreSQL instalado |
| `npx prisma migration status` | schema em dia com `migrations/app` | exige banco; não executado aqui |

* A visão e os diagramas são Markdown/Mermaid: renderizam direto no GitHub, sem exportação. Os três
  diagramas foram renderizados e conferidos (sintaxe e sobreposição de rótulos) antes da submissão.
* As decisões datadas vêm de `git log --date=short` (2026-10-09 para os ADRs 0001 e 0003; 2026-10-15
  para o ADR-0002; 2026-11-10 para a proposta do ADR-0004).
