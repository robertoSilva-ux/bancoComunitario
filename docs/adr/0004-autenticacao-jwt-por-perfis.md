# ADR-0004 — Autenticação por token de acesso curto com perfis e autorização no caso de uso

- **Status:** Proposta — **não implementada**
- **Data:** 2026-11-10
- **Decisores:** Roberto Fabiano Cunha da Silva (autor do projeto)
- **Vale também para:** todo endpoint de escrita financeira e o futuro portal do cliente

> **Aviso de estado:** esta decisão está proposta, não aceita. Hoje **todos os endpoints do Banco Comunitário são públicos**: qualquer cliente que alcance a porta cria conta, deposita, saca e solicita crédito. O diagrama C4 registra essa ausência em [`../arquitetura/c4.md`](../arquitetura/c4.md#5-o-que-este-diagrama-ainda-não-tem).

## Contexto

O sistema movimenta dinheiro de uma comunidade e não tem noção de identidade: não existe usuário, sessão, token nem perfil. Três pressões tornam isso urgente em um projeto real:

* **Integridade e rastreabilidade** (ASR 2): a tabela `Transaction` não guarda *quem* executou a operação. Sem identidade não há trilha de auditoria, e prestação de contas à comunidade pressupõe saber quem lançou o quê.
* **Separação de papéis já está no domínio do negócio**: o associado movimenta a própria conta; o gerente da associação apoia o associado; o conselho gestor precisa ler, não escrever. Hoje todos os três são o mesmo cliente anônimo.
* **Restrições e forças contrárias**: um desenvolvedor, entrega semanal, dados fictícios, nenhuma infraestrutura de identidade disponível. Implementar autenticação **mal** é pior que não ter: cria a sensação de proteção e esconde o risco. Por isso a decisão fica registrada como proposta, com o desenho pronto, em vez de ser improvisada no meio de outra tarefa.
* **Alternativas avaliadas:** sessão em cookie com estado no servidor; OAuth2/OIDC delegado a um provedor de identidade externo; chave de API estática; mTLS; e a inação (manter público).

## Decisão

Quando esta proposta for aceita, o Banco Comunitário passa a autenticar por **token de acesso de vida curta (JWT, 15 minutos) acompanhado de refresh token rotativo**, com as seguintes escolhas:

1. **Módulo de identidade próprio, em arquitetura hexagonal** (seguindo o ADR-0002), a criar em `src/identity/{domain,application,adapters}`, com porta primária para login/refresh e porta secundária para credenciais e sessões. Autenticação não entra dentro do módulo de contas.
2. **Senha com `argon2id`** (parâmetros calibrados para ~100 ms), nunca MD5/SHA puro; hash e *pepper* fora do banco.
3. **Assinatura `HS256` no início, com migração planejada para `RS256`** quando existir mais de um serviço validando token: segredo único em variável de ambiente, com rotação documentada.
4. **Perfis (`associado`, `gerente`, `auditor`) como claim do token**, e **autorização decidida no caso de uso**, não no controller: "o associado só movimenta a própria conta" é regra de negócio, e mora no núcleo — o middleware apenas popula `request.actor`.
5. **Negação por padrão**: middleware de autenticação em todas as rotas, com lista explícita de rotas públicas (`/`, `/health`). Rota nova nasce protegida.
6. **Refresh token em cookie `HttpOnly` + `SameSite=Strict`** com rotação e detecção de reuso; o token de acesso nunca é persistido em `localStorage`.
7. **Identidade na trilha de auditoria**: `Transaction` e `CreditRequest` ganham `createdBy` (id do ator) em migration aditiva — sem isso a autenticação não entrega o ASR que a motivou.

## Alternativas consideradas

| Alternativa                                        | Por que não (agora)                                                                                                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessão em cookie com estado no servidor            | Simples e revogável de imediato, mas exige armazenamento compartilhado (Redis) no dia em que houver mais de um processo — infraestrutura que hoje não existe. Fica como plano B se a revogação imediata virar requisito |
| OAuth2/OIDC com provedor externo (Keycloak, Auth0) | Mais seguro e menos código, porém adiciona um serviço e um fluxo inteiros para um projeto de uma pessoa, sem usuários reais                                                                                             |
| Chave de API estática por cliente                  | Identifica integração, não pessoa; não dá perfil, não expira, não permite atribuir operação a um associado                                                                                                              |
| mTLS                                               | Resolve serviço-a-serviço, não o associado no cliente HTTP; exige PKI                                                                                                                                                   |
| Manter público                                     | Inaceitável com dados reais; aceito apenas enquanto os dados são fictícios e a ausência está declarada no C4 e neste ADR                                                                                                |

## Consequências

### Positivas

* Token sem estado permite escalar horizontalmente sem sessão compartilhada.
* Perfis no token deixam a autorização legível no caso de uso, junto da regra que ela protege.
* Refresh rotativo com detecção de reuso dá revogação prática sem *denylist* permanente.
* Abre caminho para a trilha de auditoria (`createdBy`) que a prestação de contas exige.

### Negativas / custos

* **Revogação de token de acesso é por expiração** (15 min); desligar um usuário exige refresh store ou *denylist* — ou seja, parte do estado volta pela porta dos fundos.
* **Complexidade real**: emissão, rotação, hashing, middlewares, testes de autorização negativa e gestão de segredo. É a maior entrega isolada que falta no projeto.
* **Superfície nova de erro de segurança**: algoritmo aceito, validação de `aud`/`iss`, tempo de clock, cookie CSRF. Autenticação caseira é ponto clássico de falha.
* **Custo no caminho da requisição**: verificação de assinatura e, no login, `argon2id` — que é caro por projeto.
* **Impacto em tudo que já existe**: a suíte de integração passa hoje sem credencial; todos os casos passam a precisar de token, e a suíte cresce em setup.

### Riscos e mitigação

| Risco                                                              | Mitigação                                                                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementação insegura dar falsa sensação de proteção              | Bateria de testes **negativos** antes de habilitar: sem token (401), token de outro perfil (403), token expirado (401), refresh reusado (revogação) |
| Token em `localStorage` → XSS                                      | Token de acesso em memória; refresh em cookie `HttpOnly` + `SameSite=Strict` + verificação de origem                                                |
| Segredo vazado em repositório                                      | Segredo só em `.env`/variável de ambiente, `.env` fora do versionamento, rotação documentada                                                        |
| Autenticação "de fachada" (identifica, mas autoriza no controller) | A regra de perfil fica no caso de uso, com teste unitário do núcleo que dispensa HTTP                                                               |
| Prazo curto empurrar a decisão para "depois" indefinidamente       | A ausência está declarada no C4 e neste ADR; o item entra no backlog com critério de aceite, não como intenção                                      |

## Referências

* `src/app.ts` — hoje nenhum middleware de autenticação; rotas montadas diretamente
* `src/prisma/contract.prisma` — `Transaction` e `CreditRequest` sem `createdBy`
* `src/solidarity-credit/` — padrão de módulo hexagonal a reusar em `src/identity/`
* `docs/arquitetura/c4.md` §5 — a ausência registrada como dívida
* Material da disciplina: aula de documentação arquitetural (sugestão de ADR de estratégia de autenticação) e aula de arquitetura hexagonal
