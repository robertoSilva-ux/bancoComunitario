# Visão arquitetural — Banco Comunitário

Documento de abertura da documentação de arquitetura (Entrega de detalhamento). Ele responde
*o que o sistema é*, *para quem*, *sob quais restrições* e *o que já foi decidido* — o contexto
que os diagramas C4 ([`arquitetura/c4.md`](./arquitetura/c4.md)) e os ADRs
([`adr/`](./adr/README.md)) assumem do lado de dentro.

> Repositório: <https://github.com/robertoSilva-ux/bancoComunitario>

---

## 1. Escopo

O Banco Comunitário é uma **API REST** que sustenta os serviços financeiros solidários de um banco
comunitário: abertura e movimentação de conta corrente, extrato e solicitação de crédito solidário
para empreendimentos da comunidade.

**O que existe hoje no repositório** (não é intenção, é código em `entrega-*`):

| Capacidade | Endpoint | Onde |
|---|---|---|
| Abertura de conta corrente | `POST /accounts` | `src/controllers/AccountController.ts` → `src/services/AccountService.ts` |
| Listagem de contas | `GET /accounts` | idem |
| Depósito | `POST /accounts/:id/deposits` | `src/controllers/OperationController.ts` |
| Saque com verificação de saldo | `POST /accounts/:id/withdrawals` | idem |
| Extrato com saldo consolidado | `GET /accounts/:id/statement` | idem |
| Solicitação de crédito solidário | `POST /credit/solidarity` | `src/solidarity-credit/` |
| Verificação técnica | `GET /`, `GET /health` | `src/app.ts` |

