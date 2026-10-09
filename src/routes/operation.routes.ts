import { Router } from "express";
import { OperationController } from "../controllers/OperationController.js";
import { AccountService } from "../services/AccountService.js";
import { AccountRepository } from "../repositories/AccountRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";

const operationRouter = Router();

const accountRepository = new AccountRepository();
const transactionRepository = new TransactionRepository();
const accountService = new AccountService(accountRepository, transactionRepository);
const operationController = new OperationController(accountService);

operationRouter.post("/accounts/:id/deposits", operationController.deposit);
operationRouter.post("/accounts/:id/withdrawals", operationController.withdraw);
operationRouter.get("/accounts/:id/statement", operationController.getStatement);

export default operationRouter;