# ADR-0001 — Núcleo de contas em camadas com domínio rico e injeção de dependência

- **Status:** Aceita
- **Data:** 2026-10-09
- **Decisores:** Roberto Fabiano Cunha da Silva (autor do projeto; proposta da Entrega 2)
- **Vale também para:** qualquer módulo novo que não exija fronteira própria — a alternativa hexagonal
  passou a valer apenas onde há motivo declarado (ver ADR-0002)

## Contexto

O Banco Comunitário precisa de conta corrente, depósito, saque e extrato, e a disciplina exige
justificar a arquitetura antes de implementar. As forças em jogo:

* **As regras são estáveis, a infraestrutura não.** Como a conta funciona, o que é saldo
  insuficiente e o que o extrato precisa mostrar mudam pouco; o framework HTTP, a biblioteca de
  banco e o formato de armazenamento mudam com frequência.
* **Integridade é o atributo de qualidade central** (ASR 2). Prestação de contas à comunidade
  quebra se saldo e lançamentos divergirem ou se o valor for arredondado em algum ponto.
* **Modificabilidade (ASR 1) e testabilidade (ASR 3)** são o que a disciplina avalia: trocar a
  persistência deve ser um trabalho local; exercitar regra de negócio não deve exigir banco no ar.
* **Restrições:** um único desenvolvedor, entrega semanal, stack fixada (Node.js + TypeScript +
  Express + PostgreSQL/Prisma), sem infraestrutura de apoio.
* **Alternativas consideradas naquele momento:** arquitetura hexagonal completa no núcleo — melhor
  desacoplamento, mas cerimônia e *mappers* que atrasariam a primeira entrega funcional; modelo
  anêmico com regra no serviço — menos arquivos, porém as invariantes ficariam espalhadas e
  testáveis só via integração; microsserviços — custo operacional (rede, consistência eventual)
  desproporcional a um domínio que ainda está se firmando.

## Decisão

O módulo de contas é organizado em **quatro camadas com domínio rico e injeção de dependência por construtor**:

1. **Apresentação** — `src/routes/` (declaração de rota + instanciação das dependências) e `src/controllers/` (fronteira HTTP). Não contém regra de negócio e não importa Prisma.
2. **Aplicação** — `src/services/AccountService.ts`. Orquestra o caso de uso: verifica duplicidade,
   instancia o domínio, abre a transação e grava conta + lançamento.
3. **Domínio** — `src/models/`: `Account` e `Transaction` com invariantes nos próprios métodos (`deposit`, `withdraw`), `Money` como objeto de valor em centavos inteiros e `errors.ts` com o vocabulário de erro tipado (400/404/409/422). Nenhum import de framework.
4. **Persistência** — `src/repositories/` traduzindo linha ↔ entidade, e `src/prisma/db.ts` como único ponto que conhece o client Prisma 8.

A entrada é validada em `src/http/validation.ts` **antes** de virar domínio, e todo erro tipado é traduzido em status HTTP por `instanceof` em `src/http/errorHandler.ts`; o que não for reconhecido vira 500 genérico, com a mensagem real apenas no log do servidor.

O que esta decisão **não** inclui, de propósito: portas/interfaces para os repositórios do módulo de contas, *composition root* único do projeto e injeção de um client de banco por parâmetro. Esses três pontos são reconhecidos como dívida na seção de consequências.

## Alternativas consideradas

| Alternativa                                                | Por que não                                                                                                                                                                                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hexagonal completa em todo o projeto, desde o início       | Cerimônia alta (duas portas por caso de uso, DTO de comando, *mapper* de saída) para uma entrega em que a fronteira de crédito ainda não existia; o custo cairia sobre o prazo sem entregar desacoplamento que o projeto precisasse naquele momento |
| Modelo anêmico (entidades só com campos, regra no service) | As invariantes ficariam em `if`s espalhados; testar saldo insuficiente exigiria banco ou mock de repositório, o que contraria o ASR 3 e foi a origem de um dos bugs corrigidos depois                                                               |
| Microsserviços por domínio (contas, crédito, notificações) | Complexidade operacional (rede, consistência eventual, orquestração) para um time de uma pessoa e um domínio em consolidação                                                                                                                        |
| Framework com injeção automática (NestJS)                  | Resolveria a composição, mas esconderia a direção das dependências atrás de decoradores — o oposto do que a disciplina pede para justificar                                                                                                         |

## Consequências

### Positivas

* Entrega rápida com fronteira legível: abrir o repositório mostra onde está regra, onde está HTTP e onde está SQL.
* Domínio testável sem banco: as invariantes (`Account`, `Transaction`, `Money`) são exercitadas por construção de objeto, sem infraestrutura.
* Dinheiro correto por construção: `Money` elimina `float` do caminho do valor e o saldo inicial gera o lançamento que o justifica, então o extrato fecha com o saldo.
* Trocar ORM ou banco afeta `src/repositories/` e `src/prisma/` — controllers, service e domínio permanecem.

### Negativas / custos

* **A camada de aplicação conhece o Prisma.** `AccountService` importa `db` e chama `db.transaction(...)` diretamente: a fronteira "aplicação não conhece infraestrutura" é cumprida no discurso, não no código.
* **DIP parcial nos repositórios.** `AccountService` recebe `AccountRepository`/`TransactionRepository` (classes concretas), não interfaces — um dublê de teste precisa estender a classe ou reimplementar o tipo estruturalmente.
* **Composition root duplicado.** `account.routes.ts` e `operation.routes.ts` montam cada um a sua cadeia repositório → service → controller; duas instanciações do mesmo grafo convivem no processo.
* **Mapeamento manual em cada repositório.** `toDomain`/`toString` repetidos por classe, com a regra de conversão de `timestamptz` e `numeric` copiada.
* Não existe proteção automática contra a regra "domínio não importa framework" **neste módulo** — a guarda `check:hexagon` cobre só o módulo hexagonal.

### Riscos e mitigação

| Risco                                                                       | Mitigação                                                                                                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lógica de persistência vazar para as entidades                              | Revisão a cada incremento; o módulo hexagonal de crédito serve de referência de onde a linha fica                                                  |
| Duas cadeias de composição divergirem (uma com `forNoKeyUpdate`, outra sem) | A suíte de integração exercita as duas rotas (contas e operações)                                                                                  |
| Refatorar contas para hexagonal depois custar mais que o previsto           | A migração é incremental (*strangler*), com a suíte atual como rede de segurança; o custo já está registrado em `docs/arquitetura-hexagonal.md` §8 |

## Referências

* `src/routes/account.routes.ts`, `src/routes/operation.routes.ts` — composição das dependências
* `src/controllers/AccountController.ts`, `src/controllers/OperationController.ts`
* `src/services/AccountService.ts` — orquestração e transação
* `src/models/Account.ts`, `src/models/Transaction.ts`, `src/models/Money.ts`, `src/models/errors.ts`
* `src/repositories/AccountRepository.ts`, `src/repositories/TransactionRepository.ts`
* `src/http/validation.ts`, `src/http/errorHandler.ts`
* `docs/entrega-1.txt` (proposta original) e `docs/visao_geral.md`
* Commit da decisão: `9626186` — entrega-2, 2026-10-09
