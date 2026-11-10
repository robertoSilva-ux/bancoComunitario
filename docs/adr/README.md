# Architecture Decision Records — Banco Comunitário

Registro durável das decisões arquiteturais do projeto. Cada arquivo conta **o que foi decidido, sob
quais forças, com quais alternativas descartadas e a que custo** — o que o diagrama não diz.

| # | Decisão | Status | Data | Arquivo |
|---|---|---|---|---|
| 0001 | Núcleo de contas em camadas com domínio rico e injeção de dependência | Aceita | 2026-10-09 | [0001-camadas-com-dominio-rico.md](./0001-camadas-com-dominio-rico.md) |
| 0002 | Crédito solidário isolado em módulo hexagonal, sem converter o projeto inteiro | Aceita | 2026-10-15 | [0002-credito-solidario-hexagonal.md](./0002-credito-solidario-hexagonal.md) |
| 0003 | Um único PostgreSQL com Prisma 8, migrations versionadas e atomicidade no adaptador | Aceita | 2026-10-09 | [0003-postgresql-unico-prisma-migrations.md](./0003-postgresql-unico-prisma-migrations.md) |
| 0004 | Autenticação por token de acesso curto com perfis e autorização no caso de uso | **Proposta** | 2026-11-10 | [0004-autenticacao-jwt-por-perfis.md](./0004-autenticacao-jwt-por-perfis.md) |

## Regras

1. **ADR registra decisão tomada, não intenção.** "Aceita" só se existe no código ou no histórico do
   Git. O que ainda não existe fica como "Proposta" (caso do ADR-0004) ou só no backlog.
2. **A data é a do commit que materializou a decisão**, obtida de `git log --date=short` — não a data
   em que o ADR foi escrito.
3. **ADR aceito não se edita.** Mudou de ideia → ADR novo, "Aceita", e o antigo vira "Substituída por
   ADR-XXXX". A numeração é sequencial e nunca reaproveitada.
4. **Toda decisão carrega custo.** Sem consequência negativa, sem risco e sem motivo real para as
   alternativas descartadas, o registro é propaganda — e não passa na revisão.
5. **Referência a arquivo, não a memória.** Cada ADR aponta os arquivos reais do projeto que
   sustentam a decisão.
6. **Em divergência, o ADR é a fonte.** O `readme.md` da raiz e o
   [`visao-arquitetural.md`](../visao-arquitetural.md) resumem; se contradisserem um ADR, corrige-se
   no mesmo commit.

## Template

```markdown
# ADR-NNNN — Afirmação no presente

- **Status:** Proposta | Aceita | Substituída por ADR-XXXX | Depreciada
- **Data:** AAAA-MM-DD (do git log)
- **Decisores:** quem decidiu

## Contexto
Forças, restrições, atributos de qualidade, riscos, características do projeto e alternativas em jogo. Sem solução.

## Decisão
O que foi decidido, no presente do indicativo, com detalhe suficiente para implementar sem perguntar.

## Alternativas consideradas
Cada uma com o motivo real de ter sido descartada.

## Consequências
### Positivas
### Negativas / custos
### Riscos e mitigação

## Referências
Arquivos reais do projeto.
```

## Pendências conhecidas (decisões que ainda não têm ADR)

Registradas para não serem rediscutidas do zero — cada uma vira ADR quando for decidida:

* **Comunicação assíncrona / notificações** — o C4 (nível 1 e 2) mostra um serviço de notificações
  como *previsto*; não há fila, broker nem worker. Decidir entre outbox + fila e envio síncrono é o
  próximo ADR natural, e depende do ADR-0004 (quem é o destinatário da notificação).
* **Composition root único do projeto** — hoje cada arquivo de rota monta a própria cadeia (custo
  registrado no ADR-0001).
* **Migrar o módulo de contas para o padrão hexagonal** — decisão de migração incremental já
  anunciada no ADR-0002; falta o ADR de execução (ordem, critério de parada, o que fica em camadas).
* **Enum/`CHECK` para `Transaction.type` e `CreditRequest.status`** — hoje são `text` sem restrição no
  banco (custo registrado no ADR-0003).
* **Pagamento de contas de consumo (API de convênios)** — segundo sistema externo previsto no nível 1.