**Fora do escopo desta entrega** (e ausente do código): cartão de crédito popular, pagamento de
contas de consumo, recebimento de benefícios governamentais, gestão de gerentes de conta,
prestação de contas diária/semanal à comunidade, autenticação e autorização, interface web.
A lista completa do que o C4 ainda não representa está em
[`arquitetura/c4.md` §5](./arquitetura/c4.md#5-o-que-este-diagrama-ainda-não-tem).

---

## 2. Stakeholders

| Stakeholder | Interesse | O que espera da arquitetura |
|---|---|---|
| **Morador / empreendedor solidário** (cliente do banco) | Abrir conta, movimentar, consultar extrato, pedir crédito | Resposta rápida e previsível; extrato que fecha com o saldo; valor monetário exato, nunca arredondado |
| **Gerente de conta** (associação comunitária) | Acompanhar contas e extratos; apoiar o associado | Consultas consistentes; no futuro, operar em nome do associado com trilha de auditoria |
| **Conselho gestor / comunidade** | Prestação de contas diária e semanal | Histórico de operações íntegro e auditável; relatórios que não exijam recontar o caixa |
| **Equipe de desenvolvimento** (1 pessoa, no contexto da disciplina) | Evoluir o sistema semana a semana | Fronteiras explícitas entre módulos; regra de dependência verificável por comando, não por memória |
| **Professor / avaliador** | Verificar aderência às decisões propostas | Documentação que mostre o estado real e justifique trade-offs, não apenas vantagens |
| *(futuro)* **Órgão regulador / parceiro de pagamentos** | Operar convênios e notificações | Integrações isoladas por adaptador, sem contaminar o núcleo |

O stakeholder que hoje **pressiona mais** a arquitetura é o conselho gestor: prestação de contas
exige que saldo e lançamentos nunca divirjam. É a origem do ASR de integridade que sustenta os
ADRs 0001 e 0003.

---

## 3. Restrições relevantes

| Restrição | Origem | Efeito na arquitetura |
|---|---|---|
| Prazo semanal e **um único desenvolvedor** | Disciplina (Projeto Integrador) | Nada de infraestrutura que exija operação dedicada (broker, orquestrador, múltiplos serviços); conceitos entram por módulo, não por reescrita |
| Stack fixada: **Node.js + TypeScript + Express**, PostgreSQL e Prisma | Guia da disciplina e aulas | O framework HTTP e o ORM são detalhes de borda; o domínio é escrito sem eles |
| Entrega em **branch por semana** | Enunciado do Projeto Integrador | A arquitetura evolui por incremento; cada decisão é datada no `git log` |
| **Prisma 8 está em RC** (`8.0.0-rc.22`) e o contrato é gerado (`contract.prisma` → `contract.json`/`contract.d.ts`) | Estado da ferramenta no momento da entrega | Artefatos gerados são versionados; migration exige `migration plan --from`, senão o grafo bifurca |
| Sem infraestrutura própria: banco local/contêiner, sem CI, sem ambiente de homologação | Orçamento e escopo acadêmico | Verificação é por script (`npm run check:hexagon`, `npm run typecheck`, suítes de teste), não por pipeline |
| Nenhum dado real de associado; dados de teste apenas | LGPD / ética | Autenticação e anonimização são decisão de projeto, não urgência operacional — por isso o ADR-0004 está em estado *Proposta* |
| API **HTTP/JSON apenas**, sem frontend no repositório | Escopo da disciplina | O C4 mostra o consumidor como ator/pessoa, e o portal web como contêiner previsto |

---

## 4. Principais decisões e características já adotadas

Resumo executivo; o registro completo de cada uma está nos ADRs.

1. **Camadas com domínio rico no núcleo de contas** (ADR-0001) — `routes → controllers → service →
   repositories`, com `Account`, `Transaction` e `Money` como objetos de domínio sem framework
   (`src/models/`). Serve ao ASR de modificabilidade: trocar ORM ou banco mexe na persistência, não
   na regra.
2. **Crédito solidário em arquitetura hexagonal, como módulo autocontido** (ADR-0002) —
   `src/solidarity-credit/{domain,application,adapters}`, portas primária e secundária explícitas e
   `npm run check:hexagon` provando a regra de dependência. As duas topologias convivem de propósito
   (*strangler fig*), em vez de uma reescrita do projeto.
3. **PostgreSQL único, Prisma 8, migrations versionadas, atomicidade no adaptador** (ADR-0003) —
   `numeric` para dinheiro, `db.transaction` envolvendo conta + lançamento, `forNoKeyUpdate` na
   leitura do saque e tradução da violação de unicidade em erro de domínio.
4. **Dinheiro é objeto de valor, não número** — `src/models/Money.ts` guarda centavos inteiros,
   entra por `Money.fromInput`, sai por `toDecimalString` (coluna `numeric`) e por `toJSON` (string
   decimal na resposta). Não existe `float` no caminho do valor.
5. **Fronteira de validação explícita** — toda entrada passa por `src/http/validation.ts` antes de
   virar domínio; erros de domínio são tipados (`src/models/errors.ts`, 400/404/409/422) e mapeados
   por `instanceof` em `src/http/errorHandler.ts`; o resto vira 500 genérico com o erro só no log.
6. **Autenticação e autorização ainda não existem** — decisão registrada como proposta no ADR-0004,
   com a API hoje exposta sem controle de acesso. É a maior dívida arquitetural do projeto.

---

## 5. Como ler o restante da documentação

| Pergunta | Documento |
|---|---|
| Quem usa o sistema, com o que ele se integra e onde termina a fronteira? | [`arquitetura/c4.md` §2 — Nível 1](./arquitetura/c4.md#2-nível-1--diagrama-de-contexto) |
| Quais blocos executáveis existem e como conversam? | [`arquitetura/c4.md` §3 — Nível 2](./arquitetura/c4.md#3-nível-2--diagrama-de-contêineres) |
| Como a API é composta por dentro? | [`arquitetura/c4.md` §4 — Nível 3](./arquitetura/c4.md#4-nível-3--diagrama-de-componentes) |
| Por que cada uma dessas escolhas foi feita? | [`adr/`](./adr/README.md) |
| Como o hexágono foi desenhado e verificado? | [`arquitetura-hexagonal.md`](./arquitetura-hexagonal.md) |
