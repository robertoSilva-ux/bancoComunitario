import { Request, Response } from "express";
import { AccountService } from "../services/AccountService.js";
import { respondError } from "../http/errorHandler.js";
import { optionalText, requireMoney } from "../http/validation.js";

export class OperationController {
    constructor(private accountService: AccountService) { }

    public deposit = async (req: Request, res: Response): Promise<Response> => {
        try {
            const id = req.params.id as string;
            const amount = requireMoney(req.body?.amount, "amount");
            const description = optionalText(req.body?.description, "description");

            const result = await this.accountService.deposit(id, amount, description);

            return res.status(200).json({
                message: "Depósito realizado com sucesso!",
                transaction: {
                    id: result.transaction.id,
                    type: result.transaction.type,
                    amount: result.transaction.amount,
                    description: result.transaction.description,
                    createdAt: result.transaction.createdAt,
                },
                balance: result.balance,
            });
        } catch (error) {
            return respondError(res, error);
        }
    };

    public withdraw = async (req: Request, res: Response): Promise<Response> => {
        try {
            const id = req.params.id as string;
            const amount = requireMoney(req.body?.amount, "amount");
            const description = optionalText(req.body?.description, "description");

            const result = await this.accountService.withdraw(id, amount, description);

            return res.status(200).json({
                message: "Saque realizado com sucesso!",
                transaction: {
                    id: result.transaction.id,
                    type: result.transaction.type,
                    amount: result.transaction.amount,
                    description: result.transaction.description,
                    createdAt: result.transaction.createdAt,
                },
                balance: result.balance,
            });
        } catch (error) {
            return respondError(res, error);
        }
    };

    public getStatement = async (req: Request, res: Response): Promise<Response> => {
        try {
            const id = req.params.id as string;
            const statement = await this.accountService.getStatement(id);

            return res.status(200).json({
                accountId: id,
                holderName: statement.holderName,
                balance: statement.balance,
                transactions: statement.transactions.map((t) => ({
                    id: t.id,
                    type: t.type,
                    amount: t.amount,
                    description: t.description,
                    createdAt: t.createdAt,
                })),
            });
        } catch (error) {
            return respondError(res, error);
        }
    };
}
