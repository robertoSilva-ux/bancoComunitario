import { Request, Response } from "express";
import { AccountService } from "../services/AccountService.js";
import { respondError } from "../http/errorHandler.js";
import { optionalMoney, requireString } from "../http/validation.js";

export class AccountController {
    // Injetamos o serviço no controlador
    constructor(private accountService: AccountService) { }

    public create = async (req: Request, res: Response): Promise<Response> => {
        try {
            // Fronteira: só daqui saem tipos confiáveis para o service.
            const holderName = requireString(req.body?.holderName, "holderName");
            const document = requireString(req.body?.document, "document");
            const initialBalance = optionalMoney(req.body?.initialBalance, "initialBalance");

            // Delega a lógica de negócio para o Service
            const newAccount = await this.accountService.createAccount({
                holderName,
                document,
                initialBalance,
            });

            // Responde com sucesso (Código HTTP 201: Created).
            // `balance` é um Money: o toJSON dele emite a string decimal ("100.00").
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
        } catch (error) {
            return respondError(res, error);
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
        } catch (error) {
            return respondError(res, error);
        }
    };
}
