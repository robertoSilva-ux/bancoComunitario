# ADR-0003 — Um único PostgreSQL com Prisma 8, migrations versionadas e atomicidade no adaptador

- **Status:** Aceita
- **Data:** 2026-10-09
- **Decisores:** Roberto Fabiano Cunha da Silva (autor do projeto)
- **Vale também para:** módulos futuros que persistirem estado (notificações, pagamentos)

## Contexto

Toda a integridade do banco comunitário depende do que a persistência garante. As forças:

* **Prestação de contas à comunidade exige que saldo e lançamentos nunca divirjam** (ASR 2). Conta criada sem o lançamento de saldo inicial produz extrato que não fecha; duas requisições simultâneas com o mesmo CPF produzem duas contas.
* **Dinheiro não pode passar por ponto flutuante.** A primeira versão usava `Number()` no caminho do valor e produzia `0.30000000000000004` no extrato.
* **A evolução do schema precisa ser auditável.** O avaliador (e o próprio autor, semanas depois) precisa ver o que mudou e em que ordem — não um `db push` que reescreve o banco.
* **Restrições:** um desenvolvedor; PostgreSQL 15+ local ou em contêiner, sem administrador de banco;
  **Prisma 8 em RC** (`^^8.0.0-rc.17` / CLI `8.0.0-rc.22`), com contrato gerado a partir de PSL;
  nenhuma janela de manutenção nem *downtime* aceitável.
* **Sugestões consideradas:** a aula propõe como decisão plausível "um PostgreSQL com schema por módulo" (ADR-0003 do material). Aqui a avaliada foi a versão mais simples: uma instância, um schema, e o isolamento feito no código.

## Decisão

1. **Uma instância PostgreSQL, schema `public`, todas as tabelas juntas**: `Account`,
   `Transaction`, `SolidarityEnterprise`, `CreditRequest`. Não há schema por módulo nem banco por módulo.
2. **Dinheiro é `numeric`**, trafegando como string decimal entre domínio (`Money`, centavos inteiros) e banco (`toDecimalString`). Nenhum `float`/`double` no caminho do valor.
3. **`src/prisma/contract.prisma` é a fonte do schema**; `contract.json` e `contract.d.ts` são gerados e **versionados**, para que um clone rode sem regenerar nada.
4. **Migrations versionadas em `migrations/app/<timestamp>_<nome>`**, cada uma com `migration.json` + `ops.json` (operações com `precheck`, `execute` e `postcheck`) e snapshot em `migrations/snapshots/`. Plano de migration é gerado com `prisma migration plan --from <snapshot>`; sem `--from` o grafo bifurca.
5. **As migrations são aditivas** (criar tabela/índice): não há *data migration* até hoje.
6. **A atomicidade fica no adaptador de persistência.** `db.transaction(...)` envolve conta + lançamento inicial em `AccountService.createAccount` e empreendimento + solicitação em
   `CreditRequestRepositoryImpl.save`. A porta secundária declara *o que* é atômico; o *como* é do
   adaptador.
7. **A leitura para saque usa `forNoKeyUpdate`** (`findByIdForUpdate`), travando a linha pelo tempo
   da transação sem bloquear a inserção de lançamentos na mesma conta.
8. **A violação de unicidade é traduzida em erro de domínio.** `src/prisma/uniqueConstraint.ts`
   reconhece o SQLSTATE 23505 pela constraint e os repositórios devolvem `ConflictError` — o pré-check do serviço cobre o caso comum, a constraint decide a corrida.

## Alternativas consideradas

