# Community Bank API 🏦

API REST desenvolvida em Node.js com TypeScript e Express para o gerenciamento de serviços de um Banco Comunitário, criada no âmbito da disciplina de Princípios e Padrões de Arquitetura (Projeto Integrador) do IFRS Campus Rio Grande.

A base do sistema (contas e operações financeiras) está organizada **em camadas com domínio rico**, conforme a proposta arquitetural da Entrega 1. O módulo de **crédito solidário** foi construído em **arquitetura hexagonal (Ports and Adapters)** e serve de implementação de referência — o desenho está em [`docs/arquitetura-hexagonal.md`](docs/arquitetura-hexagonal.md).

---

## 🚀 Tecnologias Utilizadas (Stack)

O projeto foi construído utilizando as seguintes tecnologias e ferramentas:
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/) (Tipagem estática e segurança no desenvolvimento)
- **Runtime:** [Node.js](https://nodejs.org/) (Ambiente de execução JavaScript)
- **Framework HTTP:** [Express](https://expressjs.com/) (Gerenciamento de rotas e middlewares)
- **Banco de dados:** [PostgreSQL](https://www.postgresql.org/) (15 ou superior) com [Prisma ORM 8](https://www.prisma.io/) (contrato em PSL, migrations versionadas)
- **Testes:** `node:test` (suíte de unidade e de integração, sem framework externo)
- **Ferramentas de Desenvolvimento:** `tsx` (Hot reload e execução de TypeScript)
- **Controle de Versão:** Git e GitHub (com entregas em branches isoladas)

---

## 📂 Arquitetura do Projeto

A aplicação separa responsabilidades em duas topologias que convivem de propósito:

```text
bancoComunitario/
├── src/
│   ├── app.ts                  # Configuração do Express, rotas montadas e middleware de erro
│   ├── server.ts               # Inicialização da porta HTTP do servidor
│   │
│   ├── models/                 # DOMÍNIO compartilhado (sem framework)
│   │   ├── Account.ts          #   entidade com as invariantes da conta
│   │   ├── Transaction.ts      #   entidade do lançamento financeiro
│   │   ├── Money.ts            #   objeto de valor: dinheiro em centavos, sem float
│   │   └── errors.ts           #   erros de domínio tipados (400/404/409/422)
│   │
│   ├── controllers/            # CAMADA DE APRESENTAÇÃO do módulo de contas
│   ├── services/               # CAMADA DE APLICAÇÃO do módulo de contas
│   ├── repositories/           # CAMADA DE PERSISTÊNCIA do módulo de contas
│   ├── routes/                 # Rotas e fiação das dependências do módulo de contas
│   ├── http/                   # Validação de fronteira e tradução de erro -> HTTP
│   │
│   ├── solidarity-credit/      # MÓDULO HEXAGONAL (Ports and Adapters)
│   │   ├── domain/             #   núcleo: CreditRequest, SolidarityEnterprise
│   │   ├── application/
│   │   │   ├── ports/          #   portas: CreateSolidarityCreditApplication, CreditRequestRepository
│   │   │   └── useCases/       #   CreateSolidarityCreditUseCase
│   │   └── adapters/
│   │       ├── http/           #   adaptador primário: SolidarityCreditController + rotas
│   │       └── prisma/         #   adaptador secundário: CreditRequestRepositoryImpl
│   │
│   └── prisma/                 # Infraestrutura: contrato, client e migrations
│       ├── contract.prisma     #   modelos (Account, Transaction, CreditRequest, SolidarityEnterprise)
│       ├── db.ts               #   client do Prisma 8 (singleton do processo)
│       └── contract.json|d.ts  #   gerados por `npx prisma contract emit`
│
├── migrations/                 # Migrations versionadas (aplicadas com `npx prisma db migrate`)
├── test/
│   ├── unit/                   # Núcleo hexagonal: roda SEM banco de dados
│   └── integration/            # HTTP + banco de verdade
├── scripts/check-hexagon.mjs   # Guarda da regra de dependência do núcleo
├── docs/                       # Proposta arquitetural, backlog e diagramas
├── dist/                       # Código compilado para JavaScript (produção)
├── package.json                # Manifesto, dependências e scripts
└── tsconfig.json               # Configurações do compilador TypeScript
```

O módulo hexagonal não depende de Express nem de Prisma: `npm run check:hexagon` falha se isso acontecer.

---

## ⚙️ Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:

- **Node.js** 22 ou superior (o projeto foi desenvolvido e testado no Node 26)
- **npm** (Gerenciador de pacotes padrão do Node.js)
- **PostgreSQL** 15 ou superior, acessível por uma string de conexão

Para verificar Node e npm:

```bash
node --version
npm --version
```

---

## 📥 Instalação e Execução

1. Clone o repositório:

```bash
git clone https://github.com/robertoSilva-ux/bancoComunitario.git
cd bancoComunitario
```

2. Instale as dependências:

```bash
npm install
```

3. Crie o arquivo de ambiente a partir do exemplo e ajuste a string de conexão do seu PostgreSQL:

```bash
cp .env.example .env
# .env -> DATABASE_URL="postgresql://usuario:senha@localhost:5432/banco_comunitario"
```

4. Aplique as migrations (cria/atualiza as tabelas no banco):

```bash
npx prisma db migrate
npx prisma db verify      # confirma que o banco corresponde ao contrato
```

5. Execute a aplicação em modo de desenvolvimento:

```bash
npm run dev
```

O servidor será iniciado na porta 3000 (http://localhost:3000).

---

## 🛠️ Comandos Disponíveis (Scripts)

| Comando | Descrição | Quando usar |
|---|---|---|
| `npm run dev` | Executa o TypeScript com reload automático | Durante o desenvolvimento |
| `npm run typecheck` | Valida a tipagem do código e dos testes, sem gerar arquivos | Antes de realizar commits ou entregas |
| `npm test` | Roda a suíte completa (unidade + integração) — exige banco | Antes de cada entrega |
| `npm run test:unit` | Roda só o núcleo, **sem banco e sem `DATABASE_URL`** | Durante o desenvolvimento do domínio |
| `npm run check:hexagon` | Verifica se o núcleo importa algum detalhe externo | Ao mexer no módulo hexagonal |
| `npm run build` | Compila os arquivos de `src/` para `dist/` | Antes de distribuir ou implantar (produção) |
| `npm start` | Executa a versão compilada (`dist/server.js`) | Após o build |

### Comandos do banco (Prisma 8)

| Comando | Descrição |
|---|---|
| `npx prisma contract emit` | Regenera `contract.json` e `contract.d.ts` a partir de `contract.prisma` (offline) |
| `npx prisma migration plan --name <slug> --from <hash>` | Planeja uma migration aditiva a partir da mudança no contrato (offline) |
| `npx prisma db migrate` | Aplica as migrations pendentes ao banco (sem `--to`, avança até a ponta do grafo) |
| `npx prisma migration status` | Mostra o que está aplicado e o que está pendente |
| `npx prisma db verify` | Confere se o banco ativo corresponde ao contrato |

> ⚠️ No Prisma 8 não existe `migrate dev`, e o `migration plan` sem `--from` usa o ref `db`
> (a *primeira* migration) como origem, o que bifurca o grafo de migrations. Passe o hash
> do contrato atual em `--from` — ele aparece em `npx prisma migration status`.

---

## 🧪 Testando a API

A suíte pode ser executada de duas formas:

```bash
npm run test:unit     # domínio + caso de uso, sem banco (rápido)
npm test              # unidade + integração (exige DATABASE_URL e migrations aplicadas)
```

Entradas de exemplo pelo terminal:

```bash
# Rota raiz (mensagem de boas-vindas)
curl http://localhost:3000/

# Verificação de saúde
curl http://localhost:3000/health
```

---

## 🔌 Endpoints

### Contas

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/accounts` | Abre uma conta (`holderName`, `document`, `initialBalance` opcional) |
| `GET` | `/accounts` | Lista as contas |
| `POST` | `/accounts/:id/deposits` | Deposita (`amount`, `description` opcional) |
| `POST` | `/accounts/:id/withdrawals` | Saca, com verificação de saldo |
| `GET` | `/accounts/:id/statement` | Extrato: dados da conta, saldo e lançamentos |

```bash
curl -X POST http://localhost:3000/accounts -H 'Content-Type: application/json' \
  -d '{"holderName":"Maria Souza","document":"12345678901","initialBalance":100}'

curl -X POST http://localhost:3000/accounts/<id>/deposits -H 'Content-Type: application/json' \
  -d '{"amount":50,"description":"feira"}'

curl http://localhost:3000/accounts/<id>/statement
```

### Crédito solidário (módulo hexagonal)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/credit/solidarity` | Registra a solicitação de crédito de um empreendimento solidário |

```bash
curl -X POST http://localhost:3000/credit/solidarity -H 'Content-Type: application/json' \
  -d '{"enterprise":{"name":"Cooperativa de Artesanato","document":"12345678000199"},
       "amount":1500.00,"purpose":"Compra de equipamentos"}'
```

Resposta (HTTP 201):

```json
{
  "message": "Solicitação de crédito solidário registrada com sucesso!",
  "creditRequest": {
    "id": "1f0d…",
    "enterpriseId": "9b7c…",
    "enterpriseName": "Cooperativa de Artesanato",
    "amount": "1500.00",
    "purpose": "Compra de equipamentos",
    "status": "pending",
    "createdAt": "2026-10-16T10:00:00.000Z"
  }
}
```

O empreendimento é localizado pelo `document`: se já existir cadastro, a solicitação é
vinculada a ele (o nome reenviado não sobrescreve o cadastro). Se não existir, o
empreendimento é criado na mesma operação — as duas escritas acontecem numa única
transação do banco.

### Convenções da API

- **Dinheiro trafega como string decimal** (`"1500.00"`, `"0.30"`), nunca como número de
  ponto flutuante: o valor é validado na fronteira e manipulado em centavos inteiros
  internamente. Entrada com mais de 2 casas decimais, `NaN`, `Infinity`, booleano ou
  texto é recusada com 400.
- **Códigos de status:** `201` criação, `200` operação concluída, `400` entrada inválida,
  `404` recurso inexistente, `409` documento já cadastrado, `422` saldo insuficiente,
  `500` erro interno (com mensagem genérica — o detalhe fica no log do servidor).
- **Rota ou método inexistente responde JSON**, não HTML.

---

## 📅 Histórico de Entregas (Projeto Integrador)

Este projeto acompanha a evolução modular proposta pela disciplina:

- **Entrega 1 — Estruturação inicial:** configuração do ambiente, TypeScript, Express e rotas base (`/` e `/health`). Proposta arquitetural em [`docs/entrega-1.txt`](docs/entrega-1.txt).
- **Entrega 2 — Núcleo operacional:** arquitetura em camadas com domínio rico e injeção de dependências; abertura e listagem de contas, depósito, saque com validação de saldo e extrato. Persistência em PostgreSQL com Prisma 8.
- **Entrega 3 — Correções e robustez:** dinheiro como objeto de valor (`Money`, em centavos), validação de fronteira, erros de domínio tipados, escrita atômica com transação do banco e trava de linha nas operações sobre a conta, além da suíte de testes de integração.
- **Atividade de Arquitetura Hexagonal:** módulo de solicitação de crédito solidário em Ports and Adapters — caso de uso `CreateSolidarityCreditUseCase`, portas primária e secundária, adaptadores HTTP e Prisma, testes de unidade sem banco e guarda automática da regra de dependência. Backlog em [`docs/backlog-atividade-hexagonal.md`](docs/backlog-atividade-hexagonal.md).

Próximos passos previstos: cartões de crédito populares, relatórios para a comunidade e
migração do módulo de contas para o mesmo desenho hexagonal.

---

## 👤 Autor

Desenvolvido por Roberto Fabiano Cunha da Silva no âmbito do curso de Análise e Desenvolvimento de Sistemas do IFRS Campus Rio Grande.
