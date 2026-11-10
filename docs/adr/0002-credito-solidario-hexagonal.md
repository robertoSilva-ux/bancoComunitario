# ADR-0002 — Isolar o crédito solidário em módulo hexagonal, sem converter o projeto inteiro

- **Status:** Aceita
- **Data:** 2026-10-15
- **Decisores:** Roberto Fabiano Cunha da Silva (autor do projeto)
- **Vale também para:** módulos futuros com fronteira de domínio própria (notificações, pagamentos)

## Contexto

A atividade da semana pede arquitetura hexagonal (Ports and Adapters) para a funcionalidade de crédito solidário. O projeto já tem o módulo de contas em camadas (ADR-0001), com suíte de integração e domínio funcionando.

Forças:

* **A fronteira do crédito é nova e ainda vai mudar.** Análise, aprovação, recusa, desembolso e parcelas não estão decididos; o formato de persistência e as integrações (score, notificação) também não. É exatamente o tipo de módulo em que trocar infraestrutura deve ser barato.
* **A disciplina cobra isolamento verificável, não declarado.** Uma interface que existe só para agradar o diagrama não prova nada; a regra de dependência precisa falhar em algum comando quando for violada.
* **Reescrever o projeto inteiro custaria a suíte existente e o prazo de uma semana**, sem benefício proporcional: o módulo de contas já atende aos seus ASRs.
* **Risco declarado de conviver com duas topologias:** quem abrir o repositório depois precisa saber onde vale qual padrão, senão o código apodrece em dois estilos meio aplicados.
* **Restrições:** um desenvolvedor; nenhuma infraestrutura de mensageria; o módulo novo precisa reaproveitar `Money` e os erros tipados do projeto para não criar um segundo vocabulário.

## Decisão

O crédito solidário é entregue como **módulo autocontido em arquitetura hexagonal** em `src/solidarity-credit/`, convivendo com o módulo de contas em camadas (*strangler fig*: a topologia
nova entra por módulo, não por reescrita):

* `domain/` — `CreditRequest` e `SolidarityEnterprise`, sem framework;
* `application/ports/` — **porta primária** `CreateSolidarityCreditApplication` (contrato do caso de uso, em linguagem de domínio) e **porta secundária** `CreditRequestRepository`, cujo `save(creditRequest, enterprise)` declara uma **unidade de trabalho**: as duas escritas são atômicas ou não acontecem;
* `application/useCases/CreateSolidarityCreditUseCase` — implementa a porta primária, consome a secundária;
* `adapters/http/` — `SolidarityCreditController` tipado **pela porta**, não pela classe do caso de uso, e `solidarity-credit.routes.ts` como *composition root* único do módulo;
* `adapters/prisma/CreditRequestRepositoryImpl` — implementa a porta sobre Prisma 8; a transação do banco mora aqui, não na porta.

A regra de dependência é **verificada por comando**: `npm run check:hexagon`
(`scripts/check-hexagon.mjs`) percorre `domain/` e `application/` e retorna 1 se algum arquivo importar `express`, `@prisma/*`, `src/prisma/`, `src/http/`, `node:http` ou `adapters/`. A suíte `0npm run test:unit` roda o domínio e o caso de uso com repositório em memória, **sem`DATABASE_URL`** — se a infraestrutura vazasse, ela pararia de rodar.

Os nomes de classe seguem literalmente os do enunciado CreateSolidarityCreditUseCase`,
`CreditRequest`, `SolidarityEnterprise`, `CreditRequestRepository`, `CreditRequestRepositoryImpl`,
`SolidarityCreditController`), para não haver discussão de equivalência na correção.

## Alternativas consideradas

| Alternativa                                                                                           | Por que não                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Converter o projeto inteiro para hexagonal agora                                                      | Reescrever contas sem ganho imediato, consumindo o prazo de uma semana e colocando em risco a suíte que já cobre os ASRs do módulo |
| Hexagonal "de fachada": criar as interfaces e deixar o controller dependendo da classe do caso de uso | A inversão existiria no diagrama e não no código; nenhuma troca de adaptador seria possível sem editar o controller                |
| Duas portas secundárias (`CreditRequestRepository` + `SolidarityEnterpriseRepository`)                | Sugeriria duas operações independentes, e a atomicidade acabaria no caso de uso falando de transação — infraestrutura no núcleo    |
| Extrair o crédito para um serviço separado (processo próprio)                                         | Rede, deploy e consistência eventual para um domínio com um endpoint; custo desproporcional                                        |
| Manter camadas iguais às do módulo de contas                                                          | Não cumpriria o que a atividade pede e perderia o argumento de testabilidade sem banco nas fronteiras                              |

## Consequências

### Positivas

* Trocar a persistência do crédito é escrever um adaptador novo e editar **uma linha** do composition root; caso de uso, domínio e controller não mudam.
* O núcleo é exercitado sem banco (`test/unit/`), o que dá um teste barato e honesto do isolamento.
* A fronteira fica visível na árvore de diretórios e verificável por `npm run check:hexagon` — a regra deixou de ser promessa.
* A unidade de trabalho na porta mantém a decisão de atomicidade no adaptador; o núcleo não conhece transação.
* O módulo serve de referência para migrar contas depois, sem inventar padrão novo.

### Negativas / custos

* **Duas topologias convivem.** Quem abre o repositório encontra `src/services/` (camadas) e `src/solidarity-credit/application/` (hexagonal); sem documentação, o padrão vira loteria.
* **Mais arquivos por caso de uso**: porta, caso de uso, adaptador, DTO de comando e de saída — 5 arquivos onde o módulo de contas usaria 2.
* **A guarda é textual.** O script lê especificadores de import com expressão regular; um import construído dinamicamente ou um `require` passariam. A proteção é boa para regressão comum, não é sandbox.
* **Núcleo ainda usa `node:crypto`** para gerar id (biblioteca padrão, não framework); a variante purista — injetar um gerador de id por porta — ficou como item opcional de backlog.
* O adaptador duplica o reconhecimento de violação de unicidade? Não: `src/prisma/uniqueConstraint.ts` foi extraído do módulo de contas e passou a ser usado pelos dois — mas isso amarra os dois módulos a um utilitário compartilhado, que é acoplamento aceito e explícito.

### Riscos e mitigação

| Risco                                                                         | Mitigação                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Divergência de padrão entre os módulos (um refatora, o outro não)             | `docs/arquitetura-hexagonal.md` declara qual padrão vale onde; o item de migração de contas está no backlog  |
| Guarda burlada por import indireto                                            | Revisão de PR + `test:unit` sem banco: um import de infraestrutura no núcleo quebra a suíte, não só o script |
| Crescimento do módulo sem novos casos de uso (só criação de solicitação hoje) | Cada caso novo exige porta e teste próprios; a granularidade fina está documentada como refinamento possível |

## Referências

* `src/solidarity-credit/domain/CreditRequest.ts`, `SolidarityEnterprise.ts`
* `src/solidarity-credit/application/ports/` — as duas portas
* `src/solidarity-credit/application/useCases/CreateSolidarityCreditUseCase.ts`
* `src/solidarity-credit/adapters/http/`, `adapters/prisma/`
* `scripts/check-hexagon.mjs`, `package.json` (`check:hexagon`, `test:unit`)
* `test/unit/application/CreateSolidarityCreditUseCase.test.ts`, `test/unit/domain/solidarity-credit.test.ts`
* `docs/arquitetura-hexagonal.md`, `docs/backlog-atividade-hexagonal.md`
* Commits: `0cee6a8` e `abae468` — 2026-10-15
