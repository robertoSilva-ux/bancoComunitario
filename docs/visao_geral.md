# Visão Geral
## Princípio 
A arquitetura escolhida inicialmente é a de camadas (Layered Architecture), com a utilização de princípios de DDD (Driven-Domain Design - Domínio rico) para a parte central e regras de negócio.
## Justificativa
Justifica-se a decisão tendo em vista que instituições financeiras costumam lidar com regras bem definidas, embora a interface (frontend) e o ORM/Banco de Dados possam mudar, a lógica de como uma conta funciona ou como um depósito é processado não muda com frequência;
## Preocupações (Separation of Concerns)
* Camada de apresentação (controllers/routes) - lida com os protocolo HTTP, recebe requisições, valida e devolve respostas JSON; Não deve ter regras de negócio ou acesso direto ao banco de dados.
* Camada de negócio (service/models(entities)/use cases) - objetos de valor, regras de negócio; Não deve ter detalhes do protocolo HTTP, comandos sql
* Camada de persistência (repository/data access) - conversa diretamente com o banco/ORM. Não deve ter regras de negócio.
## Fluxo

POST /accounts
HTTP -> Controller -> Service -> Repository  -> ORM/BD -> Repository- > Controller

Resumo do Fluxo Completo da Funcionalidade:

    Cliente envia um POST /accounts com o nome e o documento no corpo do pedido.

    Controller captura os dados, valida se vieram no formato esperado e chama o AccountService.

    Service verifica se já existe uma conta com aquele documento e instancia o objeto de domínio rico (Account).

    Repository converte o objeto e persiste os dados na base de dados PostgreSQL.

    Controller recebe a confirmação e devolve um JSON com o estado 201 Created para o cliente.

