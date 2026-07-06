/**
 * Stages 8–10: Murabahah Contract, Repayment, Ibra', Charity, Collateral, Reports
 *
 * GET  → PQS (PostgreSQL via repository.ts)
 * POST → Canton HTTP JSON API (canton.ts)
 */
import { Router } from "express";
import { exerciseChoice, createContract } from "../canton.js";
import {
  listContracts,
  listContractsByStatus,
  getContractById,
  listRepayments,
  listRepaymentsByBorrower,
  listIbraRequests,
  listIbraByBorrower,
  listLatePaymentCharities,
  listUnsettledCharities,
  listCharitiesByBorrower,
  listRahnAgreements,
  listRahnByBorrower,
  listPortfolioReports,
  getPortfolioSummary,
  getBorrowerContracts,
  getBorrowerFinancingRequests,
  getBorrowerRepayments,
} from "../repository.js";

const router = Router();

const T_CONTRACT = "Vetify.Murabahah:MurabahahContract";
const T_IBRA     = "Vetify.Murabahah:IbraRequest";
const T_CHARITY  = "Vetify.Murabahah:LatePaymentCharity";
const T_RAHN     = "Vetify.Murabahah:RahnAgreement";

// ── FI Portfolio Dashboard ────────────────────────────────────────────────────

router.get("/summary", async (_req, res, next) => {
  try {
    res.json(await getPortfolioSummary());
  } catch (e) { next(e); }
});

// ── Stage 8: Murabahah Contracts ─────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const result = status
      ? await listContractsByStatus(status as string)
      : await listContracts();
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/:contractId", async (req, res, next) => {
  try {
    const result = await getContractById(req.params.contractId);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (e) { next(e); }
});

// ── Borrower Dashboard ────────────────────────────────────────────────────────

router.get("/borrower/:cacRegNumber", async (req, res, next) => {
  try {
    const { cacRegNumber } = req.params;
    const [contracts, financingRequests, repayments] = await Promise.all([
      getBorrowerContracts(cacRegNumber),
      getBorrowerFinancingRequests(cacRegNumber),
      getBorrowerRepayments(cacRegNumber),
    ]);
    res.json({ contracts, financingRequests, repayments });
  } catch (e) { next(e); }
});

// ── Stage 9: Repayments ───────────────────────────────────────────────────────

router.get("/repayments", async (req, res, next) => {
  try {
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listRepaymentsByBorrower(cacRegNumber as string)
      : await listRepayments();
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/:contractId/record-payment", async (req, res, next) => {
  try {
    const { paymentDate, amountPaid, installmentNo } = req.body;
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "RecordPayment",
      { paymentDate, amountPaid, installmentNo }, "financialInstitution"));
  } catch (e) { next(e); }
});

router.post("/:contractId/flag-delinquent", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "FlagDelinquent",
      { reason: req.body.reason }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/:contractId/resume-active", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "ResumeActive",
      { note: req.body.note }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/:contractId/default", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "DefaultContract",
      { reason: req.body.reason }, "financialInstitution"));
  } catch (e) { next(e); }
});

// ── Stage 10: Contract Closure ───────────────────────────────────────────────

router.post("/:contractId/close", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "CloseContract",
      { closingDate: req.body.closingDate }, "financialInstitution"));
  } catch (e) { next(e); }
});

// ── Ibra' (Early Settlement Rebate) ─────────────────────────────────────────

router.get("/ibra", async (req, res, next) => {
  try {
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listIbraByBorrower(cacRegNumber as string)
      : await listIbraRequests();
    res.json(result);
  } catch (e) { next(e); }
});

// Borrower requests early full settlement (nonconsuming on MurabahahContract)
router.post("/:contractId/request-ibra", async (req, res, next) => {
  try {
    res.status(201).json(await exerciseChoice(T_CONTRACT, req.params.contractId, "RequestIbra",
      { requestedSettlementDate: req.body.requestedSettlementDate }, "borrower"));
  } catch (e) { next(e); }
});

// FI grants a voluntary rebate on the remaining profit
router.post("/ibra/:contractId/grant", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_IBRA, req.params.contractId, "GrantIbra",
      { rebateAmount: req.body.rebateAmount }, "financialInstitution"));
  } catch (e) { next(e); }
});

// FI declines; borrower must pay the full outstanding balance
router.post("/ibra/:contractId/decline", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_IBRA, req.params.contractId, "DeclineIbra",
      {}, "financialInstitution"));
  } catch (e) { next(e); }
});

// ── Late Payment Charity (Sadaqah obligations) ────────────────────────────────

router.get("/charity", async (req, res, next) => {
  try {
    const { cacRegNumber, unsettled } = req.query;
    let result;
    if (unsettled === "true") result = await listUnsettledCharities();
    else if (cacRegNumber) result = await listCharitiesByBorrower(cacRegNumber as string);
    else result = await listLatePaymentCharities();
    res.json(result);
  } catch (e) { next(e); }
});

// FI applies the Shariah committee's formula to set the charity amount
router.post("/charity/:contractId/set-amount", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CHARITY, req.params.contractId, "SetCharityAmount",
      { amount: req.body.amount }, "financialInstitution"));
  } catch (e) { next(e); }
});

// Borrower confirms the donation was made and provides the receipt reference
router.post("/charity/:contractId/confirm-payment", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CHARITY, req.params.contractId, "ConfirmCharityPayment",
      { charityRef: req.body.charityRef }, "borrower"));
  } catch (e) { next(e); }
});

// ── Rahn (Collateral) ────────────────────────────────────────────────────────

router.get("/rahn", async (req, res, next) => {
  try {
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listRahnByBorrower(cacRegNumber as string)
      : await listRahnAgreements();
    res.json(result);
  } catch (e) { next(e); }
});

// Create a collateral agreement (FI + borrower co-sign)
router.post("/rahn", async (req, res, next) => {
  try {
    res.status(201).json(await createContract(T_RAHN, req.body, "financialInstitution"));
  } catch (e) { next(e); }
});

// FI releases the pledge on full repayment / contract closure
router.post("/rahn/:contractId/release", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_RAHN, req.params.contractId, "ReleaseCollateral",
      { note: req.body.note }, "financialInstitution"));
  } catch (e) { next(e); }
});

// FI enforces the pledge on default
router.post("/rahn/:contractId/enforce", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_RAHN, req.params.contractId, "EnforceCollateral",
      { reason: req.body.reason }, "financialInstitution"));
  } catch (e) { next(e); }
});

// ── Portfolio Reports ────────────────────────────────────────────────────────

router.get("/reports", async (_req, res, next) => {
  try {
    res.json(await listPortfolioReports());
  } catch (e) { next(e); }
});

export default router;
