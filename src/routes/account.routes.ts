import { Router } from "express";
import { AccountController } from "../controllers/AccountController.js";
import { AccountService } from "../services/AccountService.js";
import { AccountRepository } from "../repositories/AccountRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";

const accountRouter = Router();

// Instanciação das dependências de baixo para cima
const accountRepository = new AccountRepository();
const transactionRepository = new TransactionRepository();
const accountService = new AccountService(accountRepository, transactionRepository);
const accountController = new AccountController(accountService);

// Definição do endpoint POST /accounts
accountRouter.post("/accounts", accountController.create);

// Endpoint GET /accounts para listar todas as contas
accountRouter.get("/accounts", accountController.getAll);

export default accountRouter;