import express from "express"
import accountRouter from "./routes/account.routes.js";
import operationRouter from "./routes/operation.routes.js";

export const app = express()

// Corpo JSON com teto explícito: requisição gigante é recusada pelo parser, não pela aplicação.
app.use(express.json({ limit: "100kb" }))

app.get("/", (_request, response)=>{
    return response.status(200).json({message:"Community Bank API"})
})

app.use(accountRouter);
app.use(operationRouter);

app.get("/health", (_request, response)=>{
    return response.status(200).json({status: "ok"})
})

// API responde sempre JSON: sem isto, rota ou método inexistente devolvia o HTML do Express.
app.use((_request, response)=>{
    return response.status(404).json({error: "Rota não encontrada."})
})

// Rede de segurança para o que escapar do try/catch dos controllers:
// erro interno vira 500 genérico e a mensagem real fica no log do servidor.
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction)=>{
    console.error("[erro não tratado]", error)
    return response.status(500).json({error: "Erro interno ao processar o pedido."})
})