| Alternativa                                                           | Por que não                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Um schema por módulo (`accounts`, `credit`) na mesma instância        | Reforçaria a fronteira no banco, mas exigiria `search_path`/qualificação em todo acesso e complicaria as migrations; o isolamento que a disciplina avalia é o de código, e este é verificado por `check:hexagon`. Fica registrado que o custo aceito é não ter barreira de banco entre módulos |
| Um banco por módulo/serviço                                           | Duas conexões, dois backups, transação distribuída para operações que hoje são locais — custo desproporcional ao escopo                                                                                                                                                                        |
| `prisma db push` em vez de migrations                                 | Rápido, e apaga a história: o schema do banco passaria a ser o que estiver no disco de quem rodou por último                                                                                                                                                                                   |
| ORM maduro (TypeORM, Sequelize) ou SQL puro com `pg`                  | Menos risco de versão RC, porém o projeto já tinha contrato e migrations geradas; reescrever a persistência custaria mais que conviver com o RC                                                                                                                                                |
| Dinheiro em `float`/`double` com arredondamento na borda              | Erro acumulado em extrato de conta; inaceitável para prestação de contas                                                                                                                                                                                                                       |
| Transação explícita no caso de uso (porta expondo `runInTransaction`) | Vazaria infraestrutura para o núcleo hexagonal (ADR-0002)                                                                                                                                                                                                                                      |

## Consequências

### Positivas

* **Custo operacional mínimo**: um banco, um backup, uma conexão — compatível com um desenvolvedor.
* **Atomicidade real**: conta e lançamento gravam juntos; empreendimento e solicitação gravam juntos.
* **Extrato fecha com o saldo** porque o saldo inicial gera o lançamento que o justifica.
* **Histórico auditável**: cada migration tem timestamp, JSON de operações e snapshot; `prisma
  migration status` diz o estado sem abrir o banco à mão.
* **Dinheiro exato** de ponta a ponta: `numeric` no banco, centavos no domínio, string decimal no JSON.
* **Corrida de documento resolvida no banco**, não por sorte de timing.

### Negativas / custos

* **Acoplamento ao mesmo SGBD**: todos os módulos compartilham a instância; um problema nela derruba
  contas e crédito juntos, e não há barreira física impedindo o crédito de ler a tabela `Account`.
* **Prisma 8 é RC**: upgrade pode quebrar o contrato; `contract.d.ts` gerado passa de mil linhas e
  polui o diff de qualquer mudança de schema.
* **`type` e `status` são `text`, não enum/`CHECK`**: `Transaction.type` aceita qualquer string, e a
  restrição "deposit | withdrawal" vive só no domínio. O banco não impede um valor inválido vindo de
  script ou de importação.
* **Migrations com `--from` explícito**: é um passo manual que já causou grafo bifurcado quando
  esquecido; a correção é procedimento, não automação.
* **Sem retenção/backup automatizado** nem política de dados: aceitável com dados fictícios, não
  seria com dados de associados reais (LGPD).

### Riscos e mitigação

| Risco                                                           | Mitigação                                                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Migration sem `--from` bifurca o grafo                          | Procedimento documentado no README e `prisma migration status` antes de cada aplicação                                           |
| Upgrade do Prisma 8 RC quebra o contrato                        | Contrato gerado é versionado; upgrade é feito em branch própria com a suíte de integração como critério                          |
| Acesso cruzado entre módulos por não haver barreira no banco    | Revisão de código; a guarda de dependência cobre imports, e qualquer consulta fora do repositório do módulo é visível na revisão |
| Valor inválido em `type`/`status` por escrita fora da aplicação | `CHECK` ou enum pode entrar em migration aditiva quando houver escrita externa (item de backlog)                                 |
| Perda de dados em ambiente local sem backup                     | `pg_dump` antes de migrations destrutivas; hoje todas são aditivas                                                               |

## Referências

* `src/prisma/contract.prisma` (schema), `contract.json`/`contract.d.ts` (gerados, versionados)
* `src/prisma/db.ts` — client, `DbClient`/`TxClient`/`Client`
* `src/prisma/uniqueConstraint.ts` — reconhecimento do 23505
* `migrations/app/20261009T0416_create_account`, `20261009T0426_add_transactions`,
  `20261016T0208_add_solidarity_credit`; `migrations/snapshots/`
* `src/services/AccountService.ts` (`db.transaction`, `findByIdForUpdate`)
* `src/repositories/AccountRepository.ts`, `src/solidarity-credit/adapters/prisma/CreditRequestRepositoryImpl.ts`
* `src/models/Money.ts`
* Commit: `0cee6a8` — 2026-10-15 (dinheiro como objeto de valor, validação de fronteira e escrita atômica)
