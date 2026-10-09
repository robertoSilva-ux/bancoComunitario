import { Request, Response } from "express";
import { AccountService } from "../services/AccountService.js";

export class AccountController {
    // Injetamos o serviço no controlador
    constructor(private accountService: AccountService) { }

    public create = async (req: Request, res: Response): Promise<Response> => {
        try {
            const { holderName, document, initialBalance } = req.body;

            // Delega a lógica de negócio para o Service
            const newAccount = await this.accountService.createAccount({
                holderName,
                document,
                initialBalance,
            });

            // Responde com sucesso (Código HTTP 201: Created)
            return res.status(201).json({
                message: "Conta criada com sucesso no banco comunitário!",
                account: {
                    id: newAccount.id,
                    holderName: newAccount.holderName,
                    document: newAccount.document,
                    balance: newAccount.balance,
                    createdAt: newAccount.createdAt,
                },
            });
        } catch (error: any) {
            // Caso ocorra um erro de regra de negócio (ex: CPF duplicado ou dados inválidos),
            // retornamos o erro com o código HTTP 400 (Bad Request)
            return res.status(400).json({
                error: error.message || "Erro desconhecido ao processar o pedido.",
            });
        }
    };

    public getAll = async (_req: Request, res: Response): Promise<Response> => {
        try {
            const accounts = await this.accountService.getAllAccounts();

            // Mapeia os dados para retornar um JSON limpo ao cliente
            const formattedAccounts = accounts.map((account) => ({
                id: account.id,
                holderName: account.holderName,
                document: account.document,
                balance: account.balance,
                createdAt: account.createdAt,
            }));

            return res.status(200).json(formattedAccounts);
        } catch (error: any) {
            return res.status(500).json({
                error: error.message || "Erro interno ao buscar as contas.",
            });
        }
    };
}