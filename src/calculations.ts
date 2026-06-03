/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  LoanInput, 
  CustomBankConfig, 
  RatePeriod,
  PathMonthResult, 
  FinalComparisonResult,
  PathComparisonStats
} from "./types";
import { maleRiskFactorTable, femaleRiskFactorTable } from "./mrtaData";

// Helper to calculate standard monthly installment for a loan
export function calculateSuggestedInstallment(principal: number, annualRate: number, years: number): number {
  if (annualRate <= 0) return Math.ceil(principal / (years * 12));
  const r = (annualRate / 100) / 12;
  const n = Math.max(12, years * 12);
  const installment = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.ceil(installment);
}

// Resolves a RatePeriod (Fixed rate vs MRR modifier) to a final percentage rate
export function resolveRate(mrr: number, period: RatePeriod): number {
  if (!period) return mrr;
  if (period.type === "fixed") {
    return period.value;
  } else {
    // mrr modifier, e.g. MRR - 3.50 (value is -3.50 or positive 3.50 automatically treated as discount)
    // Always restrict to non-negative rates
    const baseline = period.mrrBaseline || mrr;
    return Math.max(0.1, baseline - Math.abs(period.value));
  }
}

// Calculate setup fees for a compared pathway
export function computeCustomBankFees(principal: number, config: CustomBankConfig): number {
  const mortgageFee = config.freeMortgageFee ? 0 : principal * (config.customMortgageFeeRate / 100);
  const appraisalFee = config.freeAppraisalFee ? 0 : config.customAppraisalFee;
  const dutyStamp = config.freeDutyStamp ? 0 : principal * 0.0005; // 0.05%
  return mortgageFee + appraisalFee + dutyStamp + config.otherFees;
}

// Calculate MRTA premium based on original loan, age, and single/joint profile
export function computeMrtaPremium(
  loanAmount: number,
  age: number,
  borrowerType: "single" | "joint",
  gender: "male" | "female" = "male",
  termYears: number = 10,
  decreasingRate: number = 8
): number {
  const table = gender === "female" ? femaleRiskFactorTable : maleRiskFactorTable;
  
  // Constrain age (21 - 69)
  const lookupAge = Math.min(69, Math.max(21, Math.round(age)));
  const ageFactors = table[lookupAge] || [];
  
  // Constrain period duration (1 - 30 years)
  const lookupPeriod = Math.min(ageFactors.length, Math.max(1, Math.round(termYears)));
  
  // Retrieve factor (or fallback if empty)
  const factor = ageFactors[lookupPeriod - 1] || 0;
  
  const jointMultiplier = borrowerType === "joint" ? 1.5 : 1.0;
  const schemaFactor = 1.0 - (decreasingRate - 8) * 0.03;

  const premium = ((factor * loanAmount) / 1000) * jointMultiplier * schemaFactor;
  return Math.max(0, Math.round(premium));
}

