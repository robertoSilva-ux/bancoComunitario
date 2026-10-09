import express from "express"
import accountRouter from "./routes/account.routes.js";
import operationRouter from "./routes/operation.routes.js";

export const app = express()

app.use(express.json())

app.get("/", (_request, response)=>{
    return response.status(200).json({message:"Community Bank API"})
})

app.use(accountRouter);
app.use(operationRouter);

app.get("/health", (_request, response)=>{
    return response.status(200).json({status: "ok"})
})
