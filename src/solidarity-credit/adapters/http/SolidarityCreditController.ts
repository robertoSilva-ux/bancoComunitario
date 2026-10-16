import { Request, Response } from "express";
import { respondError } from "../../../http/errorHandler.js";
import { requireMoney, requireString } from "../../../http/validation.js";
import type { CreateSolidarityCreditApplication } from "../../application/ports/CreateSolidarityCreditApplication.js";

/**
 * ADAPTADOR PRIMÁRIO (driving adapter): recebe o HTTP e aciona a porta primária.
 *
 * A dependência é declarada pelo **contrato** `CreateSolidarityCreditApplication`,
 * não pela classe `CreateSolidarityCreditUseCase`: o controller não sabe quem
 * implementa o caso de uso, nem que existe Express no meio. Todo o trabalho dele é
 * traduzir o corpo HTTP em `CreateSolidarityCreditCommand` e a saída do núcleo em JSON.
 */
export class SolidarityCreditController {
    constructor(private readonly createSolidarityCredit: CreateSolidarityCreditApplication) {}

    public create = async (req: Request, res: Response): Promise<Response> => {
        try {
            // Fronteira: só daqui saem tipos confiáveis para a porta.
            const enterprise = {
                name: requireString(req.body?.enterprise?.name, "enterprise.name"),
                document: requireString(req.body?.enterprise?.document, "enterprise.document"),
            };
            const amount = requireMoney(req.body?.amount, "amount");
            const purpose = requireString(req.body?.purpose, "purpose");

            const creditRequest = await this.createSolidarityCredit.execute({
                enterprise,
                amount,
                purpose,
            });

            // `amount` é um Money: o toJSON dele emite a string decimal ("1500.00").
            return res.status(201).json({
                message: "Solicitação de crédito solidário registrada com sucesso!",
                creditRequest: {
                    id: creditRequest.id,
                    enterpriseId: creditRequest.enterpriseId,
                    enterpriseName: creditRequest.enterpriseName,
                    amount: creditRequest.amount,
                    purpose: creditRequest.purpose,
                    status: creditRequest.status,
                    createdAt: creditRequest.createdAt,
                },
            });
        } catch (error) {
            return respondError(res, error);
        }
    };
}
