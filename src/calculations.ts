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
  const mortgageRate = config.customMortgageFeeRate !== undefined ? config.customMortgageFeeRate : 1.0;
  const dutyStampRate = config.customDutyStampRate !== undefined ? config.customDutyStampRate : 0.05;

  const mortgageFee = config.freeMortgageFee 
    ? 0 
    : (config.customMortgageFeeAmount !== undefined 
        ? config.customMortgageFeeAmount 
        : principal * (mortgageRate / 100));

  const appraisalFee = config.freeAppraisalFee ? 0 : config.customAppraisalFee;

  const dutyStamp = config.freeDutyStamp 
    ? 0 
    : (config.customDutyStampAmount !== undefined 
        ? config.customDutyStampAmount 
        : principal * (dutyStampRate / 100));
  
  const otherFeesSum = config.customOtherFees && config.customOtherFees.length > 0
    ? config.customOtherFees.reduce((sum, item) => sum + item.amount, 0)
    : config.otherFees;

  const firePremium = config.fireInsurancePremium || 0;

  return mortgageFee + appraisalFee + dutyStamp + otherFeesSum + firePremium;
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

  // 4. MRTA Surrender Value Refund (from old bank/insurance policy surrender)
  const mrta1Surrender = (input.mrta1SumInsured * input.mrta1SurrenderRate3Yr) / 1000;
  const mrta2Surrender = input.borrowerType === "joint" ? ((input.mrta2SumInsured ?? 0) * (input.mrta2SurrenderRate3Yr ?? 0)) / 1000 : 0;
  const totalMrtaSurrenderRefund = mrta1Surrender + mrta2Surrender;

  // Initialize tracking for each compared refinance pathway
  const pathStates = pathways.map(path => {
    const setupFees = computeCustomBankFees(input.outstandingPrincipal, path);
    
    let mrtaPremium = 0;
    if (path.hasMrta) {
      if (path.customMrtaType === "joint") {
        mrtaPremium = (path.customMrtaPremium1 ?? 0) + (path.customMrtaPremium2 ?? 0);
      } else if (path.customMrtaType === "single") {
        mrtaPremium = path.customMrtaPremium1 ?? 0;
      } else {
        mrtaPremium = path.customMrtaPremium !== undefined 
          ? path.customMrtaPremium 
          : computeMrtaPremium(
              input.outstandingPrincipal,
              input.borrowerAge,
              input.borrowerType,
              input.gender || "male",
              Math.max(1, Math.round(input.remainingTermMonths / 12)),
              input.mrtaDecreasingRate || 8
            );
      }
    }
    
    // Total setup fees include physical setup fees + old exit costs + path's MRTA premium if any - totalMrtaSurrenderRefund (deducted as credit)
    const totalSetupAndAdjustments = setupFees + mrtaPremium + totalOldBankExitCost - totalMrtaSurrenderRefund;

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
    
    let mrtaPremium = 0;
    if (path.hasMrta) {
      if (path.customMrtaType === "joint") {
        mrtaPremium = (path.customMrtaPremium1 ?? 0) + (path.customMrtaPremium2 ?? 0);
      } else if (path.customMrtaType === "single") {
        mrtaPremium = path.customMrtaPremium1 ?? 0;
      } else {
        mrtaPremium = path.customMrtaPremium !== undefined 
          ? path.customMrtaPremium 
          : computeMrtaPremium(
              input.outstandingPrincipal,
              input.borrowerAge,
              input.borrowerType,
              input.gender || "male",
              Math.max(1, Math.round(input.remainingTermMonths / 12)),
              input.mrtaDecreasingRate || 8
            );
      }
    }
    const totalSetupAndAdjustments = setupFees + mrtaPremium + totalOldBankExitCost - totalMrtaSurrenderRefund;

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
        totalSavingsVsCurrent: threeYearSavings,
        mrtaSurrenderRefund: totalMrtaSurrenderRefund
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

export interface ScoredPathway {
  id: string;
  nameTh: string;
  type: "current" | "retention" | "refinance";
  color: string;
  savings: number;
  setupFees: number;
  breakevenMonths: number;
  fixedMonths: number;
  
  // Scores 0-100
  scoreSavings: number;
  scoreLiquidity: number;
  scoreBreakeven: number;
  scoreStability: number;
  scoreConvenience: number;
  
  compositeScore: number;
  rank: number;
  verdictTh: string;
  tagTh: string;
}

export function computeSmartScores(
  candidates: Array<{
    id: string;
    type: "current" | "retention" | "refinance";
    nameTh: string;
    color: string;
    totalSetupFees: number;
    savingsStandard: number;
    savingsSimulated: number;
    breakevenMonths: number;
    fixedMonths: number; // pass the number of fixed periods in golden window (0 - 36 months)
  }>,
  outstandingPrincipal: number,
  strategy: "balanced" | "max_savings" | "cash_preservation" | "maximum_convenience" | "rate_stability",
  refiScheduleType: "standard" | "simulated"
): ScoredPathway[] {
  // Determine weights according to Selected Persona Goal
  let wSavings = 0.40;
  let wLiquidity = 0.20;
  let wBreakeven = 0.15;
  let wStability = 0.15;
  let wConvenience = 0.10;

  switch (strategy) {
    case "max_savings":
      wSavings = 0.70;
      wLiquidity = 0.10;
      wBreakeven = 0.10;
      wStability = 0.05;
      wConvenience = 0.05;
      break;
    case "cash_preservation":
      wSavings = 0.15;
      wLiquidity = 0.60;
      wBreakeven = 0.15;
      wStability = 0.05;
      wConvenience = 0.05;
      break;
    case "maximum_convenience":
      wSavings = 0.12;
      wLiquidity = 0.13;
      wBreakeven = 0.10;
      wStability = 0.15;
      wConvenience = 0.50;
      break;
    case "rate_stability":
      wSavings = 0.15;
      wLiquidity = 0.10;
      wBreakeven = 0.10;
      wStability = 0.55;
      wConvenience = 0.10;
      break;
    case "balanced":
    default:
      wSavings = 0.40;
      wLiquidity = 0.20;
      wBreakeven = 0.15;
      wStability = 0.15;
      wConvenience = 0.10;
      break;
  }

  // Find max savings to normalize savings score
  const maxSavings = Math.max(0.1, ...candidates.map(c => refiScheduleType === "simulated" ? c.savingsSimulated : c.savingsStandard));

  const scored: ScoredPathway[] = candidates.map(c => {
    const savings = refiScheduleType === "simulated" ? c.savingsSimulated : c.savingsStandard;
    
    // Dimension 1: Savings Score (0-100)
    // Relative to the absolute best savings option. If net savings are negative, score is 0.
    const scoreSavings = savings > 0 ? Math.min(100, (savings / maxSavings) * 100) : 0;

    // Dimension 2: Upfront Liquidity Score (0-100)
    // Retention has 0 transactional fees, scored high. High fee options score lower.
    const normFeesRatio = c.totalSetupFees / (outstandingPrincipal > 0 ? outstandingPrincipal : 1000000);
    const scoreLiquidity = Math.max(0, Math.min(100, 100 - normFeesRatio * 1500));

    // Dimension 3: Breakeven Speed Score (0-100)
    // No breakeven (fees 0) or breakeven = 0 means immediate payout (100). Longer than 30 months is near 0.
    let scoreBreakeven = 100;
    if (c.breakevenMonths > 0) {
      if (c.breakevenMonths > 36) {
        scoreBreakeven = 0;
      } else {
        scoreBreakeven = Math.max(10, Math.min(100, 103 - (c.breakevenMonths * 2.8)));
      }
    } else if (c.totalSetupFees <= 100) {
      // If upfront setup fees are tiny/none, there is no capital cost to recoup.
      // To prevent bias that rewards a low-saving option with a flat 100, we tie breakeven score to savings score.
      scoreBreakeven = Math.max(15, scoreSavings);
    }

    // Dimension 4: Rate Security / Stability Score (0-100)
    // Fixed rate months in the first 3 years.
    const scoreStability = Math.max(15, Math.min(100, (c.fixedMonths / 36) * 85 + 15));

    // Dimension 5: Process Convenience Score (0-100)
    // Stay (current) is 100. Retention is 85. Refinance is 55.
    let scoreConvenience = 55;
    if (c.type === "current") {
      scoreConvenience = 100;
    } else if (c.type === "retention") {
      scoreConvenience = 85; // Optimized from 95 to avoid flat bias relative to Refinance options (55)
    }

    // Weighted composite score calculation
    const compositeScore = Number(
      (
        scoreSavings * wSavings +
        scoreLiquidity * wLiquidity +
        scoreBreakeven * wBreakeven +
        scoreStability * wStability +
        scoreConvenience * wConvenience
      ).toFixed(2)
    );

    // Custom text advice of verdict & custom tags
    let verdictTh = "ตัวเลือกระดับปานกลาง";
    let tagTh = "";

    if (compositeScore >= 85) {
      verdictTh = "แนะนำเป็นทางเลือกสูงสุด (ยอดเยี่ยมอย่างยิ่ง)";
      tagTh = "🥇 แนะนำสูงสุด";
    } else if (compositeScore >= 70) {
      verdictTh = "ทางเลือกแนะนำที่ดีมาก สมดุลและคุ้มค่าสูง";
      tagTh = "⭐️ คุ้มค่าน่าสนใจ";
    } else if (compositeScore >= 50) {
      verdictTh = "ตัวเลือกปานกลาง มีข้อจำกัดเฉพาะด้าน";
      tagTh = "⚖️ ปานกลาง";
    } else {
      verdictTh = "ข้อเสนอนี้มีความคุ้มค่าเฉลี่ยค่อนข้างต่ำ";
      tagTh = "⚠️ ไม่คุ้มเมื่อหักค่าครองธรรมเนียม";
    }

    return {
      id: c.id,
      nameTh: c.nameTh,
      type: c.type,
      color: c.color,
      savings,
      setupFees: c.totalSetupFees,
      breakevenMonths: c.breakevenMonths,
      fixedMonths: c.fixedMonths,
      scoreSavings: Math.round(scoreSavings),
      scoreLiquidity: Math.round(scoreLiquidity),
      scoreBreakeven: Math.round(scoreBreakeven),
      scoreStability: Math.round(scoreStability),
      scoreConvenience: Math.round(scoreConvenience),
      compositeScore,
      verdictTh,
      tagTh,
      rank: 1
    };
  });

  // Assign correct ranking based on composite score descending
  const sorted = [...scored].sort((a, b) => b.compositeScore - a.compositeScore);
  sorted.forEach((item, index) => {
    item.rank = index + 1;
  });

  // Re-map back to keep original candidate order or sorted order.
  // Actually, returning sorted order is fantastic and highly helpful! Let's return sorted.
  return sorted;
}

