import { Router } from "express";
import { CreateSolidarityCreditUseCase } from "../../application/useCases/CreateSolidarityCreditUseCase.js";
import type { CreateSolidarityCreditApplication } from "../../application/ports/CreateSolidarityCreditApplication.js";
import { CreditRequestRepositoryImpl } from "../prisma/CreditRequestRepositoryImpl.js";
import { SolidarityCreditController } from "./SolidarityCreditController.js";

/**
 * Composition root do módulo hexagonal: o **único** ponto que conhece as
 * implementações concretas. A direção da dependência termina aqui:
 *
 *   CreditRequestRepositoryImpl ── implementa ──▶ CreditRequestRepository (porta)
 *   CreateSolidarityCreditUseCase ── implementa ──▶ CreateSolidarityCreditApplication (porta)
 *   SolidarityCreditController ── depende ──▶ CreateSolidarityCreditApplication (porta)
 *
 * Trocar a persistência (outro banco, memória, arquivo) é trocar a primeira linha
 * abaixo — nada mais no módulo muda.
 */
const creditRequestRepository = new CreditRequestRepositoryImpl();
const createSolidarityCredit: CreateSolidarityCreditApplication =
    new CreateSolidarityCreditUseCase(creditRequestRepository);
const solidarityCreditController = new SolidarityCreditController(createSolidarityCredit);

const solidarityCreditRouter = Router();

solidarityCreditRouter.post("/credit/solidarity", solidarityCreditController.create);

export default solidarityCreditRouter;
