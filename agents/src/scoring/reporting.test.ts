import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregatePortfolio } from "./reporting.js";
import type { MurabahahContractSnapshot } from "./reporting.js";

test("empty portfolio returns all zeros, no divide-by-zero", () => {
  const result = aggregatePortfolio([]);
  assert.deepEqual(result, {
    totalActiveContracts: 0,
    totalDisbursed: 0,
    totalOutstanding: 0,
    totalRepaid: 0,
    delinquentCount: 0,
    completedCount: 0,
    defaultedCount: 0,
    delinquencyRatePct: 0,
    completionRatePct: 0,
  });
});

test("counts Active and Delinquent (but not Completed/Defaulted) as active contracts", () => {
  const contracts: MurabahahContractSnapshot[] = [
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 600_000 },
    { status: "Delinquent", salePrice: 1_000_000, outstandingBalance: 800_000 },
    { status: "Completed", salePrice: 1_000_000, outstandingBalance: 0 },
    { status: "Defaulted", salePrice: 1_000_000, outstandingBalance: 400_000 },
  ];
  const result = aggregatePortfolio(contracts);
  assert.equal(result.totalActiveContracts, 2);
  assert.equal(result.totalOutstanding, 600_000 + 800_000);
});

test("DelinquencyManualReview counts as active (non-terminal) but not as confirmed delinquent", () => {
  const contracts: MurabahahContractSnapshot[] = [
    { status: "DelinquencyManualReview", salePrice: 1_000_000, outstandingBalance: 700_000 },
  ];
  const result = aggregatePortfolio(contracts);
  assert.equal(result.totalActiveContracts, 1);
  assert.equal(result.totalOutstanding, 700_000);
  assert.equal(result.delinquentCount, 0);
});

test("totalDisbursed sums salePrice across every contract regardless of status", () => {
  const contracts: MurabahahContractSnapshot[] = [
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 500_000 },
    { status: "Completed", salePrice: 2_000_000, outstandingBalance: 0 },
    { status: "Defaulted", salePrice: 500_000, outstandingBalance: 500_000 },
  ];
  const result = aggregatePortfolio(contracts);
  assert.equal(result.totalDisbursed, 3_500_000);
});

test("totalRepaid derives from totalDisbursed minus totalOutstanding", () => {
  const contracts: MurabahahContractSnapshot[] = [
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 300_000 },
  ];
  const result = aggregatePortfolio(contracts);
  assert.equal(result.totalRepaid, 700_000);
});

test("delinquencyRatePct is delinquentCount over totalActiveContracts, as a percentage", () => {
  const contracts: MurabahahContractSnapshot[] = [
    { status: "Delinquent", salePrice: 1_000_000, outstandingBalance: 500_000 },
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 500_000 },
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 500_000 },
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 500_000 },
  ];
  const result = aggregatePortfolio(contracts);
  assert.equal(result.delinquencyRatePct, 25);
});

test("completionRatePct is completedCount over every contract ever created, as a percentage", () => {
  const contracts: MurabahahContractSnapshot[] = [
    { status: "Completed", salePrice: 1_000_000, outstandingBalance: 0 },
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 500_000 },
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 500_000 },
    { status: "Active", salePrice: 1_000_000, outstandingBalance: 500_000 },
  ];
  const result = aggregatePortfolio(contracts);
  assert.equal(result.completionRatePct, 25);
});

test("defaultedCount counts Defaulted contracts, excluded from active/outstanding", () => {
  const contracts: MurabahahContractSnapshot[] = [
    { status: "Defaulted", salePrice: 1_000_000, outstandingBalance: 900_000 },
  ];
  const result = aggregatePortfolio(contracts);
  assert.equal(result.defaultedCount, 1);
  assert.equal(result.totalActiveContracts, 0);
  assert.equal(result.totalOutstanding, 0);
});

test("determinism: identical input produces identical output", () => {
  const contracts: MurabahahContractSnapshot[] = [
    { status: "Delinquent", salePrice: 1_000_000, outstandingBalance: 500_000 },
    { status: "Completed", salePrice: 2_000_000, outstandingBalance: 0 },
  ];
  const a = aggregatePortfolio(contracts);
  const b = aggregatePortfolio(contracts);
  assert.deepEqual(a, b);
});
