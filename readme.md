# Community Bank API 🏦

API REST desenvolvida em Node.js com TypeScript e Express para o gerenciamento de serviços de um Banco Comunitário, criada no âmbito da disciplina de Princípios e Padrões de Arquitetura (Projeto Integrador) do IFRS Campus Rio Grande.

---

## 🚀 Tecnologias Utilizadas (Stack)

O projeto foi construído utilizando as seguintes tecnologias e ferramentas:
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/) (Tipagem estática e segurança no desenvolvimento)
- **Runtime:** [Node.js](https://nodejs.org/) (Ambiente de execução JavaScript)
- **Framework HTTP:** [Express](https://expressjs.com/) (Gerenciamento de rotas e middlewares)
- **Ferramentas de Desenvolvimento:** `tsx` (Hot reload e execução de TypeScript)
- **Controle de Versão:** Git e GitHub (com entregas semanais em branches isoladas)

---

## 📂 Arquitetura do Projeto

A aplicação adota uma estrutura em camadas inspirada no padrão MVC/Camadas para separar as responsabilidades e garantir a manutenibilidade do código à medida que novas regras de negócio do banco comunitário são adicionadas:

```text
community-bank-api/
├── src/
│   ├── app.ts         # Configuração do Express e middlewares
│   └── server.ts      # Inicialização da porta HTTP do servidor
├── dist/              # Código compilado para JavaScript (produção)
├── package.json       # Manifesto e dependências do projeto
├── tsconfig.json      # Configurações do compilador TypeScript
└── README.md          # Documentação do projeto

⚙️ Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:

    Node.js (Versão 18 LTS ou superior recomendada)

    npm (Gerenciador de pacotes padrão do Node.js)

Para verificar se estão instalados, execute no terminal:
Bash

node --version
npm --version

📥 Instalação e Execução

    Clone o repositório:
    Bash

    git clone [https://github.com/robertoSilva-ux/bancoComunitario.git](https://github.com/robertoSilva-ux/bancoComunitario.git)
    cd community-bank-api

    Instale as dependências do projeto:
    Bash

    npm install

    Execute a aplicação em modo de desenvolvimento:
    Bash

    npm run dev

    O servidor será iniciado na porta 3000 (http://localhost:3000).

🛠️ Comandos Disponíveis (Scripts)

O arquivo package.json configura os seguintes scripts para o ciclo de vida do projeto:
Comando	Descrição	Quando usar
npm run dev	Executa o TypeScript com reload automático	Durante o desenvolvimento
npm run typecheck	Valida erros de tipagem sem gerar arquivos	Antes de realizar commits ou entregas
npm run build	Compila os arquivos de src/ para dist/	Antes de distribuir ou implantar (produção)
npm start	Executa a versão compilada (dist/server.js)	Após o build
🧪 Testando a API

Você pode testar se a aplicação está respondendo corretamente utilizando o navegador nas rotas GET ou via terminal com curl:

    Rota raiz (Mensagem de boas-vindas):
    Bash

    curl http://localhost:3000/

    Rota de verificação de saúde (/health):
    Bash

    curl http://localhost:3000/health

📅 Histórico de Entregas (Projeto Integrador)

Este projeto acompanha a evolução modular proposta pela disciplina:

    Semana 1: Estruturação inicial do ambiente, configuração do TypeScript, Express e rotas base (/ e /health).

    Próximas Semanas: Evolução para o domínio de contas, cartões de crédito populares, operações financeiras e relatórios para a comunidade.

👤 Autor

Desenvolvido por Roberto Fabiano Cunha da Silva no âmbito do curso de Análise e Desenvolvimento de Sistemas do IFRS Campus Rio Grande.