// Dynamic Multi-Pathway Simulator
export function performMultiAmortization(
  input: LoanInput,
  pathways: CustomBankConfig[],
  currentBankMrr: number = 6.50
): {
  monthlyList: PathMonthResult[];
  results: FinalComparisonResult;
} {
  const monthsToProject = 36; // 3-year promotional cycle
  const termMonths = input.remainingTermMonths > 0 ? input.remainingTermMonths : 240;

  // Let's run a full amortization up to the standard 3 years to build the chart and table
  const monthlyList: PathMonthResult[] = [];

  // Initialize tracking variables for the standard Current Loan (unmodified)
  let curBal = input.outstandingPrincipal;
  let curAccInterest = 0;
  let curAccPayment = 0;

  // --- REFINANCING PENALTIES / ADJUSTMENTS CALCULATION FROM OLD BANK ---
  // 1. Prepayment penalty (if we Refinance before lock-in, typically 36 months)
  const isPrepaymentViolated = input.elapsedMonths < input.prepaymentLockMonths;
  const prepaymentCost = isPrepaymentViolated 
    ? input.outstandingPrincipal * (input.prepaymentFeeRate / 100) 
    : 0;

  // 2. Subsidized expense recovery (e.g. Free registration refund if we refinance early)
  const isSubsidyRefundViolated = input.receivesSubsidy && (input.elapsedMonths < input.subsidyLockMonths);
  const subsidyRefundCost = isSubsidyRefundViolated ? input.subsidyAmount : 0;

  // 3. Insurance Early Cancellation Penalty (e.g. cancelled within 3 years)
  // Example: penalty 0.35% for 36 periods
  const isInsurancePenaltyViolated = input.hasInsurancePenalty && (input.elapsedMonths < 36);
  const insurancePenaltyCost = isInsurancePenaltyViolated
    ? input.outstandingPrincipal * (input.insurancePenaltyRate / 100) * input.insurancePenaltyMonths
    : 0;

  const totalOldBankExitCost = prepaymentCost + subsidyRefundCost + insurancePenaltyCost;

  // Initialize tracking for each compared refinance pathway
  const pathStates = pathways.map(path => {
    const setupFees = computeCustomBankFees(input.outstandingPrincipal, path);
    const mrtaPremium = path.hasMrta 
      ? computeMrtaPremium(
          input.outstandingPrincipal,
          input.borrowerAge,
          input.borrowerType,
          input.gender || "male",
          Math.max(1, Math.round(input.remainingTermMonths / 12)),
          input.mrtaDecreasingRate || 8
        )
      : 0;
    
    // Total setup fees include physical setup fees + old exit costs + path's MRTA premium if any
    const totalSetupAndAdjustments = setupFees + mrtaPremium + totalOldBankExitCost;

    return {
      config: path,
      balance: input.outstandingPrincipal,
      accumulatedInterest: 0,
      accumulatedPayment: 0,
      setupFees: setupFees,
      mrtaPremium: mrtaPremium,
      totalSetupAndAdjustments: totalSetupAndAdjustments,
      breakevenMonth: -1
    };
  });

  // Month-by-month simulation for the first 36 months (3 Years)
  for (let m = 1; m <= monthsToProject; m++) {
    // A. Current Loan Pathway Step (Stepped Promotional or Flat)
    let curIntRatePct = input.currentInterestRate;
    let curInstallment = input.currentInstallment;

    if (m <= 12) {
      curIntRatePct = resolveRate(currentBankMrr, input.currentYr1Rate);
      curInstallment = input.currentYr1Installment;
    } else if (m <= 24) {
      curIntRatePct = resolveRate(currentBankMrr, input.currentYr2Rate);
      curInstallment = input.currentYr2Installment;
    } else if (m <= 36) {
      curIntRatePct = resolveRate(currentBankMrr, input.currentYr3Rate);
      curInstallment = input.currentYr3Installment;
    } else {
      curIntRatePct = resolveRate(currentBankMrr, input.currentYr4PlusRate);
      curInstallment = input.currentYr4PlusInstallment;
    }

    const curIntRate = (curIntRatePct / 100) / 12;
    const curInt = curBal * curIntRate;
    let curPay = Math.min(curInstallment, curBal + curInt);
    if (curPay < curInt) {
      // Force minimum payment matching interest + 0.2% principal decay to prevent locked calculations
      curPay = curInt + Math.max(1000, input.outstandingPrincipal * 0.002);
    }
    const curPrin = curPay - curInt;
    curBal = Math.max(0, curBal - curPrin);
    curAccInterest += curInt;
    curAccPayment += curPay;

    // B. Custom Pathways Steps
    const pathsMonthlyResult: Record<string, any> = {};

    pathStates.forEach(state => {
      // Determine what phase period rate config to use for compared bank
      let activePeriod: RatePeriod = state.config.yr3;
      if (m <= 12) {
        activePeriod = state.config.yr1;
      } else if (m <= 24) {
        activePeriod = state.config.yr2;
      } else if (m <= 36) {
        activePeriod = state.config.yr3;
      }

      const activeRate = resolveRate(state.config.mrr, activePeriod);
      const monthlyRate = (activeRate / 100) / 12;
      
      const interest = state.balance * monthlyRate;
      
      // Determine installment for this compared bank
      let stateInstallment = state.config.isInstallmentAdjusted 
        ? state.config.customInstallment 
        : curInstallment; // Match standard period's installment as backdrop

      let payment = Math.min(stateInstallment, state.balance + interest);
      if (payment < interest) {
        payment = interest + Math.max(1000, input.outstandingPrincipal * 0.002);
      }
      const principal = payment - interest;
      
      state.balance = Math.max(0, state.balance - principal);
      state.accumulatedInterest += interest;
      state.accumulatedPayment += payment;

      // Check breakeven (incorporating setup, exit adjustments + MRTA price)
      const interestSaved = curAccInterest - state.accumulatedInterest;
      if (state.breakevenMonth === -1 && interestSaved > state.totalSetupAndAdjustments) {
        state.breakevenMonth = m;
      }

      pathsMonthlyResult[state.config.id] = {
        balance: state.balance,
        interest: interest,
        payment: payment,
        accumulatedInterest: state.accumulatedInterest,
        accumulatedPayment: state.accumulatedPayment,
      };
    });

    monthlyList.push({
      monthNumber: m,
      currentBalance: curBal,
      currentInterest: curInt,
      currentPayment: curPay,
      currentAccumulatedInterest: curAccInterest,
      currentAccumulatedPayment: curAccPayment,
      paths: pathsMonthlyResult,
    });
  }

  // --- Long Term (Full term) Simulation ---
  // Run full term (up to 20-30 years) to secure extremely precise total long-term estimates
  let curFullBal = input.outstandingPrincipal;
  let curFullAccInterest = 0;
  let curFullAccPayment = 0;

  const pathFullStates = pathways.map(path => {
    const setupFees = computeCustomBankFees(input.outstandingPrincipal, path);
    const mrtaPremium = path.hasMrta 
      ? computeMrtaPremium(
          input.outstandingPrincipal,
          input.borrowerAge,
          input.borrowerType,
          input.gender || "male",
          Math.max(1, Math.round(input.remainingTermMonths / 12)),
          input.mrtaDecreasingRate || 8
        )
      : 0;
    const totalSetupAndAdjustments = setupFees + mrtaPremium + totalOldBankExitCost;

    return {
      config: path,
      balance: input.outstandingPrincipal,
      accumulatedInterest: 0,
      accumulatedPayment: 0,
      setupFees: setupFees,
      mrtaPremium: mrtaPremium,
      totalSetupAndAdjustments: totalSetupAndAdjustments,
    };
  });

  for (let m = 1; m <= termMonths; m++) {
    // Current Pathway Floating
    if (curFullBal > 0) {
      let curIntRatePct = input.currentInterestRate;
      let curInstallment = input.currentInstallment;

      if (m <= 12) {
        curIntRatePct = resolveRate(currentBankMrr, input.currentYr1Rate);
        curInstallment = input.currentYr1Installment;
      } else if (m <= 24) {
        curIntRatePct = resolveRate(currentBankMrr, input.currentYr2Rate);
        curInstallment = input.currentYr2Installment;
      } else if (m <= 36) {
        curIntRatePct = resolveRate(currentBankMrr, input.currentYr3Rate);
        curInstallment = input.currentYr3Installment;
      } else {
        curIntRatePct = resolveRate(currentBankMrr, input.currentYr4PlusRate);
        curInstallment = input.currentYr4PlusInstallment;
      }

      const curIntRate = (curIntRatePct / 100) / 12;
      const curInt = curFullBal * curIntRate;
      let curPay = Math.min(curInstallment, curFullBal + curInt);
      if (curPay < curInt) {
        curPay = curInt + Math.max(1000, input.outstandingPrincipal * 0.002);
      }
      const curPrin = curPay - curInt;
      curFullBal = Math.max(0, curFullBal - curPrin);
      curFullAccInterest += curInt;
      curFullAccPayment += curPay;
    }

    // Compare pathways
    pathFullStates.forEach((state, i) => {
      if (state.balance > 0) {
        let activePeriod = state.config.yr4Plus; // Yr 4+ default
        if (m <= 12) {
          activePeriod = state.config.yr1;
        } else if (m <= 24) {
          activePeriod = state.config.yr2;
        } else if (m <= 36) {
          activePeriod = state.config.yr3;
        }

        const activeRate = resolveRate(state.config.mrr, activePeriod);
        const monthlyRate = (activeRate / 100) / 12;
        
        const interest = state.balance * monthlyRate;

        // Custom installment resolution
        const currentRefInst = m <= 12 ? input.currentYr1Installment
                             : m <= 24 ? input.currentYr2Installment
                             : m <= 36 ? input.currentYr3Installment
                             : input.currentYr4PlusInstallment;

        let stateInstallment = state.config.isInstallmentAdjusted 
          ? state.config.customInstallment 
          : currentRefInst;

        let payment = Math.min(stateInstallment, state.balance + interest);
        if (payment < interest) {
          payment = interest + Math.max(1000, input.outstandingPrincipal * 0.002);
        }
        const principal = payment - interest;
        
        state.balance = Math.max(0, state.balance - principal);
        state.accumulatedInterest += interest;
        state.accumulatedPayment += payment;
      }
    });
  }

  // Final compilation
  const pathwaysResults: PathComparisonStats[] = pathways.map((path, index) => {
    const s3Y = pathStates[index];
    const sFull = pathFullStates[index];

    // Pocket interest savings: (Current Interest - Refinance Interest) - setup & old exits & MRTA
    const threeYearSavings = (curAccInterest - s3Y.accumulatedInterest) - s3Y.totalSetupAndAdjustments;
    const fullTermSavings = (curFullAccInterest - sFull.accumulatedInterest) - sFull.totalSetupAndAdjustments;

    return {
      id: path.id,
      nameTh: path.nameTh,
      color: path.color,
      threeYear: {
        totalPaid: s3Y.accumulatedPayment,
        totalInterest: s3Y.accumulatedInterest,
        remainingPrincipal: s3Y.balance,
        setupFees: s3Y.setupFees,
        mrtaPremium: s3Y.mrtaPremium,
        prepaymentCost: prepaymentCost,
        subsidyRefundCost: subsidyRefundCost,
        insurancePenaltyCost: insurancePenaltyCost,
        netExpense: s3Y.accumulatedPayment + s3Y.totalSetupAndAdjustments,
        totalSavingsVsCurrent: threeYearSavings
      },
      fullTerm: {
        totalPaid: sFull.accumulatedPayment,
        totalInterest: sFull.accumulatedInterest,
        totalSavingsVsCurrent: fullTermSavings
      },
      breakevenMonths: s3Y.breakevenMonth
    };
  });

  return {
    monthlyList,
    results: {
      currentStats: {
        threeYear: {
          totalPaid: curAccPayment,
          totalInterest: curAccInterest,
          remainingPrincipal: curBal
        },
        fullTerm: {
          totalPaid: curFullAccPayment,
          totalInterest: curFullAccInterest
        }
      },
      pathways: pathwaysResults
    }
  };
}
