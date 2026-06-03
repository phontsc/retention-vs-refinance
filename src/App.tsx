/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Percent, 
  TrendingDown, 
  DollarSign, 
  Calculator, 
  Landmark, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  BadgeAlert, 
  HelpCircle,
  FileText,
  Bookmark,
  Sparkles,
  Info,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  ClipboardList,
  Plus,
  Trash2,
  User,
  Users,
  Check,
  PiggyBank,
  ShieldCheck,
  Building,
  Coins,
  Flame,
  ShieldAlert,
  Upload,
  Import,
  RotateCcw
} from "lucide-react";
import { 
  BankRate, 
  LoanInput, 
  CustomBankConfig, 
  RatePeriod,
  PathMonthResult, 
  FinalComparisonResult,
  HistoricalPayment,
  RefiPackageConfig
} from "./types";
import { 
  performMultiAmortization, 
  calculateSuggestedInstallment, 
  computeCustomBankFees,
  resolveRate,
  computeMrtaPremium,
  computeSmartScores,
  ScoredPathway
} from "./calculations";
import { maleRiskFactorTable, femaleRiskFactorTable } from "./mrtaData";
import BankOffers from "./components/BankOffers";
import BankLogo from "./components/BankLogo";
import { MrtaCalculator } from "./components/MrtaCalculator";

const LedgerDateInput = ({ initialValue, onChange }: { initialValue: string, onChange: (val: string) => void }) => {
  const [val, setVal] = React.useState(initialValue);
  useEffect(() => { setVal(initialValue); }, [initialValue]);
  return (
    <input
      type="date"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { if (val !== initialValue) onChange(val); }}
      className="bg-transparent border-0 focus:ring-1 focus:ring-indigo-100 text-[10px] w-full p-0.5"
    />
  );
};

const LedgerAmountInput = ({ initialValue, onChange }: { initialValue: number, onChange: (val: string) => void }) => {
  const [val, setVal] = React.useState<number | string>(initialValue);
  useEffect(() => { setVal(initialValue); }, [initialValue]);
  return (
    <input
      type="number"
      step="500"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { if (val !== initialValue && val !== "") onChange(val.toString()); }}
      className="bg-transparent border-0 focus:ring-1 focus:ring-indigo-100 text-right text-[10px] font-bold text-slate-800 w-full p-0.5"
    />
  );
};

const getPackageOptionLabel = (id: number) => {
  switch(id) {
    case 1: return "1. ทำ MRTA + ฟรีค่าจดจำนอง (1%)";
    case 2: return "2. ทำ MRTA + ไม่ฟรีค่าจดจำนอง";
    case 3: return "3. ไม่ทำ MRTA + ฟรีค่าจดจำนอง (1%)";
    case 4: return "4. ไม่ทำ MRTA + ไม่ฟรีค่าจดจำนอง";
    default: return "";
  }
};

const computeRefiPackageSchedule3YrGlobal = (
  principal: number,
  mrr: number,
  startDateStr: string,
  yr1: RatePeriod,
  yr2: RatePeriod,
  yr3: RatePeriod,
  stdInstallment: number,
  simTotalPay: number
) => {
  let balStd = principal;
  let intStdTotal = 0;
  const stdRows = [];

  let balSim = principal;
  let intSimTotal = 0;
  const simRows = [];

  const parts = startDateStr.split("-");
  const year = parseInt(parts[0], 10) || 2026;
  const month = (parseInt(parts[1], 10) - 1) || 7;
  const day = parseInt(parts[2], 10) || 16;

  for (let m = 1; m <= 36; m++) {
    let ratePeriod = yr3;
    if (m <= 12) {
      ratePeriod = yr1;
    } else if (m <= 24) {
      ratePeriod = yr2;
    }

    const activeRate = resolveRate(mrr, ratePeriod);

    // Date calculations for precision
    const prevDate = new Date(year, month + (m - 1), day);
    const currDate = new Date(year, month + m, day);
    const prevUtc = Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
    const currUtc = Date.UTC(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
    const daysInPeriod = Math.max(28, Math.min(31, Math.floor((currUtc - prevUtc) / (1000 * 60 * 60 * 24))));

    const pStartDate = (m === 1) ? prevDate : new Date(prevDate.getTime() + 24 * 60 * 60 * 1000);
    const pEndDate = currDate;

    const formatD = (d: Date) => {
      const dd = d.getDate().toString().padStart(2, "0");
      const mm = (d.getMonth() + 1).toString().padStart(2, "0");
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    };

    const dateRangeStr = `${formatD(pStartDate)} - ${formatD(pEndDate)}`;
    const dailyRate = activeRate / 100 / 365;

    // Standard Step
    const begStd = balStd;
    const interestStd = Number((balStd * dailyRate * daysInPeriod).toFixed(2));
    const payStd = Math.min(stdInstallment, balStd + interestStd);
    const principalStd = Number((payStd - interestStd).toFixed(2));
    balStd = Math.max(0, Number((balStd - principalStd).toFixed(2)));
    intStdTotal += interestStd;

    stdRows.push({
      month: m,
      rate: activeRate,
      begBal: begStd,
      interest: interestStd,
      payment: payStd,
      principal: principalStd,
      endBal: balStd,
      days: daysInPeriod,
      dateRange: dateRangeStr
    });

    // Simulated Step
    const begSim = balSim;
    const interestSim = Number((balSim * dailyRate * daysInPeriod).toFixed(2));
    const paySim = Math.min(Math.max(stdInstallment, simTotalPay), balSim + interestSim);
    const principalSim = Number((paySim - interestSim).toFixed(2));
    balSim = Math.max(0, Number((balSim - principalSim).toFixed(2)));
    intSimTotal += interestSim;

    simRows.push({
      month: m,
      rate: activeRate,
      begBal: begSim,
      interest: interestSim,
      payment: paySim,
      principal: principalSim,
      endBal: balSim,
      days: daysInPeriod,
      dateRange: dateRangeStr
    });
  }

  return {
    standardInterest: Number(intStdTotal.toFixed(2)),
    simulatedInterest: Number(intSimTotal.toFixed(2)),
    standardSchedule: stdRows,
    simulatedSchedule: simRows
  };
};

export default function App() {                
  
  const getElapsedYears = (startDateStr: string) => {
    if (!startDateStr) return 0;
    const start = new Date(startDateStr);
    const today = new Date();
    let diffYears = today.getFullYear() - start.getFullYear();
    const monthDiff = today.getMonth() - start.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < start.getDate())) {
      diffYears--;
    }
    return Math.max(0, diffYears);
  };

  const getMonthsDiff = (startDateStr: string, endDateStr: string) => {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) {
      months--;
    }
    return Math.max(0, months);
  };

  const addMonthsToDateString = (startDateStr: string, monthsToAdd: number) => {
    if (!startDateStr) return "";
    const parts = startDateStr.split("-");
    if (parts.length !== 3) return startDateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    date.setMonth(date.getMonth() + monthsToAdd);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const calculateMrtaPremium = (age: number, loanAmount: number, loanPeriod: number, gender: "male" | "female") => {
    const table = gender === 'male' ? maleRiskFactorTable : femaleRiskFactorTable;
    const lookupAge = Math.min(69, Math.max(21, Math.round(age)));
    const factors = table[lookupAge] || [];
    const lookupPeriod = Math.min(factors.length, Math.max(1, Math.round(loanPeriod)));
    const factor = factors[lookupPeriod - 1] || 0;
    return (factor * loanAmount) / 1000;
  };

  // 1. Core States
  const [loanInput, setLoanInput] = useState<LoanInput>({
    outstandingPrincipal: 5400000,
    currentInterestRate: 6.50,
    remainingTermMonths: 447, // 480 - 33 = 447 months remaining
    currentInstallment: 20500,

    borrowerType: "joint",
    gender: "male",
    borrowerAge: 35,
    borrowerAgeAtContract: 32,
    borrower2Age: 32,
    borrower2Gender: "female",
    startingLoanAmount: 5400000,

    // Contract dates
    contractStartDate: "2023-08-16",
    retentionStartDate: "2026-08-16",
    startingTermMonths: 480, // 480 เดือน (40 ปี)

    // Related Expenses
    appraisalFee: 3000,
    mortgageFeeRate: 1.0,
    dutyStampRate: 0.05,

    // Fire Insurance
    fireInsurancePremium: 4500,
    fireInsuranceDuration: 3,
    fireSumInsuredBuilding: 2500000,
    fireSumInsuredContent: 600000,

    // Borrower 1 MRTA
    mrta1Premium: 35000,
    mrta1SumInsured: 3500000,
    mrta1Type: "decreasing",
    mrta1PaymentPattern: "single",
    mrta1SurrenderRate3Yr: 13.57,

    // Borrower 2 MRTA (for Joint)
    mrta2Premium: 28000,
    mrta2SumInsured: 3500000,
    mrta2Type: "decreasing",
    mrta2PaymentPattern: "single",
    mrta2SurrenderRate3Yr: 13.57,

    currentYr1Rate: { type: "fixed", value: 2.69 },
    currentYr2Rate: { type: "fixed", value: 2.89 },
    currentYr3Rate: { type: "mrr", value: -5.31 },
    currentYr4PlusRate: { type: "fixed", value: 2.69 },

    currentYr1Installment: 14300,
    currentYr2Installment: 15400,
    currentYr3Installment: 20500,
    currentYr4PlusInstallment: 14300,

    prepaymentFeeRate: 3.0,
    prepaymentLockMonths: 36,

    receivesSubsidy: true,
    subsidyAmount: 40000, // ค่าจดจำนองที่ธนาคารเดิมสำรองจ่ายให้ 1%
    subsidyLockMonths: 36,
    elapsedMonths: 36, // งวดผ่อนมาแล้ว 36 ด.

    hasInsurancePenalty: true,
    insurancePenaltyRate: 0.35,
    insurancePenaltyMonths: 36,

    historicalPayments: [
      { id: "h1", monthIndex: 1, payDate: "2023-08-31", paymentAmount: 29700, interestCalculated: 5970, principalDeducted: 23730, endingBalance: 5376270 },
      { id: "h2", monthIndex: 2, payDate: "2023-08-31", paymentAmount: 14300, interestCalculated: 0, principalDeducted: 14300, endingBalance: 5361970 },
      { id: "h3", monthIndex: 3, payDate: "2023-09-01", paymentAmount: 14300, interestCalculated: 395, principalDeducted: 13905, endingBalance: 5348065 },
      { id: "h4", monthIndex: 4, payDate: "2023-09-30", paymentAmount: 17200, interestCalculated: 11430, principalDeducted: 5770, endingBalance: 5342295 },
      { id: "h5", monthIndex: 5, payDate: "2023-09-30", paymentAmount: 44000, interestCalculated: 0, principalDeducted: 44000, endingBalance: 5298295 },
      { id: "h6", monthIndex: 6, payDate: "2023-10-05", paymentAmount: 14300, interestCalculated: 1952, principalDeducted: 12348, endingBalance: 5285947 },
    ]
  });

  const [selectedBankIds, setSelectedBankIds] = useState<string[]>(["ghb"]);
  const [currentBankId, setCurrentBankId] = useState<string>("lhbank");
  const [banksList, setBanksList] = useState<BankRate[]>([]);

  // Customized profiles for selected refinancing banks
  const [customBanks, setCustomBanks] = useState<CustomBankConfig[]>([]);

  // Derived state options
  const [activeTab, setActiveTab] = useState<"chart" | "table">("chart");
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<string>("ghb"); // defaults to the preselected bank ID
  const [activeConfigSubTab, setActiveConfigSubTab] = useState<"borrower" | "teaser_rates" | "expenses" | "mrta" | "mrta_calc" | "penalties">("borrower");
  const [botHistoricalMrrs, setBotHistoricalMrrs] = useState<Record<string, { periodFromApi: string, mrr: string }[] | null>>({});
  const [optimizationStrategy, setOptimizationStrategy] = useState<"balanced" | "max_savings" | "cash_preservation" | "maximum_convenience" | "rate_stability">("balanced");

  // States for past payment ledger comparison graph and simulation scenario
  const [simulatedTotalPayment, setSimulatedTotalPayment] = useState<number>(30500); // Default total payment per month to 30,500 THB (20,500 base + 10,000 prepay)
  const simulatedPrepayAmount = Math.max(0, simulatedTotalPayment - loanInput.currentInstallment);
  const [ledgerVisualTab, setLedgerVisualTab] = useState<"balance" | "payments">("balance");
  const [hoveredInstallmentIndex, setHoveredInstallmentIndex] = useState<number | null>(null);
  const [showStdAmortizationTable, setShowStdAmortizationTable] = useState(false);
  const [amortTableType, setAmortTableType] = useState<"standard" | "simulated">("standard");
  const [isHistoryCalcTableCollapsed, setIsHistoryCalcTableCollapsed] = useState(false);

  // Decoupled Simulation States for Original Loan Panel
  const [origSimRates, setOrigSimRates] = useState({
    yr1: { type: "fixed", value: 2.69 },
    yr2: { type: "fixed", value: 2.89 },
    yr3: { type: "mrr", value: -5.31 },
    yr4Plus: { type: "fixed", value: 2.69 },
  });
  const [origSimInstallments, setOrigSimInstallments] = useState({
    yr1: 14300,
    yr2: 15400,
    yr3: 20500,
    yr4Plus: 14300,
  });

  // Decoupled Fire Insurance States for Retention
  const [retentionFirePremium, setRetentionFirePremium] = useState<number>(0);
  const [retentionFireDuration, setRetentionFireDuration] = useState<number>(3);
  const [retentionFireSumInsured, setRetentionFireSumInsured] = useState<number>(2500000);

  // Expanded MRTA calculator state (Default is collapsed/false)
  const [mrtaCalculatorExpanded, setMrtaCalculatorExpanded] = useState<Record<string, boolean>>({});

  // Refinance 3-Year Schedule and Start Date states
  const [refinanceStartDate, setRefinanceStartDate] = useState<string>("2026-08-16");
  const [refiScheduleExpandedPkgId, setRefiScheduleExpandedPkgId] = useState<number | null>(null);
  const [refiScheduleType, setRefiScheduleType] = useState<"standard" | "simulated">("standard");
  const [activeRefiSchedule, setActiveRefiSchedule] = useState<{
    title: string;
    isSimulated: boolean;
    setupFeesBreakdown?: {
      mortgageFee: number;
      appraisalFee: number;
      dutyStamp: number;
      mrtaPremium: number;
      fireInsurancePremium: number;
      otherFees: number;
      oldMrtaRefund?: number;
      totalSetupFees: number;
    };
    rows: Array<{
      month: number;
      beginning: number;
      rate: number;
      payment: number;
      interest: number;
      principal: number;
      ending: number;
    }>;
  } | null>(null);

  const [showMcrasInfo, setShowMcrasInfo] = useState<boolean>(false);

  const handleOrigSimRateChange = (
    key: "yr1" | "yr2" | "yr3" | "yr4Plus",
    field: "type" | "value",
    val: any
  ) => {
    setOrigSimRates(prev => {
      const currentRate = prev[key];
      let finalValue = val;
      if (field === "value" && currentRate.type === "mrr") {
        finalValue = -Math.abs(val);
      }
      return { ...prev, [key]: { ...currentRate, [field]: finalValue } };
    });
  };

  // Build simulated pathways array containing ONLY our custom refinancing banks
  const pathwaysToSimulate = customBanks;

  // Universal helper to generate the 4 specific Refinance Packages requested by the user
  const getRefiPackagesForBank = (bankId: string, defaultMRR: number, defaultRefiRate: number) => {
    const base = defaultRefiRate > 0 ? defaultRefiRate : 3.50;
    if (bankId === "lhbank") {
      return [
        {
          id: 1,
          label: "1. ทำประกัน MRTA/MLTA + ฟรีค่าจดจำนอง",
          desc: "ปี 1-3: 3.15% | หลังจากนั้น: MRR - 3.01% (5.17%)",
          avg: 3.15,
          rates: [3.15, 3.15, 3.15],
          freeMortgage: true,
          yr4PlusVal: -3.01,
        },
        {
          id: 2,
          label: "2. ทำประกัน MRTA/MLTA + ไม่ฟรีค่าจดจำนอง",
          desc: "ปี 1: 1.59% | ปี 2-3: 3.63% | หลังจากนั้น: MRR - 3.01% (5.17%)",
          avg: 2.95,
          rates: [1.59, 3.63, 3.63],
          freeMortgage: false,
          yr4PlusVal: -3.01,
        },
        {
          id: 3,
          label: "3. ไม่ทำประกัน + ฟรีค่าจดจำนอง",
          desc: "ปี 1-3: 3.25% | หลังจากนั้น: MRR - 3.01% (5.17%)",
          avg: 3.25,
          rates: [3.25, 3.25, 3.25],
          freeMortgage: true,
          yr4PlusVal: -3.01,
        },
        {
          id: 4,
          label: "4. ไม่ทำประกัน + ไม่ฟรีค่าจดจำนอง",
          desc: "ปี 1-3: 3.05% | หลังจากนั้น: MRR - 3.01% (5.17%)",
          avg: 3.05,
          rates: [3.05, 3.05, 3.05],
          freeMortgage: false,
          yr4PlusVal: -3.01,
        }
      ];
    }

    const getSteppedRates = (avg: number) => [
      Number((avg - 0.30).toFixed(2)),
      Number(avg.toFixed(2)),
      Number((avg + 0.30).toFixed(2))
    ];

    const avg1 = base;
    const avg2 = Number((base - 0.20).toFixed(2));
    const avg3 = Number((base + 0.10).toFixed(2));
    const avg4 = Number((base - 0.10).toFixed(2));

    return [
      {
        id: 1,
        label: "1. ทำประกัน MRTA/MLTA + ฟรีค่าจดจำนอง",
        desc: `เฉลี่ย 3 ปี: ${avg1.toFixed(2)}% (ปี 1: ${(avg1-0.30).toFixed(2)}% | ปี 2: ${avg1.toFixed(2)}% | ปี 3: ${(avg1+0.30).toFixed(2)}%)`,
        avg: avg1,
        rates: getSteppedRates(avg1),
        freeMortgage: true,
        yr4PlusVal: -1.00,
      },
      {
        id: 2,
        label: "2. ทำประกัน MRTA/MLTA + ไม่ฟรีค่าจดจำนอง",
        desc: `เฉลี่ย 3 ปี: ${avg2.toFixed(2)}% (ปี 1: ${(avg2-0.30).toFixed(2)}% | ปี 2: ${avg2.toFixed(2)}% | ปี 3: ${(avg2+0.30).toFixed(2)}%)`,
        avg: avg2,
        rates: getSteppedRates(avg2),
        freeMortgage: false,
        yr4PlusVal: -1.00,
      },
      {
        id: 3,
        label: "3. ไม่ทำประกัน + ฟรีค่าจดจำนอง",
        desc: `เฉลี่ย 3 ปี: ${avg3.toFixed(2)}% (ปี 1: ${(avg3-0.30).toFixed(2)}% | ปี 2: ${avg3.toFixed(2)}% | ปี 3: ${(avg3+0.30).toFixed(2)}%)`,
        avg: avg3,
        rates: getSteppedRates(avg3),
        freeMortgage: true,
        yr4PlusVal: -1.00,
      },
      {
        id: 4,
        label: "4. ไม่ทำประกัน + ไม่ฟรีค่าจดจำนอง",
        desc: `เฉลี่ย 3 ปี: ${avg4.toFixed(2)}% (ปี 1: ${(avg4-0.30).toFixed(2)}% | ปี 2: ${avg4.toFixed(2)}% | ปี 3: ${(avg4+0.30).toFixed(2)}%)`,
        avg: avg4,
        rates: getSteppedRates(avg4),
        freeMortgage: false,
        yr4PlusVal: -1.00,
      }
    ];
  };

  // Find active reference MRR of current bank
  const currentBankObj = banksList.find(b => b.id === currentBankId);
  const currentBankMrrVal = currentBankObj ? currentBankObj.mrr : 6.50;

  // Perform multi-pathway calculations
  const { monthlyList, results } = performMultiAmortization(loanInput, pathwaysToSimulate, currentBankMrrVal);

  const oldBankPenaltiesRetention = React.useMemo(() => {
    // Calculate precise elapsed months based on contract start/end dates
    const dateElapsedMonths = getMonthsDiff(loanInput.contractStartDate, loanInput.retentionStartDate);

    const isPrepaymentViolated = dateElapsedMonths < loanInput.prepaymentLockMonths;
    const prepaymentCost = isPrepaymentViolated 
      ? loanInput.outstandingPrincipal * (loanInput.prepaymentFeeRate / 100) 
      : 0;

    const isSubsidyRefundViolated = loanInput.receivesSubsidy && (dateElapsedMonths < loanInput.subsidyLockMonths);
    const subsidyRefundCost = isSubsidyRefundViolated ? loanInput.subsidyAmount : 0;

    const isInsurancePenaltyViolated = loanInput.hasInsurancePenalty && (dateElapsedMonths < 36);
    const insurancePenaltyCost = isInsurancePenaltyViolated
      ? loanInput.outstandingPrincipal * (loanInput.insurancePenaltyRate / 100) * (loanInput.insurancePenaltyMonths || 0)
      : 0;

    const total = prepaymentCost + subsidyRefundCost + insurancePenaltyCost;

    return {
      isPrepaymentViolated,
      prepaymentCost,
      isSubsidyRefundViolated,
      subsidyRefundCost,
      isInsurancePenaltyViolated,
      insurancePenaltyCost,
      total
    };
  }, [
    loanInput.contractStartDate,
    loanInput.retentionStartDate,
    loanInput.prepaymentLockMonths,
    loanInput.prepaymentFeeRate,
    loanInput.outstandingPrincipal,
    loanInput.receivesSubsidy,
    loanInput.subsidyLockMonths,
    loanInput.subsidyAmount,
    loanInput.hasInsurancePenalty,
    loanInput.insurancePenaltyRate,
    loanInput.insurancePenaltyMonths
  ]);

  const oldBankPenaltiesRefinance = React.useMemo(() => {
    // Calculate precise elapsed months based on contract start/refinance dates
    const dateElapsedMonths = getMonthsDiff(loanInput.contractStartDate, refinanceStartDate);

    const isPrepaymentViolated = dateElapsedMonths < loanInput.prepaymentLockMonths;
    const prepaymentCost = isPrepaymentViolated 
      ? loanInput.outstandingPrincipal * (loanInput.prepaymentFeeRate / 100) 
      : 0;

    const isSubsidyRefundViolated = loanInput.receivesSubsidy && (dateElapsedMonths < loanInput.subsidyLockMonths);
    const subsidyRefundCost = isSubsidyRefundViolated ? loanInput.subsidyAmount : 0;

    const isInsurancePenaltyViolated = loanInput.hasInsurancePenalty && (dateElapsedMonths < 36);
    const insurancePenaltyCost = isInsurancePenaltyViolated
      ? loanInput.outstandingPrincipal * (loanInput.insurancePenaltyRate / 100) * (loanInput.insurancePenaltyMonths || 0)
      : 0;

    const total = prepaymentCost + subsidyRefundCost + insurancePenaltyCost;

    return {
      isPrepaymentViolated,
      prepaymentCost,
      isSubsidyRefundViolated,
      subsidyRefundCost,
      isInsurancePenaltyViolated,
      insurancePenaltyCost,
      total
    };
  }, [
    loanInput.contractStartDate,
    refinanceStartDate,
    loanInput.prepaymentLockMonths,
    loanInput.prepaymentFeeRate,
    loanInput.outstandingPrincipal,
    loanInput.receivesSubsidy,
    loanInput.subsidyLockMonths,
    loanInput.subsidyAmount,
    loanInput.hasInsurancePenalty,
    loanInput.insurancePenaltyRate,
    loanInput.insurancePenaltyMonths
  ]);

  const currentLoan3YrStats = React.useMemo(() => {
    let balStd = loanInput.outstandingPrincipal;
    let intStdTotal = 0;
    
    let balSim = loanInput.outstandingPrincipal;
    let intSimTotal = 0;

    const rDateStr = loanInput.retentionStartDate || "2026-08-16";
    const rParts = rDateStr.split("-");
    const rYear = parseInt(rParts[0], 10) || 2026;
    const rMonth = (parseInt(rParts[1], 10) - 1) || 7;
    const rDay = parseInt(rParts[2], 10) || 16;

    const activeRate = loanInput.currentInterestRate; // standard floating rate, e.g. 6.50%

    for (let m = 1; m <= 36; m++) {
      const prevDate = new Date(rYear, rMonth + (m - 1), rDay);
      const currDate = new Date(rYear, rMonth + m, rDay);
      const prevUtc = Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
      const currUtc = Date.UTC(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
      const daysInPeriod = Math.max(28, Math.min(31, Math.floor((currUtc - prevUtc) / (1000 * 60 * 60 * 24))));

      const dailyRateVal = activeRate / 100 / 365;

      // Standard Base Step
      const interestStd = Number((balStd * dailyRateVal * daysInPeriod).toFixed(2));
      const payStd = Math.min(loanInput.currentInstallment, balStd + interestStd);
      const principalStd = Number((payStd - interestStd).toFixed(2));
      balStd = Math.max(0, Number((balStd - principalStd).toFixed(2)));
      intStdTotal += interestStd;

      // Simulated Step
      const interestSim = Number((balSim * dailyRateVal * daysInPeriod).toFixed(2));
      const paySim = Math.min(Math.max(loanInput.currentInstallment, simulatedTotalPayment), balSim + interestSim);
      const principalSim = Number((paySim - interestSim).toFixed(2));
      balSim = Math.max(0, Number((balSim - principalSim).toFixed(2)));
      intSimTotal += interestSim;
    }

    return {
      standardInterest: Number(intStdTotal.toFixed(2)),
      simulatedInterest: Number(intSimTotal.toFixed(2))
    };
  }, [
    loanInput.outstandingPrincipal,
    loanInput.currentInterestRate,
    loanInput.currentInstallment,
    loanInput.retentionStartDate,
    simulatedTotalPayment
  ]);

  const computeRefiPackageSchedule3Yr = React.useCallback((
    principal: number,
    bankConfig: CustomBankConfig,
    packageId: number,
    simTotalPay: number
  ) => {
    const pkgs = bankConfig.packages || [];
    const pkgObj = pkgs.find(p => p.id === packageId) || pkgs[0];
    if (!pkgObj) {
      return {
        standardInterest: 0,
        simulatedInterest: 0,
        mortgageFee: 0,
        appraisalFee: 0,
        dutyStamp: 0,
        otherFees: 0,
        mrtaPremium: 0,
        fireInsurancePremium: 0,
        totalSetupFees: 0
      };
    }

    const isFreeMortgage = pkgObj.freeMortgage;
    const mortgageFee = isFreeMortgage 
      ? 0 
      : principal * ((bankConfig.customMortgageFeeRate !== undefined ? bankConfig.customMortgageFeeRate : 1.0) / 100);

    const appraisalFee = bankConfig.freeAppraisalFee ? 0 : (bankConfig.customAppraisalFee ?? 3000);

    const dutyStamp = bankConfig.freeDutyStamp 
      ? 0 
      : (bankConfig.customDutyStampAmount !== undefined 
          ? bankConfig.customDutyStampAmount 
          : Math.round(principal * ((bankConfig.customDutyStampRate !== undefined ? bankConfig.customDutyStampRate : 0.05) / 100)));

    let otherFeesVal = bankConfig.otherFees || 0;
    if (bankConfig.customOtherFees && bankConfig.customOtherFees.length > 0) {
      otherFeesVal = bankConfig.customOtherFees.reduce((sum, item) => sum + (item.amount || 0), 0);
    }

    let mrtaPremium = 0;
    const hasMrtaInPkg = pkgObj.hasMrta;
    if (hasMrtaInPkg) {
      if (bankConfig.customMrtaType === "joint") {
        mrtaPremium = (bankConfig.customMrtaPremium1 ?? 0) + (bankConfig.customMrtaPremium2 ?? 0);
      } else if (bankConfig.customMrtaType === "single") {
        mrtaPremium = bankConfig.customMrtaPremium1 ?? 0;
      } else {
        mrtaPremium = bankConfig.customMrtaPremium !== undefined 
          ? bankConfig.customMrtaPremium 
          : computeMrtaPremium(
              principal,
              loanInput.borrowerAge,
              loanInput.borrowerType,
              loanInput.gender || "male",
              Math.max(1, Math.round(loanInput.remainingTermMonths / 12)),
              loanInput.mrtaDecreasingRate || 8
            );
      }
    }

    const fireInsurancePremium = bankConfig.fireInsurancePremium || 0;

    const mrta1Surrender = (loanInput.mrta1SumInsured * loanInput.mrta1SurrenderRate3Yr) / 1000;
    const mrta2Surrender = loanInput.borrowerType === "joint" ? ((loanInput.mrta2SumInsured ?? 0) * (loanInput.mrta2SurrenderRate3Yr ?? 0)) / 1000 : 0;
    const oldMrtaRefund = mrta1Surrender + mrta2Surrender;

    const totalSetupFees = mortgageFee + appraisalFee + dutyStamp + otherFeesVal + mrtaPremium + fireInsurancePremium - oldMrtaRefund + oldBankPenaltiesRefinance.total;

    let balStd = principal;
    let intStdTotal = 0;
    let balSim = principal;
    let intSimTotal = 0;

    const rDateStr = refinanceStartDate || "2026-08-16";
    const rParts = rDateStr.split("-");
    const rYear = parseInt(rParts[0], 10) || 2026;
    const rMonth = (parseInt(rParts[1], 10) - 1) || 7;
    const rDay = parseInt(rParts[2], 10) || 16;

    for (let m = 1; m <= 36; m++) {
      let ratePeriod = pkgObj.yr4Plus;
      if (m <= 12) ratePeriod = pkgObj.yr1;
      else if (m <= 24) ratePeriod = pkgObj.yr2;
      else if (m <= 36) ratePeriod = pkgObj.yr3;

      const activeRate = resolveRate(bankConfig.mrr, ratePeriod);

      const prevDate = new Date(rYear, rMonth + (m - 1), rDay);
      const currDate = new Date(rYear, rMonth + m, rDay);
      const prevUtc = Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
      const currUtc = Date.UTC(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
      const daysInPeriod = Math.max(28, Math.min(31, Math.floor((currUtc - prevUtc) / (1000 * 60 * 60 * 24))));

      const dailyRateVal = activeRate / 100 / 365;

      const stdInstallment = bankConfig.isInstallmentAdjusted ? bankConfig.customInstallment : loanInput.currentInstallment;
      const interestStd = Number((balStd * dailyRateVal * daysInPeriod).toFixed(2));
      const payStd = Math.min(stdInstallment, balStd + interestStd);
      const principalStd = Number((payStd - interestStd).toFixed(2));
      balStd = Math.max(0, Number((balStd - principalStd).toFixed(2)));
      intStdTotal += interestStd;

      const interestSim = Number((balSim * dailyRateVal * daysInPeriod).toFixed(2));
      const activeSimInstallment = bankConfig.isInstallmentAdjusted ? bankConfig.customInstallment : loanInput.currentInstallment;
      const paySim = Math.min(Math.max(activeSimInstallment, simTotalPay), balSim + interestSim);
      const principalSim = Number((paySim - interestSim).toFixed(2));
      balSim = Math.max(0, Number((balSim - principalSim).toFixed(2)));
      intSimTotal += interestSim;
    }

    return {
      standardInterest: Number(intStdTotal.toFixed(2)),
      simulatedInterest: Number(intSimTotal.toFixed(2)),
      mortgageFee,
      appraisalFee,
      dutyStamp,
      otherFees: otherFeesVal,
      mrtaPremium,
      fireInsurancePremium,
      oldMrtaRefund,
      totalSetupFees,
      prepaymentCost: oldBankPenaltiesRefinance.prepaymentCost,
      subsidyRefundCost: oldBankPenaltiesRefinance.subsidyRefundCost,
      insurancePenaltyCost: oldBankPenaltiesRefinance.insurancePenaltyCost,
      totalPenalties: oldBankPenaltiesRefinance.total
    };
  }, [
    refinanceStartDate,
    loanInput.currentInstallment,
    loanInput.borrowerAge,
    loanInput.borrowerType,
    loanInput.gender,
    loanInput.remainingTermMonths,
    loanInput.mrtaDecreasingRate,
    loanInput.mrta1SumInsured,
    loanInput.mrta1SurrenderRate3Yr,
    loanInput.mrta2SumInsured,
    loanInput.mrta2SurrenderRate3Yr,
    oldBankPenaltiesRefinance
  ]);

  const { standardInt, actualInt, savings, standardSchedule, actualSchedule } = React.useMemo(() => {
    // Standard Amortization over 36 periods starting from active outstanding principal
    let balStd3Yr = loanInput.outstandingPrincipal;
    let totalIntStd3Yr = 0;
    const stdSchedule = [];
    
    // Actual Amortization over 36 periods (with simulated extra prepayments)
    let balAct3Yr = loanInput.outstandingPrincipal;
    let totalIntAct3Yr = 0;
    const actSchedule = [];

    const mrr = currentBankMrrVal;

    // Daily interest calculation from retention start date
    const rDateStr = loanInput.retentionStartDate || "2026-08-16";
    const rParts = rDateStr.split("-");
    const rYear = parseInt(rParts[0], 10) || 2026;
    const rMonth = (parseInt(rParts[1], 10) - 1) || 7;
    const rDay = parseInt(rParts[2], 10) || 16;

    for (let m = 1; m <= 36; m++) {
      // Standard Rate & Installment
      let ratePeriod = origSimRates.yr4Plus;
      let installment = origSimInstallments.yr4Plus;

      if (m <= 12) {
        ratePeriod = origSimRates.yr1;
        installment = origSimInstallments.yr1;
      } else if (m <= 24) {
        ratePeriod = origSimRates.yr2;
        installment = origSimInstallments.yr2;
      } else if (m <= 36) {
        ratePeriod = origSimRates.yr3;
        installment = origSimInstallments.yr3;
      }

      const activeRate = resolveRate(mrr, ratePeriod);

      // Determine starting/ending dates of this period to count exact days
      const prevDate = new Date(rYear, rMonth + (m - 1), rDay);
      const currDate = new Date(rYear, rMonth + m, rDay);
      const prevUtc = Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
      const currUtc = Date.UTC(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
      const daysInPeriod = Math.max(28, Math.min(31, Math.floor((currUtc - prevUtc) / (1000 * 60 * 60 * 24))));

      const pStartDate = (m === 1) ? prevDate : new Date(prevDate.getTime() + 24 * 60 * 60 * 1000);
      const pEndDate = currDate;

      const formatD = (d: Date) => {
        const day = d.getDate().toString().padStart(2, "0");
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const dateRangeStr = `${formatD(pStartDate)} - ${formatD(pEndDate)}`;

      const dailyRate = activeRate / 100 / 365;

      // Standard Step
      const begStd = balStd3Yr;
      const intStd = Number((balStd3Yr * dailyRate * daysInPeriod).toFixed(2));
      const payStd = Math.min(installment, balStd3Yr + intStd);
      const prinStd = Number((payStd - intStd).toFixed(2));
      balStd3Yr = Math.max(0, Number((balStd3Yr - prinStd).toFixed(2)));
      totalIntStd3Yr += intStd;

      stdSchedule.push({
        month: m,
        rate: activeRate,
        begBal: begStd,
        interest: intStd,
        payment: payStd,
        principal: prinStd,
        endBal: balStd3Yr,
        days: daysInPeriod,
        dateRange: dateRangeStr
      });

      // Actual Simulation Step
      const begAct = balAct3Yr;
      const intAct = Number((balAct3Yr * dailyRate * daysInPeriod).toFixed(2));
      const payAct = Math.min(Math.max(installment, simulatedTotalPayment), balAct3Yr + intAct);
      const prinAct = Number((payAct - intAct).toFixed(2));
      balAct3Yr = Math.max(0, Number((balAct3Yr - prinAct).toFixed(2)));
      totalIntAct3Yr += intAct;

      actSchedule.push({
        month: m,
        rate: activeRate,
        begBal: begAct,
        interest: intAct,
        payment: payAct,
        principal: prinAct,
        endBal: balAct3Yr,
        days: daysInPeriod,
        dateRange: dateRangeStr
      });
    }

    return { 
      standardInt: Number(totalIntStd3Yr.toFixed(2)), 
      actualInt: Number(totalIntAct3Yr.toFixed(2)), 
      savings: Number((totalIntStd3Yr - totalIntAct3Yr).toFixed(2)),
      standardSchedule: stdSchedule,
      actualSchedule: actSchedule
    };
  }, [
    loanInput.outstandingPrincipal,
    loanInput.contractStartDate,
    loanInput.retentionStartDate,
    loanInput.elapsedMonths,
    origSimRates,
    origSimInstallments,
    simulatedTotalPayment,
    currentBankMrrVal
  ]);

  const retentionFullTermStats = React.useMemo(() => {
    const termMonths = loanInput.remainingTermMonths > 0 ? loanInput.remainingTermMonths : 240;
    
    // Standard full term (no extra prepayments)
    let balStd = loanInput.outstandingPrincipal;
    let totalIntStd = 0;
    
    // Actual full term (with simulated extra payments)
    let balAct = loanInput.outstandingPrincipal;
    let totalIntAct = 0;

    const mrr = currentBankMrrVal;

    for (let m = 1; m <= termMonths; m++) {
      // Rates and installments for each month
      let ratePeriod = origSimRates.yr4Plus;
      let installment = origSimInstallments.yr4Plus;

      if (m <= 12) {
        ratePeriod = origSimRates.yr1;
        installment = origSimInstallments.yr1;
      } else if (m <= 24) {
        ratePeriod = origSimRates.yr2;
        installment = origSimInstallments.yr2;
      } else if (m <= 36) {
        ratePeriod = origSimRates.yr3;
        installment = origSimInstallments.yr3;
      }

      const activeRate = resolveRate(mrr, ratePeriod);
      const monthlyRate = activeRate / 100 / 12;

      // 1. Standard Step
      if (balStd > 0) {
        const intStd = balStd * monthlyRate;
        const payStd = Math.min(installment, balStd + intStd);
        const prinStd = payStd - intStd;
        balStd = Math.max(0, balStd - prinStd);
        totalIntStd += intStd;
      }

      // 2. Actual Simulated Step (with extra payment)
      if (balAct > 0) {
        const intAct = balAct * monthlyRate;
        const payAct = Math.min(Math.max(installment, simulatedTotalPayment), balAct + intAct);
        const prinAct = payAct - intAct;
        balAct = Math.max(0, balAct - prinAct);
        totalIntAct += intAct;
      }
    }

    // Compare this against the Status Quo (Staying with current loan without retention)
    let balCurrentStd = loanInput.outstandingPrincipal;
    let totalIntCurrentStd = 0;

    let balCurrentAct = loanInput.outstandingPrincipal;
    let totalIntCurrentAct = 0;

    for (let m = 1; m <= termMonths; m++) {
      let curIntRatePct = loanInput.currentInterestRate;
      let curInstallment = loanInput.currentInstallment;

      if (m <= 12) {
        curIntRatePct = resolveRate(mrr, loanInput.currentYr1Rate);
        curInstallment = loanInput.currentYr1Installment;
      } else if (m <= 24) {
        curIntRatePct = resolveRate(mrr, loanInput.currentYr2Rate);
        curInstallment = loanInput.currentYr2Installment;
      } else if (m <= 36) {
        curIntRatePct = resolveRate(mrr, loanInput.currentYr3Rate);
        curInstallment = loanInput.currentYr3Installment;
      } else {
        curIntRatePct = resolveRate(mrr, loanInput.currentYr4PlusRate);
        curInstallment = loanInput.currentYr4PlusInstallment;
      }

      const activeRate = curIntRatePct;
      const currentMonthlyRate = activeRate / 100 / 12;

      if (balCurrentStd > 0) {
        const intStd = balCurrentStd * currentMonthlyRate;
        const payStd = Math.min(curInstallment, balCurrentStd + intStd);
        const prinStd = payStd - intStd;
        balCurrentStd = Math.max(0, balCurrentStd - prinStd);
        totalIntCurrentStd += intStd;
      }

      if (balCurrentAct > 0) {
        const intAct = balCurrentAct * currentMonthlyRate;
        const payAct = Math.min(Math.max(curInstallment, simulatedTotalPayment), balCurrentAct + intAct);
        const prinAct = payAct - intAct;
        balCurrentAct = Math.max(0, balCurrentAct - prinAct);
        totalIntCurrentAct += intAct;
      }
    }

    const retentionSetupFee = retentionFirePremium + oldBankPenaltiesRetention.total;

    return {
      savingsStandard: (totalIntCurrentStd - totalIntStd) - retentionSetupFee,
      savingsSimulated: (totalIntCurrentAct - totalIntAct) - retentionSetupFee,
    };
  }, [
    loanInput.remainingTermMonths,
    loanInput.outstandingPrincipal,
    loanInput.currentInterestRate,
    loanInput.currentInstallment,
    loanInput.currentYr1Rate,
    loanInput.currentYr1Installment,
    loanInput.currentYr2Rate,
    loanInput.currentYr2Installment,
    loanInput.currentYr3Rate,
    loanInput.currentYr3Installment,
    loanInput.currentYr4PlusRate,
    loanInput.currentYr4PlusInstallment,
    origSimRates,
    origSimInstallments,
    currentBankMrrVal,
    simulatedTotalPayment,
    retentionFirePremium,
    oldBankPenaltiesRetention.total
  ]);

  const comparativeCandidates = React.useMemo(() => {
    const candidates: Array<{
      id: string;
      type: "current" | "retention" | "refinance";
      nameTh: string;
      color: string;
      standardInterest: number;
      simulatedInterest: number;
      totalSetupFees: number;
      netExpenseStandard: number;
      netExpenseSimulated: number;
      savingsStandard: number;
      savingsSimulated: number;
      fixedMonths: number;
      breakevenMonths: number;
      originConfig?: CustomBankConfig;
    }> = [];

    // 1. Retention ธนาคารเดิม
    let retentionFixedMonths = 0;
    if (loanInput.currentYr1Rate?.type === "fixed") retentionFixedMonths += 12;
    if (loanInput.currentYr2Rate?.type === "fixed") retentionFixedMonths += 12;
    if (loanInput.currentYr3Rate?.type === "fixed") retentionFixedMonths += 12;

    const retentionSetupFee = retentionFirePremium + oldBankPenaltiesRetention.total;
    const rententionExpenseStd = standardInt + retentionSetupFee;
    const rententionExpenseSim = actualInt + retentionSetupFee;

    candidates.push({
      id: "retention",
      type: "retention",
      nameTh: "Retention ธนาคารเดิม",
      color: "#10b981", // Emerald
      standardInterest: standardInt,
      simulatedInterest: actualInt,
      totalSetupFees: retentionSetupFee,
      netExpenseStandard: rententionExpenseStd,
      netExpenseSimulated: rententionExpenseSim,
      savingsStandard: currentLoan3YrStats.standardInterest - rententionExpenseStd,
      savingsSimulated: currentLoan3YrStats.simulatedInterest - rententionExpenseSim,
      fixedMonths: retentionFixedMonths,
      breakevenMonths: 0,
    });

    // 2. Each Refinance Bank Option
    customBanks.forEach(bank => {
      const activePkgId = bank.activePackageId || 1;
      const refiStats = computeRefiPackageSchedule3Yr(
        loanInput.outstandingPrincipal,
        bank,
        activePkgId,
        simulatedTotalPayment
      );

      const pathwayStats = results.pathways.find(p => p.id === bank.id);
      const breakevenMonths = pathwayStats ? pathwayStats.breakevenMonths : -1;

      let bankFixedMonths = 0;
      const pkgObj = bank.packages?.find(p => p.id === activePkgId) || bank.packages?.[0];
      if (pkgObj) {
        if (pkgObj.yr1?.type === "fixed") bankFixedMonths += 12;
        if (pkgObj.yr2?.type === "fixed") bankFixedMonths += 12;
        if (pkgObj.yr3?.type === "fixed") bankFixedMonths += 12;
      } else {
        if (bank.yr1?.type === "fixed") bankFixedMonths += 12;
        if (bank.yr2?.type === "fixed") bankFixedMonths += 12;
        if (bank.yr3?.type === "fixed") bankFixedMonths += 12;
      }

      const expenseStd = refiStats.standardInterest + refiStats.totalSetupFees;
      const expenseSim = refiStats.simulatedInterest + refiStats.totalSetupFees;

      candidates.push({
        id: bank.id,
        type: "refinance",
        nameTh: bank.nameTh,
        color: bank.color,
        standardInterest: refiStats.standardInterest,
        simulatedInterest: refiStats.simulatedInterest,
        totalSetupFees: refiStats.totalSetupFees,
        netExpenseStandard: expenseStd,
        netExpenseSimulated: expenseSim,
        savingsStandard: currentLoan3YrStats.standardInterest - expenseStd,
        savingsSimulated: currentLoan3YrStats.simulatedInterest - expenseSim,
        fixedMonths: bankFixedMonths,
        breakevenMonths: breakevenMonths,
        originConfig: bank
      });
    });

    return candidates;
  }, [
    customBanks,
    standardInt,
    actualInt,
    retentionFirePremium,
    currentLoan3YrStats,
    loanInput.outstandingPrincipal,
    simulatedTotalPayment,
    computeRefiPackageSchedule3Yr,
    oldBankPenaltiesRetention,
    results.pathways
  ]);

  const championCandidate = React.useMemo(() => {
    if (comparativeCandidates.length === 0) return null;
    let best = comparativeCandidates[0];
    comparativeCandidates.forEach(cand => {
      const bestSavings = refiScheduleType === "simulated" ? best.savingsSimulated : best.savingsStandard;
      const candSavings = refiScheduleType === "simulated" ? cand.savingsSimulated : cand.savingsStandard;
      if (candSavings > bestSavings) {
        best = cand;
      }
    });

    const winningSavings = refiScheduleType === "simulated" ? best.savingsSimulated : best.savingsStandard;
    // We only declare a champion if it actually saves more than staying under the current status-quo
    return winningSavings > 0 ? best : null;
  }, [comparativeCandidates, refiScheduleType]);

  const scoredPathways = React.useMemo(() => {
    return computeSmartScores(
      comparativeCandidates,
      loanInput.outstandingPrincipal,
      optimizationStrategy,
      refiScheduleType
    );
  }, [comparativeCandidates, loanInput.outstandingPrincipal, optimizationStrategy, refiScheduleType]);

  const smartChampion = React.useMemo(() => {
    if (scoredPathways.length === 0) return null;
    return scoredPathways[0]; // Already sorted descending by compositeScore!
  }, [scoredPathways]);

  const allComparisonOptions = React.useMemo(() => {
    const list = [
      {
        id: "current",
        nameTh: "กู้เดิมแบบปล่อยลอยตัวต่อเนื่อง",
        color: "#94a3b8",
        installment: refiScheduleType === "simulated" ? Math.max(loanInput.currentYr1Installment, simulatedTotalPayment) : loanInput.currentYr1Installment,
        interest: refiScheduleType === "simulated" ? currentLoan3YrStats.simulatedInterest : currentLoan3YrStats.standardInterest,
        setupFees: 0,
        netExpense: refiScheduleType === "simulated" ? currentLoan3YrStats.simulatedInterest : currentLoan3YrStats.standardInterest,
        savings: 0,
        avgRate: ((resolveRate(currentBankMrrVal, loanInput.currentYr1Rate) + resolveRate(currentBankMrrVal, loanInput.currentYr2Rate) + resolveRate(currentBankMrrVal, loanInput.currentYr3Rate)) / 3),
        yr1Rate: resolveRate(currentBankMrrVal, loanInput.currentYr1Rate),
        yr2Rate: resolveRate(currentBankMrrVal, loanInput.currentYr2Rate),
        yr3Rate: resolveRate(currentBankMrrVal, loanInput.currentYr3Rate),
        tagTh: "ดอกเบี้ยลอยตัวแบงก์เดิม",
      },
      {
        id: "retention",
        nameTh: "Retention ต่อสัญญากับแบงก์เก่า",
        color: "#10b981",
        installment: refiScheduleType === "simulated" ? Math.max(origSimInstallments.yr1, simulatedTotalPayment) : origSimInstallments.yr1,
        interest: refiScheduleType === "simulated" ? actualInt : standardInt,
        setupFees: retentionFirePremium + oldBankPenaltiesRetention.total,
        netExpense: (refiScheduleType === "simulated" ? actualInt : standardInt) + retentionFirePremium + oldBankPenaltiesRetention.total,
        savings: refiScheduleType === "simulated" ? (currentLoan3YrStats.simulatedInterest - (actualInt + retentionFirePremium + oldBankPenaltiesRetention.total)) : (currentLoan3YrStats.standardInterest - (standardInt + retentionFirePremium + oldBankPenaltiesRetention.total)),
        avgRate: ((resolveRate(currentBankMrrVal, origSimRates.yr1) + resolveRate(currentBankMrrVal, origSimRates.yr2) + resolveRate(currentBankMrrVal, origSimRates.yr3)) / 3),
        yr1Rate: resolveRate(currentBankMrrVal, origSimRates.yr1),
        yr2Rate: resolveRate(currentBankMrrVal, origSimRates.yr2),
        yr3Rate: resolveRate(currentBankMrrVal, origSimRates.yr3),
        tagTh: "ปรับลดดอกเบี้ยแบงก์เก่า",
      }
    ];

    customBanks.forEach(bank => {
      const activePkgId = bank.activePackageId || 1;
      const refiStats = computeRefiPackageSchedule3Yr(
        loanInput.outstandingPrincipal,
        bank,
        activePkgId,
        simulatedTotalPayment
      );

      let yr1R = 0, yr2R = 0, yr3R = 0;
      const pkgObj = bank.packages?.find(p => p.id === activePkgId) || bank.packages?.[0];
      if (pkgObj) {
        yr1R = resolveRate(bank.mrr, pkgObj.yr1);
        yr2R = resolveRate(bank.mrr, pkgObj.yr2);
        yr3R = resolveRate(bank.mrr, pkgObj.yr3);
      } else {
        yr1R = resolveRate(bank.mrr, bank.yr1);
        yr2R = resolveRate(bank.mrr, bank.yr2);
        yr3R = resolveRate(bank.mrr, bank.yr3);
      }

      const interestVal = refiScheduleType === "simulated" ? refiStats.simulatedInterest : refiStats.standardInterest;
      const netExpenseVal = interestVal + refiStats.totalSetupFees;
      const savingsVal = refiScheduleType === "simulated" 
        ? (currentLoan3YrStats.simulatedInterest - netExpenseVal)
        : (currentLoan3YrStats.standardInterest - netExpenseVal);

      list.push({
        id: bank.id,
        nameTh: `Refinance ${bank.nameTh}`,
        color: bank.color,
        installment: refiScheduleType === "simulated" 
          ? Math.max(bank.isInstallmentAdjusted ? bank.customInstallment : loanInput.currentInstallment, simulatedTotalPayment)
          : (bank.isInstallmentAdjusted ? bank.customInstallment : loanInput.currentInstallment),
        interest: interestVal,
        setupFees: refiStats.totalSetupFees,
        netExpense: netExpenseVal,
        savings: savingsVal,
        avgRate: (yr1R + yr2R + yr3R) / 3,
        yr1Rate: yr1R,
        yr2Rate: yr2R,
        yr3Rate: yr3R,
        tagTh: pkgObj ? `แพ็กเกจขอยื่นแบบ ${pkgObj.name || activePkgId}` : "ย้ายสู่สถาบันหลักทุนใหม่",
      });
    });

    return list;
  }, [
    refiScheduleType,
    loanInput,
    simulatedTotalPayment,
    currentLoan3YrStats,
    currentBankMrrVal,
    origSimInstallments,
    actualInt,
    standardInt,
    retentionFirePremium,
    oldBankPenaltiesRetention,
    origSimRates,
    customBanks,
    computeRefiPackageSchedule3Yr
  ]);

  // Synchronize and seed default customization parameters on bank rates load
  const handleRatesLoaded = (banks: BankRate[]) => {
    setBanksList(banks);
    // Initialize standard custom configurations for selected IDs
    const seeded = banks
      .filter(b => selectedBankIds.includes(b.id))
      .map(b => getInitialCustomBank(b, loanInput.currentInstallment));
    setCustomBanks(seeded);
  };

  const getInitialCustomBank = (bank: BankRate, currentFormInstallment: number): CustomBankConfig => {
    const pkgs = getRefiPackagesForBank(bank.id, bank.mrr, bank.typicalRefinance3Yr);
    const formattedPackages = pkgs.map(pkg => ({
      id: pkg.id,
      label: pkg.label,
      yr1: { type: "fixed" as const, value: pkg.rates[0] },
      yr2: { type: "fixed" as const, value: pkg.rates[1] },
      yr3: { type: "fixed" as const, value: pkg.rates[2] },
      yr4Plus: { type: "mrr" as const, value: pkg.yr4PlusVal },
      freeMortgage: pkg.freeMortgage,
      hasMrta: pkg.id === 1 || pkg.id === 2,
    }));
    const defaultPkg = formattedPackages[0]; // Option 1 is default
    
    return {
      id: bank.id,
      nameTh: bank.nameTh,
      nameEn: bank.nameEn,
      color: bank.color,
      mrr: bank.mrr,
      yr1: { ...defaultPkg.yr1 },
      yr2: { ...defaultPkg.yr2 },
      yr3: { ...defaultPkg.yr3 },
      yr4Plus: { ...defaultPkg.yr4Plus },
      
      freeMortgageFee: defaultPkg.freeMortgage,
      freeAppraisalFee: false,
      freeDutyStamp: false,
      customAppraisalFee: 3000,
      customMortgageFeeRate: 1.0,
      customDutyStampRate: 0.05,
      otherFees: 0,
      
      hasMrta: defaultPkg.hasMrta,
      
      fireInsurancePremium: 0,
      fireInsuranceDuration: 3,
      fireSumInsured: 2500000,
      
      isInstallmentAdjusted: false,
      customInstallment: currentFormInstallment,
      
      packages: formattedPackages,
      activePackageId: 1
    };
  };

  // Toggle bank selection (Up to 5 banks selected simultaneously)
  const handleToggleBank = (bank: BankRate) => {
    const exists = selectedBankIds.includes(bank.id);
    if (exists) {
      // Remove it
      setSelectedBankIds(prev => prev.filter(id => id !== bank.id));
      setCustomBanks(prev => prev.filter(b => b.id !== bank.id));
      if (activeEditorTab === bank.id) {
        const remaining = selectedBankIds.filter(id => id !== bank.id);
        setActiveEditorTab(remaining.length > 0 ? remaining[0] : "");
      }
    } else {
      // Add it if within limits
      if (selectedBankIds.length >= 5) {
        // Prevent adding more than 5 compared banks
        return;
      }
      setSelectedBankIds(prev => [...prev, bank.id]);
      const newCustom = getInitialCustomBank(bank, loanInput.currentInstallment);
      setCustomBanks(prev => [...prev, newCustom]);
      setActiveEditorTab(bank.id);
    }
  };

  // Set selected bank as the current loan bank
  const handleSetCurrentBank = (bank: BankRate) => {
    setCurrentBankId(bank.id);
    setLoanInput(prev => ({ 
      ...prev, 
      currentInterestRate: Number(bank.mrr.toFixed(3)) 
    }));
  };

  // Generic customized state update dispatchers
  const handleRatePeriodChange = (
    id: string, // bank ID
    periodKey: "yr1" | "yr2" | "yr3" | "yr4Plus",
    field: "type" | "value" | "mrrBaseline",
    val: any
  ) => {
    const update = (prev: CustomBankConfig): CustomBankConfig => {
      let finalValue = val;
      if (field === "value" && prev[periodKey].type === "mrr" && val > 0) {
        finalValue = -val;
      }
      const updatedPeriod = {
        ...prev[periodKey],
        [field]: finalValue
      };

      const updatedPackages = prev.packages?.map(p => {
        if (p.id === prev.activePackageId) {
          return {
            ...p,
            [periodKey]: updatedPeriod
          };
        }
        return p;
      }) || prev.packages;

      return {
        ...prev,
        [periodKey]: updatedPeriod,
        packages: updatedPackages
      };
    };

    setCustomBanks(prev => prev.map(bank => bank.id === id ? update(bank) : bank));
  };

  const handleFeeChange = (id: string, key: string, value: any) => {
    const update = (prev: CustomBankConfig): CustomBankConfig => ({
      ...prev,
      [key]: value
    });

    setCustomBanks(prev => prev.map(bank => bank.id === id ? update(bank) : bank));
  };

  const addCustomFeeItem = (bankId: string) => {
    setCustomBanks(prev => prev.map(bank => {
      if (bank.id === bankId) {
        const fees = bank.customOtherFees || [];
        const nextId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const nextName = `ค่าธรรมเนียมอื่นๆ ${fees.length + 1}`;
        return {
          ...bank,
          customOtherFees: [
            ...fees,
            { id: nextId, name: nextName, amount: 0 }
          ]
        };
      }
      return bank;
    }));
  };

  const updateCustomFeeItem = (bankId: string, itemId: string, field: "name" | "amount", val: any) => {
    setCustomBanks(prev => prev.map(bank => {
      if (bank.id === bankId) {
        const fees = bank.customOtherFees || [];
        return {
          ...bank,
          customOtherFees: fees.map(item => {
            if (item.id === itemId) {
              return {
                ...item,
                [field]: field === "amount" ? Number(val) : val
              };
            }
            return item;
          })
        };
      }
      return bank;
    }));
  };

  const removeCustomFeeItem = (bankId: string, itemId: string) => {
    setCustomBanks(prev => prev.map(bank => {
      if (bank.id === bankId) {
        const fees = bank.customOtherFees || [];
        return {
          ...bank,
          customOtherFees: fees.filter(item => item.id !== itemId)
        };
      }
      return bank;
    }));
  };

  const handleMrrChange = (id: string, value: number) => {
    const update = (prev: CustomBankConfig): CustomBankConfig => ({
      ...prev,
      mrr: value
    });

    setCustomBanks(prev => prev.map(bank => bank.id === id ? update(bank) : bank));
  };

  const handleInstallmentSettingsChange = (id: string, isAdjusted: boolean, customVal?: number) => {
    const currentConf = customBanks.find(b => b.id === id);
    if (!currentConf) return;

    // average resolved rate for refinance bank
    const r1 = resolveRate(currentConf.mrr, currentConf.yr1);
    const r2 = resolveRate(currentConf.mrr, currentConf.yr2);
    const r3 = resolveRate(currentConf.mrr, currentConf.yr3);
    const activeAvgRate = Number(((r1 + r2 + r3) / 3).toFixed(2));

    const suggested = isAdjusted
      ? calculateSuggestedInstallment(loanInput.outstandingPrincipal, activeAvgRate, loanInput.remainingTermMonths / 12)
      : loanInput.currentInstallment;

    const update = (prev: CustomBankConfig): CustomBankConfig => ({
      ...prev,
      isInstallmentAdjusted: isAdjusted,
      customInstallment: customVal !== undefined ? customVal : suggested
    });

    setCustomBanks(prev => prev.map(bank => bank.id === id ? update(bank) : bank));
  };

  // Adjust suggested installments on changes to global input metrics
  const updateSuggestedInstallments = (newPrincipal: number, newTermMonths: number, newInstallment: number) => {
    // Custom banks updates
    setCustomBanks(prev => prev.map(bank => {
      const r1 = resolveRate(bank.mrr, bank.yr1);
      const r2 = resolveRate(bank.mrr, bank.yr2);
      const r3 = resolveRate(bank.mrr, bank.yr3);
      const avgRefiRate = Number(((r1 + r2 + r3) / 3).toFixed(2));
      const suggestedRef = calculateSuggestedInstallment(newPrincipal, avgRefiRate, newTermMonths / 12);
      return {
        ...bank,
        customInstallment: bank.isInstallmentAdjusted ? suggestedRef : newInstallment
      };
    }));
  };

  const handlePrincipalChange = (val: number) => {
    setLoanInput(prev => {
      const updated = { ...prev, outstandingPrincipal: val };
      updateSuggestedInstallments(val, prev.remainingTermMonths, prev.currentInstallment);
      return updated;
    });
  };

  const handleStartingAmountChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, startingLoanAmount: val }));
  };

  const handleTermMonthsChange = (val: number) => {
    setLoanInput(prev => {
      const updated = { ...prev, remainingTermMonths: val };
      updateSuggestedInstallments(prev.outstandingPrincipal, val, prev.currentInstallment);
      return updated;
    });
  };

  const handleBorrowerTypeChange = (val: "single" | "joint") => {
    setLoanInput(prev => ({ ...prev, borrowerType: val }));
  };

  const handleBorrowerAgeChange = (val: number) => {
    setLoanInput(prev => {
      const elapsed = getElapsedYears(prev.contractStartDate);
      return {
        ...prev,
        borrowerAge: val,
        borrowerAgeAtContract: Math.max(18, val - elapsed)
      };
    });
  };

  const handleBorrower2AgeChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, borrower2Age: val }));
  };

  const handleBorrower2GenderChange = (val: "male" | "female") => {
    setLoanInput(prev => ({ ...prev, borrower2Gender: val }));
  };

  const handlePrepaymentFeeRateChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, prepaymentFeeRate: val }));
  };

  const handlePrepaymentLockMonthsChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, prepaymentLockMonths: val }));
  };

  const handleReceivesSubsidyChange = (val: boolean) => {
    setLoanInput(prev => ({ ...prev, receivesSubsidy: val }));
  };

  const handleSubsidyAmountChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, subsidyAmount: val }));
  };

  const handleSubsidyLockMonthsChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, subsidyLockMonths: val }));
  };

  const handleElapsedMonthsChange = (val: number) => {
    setLoanInput(prev => {
      const newRetentionDate = addMonthsToDateString(prev.contractStartDate, val);
      return {
        ...prev,
        elapsedMonths: val,
        retentionStartDate: newRetentionDate
      };
    });
  };

  const handleHasInsurancePenaltyChange = (val: boolean) => {
    setLoanInput(prev => ({ ...prev, hasInsurancePenalty: val }));
  };

  const handleInsurancePenaltyRateChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, insurancePenaltyRate: val }));
  };

  const handleInsurancePenaltyMonthsChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, insurancePenaltyMonths: val }));
  };

  const handleContractStartDateChange = (val: string) => {
    setLoanInput(prev => {
      const elapsed = getElapsedYears(val);
      const parts = val.split("-");
      let defaultRetentionDate = prev.retentionStartDate;
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        defaultRetentionDate = `${y + 3}-${parts[1]}-${parts[2]}`;
      }
      const monthsDiff = getMonthsDiff(val, defaultRetentionDate);
      return {
        ...prev,
        contractStartDate: val,
        retentionStartDate: defaultRetentionDate,
        elapsedMonths: monthsDiff,
        borrowerAgeAtContract: Math.max(18, prev.borrowerAge - elapsed)
      };
    });
  };

  const handleRetentionStartDateChange = (val: string) => {
    setLoanInput(prev => {
      const monthsDiff = getMonthsDiff(prev.contractStartDate, val);
      return {
        ...prev,
        retentionStartDate: val,
        elapsedMonths: monthsDiff
      };
    });
  };

  const handleStartingTermMonthsChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, startingTermMonths: val }));
  };

  const handleAppraisalFeeChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, appraisalFee: val }));
  };

  const handleMortgageFeeRateChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, mortgageFeeRate: val }));
  };

  const handleDutyStampRateChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, dutyStampRate: val }));
  };

  const handleFireInsurancePremiumChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, fireInsurancePremium: val }));
  };

  const handleFireInsuranceDurationChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, fireInsuranceDuration: val }));
  };

  const handleFireSumInsuredBuildingChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, fireSumInsuredBuilding: val }));
  };

  const handleFireSumInsuredContentChange = (val: number) => {
    setLoanInput(prev => ({ ...prev, fireSumInsuredContent: val }));
  };

  const handleMrta1FieldChange = (
    field: "mrta1Premium" | "mrta1SumInsured" | "mrta1Type" | "mrta1PaymentPattern" | "mrta1SurrenderRate3Yr",
    val: any
  ) => {
    setLoanInput(prev => ({ ...prev, [field]: val }));
  };

  const handleMrta2FieldChange = (
    field: "mrta2Premium" | "mrta2SumInsured" | "mrta2Type" | "mrta2PaymentPattern" | "mrta2SurrenderRate3Yr",
    val: any
  ) => {
    setLoanInput(prev => ({ ...prev, [field]: val }));
  };

  const handleCurrentRatePeriodChange = (
    periodKey: "currentYr1Rate" | "currentYr2Rate" | "currentYr3Rate" | "currentYr4PlusRate",
    field: "type" | "value" | "mrrBaseline",
    val: any
  ) => {
    setLoanInput(prev => {
      const currentRate = prev[periodKey];
      let finalValue = val;
      
      // If setting the numerical value for MRR type, force it to be negative
      if (field === "value" && currentRate.type === "mrr") {
        finalValue = -Math.abs(val);
      }
      
      let updates: any = { [field]: finalValue };
      
      // If switching type to MRR, set the default baseline and force the current value to be negative
      if (field === "type" && val === "mrr") {
        if (!currentRate.mrrBaseline) {
          updates.mrrBaseline = currentBankMrrVal;
        }
        if (currentRate.value > 0) {
          updates.value = -currentRate.value;
        }
      } else if (field === "type" && val === "fixed") {
        // Switching type back to fixed, restore it as positive
        if (currentRate.value < 0) {
          updates.value = Math.abs(currentRate.value);
        }
      }
      
      return {
        ...prev,
        [periodKey]: {
          ...prev[periodKey],
          ...updates
        }
      };
    });
  };

  const handleCurrentInstallmentPeriodChange = (
    installmentKey: "currentYr1Installment" | "currentYr2Installment" | "currentYr3Installment" | "currentYr4PlusInstallment",
    val: number
  ) => {
    setLoanInput(prev => ({
      ...prev,
      [installmentKey]: val
    }));
  };

  // Sequential Past Payment Ledger calculation loop
  const recalculateLedger = (
    payments: HistoricalPayment[],
    startingAmount: number,
    contractStartDate: string,
    mrr: number,
    r1: RatePeriod,
    r2: RatePeriod,
    r3: RatePeriod,
    r4: RatePeriod,
    botMrrs: Record<string, { periodFromApi: string, mrr: string }[] | null>
  ): HistoricalPayment[] => {
    let runningBalance = startingAmount;
    let lastDateStr = contractStartDate;
    
    // Sort payments by date to ensure proper timeline calculation
    const sortedPayments = [...payments].sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
    
    // Parse contract start date parts to calculate year anniversaries reliably
    const parseDateParts = (dateStr: string) => {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-based
        const day = parseInt(parts[2], 10);
        return { year, month, day };
      }
      const d = new Date(dateStr);
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
    };

    const sParts = parseDateParts(contractStartDate);

    // High-fidelity fallback database entries for bank MRRs to guarantee calculation accuracy even if BOT network API fails
    const fallbackMrrHistory: Record<string, { date: string, mrr: number }[]> = {
      lhbank: [
        { date: "1900-01-01", mrr: 8.53 }, // Catch-all baseline
        { date: "2023-01-01", mrr: 8.12 },
        { date: "2023-04-01", mrr: 8.30 },
        { date: "2023-06-01", mrr: 8.55 },
        { date: "2023-10-25", mrr: 8.80 },
        { date: "2024-05-22", mrr: 8.55 },
        { date: "2025-01-01", mrr: 8.53 }, // Holds 8.53% until Aug 19, 2025
        { date: "2025-08-20", mrr: 8.28 }, // Reduced to 8.28% on 20 Aug 2025
        { date: "2025-10-24", mrr: 8.18 }, // Current baseline
      ]
    };

    const calculated = sortedPayments.map((pay, i) => {
      // Month index estimation for rate lookup.
      const seqIdx = i + 1; // Used for sequential display only
      
      let interestCalculated = 0;
      let diffDays = 0;
      
      if (lastDateStr && pay.payDate) {
        const d1 = new Date(lastDateStr);
        const d2 = new Date(pay.payDate);
        const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        
        if (!isNaN(utc1) && !isNaN(utc2)) {
          diffDays = Math.max(0, Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)));
          
          // Determine if there is any MRR rate period active under original style dayMs
          let periodHasMrr = false;
          const ann1 = Date.UTC(sParts.year + 1, sParts.month, sParts.day);
          const ann2 = Date.UTC(sParts.year + 2, sParts.month, sParts.day);
          const ann3 = Date.UTC(sParts.year + 3, sParts.month, sParts.day);
          
          for (let k = 1; k <= diffDays; k++) {
            const dayMsOriginal = utc1 + (k - 1) * (1000 * 60 * 60 * 24);
            let ratePeriodOriginal = r4;
            if (dayMsOriginal < ann1) ratePeriodOriginal = r1;
            else if (dayMsOriginal < ann2) ratePeriodOriginal = r2;
            else if (dayMsOriginal < ann3) ratePeriodOriginal = r3;
            if (ratePeriodOriginal.type === "mrr") {
              periodHasMrr = true;
              break;
            }
          }

          let totalInterest = 0;
          for (let k = 1; k <= diffDays; k++) {
            // If the period has any MRR or transition, we use k (day following lastDateStr)
            // Otherwise, for pure fixed rate periods, we use k-1 (original way)
            const dayMs = periodHasMrr 
              ? utc1 + k * (1000 * 60 * 60 * 24)
              : utc1 + (k - 1) * (1000 * 60 * 60 * 24);
            
            let ratePeriod = r4;
            if (dayMs < ann1) ratePeriod = r1;
            else if (dayMs < ann2) ratePeriod = r2;
            else if (dayMs < ann3) ratePeriod = r3;
            
            let applicableMrr = mrr;
            let foundInApi = false;
            
            if (ratePeriod.type === "mrr" && botMrrs[pay.id]) {
                const hist = botMrrs[pay.id];
                if (hist && hist.length > 0) {
                    // Sort descending by periodFromApi to evaluate newest to oldest reliably
                    const sortedHist = [...hist].sort((a, b) => b.periodFromApi.localeCompare(a.periodFromApi));
                    let activeHistMrr: number | null = null;
                    for (const record of sortedHist) {
                        if (!record.periodFromApi || !record.mrr || record.mrr === "-") continue;
                        const rParts = record.periodFromApi.split("-");
                        if (rParts.length !== 3) continue;
                        let rYear = parseInt(rParts[0], 10);
                        if (rYear > 2400) rYear -= 543; // Correctly normalize Buddhist year (2500+) to AD (2000+)
                        const rDate = Date.UTC(rYear, parseInt(rParts[1], 10) - 1, parseInt(rParts[2], 10));
                        if (dayMs >= rDate) {
                            activeHistMrr = parseFloat(record.mrr);
                            break;
                        }
                    }
                    if (activeHistMrr !== null && !isNaN(activeHistMrr)) {
                        applicableMrr = activeHistMrr;
                        foundInApi = true;
                    } else {
                        // If dayMs is before all records (e.g. weekend start), just use the oldest record (last in array after sorted ascending, i.e. first in sortedHist)
                        const oldest = sortedHist[sortedHist.length - 1];
                        if (oldest && oldest.mrr && oldest.mrr !== "-") {
                            applicableMrr = parseFloat(oldest.mrr);
                            foundInApi = true;
                        }
                    }
                }
            }
            
            // Backup with high-fidelity local fallback database if not resolved from BOT API
            if (!foundInApi && ratePeriod.type === "mrr") {
                const bankId = currentBankId || "lhbank";
                const bankHistory = fallbackMrrHistory[bankId];
                if (bankHistory && bankHistory.length > 0) {
                    let activeFallbackMrr: number | null = null;
                    const sortedFallback = [...bankHistory].sort((a, b) => b.date.localeCompare(a.date));
                    for (const record of sortedFallback) {
                        const parts = record.date.split("-");
                        const rDate = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                        if (dayMs >= rDate) {
                            activeFallbackMrr = record.mrr;
                            break;
                        }
                    }
                    if (activeFallbackMrr !== null) {
                        applicableMrr = activeFallbackMrr;
                    }
                }
            }
            
            const activeRate = resolveRate(applicableMrr, ratePeriod);
            totalInterest += (runningBalance * (activeRate / 100)) / 365;
          }
          interestCalculated = Number(totalInterest.toFixed(2));
        }
      }
      
      const principalDeducted = Number((pay.paymentAmount - interestCalculated).toFixed(2));
      const endingBalance = Number(Math.max(0, runningBalance - principalDeducted).toFixed(2));
      
      runningBalance = endingBalance;
      lastDateStr = pay.payDate;
      
      return {
        ...pay,
        monthIndex: seqIdx,
        interestCalculated,
        principalDeducted,
        endingBalance
      };
    });
    
    // Put them back in original order to prevent cursor jumping or losing focus while typing
    return payments.map(orig => calculated.find(c => c.id === orig.id) || orig);
  };

  // Dynamically calculate standard bank-mandated and simulated prepayment timelines for validation and charts
  const getComparisonSimulations = () => {
    const historical = [...loanInput.historicalPayments].sort((a,b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
    if (historical.length === 0) return null;

    const sParts = loanInput.contractStartDate.split("-");
    const sYear = parseInt(sParts[0], 10) || 2023;
    const sMonth = (parseInt(sParts[1], 10) - 1) || 0;
    const sDay = parseInt(sParts[2], 10) || 16;

    const fallbackMrrHistory: Record<string, { date: string, mrr: number }[]> = {
      lhbank: [
        { date: "1900-01-01", mrr: 8.53 }, // Catch-all baseline
        { date: "2023-01-01", mrr: 8.12 },
        { date: "2023-04-01", mrr: 8.30 },
        { date: "2023-06-01", mrr: 8.55 },
        { date: "2023-10-25", mrr: 8.80 },
        { date: "2024-05-22", mrr: 8.55 },
        { date: "2025-01-01", mrr: 8.53 },
        { date: "2025-08-20", mrr: 8.28 },
        { date: "2025-10-24", mrr: 8.18 },
      ]
    };

    // 1. Simulate Standard Mandated Only
    let standardBalance = loanInput.startingLoanAmount;
    let standardLastDate = loanInput.contractStartDate;
    let standardTotalInterest = 0;
    let standardTotalPaid = 0;

    const standardTimeline = historical.map((pay) => {
      const d2 = new Date(pay.payDate);
      const payUtc = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
      
      const ann1 = Date.UTC(sYear + 1, sMonth, sDay);
      const ann2 = Date.UTC(sYear + 2, sMonth, sDay);
      const ann3 = Date.UTC(sYear + 3, sMonth, sDay);
      
      let standardAmount = loanInput.currentYr4PlusInstallment;
      if (payUtc < ann1) standardAmount = loanInput.currentYr1Installment;
      else if (payUtc < ann2) standardAmount = loanInput.currentYr2Installment;
      else if (payUtc < ann3) standardAmount = loanInput.currentYr3Installment;

      let interestCalculated = 0;
      let diffDays = 0;
      
      if (standardLastDate && pay.payDate) {
        const d1 = new Date(standardLastDate);
        const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        
        if (!isNaN(utc1) && !isNaN(utc2)) {
          diffDays = Math.max(0, Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)));
          
          let periodHasMrr = false;
          for (let k = 1; k <= diffDays; k++) {
            const dayMsOriginal = utc1 + (k - 1) * (1000 * 60 * 60 * 24);
            let ratePeriodOriginal = loanInput.currentYr4PlusRate;
            if (dayMsOriginal < ann1) ratePeriodOriginal = loanInput.currentYr1Rate;
            else if (dayMsOriginal < ann2) ratePeriodOriginal = loanInput.currentYr2Rate;
            else if (dayMsOriginal < ann3) ratePeriodOriginal = loanInput.currentYr3Rate;
            if (ratePeriodOriginal.type === "mrr") {
              periodHasMrr = true;
              break;
            }
          }
          
          let localInterest = 0;
          for (let k = 1; k <= diffDays; k++) {
            const dayMs = periodHasMrr 
              ? utc1 + k * (1000 * 60 * 60 * 24)
              : utc1 + (k - 1) * (1000 * 60 * 60 * 24);
            
            let ratePeriod = loanInput.currentYr4PlusRate;
            if (dayMs < ann1) ratePeriod = loanInput.currentYr1Rate;
            else if (dayMs < ann2) ratePeriod = loanInput.currentYr2Rate;
            else if (dayMs < ann3) ratePeriod = loanInput.currentYr3Rate;
            
            let applicableMrr = loanInput.currentInterestRate;
            let foundInApi = false;
            
            const hist = botHistoricalMrrs[pay.id];
            if (ratePeriod.type === "mrr" && hist && hist.length > 0) {
              const sortedHist = [...hist].sort((a, b) => b.periodFromApi.localeCompare(a.periodFromApi));
              let activeHistMrr: number | null = null;
              for (const record of sortedHist) {
                if (!record.periodFromApi || !record.mrr || record.mrr === "-") continue;
                const rParts = record.periodFromApi.split("-");
                if (rParts.length !== 3) continue;
                let rYear = parseInt(rParts[0], 10);
                if (rYear > 2400) rYear -= 543;
                const rDate = Date.UTC(rYear, parseInt(rParts[1], 10) - 1, parseInt(rParts[2], 10));
                if (dayMs >= rDate) {
                  activeHistMrr = parseFloat(record.mrr);
                  break;
                }
              }
              if (activeHistMrr !== null && !isNaN(activeHistMrr)) {
                applicableMrr = activeHistMrr;
                foundInApi = true;
              } else {
                const oldest = sortedHist[sortedHist.length - 1];
                if (oldest && oldest.mrr && oldest.mrr !== "-") {
                  applicableMrr = parseFloat(oldest.mrr);
                  foundInApi = true;
                }
              }
            }
            
            if (!foundInApi && ratePeriod.type === "mrr") {
              const bankId = currentBankId || "lhbank";
              const bankHistory = fallbackMrrHistory[bankId];
              if (bankHistory && bankHistory.length > 0) {
                let activeFallbackMrr: number | null = null;
                const sortedFallback = [...bankHistory].sort((a, b) => b.date.localeCompare(a.date));
                for (const record of sortedFallback) {
                  const parts = record.date.split("-");
                  const rDate = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  if (dayMs >= rDate) {
                    activeFallbackMrr = record.mrr;
                    break;
                  }
                }
                if (activeFallbackMrr !== null) {
                  applicableMrr = activeFallbackMrr;
                }
              }
            }
            
            const activeRate = resolveRate(applicableMrr, ratePeriod);
            localInterest += (standardBalance * (activeRate / 100)) / 365;
          }
          interestCalculated = Number(localInterest.toFixed(2));
        }
      }

      const principalDeducted = Number((standardAmount - interestCalculated).toFixed(2));
      standardBalance = Number(Math.max(0, standardBalance - principalDeducted).toFixed(2));
      standardLastDate = pay.payDate;
      standardTotalInterest += interestCalculated;
      standardTotalPaid += standardAmount;

      return {
        payDate: pay.payDate,
        amount: standardAmount,
        interest: interestCalculated,
        principal: principalDeducted,
        balance: standardBalance,
        monthIndex: pay.monthIndex
      };
    });

    // 2. Simulate Standard + Custom Prepayment
    let simulatedBalance = loanInput.startingLoanAmount;
    let simulatedLastDate = loanInput.contractStartDate;
    let simulatedTotalInterest = 0;
    let simulatedTotalPaid = 0;

    const simulatedTimeline = historical.map((pay) => {
      const d2 = new Date(pay.payDate);
      const payUtc = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
      
      const ann1 = Date.UTC(sYear + 1, sMonth, sDay);
      const ann2 = Date.UTC(sYear + 2, sMonth, sDay);
      const ann3 = Date.UTC(sYear + 3, sMonth, sDay);
      
      let standardAmount = loanInput.currentYr4PlusInstallment;
      if (payUtc < ann1) standardAmount = loanInput.currentYr1Installment;
      else if (payUtc < ann2) standardAmount = loanInput.currentYr2Installment;
      else if (payUtc < ann3) standardAmount = loanInput.currentYr3Installment;

      const simAmount = Math.max(standardAmount, simulatedTotalPayment);

      let interestCalculated = 0;
      let diffDays = 0;
      
      if (simulatedLastDate && pay.payDate) {
        const d1 = new Date(simulatedLastDate);
        const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        
        if (!isNaN(utc1) && !isNaN(utc2)) {
          diffDays = Math.max(0, Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)));
          
          let periodHasMrr = false;
          for (let k = 1; k <= diffDays; k++) {
            const dayMsOriginal = utc1 + (k - 1) * (1000 * 60 * 60 * 24);
            let ratePeriodOriginal = loanInput.currentYr4PlusRate;
            if (dayMsOriginal < ann1) ratePeriodOriginal = loanInput.currentYr1Rate;
            else if (dayMsOriginal < ann2) ratePeriodOriginal = loanInput.currentYr2Rate;
            else if (dayMsOriginal < ann3) ratePeriodOriginal = loanInput.currentYr3Rate;
            if (ratePeriodOriginal.type === "mrr") {
              periodHasMrr = true;
              break;
            }
          }
          
          let localInterest = 0;
          for (let k = 1; k <= diffDays; k++) {
            const dayMs = periodHasMrr 
              ? utc1 + k * (1000 * 60 * 60 * 24)
              : utc1 + (k - 1) * (1000 * 60 * 60 * 24);
            
            let ratePeriod = loanInput.currentYr4PlusRate;
            if (dayMs < ann1) ratePeriod = loanInput.currentYr1Rate;
            else if (dayMs < ann2) ratePeriod = loanInput.currentYr2Rate;
            else if (dayMs < ann3) ratePeriod = loanInput.currentYr3Rate;
            
            let applicableMrr = loanInput.currentInterestRate;
            let foundInApi = false;
            
            const hist = botHistoricalMrrs[pay.id];
            if (ratePeriod.type === "mrr" && hist && hist.length > 0) {
              const sortedHist = [...hist].sort((a, b) => b.periodFromApi.localeCompare(a.periodFromApi));
              let activeHistMrr: number | null = null;
              for (const record of sortedHist) {
                if (!record.periodFromApi || !record.mrr || record.mrr === "-") continue;
                const rParts = record.periodFromApi.split("-");
                if (rParts.length !== 3) continue;
                let rYear = parseInt(rParts[0], 10);
                if (rYear > 2400) rYear -= 543;
                const rDate = Date.UTC(rYear, parseInt(rParts[1], 10) - 1, parseInt(rParts[2], 10));
                if (dayMs >= rDate) {
                  activeHistMrr = parseFloat(record.mrr);
                  break;
                }
              }
              if (activeHistMrr !== null && !isNaN(activeHistMrr)) {
                applicableMrr = activeHistMrr;
                foundInApi = true;
              } else {
                const oldest = sortedHist[sortedHist.length - 1];
                if (oldest && oldest.mrr && oldest.mrr !== "-") {
                  applicableMrr = parseFloat(oldest.mrr);
                  foundInApi = true;
                }
              }
            }
            
            if (!foundInApi && ratePeriod.type === "mrr") {
              const bankId = currentBankId || "lhbank";
              const bankHistory = fallbackMrrHistory[bankId];
              if (bankHistory && bankHistory.length > 0) {
                let activeFallbackMrr: number | null = null;
                const sortedFallback = [...bankHistory].sort((a, b) => b.date.localeCompare(a.date));
                for (const record of sortedFallback) {
                  const parts = record.date.split("-");
                  const rDate = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  if (dayMs >= rDate) {
                    activeFallbackMrr = record.mrr;
                    break;
                  }
                }
                if (activeFallbackMrr !== null) {
                  applicableMrr = activeFallbackMrr;
                }
              }
            }
            
            const activeRate = resolveRate(applicableMrr, ratePeriod);
            localInterest += (simulatedBalance * (activeRate / 100)) / 365;
          }
          interestCalculated = Number(localInterest.toFixed(2));
        }
      }

      const principalDeducted = Number((simAmount - interestCalculated).toFixed(2));
      simulatedBalance = Number(Math.max(0, simulatedBalance - principalDeducted).toFixed(2));
      simulatedLastDate = pay.payDate;
      simulatedTotalInterest += interestCalculated;
      simulatedTotalPaid += simAmount;

      return {
        payDate: pay.payDate,
        amount: simAmount,
        interest: interestCalculated,
        principal: principalDeducted,
        balance: simulatedBalance,
        monthIndex: pay.monthIndex
      };
    });

    // Actual Stats Accumulators (from recalculated ledger)
    const actualTotalPaid = historical.reduce((sum, p) => sum + p.paymentAmount, 0);
    const actualTotalInterest = historical.reduce((sum, p) => sum + p.interestCalculated, 0);
    const actualEndingBalance = historical[historical.length - 1].endingBalance;

    return {
      standardTimeline,
      simulatedTimeline,
      actualTimeline: historical.map(p => ({
        payDate: p.payDate,
        amount: p.paymentAmount,
        interest: p.interestCalculated,
        principal: p.principalDeducted,
        balance: p.endingBalance,
        monthIndex: p.monthIndex
      })),
      stats: {
        standard: {
          totalPaid: standardTotalPaid,
          totalInterest: standardTotalInterest,
          endingBalance: standardBalance
        },
        actual: {
          totalPaid: actualTotalPaid,
          totalInterest: actualTotalInterest,
          endingBalance: actualEndingBalance
        },
        simulated: {
          totalPaid: simulatedTotalPaid,
          totalInterest: simulatedTotalInterest,
          endingBalance: simulatedBalance
        }
      }
    };
  };

  // Fetch historical BOT MRRs dynamically for payments acting under MRR
  useEffect(() => {
    const sParts = loanInput.contractStartDate.split("-");
    if (sParts.length !== 3) return;
    const year = parseInt(sParts[0], 10);
    const month = parseInt(sParts[1], 10) - 1;
    const day = parseInt(sParts[2], 10);
    const ann1 = Date.UTC(year + 1, month, day);
    const ann2 = Date.UTC(year + 2, month, day);
    const ann3 = Date.UTC(year + 3, month, day);
    
    let lastDateStr = loanInput.contractStartDate;
    const missingKeys: {id: string, start: string, end: string, acronym: string}[] = [];
    
    const sorted = [...loanInput.historicalPayments].sort((a,b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
    sorted.forEach(pay => {
      const d2 = new Date(pay.payDate);
      const payUtc = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
      
      let ratePeriod = loanInput.currentYr4PlusRate;
      if (payUtc < ann1) ratePeriod = loanInput.currentYr1Rate;
      else if (payUtc < ann2) ratePeriod = loanInput.currentYr2Rate;
      else if (payUtc < ann3) ratePeriod = loanInput.currentYr3Rate;
      
      if (ratePeriod.type === "mrr" && botHistoricalMrrs[pay.id] === undefined) {
         missingKeys.push({
           id: pay.id, 
           start: lastDateStr, 
           end: pay.payDate,
           acronym: currentBankId 
         });
      }
      lastDateStr = pay.payDate;
    });

    if (missingKeys.length > 0) {
      Promise.all(missingKeys.map(async req => {
         try {
           const res = await fetch(`/api/bot-mrr?acronym=${req.acronym}&startDate=${req.start}&endDate=${req.end}`);
           if (res.ok) {
             const data = await res.json();
             return { id: req.id, historical: data.historical || [{ periodFromApi: data.periodFromApi, mrr: data.mrr.toString() }] };
           }
         } catch (e) {}
         return { id: req.id, historical: null };
      })).then(results => {
         const newMrrs = { ...botHistoricalMrrs };
         let changed = false;
         for (const res of results) {
           if (res && res.historical !== undefined && botHistoricalMrrs[res.id] === undefined) {
             newMrrs[res.id] = res.historical || []; // use empty array instead of null to prevent infinite loop but flag as fetched
             changed = true;
           }
         }
         if (changed) {
           setBotHistoricalMrrs(newMrrs);
         }
      });
    }
  }, [loanInput.historicalPayments, loanInput.contractStartDate, currentBankId, loanInput.currentYr1Rate, loanInput.currentYr2Rate, loanInput.currentYr3Rate, loanInput.currentYr4PlusRate, botHistoricalMrrs]);

  useEffect(() => {
    setLoanInput(prev => {
      const recalculated = recalculateLedger(
        prev.historicalPayments,
        prev.startingLoanAmount,
        prev.contractStartDate,
        currentBankMrrVal,
        prev.currentYr1Rate,
        prev.currentYr2Rate,
        prev.currentYr3Rate,
        prev.currentYr4PlusRate,
        botHistoricalMrrs
      );

      // Only update if there has been a mathematical change to avoid infinite loop
      const isChanged = JSON.stringify(recalculated) !== JSON.stringify(prev.historicalPayments);
      if (isChanged) {
        return {
          ...prev,
          historicalPayments: recalculated
        };
      }
      return prev;
    });
  }, [
    loanInput.startingLoanAmount,
    loanInput.contractStartDate,
    currentBankMrrVal,
    loanInput.currentYr1Rate,
    loanInput.currentYr2Rate,
    loanInput.currentYr3Rate,
    loanInput.currentYr4PlusRate,
    botHistoricalMrrs
  ]);

  const handleUpdateLedgerRow = (id: string, field: "payDate" | "paymentAmount", val: any) => {
    setLoanInput(prev => {
      const updatedList = prev.historicalPayments.map(p => {
        if (p.id === id) {
          const numVal = field === "paymentAmount" ? Number(val) : val;
          return { ...p, [field]: numVal };
        }
        return p;
      });
      
      const recalculated = recalculateLedger(
        updatedList, 
        prev.startingLoanAmount, 
        prev.contractStartDate,
        currentBankMrrVal,
        prev.currentYr1Rate,
        prev.currentYr2Rate,
        prev.currentYr3Rate,
        prev.currentYr4PlusRate,
        botHistoricalMrrs
      );
      
      return {
        ...prev,
        historicalPayments: recalculated
      };
    });
  };

  const handleAddLedgerRow = () => {
    setLoanInput(prev => {
      const nextIndex = prev.historicalPayments.length + 1;
      const lastRow = prev.historicalPayments[prev.historicalPayments.length - 1];
      const startBal = lastRow ? lastRow.endingBalance : prev.startingLoanAmount;
      
      let defaultInstallment = prev.currentYr1Installment;
      if (nextIndex <= 12) defaultInstallment = prev.currentYr1Installment;
      else if (nextIndex <= 24) defaultInstallment = prev.currentYr2Installment;
      else if (nextIndex <= 36) defaultInstallment = prev.currentYr3Installment;
      else defaultInstallment = prev.currentYr4PlusInstallment;

      // Calculate next sequence's payDate by adding exactly 1 month to the previous entry or contract start date
      let nextDateStr = "";
      const baseDateStr = lastRow ? lastRow.payDate : prev.contractStartDate;
      try {
        const parts = baseDateStr.split("-");
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1; // 0-based
          const d = parseInt(parts[2], 10);
          const nextDate = new Date(y, m + 1, d);
          const py = nextDate.getFullYear();
          const pm = (nextDate.getMonth() + 1).toString().padStart(2, "0");
          const pd = nextDate.getDate().toString().padStart(2, "0");
          nextDateStr = `${py}-${pm}-${pd}`;
        } else {
          const d = new Date(baseDateStr);
          d.setMonth(d.getMonth() + 1);
          nextDateStr = d.toISOString().split("T")[0];
        }
      } catch (err) {
        nextDateStr = new Date().toISOString().split("T")[0];
      }

      const newRow: HistoricalPayment = {
        id: Math.random().toString(36).substring(2, 9),
        monthIndex: nextIndex,
        payDate: nextDateStr,
        paymentAmount: defaultInstallment,
        interestCalculated: 0,
        principalDeducted: 0,
        endingBalance: startBal
      };
      
      const recalculated = recalculateLedger(
        [...prev.historicalPayments, newRow],
        prev.startingLoanAmount,
        prev.contractStartDate,
        currentBankMrrVal,
        prev.currentYr1Rate,
        prev.currentYr2Rate,
        prev.currentYr3Rate,
        prev.currentYr4PlusRate,
        botHistoricalMrrs
      );

      return {
        ...prev,
        historicalPayments: recalculated
      };
    });
  };

  const handleDeleteLedgerRow = (id: string) => {
    setLoanInput(prev => {
      const filtered = prev.historicalPayments.filter(p => p.id !== id);
      const reindexed = filtered.map((p, idx) => ({ ...p, monthIndex: idx + 1 }));
      const recalculated = recalculateLedger(
        reindexed,
        prev.startingLoanAmount,
        prev.contractStartDate,
        currentBankMrrVal,
        prev.currentYr1Rate,
        prev.currentYr2Rate,
        prev.currentYr3Rate,
        prev.currentYr4PlusRate,
        botHistoricalMrrs
      );
      return {
        ...prev,
        historicalPayments: recalculated
      };
    });
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      
      const newPayments: HistoricalPayment[] = [];
      let baseIndex = 0;
      
      lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const dateStr = parts[0].trim();
          const amountStr = parts[1].trim();
          
          let parsedDate = "";
          const cleanDateStr = dateStr.replace(/\s+/g, ""); // Strip any whitespace
          const dateParts = cleanDateStr.split(/[-/]/); // Split by slashes or dashes
          if (dateParts.length === 3) {
            // Check if year is first (YYYY-MM-DD) or last (DD-MM-YYYY)
            if (dateParts[0].length === 4) {
              const year = dateParts[0];
              const month = dateParts[1].padStart(2, '0');
              const day = dateParts[2].padStart(2, '0');
              parsedDate = `${year}-${month}-${day}`;
            } else {
              const day = dateParts[0].padStart(2, '0');
              const month = dateParts[1].padStart(2, '0');
              const yearStr = dateParts[2];
              const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
              parsedDate = `${year}-${month}-${day}`;
            }
          } else {
            // Fallback to standard JS Date parsing
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              parsedDate = parsed.toISOString().split("T")[0];
            } else {
              parsedDate = new Date().toISOString().split("T")[0];
            }
          }
          
          const amount = parseFloat(amountStr) || 0;
          
          if (amount > 0) {
            baseIndex++;
            newPayments.push({
              id: Math.random().toString(36).substring(2, 9) + baseIndex,
              monthIndex: baseIndex,
              payDate: parsedDate,
              paymentAmount: amount,
              interestCalculated: 0,
              principalDeducted: 0,
              endingBalance: 0
            });
          }
        }
      });
      
      if (newPayments.length > 0) {
        setLoanInput(prev => {
          const combined = [...newPayments];
          // Sort chronologically upon import
          combined.sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
          
          // Re-index after sort
          const reindexed = combined.map((p, idx) => ({ ...p, monthIndex: idx + 1 }));
          
          const recalculated = recalculateLedger(
            reindexed,
            prev.startingLoanAmount,
            prev.contractStartDate,
            currentBankMrrVal,
            prev.currentYr1Rate,
            prev.currentYr2Rate,
            prev.currentYr3Rate,
            prev.currentYr4PlusRate,
            botHistoricalMrrs
          );
          return {
            ...prev,
            historicalPayments: recalculated
          };
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSyncBalanceFromLedger = () => {
    const lastRow = loanInput.historicalPayments[loanInput.historicalPayments.length - 1];
    if (lastRow) {
      setLoanInput(prev => {
        const updated = { ...prev, outstandingPrincipal: lastRow.endingBalance };
        updateSuggestedInstallments(lastRow.endingBalance, prev.remainingTermMonths, prev.currentInstallment);
        return updated;
      });
    }
  };

  const handleInstallmentChange = (val: number) => {
    setLoanInput(prev => {
      const updated = { ...prev, currentInstallment: val };
      updateSuggestedInstallments(prev.outstandingPrincipal, prev.remainingTermMonths, val);
      return updated;
    });
  };

  // Helper to format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const handlePrintReport = () => {
    setPrintSuccess(true);
    setTimeout(() => {
      window.print();
      setPrintSuccess(false);
    }, 600);
  };

  // Find the overall best pathway for summary banners
  const bestPathwayObj = results.pathways.reduce<any>((best, current) => {
    if (!best || current.threeYear.totalSavingsVsCurrent > best.threeYear.totalSavingsVsCurrent) {
      return current;
    }
    return best;
  }, null);

  // Render individual Period Config fields
  const renderRatePeriodEditor = (
    id: string,
    periodKey: "yr1" | "yr2" | "yr3" | "yr4Plus",
    label: string,
    period: RatePeriod,
    mrr: number
  ) => {
    const resolved = resolveRate(mrr, period);
    return (
      <div className="flex flex-col gap-1 p-3 bg-slate-50 border border-slate-150 rounded-xl">
        <span className="text-[11px] font-bold text-slate-500">{label}</span>
        <div className="space-y-1.5 mt-1">
          {/* Selector Type */}
          <select
            value={period.type}
            onChange={(e) => {
              const val = e.target.value as "fixed" | "mrr";
              handleRatePeriodChange(id, periodKey, "type" as any, val);                
              if (val === 'mrr' && !period.mrrBaseline) {
                 handleRatePeriodChange(id, periodKey, "mrrBaseline" as any, mrr);
              }
            }}
            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="fixed">Fixed Rate (คงที่)</option>
            <option value="mrr">MRR Modifier (ลอยตัว)</option>
          </select>

          {/* Numeric Value */}
          <div className="relative">
            <input
              type="number"
              step="0.05"
              value={period.type === 'mrr' ? Math.abs(period.value) : period.value}
              onChange={(e) => handleRatePeriodChange(id, periodKey, "value", Number(e.target.value))}
              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg py-1 px-3 text-xs font-bold text-center outline-none"
            />
            <span className="absolute right-2 top-1 shadow-sm text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-mono font-bold">
              {period.type === "fixed" ? "%อัตรา" : "%ส่วนต่าง"}
            </span>
          </div>

          {/* Resolved Text */}
          <div className="flex justify-between items-center text-[10px] bg-indigo-50/50 p-1 px-1.5 rounded text-indigo-700 font-bold">
            <span>คำนวณสุทธิ:</span>
            <span className="font-mono">{resolved.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    );
  };

  const generateOriginalScheduleRows = (
    principal: number,
    rate: number,
    installment: number,
    simTotalPay: number,
    isSimulated: boolean
  ) => {
    let bal = principal;
    const rows = [];

    const rDateStr = loanInput.retentionStartDate || "2026-08-16";
    const rParts = rDateStr.split("-");
    const rYear = parseInt(rParts[0], 10) || 2026;
    const rMonth = (parseInt(rParts[1], 10) - 1) || 7;
    const rDay = parseInt(rParts[2], 10) || 16;

    for (let m = 1; m <= 36; m++) {
      const prevDate = new Date(rYear, rMonth + (m - 1), rDay);
      const currDate = new Date(rYear, rMonth + m, rDay);
      const prevUtc = Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
      const currUtc = Date.UTC(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
      const daysInPeriod = Math.max(28, Math.min(31, Math.floor((currUtc - prevUtc) / (1000 * 60 * 60 * 24))));

      const dailyRateVal = rate / 100 / 365;
      const beginning = bal;
      const interest = Number((beginning * dailyRateVal * daysInPeriod).toFixed(2));

      let paymentAmt = installment;
      if (isSimulated) {
        paymentAmt = Math.max(paymentAmt, simTotalPay);
      }
      
      const payment = Math.min(paymentAmt, beginning + interest);
      const principalPaid = Number((payment - interest).toFixed(2));
      bal = Math.max(0, Number((beginning - principalPaid).toFixed(2)));

      rows.push({
        month: m,
        beginning,
        rate,
        payment,
        interest,
        principal: principalPaid,
        ending: bal
      });
    }

    return rows;
  };

  const generateRetentionScheduleRows = (
    principal: number,
    mrr: number,
    simTotalPay: number,
    isSimulated: boolean
  ) => {
    let bal = principal;
    const rows = [];

    const rDateStr = loanInput.retentionStartDate || "2026-08-16";
    const rParts = rDateStr.split("-");
    const rYear = parseInt(rParts[0], 10) || 2026;
    const rMonth = (parseInt(rParts[1], 10) - 1) || 7;
    const rDay = parseInt(rParts[2], 10) || 16;

    for (let m = 1; m <= 36; m++) {
      let ratePeriod = origSimRates.yr4Plus;
      let installment = origSimInstallments.yr4Plus;

      if (m <= 12) {
        ratePeriod = origSimRates.yr1;
        installment = origSimInstallments.yr1;
      } else if (m <= 24) {
        ratePeriod = origSimRates.yr2;
        installment = origSimInstallments.yr2;
      } else if (m <= 36) {
        ratePeriod = origSimRates.yr3;
        installment = origSimInstallments.yr3;
      }

      const activeRate = resolveRate(mrr, ratePeriod);

      const prevDate = new Date(rYear, rMonth + (m - 1), rDay);
      const currDate = new Date(rYear, rMonth + m, rDay);
      const prevUtc = Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
      const currUtc = Date.UTC(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
      const daysInPeriod = Math.max(28, Math.min(31, Math.floor((currUtc - prevUtc) / (1000 * 60 * 60 * 24))));

      const dailyRateVal = activeRate / 100 / 365;
      const beginning = bal;
      const interest = Number((beginning * dailyRateVal * daysInPeriod).toFixed(2));

      let paymentAmt = installment;
      if (isSimulated) {
        paymentAmt = Math.max(paymentAmt, simTotalPay);
      }
      
      const payment = Math.min(paymentAmt, beginning + interest);
      const principalPaid = Number((payment - interest).toFixed(2));
      bal = Math.max(0, Number((beginning - principalPaid).toFixed(2)));

      rows.push({
        month: m,
        beginning,
        rate: activeRate,
        payment,
        interest,
        principal: principalPaid,
        ending: bal
      });
    }

    return rows;
  };

  const generateScheduleRows = (
    principal: number,
    bankConfig: CustomBankConfig,
    packageId: number,
    simTotalPay: number,
    isSimulated: boolean
  ) => {
    const pkgs = bankConfig.packages || [];
    const pkgObj = pkgs.find(p => p.id === packageId) || pkgs[0];
    if (!pkgObj) return [];

    let bal = principal;
    const rows = [];

    const rDateStr = loanInput.retentionStartDate || "2026-08-16";
    const rParts = rDateStr.split("-");
    const rYear = parseInt(rParts[0], 10) || 2026;
    const rMonth = (parseInt(rParts[1], 10) - 1) || 7;
    const rDay = parseInt(rParts[2], 10) || 16;

    for (let m = 1; m <= 36; m++) {
      let ratePeriod = pkgObj.yr4Plus;
      if (m <= 12) ratePeriod = pkgObj.yr1;
      else if (m <= 24) ratePeriod = pkgObj.yr2;
      else if (m <= 36) ratePeriod = pkgObj.yr3;

      const activeRate = resolveRate(bankConfig.mrr, ratePeriod);

      const prevDate = new Date(rYear, rMonth + (m - 1), rDay);
      const currDate = new Date(rYear, rMonth + m, rDay);
      const prevUtc = Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
      const currUtc = Date.UTC(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
      const daysInPeriod = Math.max(28, Math.min(31, Math.floor((currUtc - prevUtc) / (1000 * 60 * 60 * 24))));

      const dailyRateVal = activeRate / 100 / 365;
      const beginning = bal;
      const interest = Number((beginning * dailyRateVal * daysInPeriod).toFixed(2));

      let paymentAmt = bankConfig.isInstallmentAdjusted ? bankConfig.customInstallment : loanInput.currentInstallment;
      if (isSimulated) {
        paymentAmt = Math.max(paymentAmt, simTotalPay);
      }
      
      const payment = Math.min(paymentAmt, beginning + interest);
      const principalPaid = Number((payment - interest).toFixed(2));
      bal = Math.max(0, Number((beginning - principalPaid).toFixed(2)));

      rows.push({
        month: m,
        beginning,
        rate: activeRate,
        payment,
        interest,
        principal: principalPaid,
        ending: bal
      });
    }

    return rows;
  };

  return (
    <div id="calculator-root-container" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased print:bg-white">
      
      {/* HEADER SECTION */}
      <header id="app-header" className="bg-white text-slate-800 px-6 py-4 md:px-8 flex flex-col md:flex-row justify-between items-center shrink-0 shadow-xs border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              Thai Loan Retention & Refinance Multi-Compare
            </h1>
            <p className="text-[11px] text-indigo-600 font-medium font-bold">
              วิเคราะห์เปรียบเทียบข้อเสนอขอลดดอกเบี้ยและการรีไฟแนนซ์พร้อมกันสูงสุด 5 สัญญา อย่างแม่นยำรายธนาคาร
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-3 md:mt-0 text-xs font-semibold">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>ปีงบประมาณ 2569 (2026)</span>
          </div>
          <button 
            onClick={handlePrintReport}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            พิมพ์รายงานเปรียบเทียบ
          </button>
        </div>
      </header>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-6 font-sans">
        <h1 className="text-3xl font-bold">รายงานเปรียบเทียบ Retention & Refinance เชิงลึก</h1>
        <p className="text-slate-500 mt-1">เปรียบเทียบดอกเบี้ยรายปี จุดคุ้มทุน และค่าใช้จ่ายของสินเชื่อที่อยู่อาศัย</p>
        <div className="grid grid-cols-4 gap-4 mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase">เงินต้นคงเหลือ</p>
            <p className="text-lg font-bold text-indigo-700">{formatCurrency(loanInput.outstandingPrincipal)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase">อัตราเดิม</p>
            <p className="text-lg font-bold text-rose-600">{loanInput.currentInterestRate}%</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase">ระยะเวลาที่เหลือ</p>
            <p className="text-lg font-bold">{(loanInput.remainingTermMonths / 12).toFixed(1)} ปี</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase">ค่างวดผ่อนเดิม</p>
            <p className="text-lg font-bold">{formatCurrency(loanInput.currentInstallment)}/ด.</p>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main id="main-content-layout" className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* SECTION A: BANK MULTI-SELECTION FOR REFINANCE */}
        {!printSuccess && (
          <section id="bank-rates-section" className="print:hidden">
            <BankOffers 
              selectedBankIds={selectedBankIds}
              currentBankId={currentBankId}
              onToggleBank={handleToggleBank}
              onSetCurrentBank={handleSetCurrentBank}
              onRatesLoaded={handleRatesLoaded}
            />
          </section>
        )}

        {/* DOUBLE PANEL SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: CRITICAL CONFIGS AND INPUT ADJUSTMENTS */}
          <div className="lg:col-span-4 space-y-6 print:hidden">
            
            {/* 1. ADVANCED MORTGAGE CONFIGURATOR */}
            <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden flex flex-col">
              
              {/* Header Title */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-slate-800">
                <div>
                  <h3 className="font-extrabold text-[12px] uppercase tracking-wider flex items-center gap-1.5 text-indigo-900">
                    <Building className="w-4 h-4 text-indigo-600" />
                    1. ข้อมูลสัญญากู้เดิม
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-bold">ระบุรายละเอียดและเงื่อนไขของธนาคารเดิม</p>
                </div>
                {(() => {
                  const cb = banksList.find(b => b.id === currentBankId);
                  return cb ? (
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded flex items-center gap-1 border border-indigo-100 max-w-[100px] truncate">
                      {cb.nameTh.replace("ธนาคาร", "")}
                    </span>
                  ) : null;
                })()}
              </div>

              {/* Sub tabs selectors */}
              <div className="flex flex-wrap gap-1 bg-slate-50 border-b border-slate-100 p-2">
                <button
                  type="button"
                  onClick={() => setActiveConfigSubTab("borrower")}
                  className={`flex-1 min-w-[100px] whitespace-nowrap py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer text-center ${
                    activeConfigSubTab === "borrower"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                  title="ผู้กู้ & สัญญา"
                >
                  ผู้กู้ & สัญญา
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConfigSubTab("teaser_rates")}
                  className={`flex-1 min-w-[100px] whitespace-nowrap py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer text-center ${
                    activeConfigSubTab === "teaser_rates"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                  title="ดอกเบี้ย"
                >
                  ดอกเบี้ย
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConfigSubTab("expenses")}
                  className={`flex-1 min-w-[100px] whitespace-nowrap py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer text-center ${
                    activeConfigSubTab === "expenses"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                  title="ค่าใช้จ่าย & อัคคีภัย"
                >
                  อื่นๆ & อัคคีภัย
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConfigSubTab("mrta")}
                  className={`flex-1 min-w-[100px] whitespace-nowrap py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer text-center ${
                    activeConfigSubTab === "mrta"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                  title="ชีวิต MRTA/MLTA"
                >
                  MRTA/MLTA
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConfigSubTab("penalties")}
                  className={`flex-1 min-w-[100px] whitespace-nowrap py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer text-center ${
                    activeConfigSubTab === "penalties"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                  title="ค่าปรับ"
                >
                  ค่าปรับ
                </button>
              </div>

              {/* Content Panel */}
              <div className="p-4 space-y-4">
                
                {/* 1. Borrower Profile & Main Contract Panel */}
                {activeConfigSubTab === "borrower" && (
                  <div className="space-y-3.5 animate-fadeIn">
                    
                    {/* Borrower Type (Single / Joint) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">ประเภทสัญญากู้ยืม</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handleBorrowerTypeChange("single")}
                          className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            loanInput.borrowerType === "single"
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <User className="w-3.5 h-3.5" />
                          กู้เดี่ยว
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBorrowerTypeChange("joint")}
                          className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            loanInput.borrowerType === "joint"
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          กู้ร่วม
                        </button>
                      </div>
                      <p className="text-[9.5px] text-slate-400 font-medium leading-relaxed mt-1">
                        * สัญญากู้เดี่ยวและกู้ร่วมส่งผลต่อการคำนวณราคาเบี้ยประกันคุ้มครองวงเงิน (MRTA) สำหรับผู้กู้ร่วม
                      </p>
                    </div>

                    {/* Borrower Profiles */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                      <p className="text-xs font-black text-indigo-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        ผู้กู้หลัก
                      </p>

                      {/* Borrower 1 Gender */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">เพศผู้กู้หลัก</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setLoanInput(prev => ({ ...prev, gender: "male" }))}
                            className={`py-1 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              loanInput.gender === "male"
                                ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-black"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            ชาย
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoanInput(prev => ({ ...prev, gender: "female" }))}
                            className={`py-1 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              loanInput.gender === "female"
                                ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-black"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            หญิง
                          </button>
                        </div>
                      </div>

                      {/* Borrower 1 Current Age */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="font-extrabold text-slate-500 uppercase tracking-wide">อายุปัจจุบันของผู้กู้หลัก (ปี)</span>
                          <span className="font-bold text-slate-700 font-mono">{loanInput.borrowerAge} ปี</span>
                        </div>
                        <input
                          type="number"
                          min="18"
                          max="80"
                          value={loanInput.borrowerAge}
                          onChange={(e) => handleBorrowerAgeChange(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1 px-3 text-xs font-bold text-slate-800 outline-none transition"
                        />
                      </div>

                      {/* Borrower 1 Age At Contract */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="font-extrabold text-slate-500 uppercase tracking-wide text-slate-400">อายุตอนทำสัญญาของผู้กู้หลัก (ปี)</span>
                          <span className="font-bold text-indigo-600 font-mono">{loanInput.borrowerAgeAtContract} ปี</span>
                        </div>
                        <div className="bg-slate-100/80 border border-slate-150 rounded-xl py-1 px-3 text-[10px] font-bold text-slate-500 flex justify-between">
                          <span>คำนวณอัตโนมัติ (อายุปัจจุบัน - สัญญา):</span>
                          <span>{loanInput.borrowerAgeAtContract} ปี</span>
                        </div>
                      </div>
                    </div>

                    {/* Joint Borrower Profile (if joint loan) */}
                    {loanInput.borrowerType === "joint" && (
                      <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 space-y-3 animate-fadeIn">
                        <p className="text-xs font-black text-purple-900 border-b border-purple-100 pb-1.5 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                          ผู้กู้ร่วมคนที่สอง
                        </p>

                        {/* Borrower 2 Gender */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">เพศผู้กู้ร่วม</label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => handleBorrower2GenderChange("male")}
                              className={`py-1 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                loanInput.borrower2Gender === "male"
                                  ? "bg-purple-100 border-purple-500 text-purple-700 font-black"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              ชาย
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBorrower2GenderChange("female")}
                              className={`py-1 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                loanInput.borrower2Gender === "female"
                                  ? "bg-purple-100 border-purple-500 text-purple-700 font-black"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              หญิง
                            </button>
                          </div>
                        </div>

                        {/* Borrower 2 Current Age */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-extrabold text-slate-500 uppercase tracking-wide">อายุปัจจุบันของผู้กู้ร่วม (ปี)</span>
                            <span className="font-bold text-slate-700 font-mono">{loanInput.borrower2Age || 32} ปี</span>
                          </div>
                          <input
                            type="number"
                            min="18"
                            max="80"
                            value={loanInput.borrower2Age || 32}
                            onChange={(e) => handleBorrower2AgeChange(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-purple-500 rounded-xl py-1 px-3 text-xs font-bold text-slate-800 outline-none transition"
                          />
                        </div>

                        {/* Borrower 2 Age At Contract */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-extrabold text-slate-500 uppercase tracking-wide text-slate-400">อายุตอนทำสัญญาของผู้กู้ร่วม (ปี)</span>
                            <span className="font-bold text-purple-600 font-mono">
                              {Math.max(18, (loanInput.borrower2Age || 32) - getElapsedYears(loanInput.contractStartDate))} ปี
                            </span>
                          </div>
                          <div className="bg-slate-100/80 border border-slate-150 rounded-xl py-1 px-3 text-[10px] font-bold text-slate-500 flex justify-between">
                            <span>คำนวณอัตโนมัติ (อายุปัจจุบัน - สัญญา):</span>
                            <span>{Math.max(18, (loanInput.borrower2Age || 32) - getElapsedYears(loanInput.contractStartDate))} ปี</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Date Contract Started */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wide">วันที่เริ่มทำสัญญา</span>
                        <span className="font-bold text-slate-700 font-mono">{loanInput.contractStartDate}</span>
                      </div>
                      <input
                        type="date"
                        value={loanInput.contractStartDate}
                        onChange={(e) => handleContractStartDateChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none transition"
                      />
                    </div>

                    {/* Initial Contract Term */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wide">ระยะเวลาสัญญาเริ่มต้น (เดือน)</span>
                        <span className="font-bold text-indigo-600 font-mono">
                          {loanInput.startingTermMonths} ด. ({(loanInput.startingTermMonths / 12).toFixed(1)} ปี)
                        </span>
                      </div>
                      <input
                        type="number"
                        min="12"
                        max="480"
                        value={loanInput.startingTermMonths}
                        onChange={(e) => handleStartingTermMonthsChange(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none transition"
                      />
                    </div>

                    {/* Starting Loan Amount */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wide">วงเงินร่วมกู้แรกเริ่ม (บาท)</span>
                        <span className="font-bold text-indigo-600 font-mono">{formatCurrency(loanInput.startingLoanAmount)}</span>
                      </div>
                      <input
                        type="number"
                        step="100000"
                        value={loanInput.startingLoanAmount}
                        onChange={(e) => handleStartingAmountChange(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none transition"
                      />
                    </div>

                    {/* Outstanding Principal */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wide font-bold">ยอดหนี้ต้นคงเหลือปัจจุบัน (บาท)</span>
                        <span className="font-bold text-emerald-600 font-mono">{formatCurrency(loanInput.outstandingPrincipal)}</span>
                      </div>
                      <input
                        type="number"
                        value={loanInput.outstandingPrincipal}
                        onChange={(e) => handlePrincipalChange(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none transition"
                      />
                    </div>

                    {/* Months Term */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wide">ระยะเวลาผ่อนสัญญาที่เหลืออยู่ (เดือน)</span>
                        <span className="font-bold text-indigo-600 font-mono">
                          {loanInput.remainingTermMonths} ด. ({(loanInput.remainingTermMonths / 12).toFixed(1)} ปี)
                        </span>
                      </div>
                      <input
                        type="number"
                        min="12"
                        max="480"
                        value={loanInput.remainingTermMonths}
                        onChange={(e) => handleTermMonthsChange(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none transition"
                      />
                    </div>

                  </div>
                )}

                {/* 3. Transaction Expenses & Fire Insurance Panel */}
                {activeConfigSubTab === "expenses" && (
                  <div className="space-y-4 animate-fadeIn max-h-[420px] overflow-y-auto pr-1">
                    <p className="text-[10px] text-slate-400 font-bold mb-2 leading-relaxed">
                      ระบุค่าใช้จ่ายจดทะเบียนทำสิทธิ์และนิติกรรม และสเปกความคุ้มครองของเบี้ยประกันอัคคีภัยที่เกี่ยวข้อง
                    </p>

                    {/* Transaction Fees Sub-group */}
                    <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-3">
                      <p className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-indigo-500" />
                        ค่าธรรมเนียมและค่าจดทะเบียนสิทธิ์
                      </p>

                      {/* Appraisal Fee */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <label className="text-slate-500 font-extrabold uppercase">ค่าสำรวจและประเมินหลักประกัน (บาท)</label>
                          <span className="font-mono text-slate-700 font-bold">{formatCurrency(loanInput.appraisalFee)}</span>
                        </div>
                        <input
                          type="number"
                          step="500"
                          value={loanInput.appraisalFee}
                          onChange={(e) => handleAppraisalFeeChange(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>

                      {/* Mortgage Fee Rate */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <label className="text-slate-500 font-extrabold uppercase">ค่าจดจำนอง (% ของวงเงินสินเชื่อ/จำนอง)</label>
                          <span className="font-mono text-indigo-600 font-bold">{loanInput.mortgageFeeRate}% (≈ {formatCurrency((loanInput.startingLoanAmount * loanInput.mortgageFeeRate) / 100)})</span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={loanInput.mortgageFeeRate}
                            onChange={(e) => handleMortgageFeeRateChange(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none pr-8"
                          />
                          <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">%</span>
                        </div>
                      </div>

                      {/* Duty Stamp Rate */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <label className="text-slate-500 font-extrabold uppercase">ค่าอากรแสตมป์ (% ของวงเงินกู้)</label>
                          <span className="font-mono text-emerald-600 font-bold">{loanInput.dutyStampRate}% (≈ {formatCurrency((loanInput.startingLoanAmount * loanInput.dutyStampRate) / 100)})</span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={loanInput.dutyStampRate}
                            onChange={(e) => handleDutyStampRateChange(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none pr-8"
                          />
                          <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Fire Insurance Sub-group */}
                    <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl space-y-3">
                      <p className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                        ความคุ้มครองและเบี้ยประกันภัยอัคคีภัย
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Premium */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] text-slate-500 font-extrabold uppercase block">เบี้ยประกันภัย (บาท)</label>
                          <input
                            type="number"
                            step="100"
                            value={loanInput.fireInsurancePremium}
                            onChange={(e) => handleFireInsurancePremiumChange(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-2 text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>

                        {/* Duration */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] text-slate-500 font-extrabold uppercase block">เวลาคุ้มครอง (ปี)</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={loanInput.fireInsuranceDuration}
                            onChange={(e) => handleFireInsuranceDurationChange(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-2 text-xs font-bold text-slate-800 outline-none text-center"
                          />
                        </div>
                      </div>

                      {/* Building Sum Insured (excluding Foundation) */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9.5px]">
                          <label className="text-slate-500 font-extrabold uppercase">สิ่งปลูกสร้างไม่รวมฐานราก (บาท)</label>
                          <span className="font-mono text-slate-700 font-bold">{formatCurrency(loanInput.fireSumInsuredBuilding)}</span>
                        </div>
                        <input
                          type="number"
                          step="100000"
                          value={loanInput.fireSumInsuredBuilding}
                          onChange={(e) => handleFireSumInsuredBuildingChange(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>

                      {/* Possessions / Contents Insured */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9.5px]">
                          <label className="text-slate-500 font-extrabold uppercase">ทรัพย์สินภายในสิ่งปลูกสร้าง (บาท)</label>
                          <span className="font-mono text-slate-700 font-bold">{formatCurrency(loanInput.fireSumInsuredContent)}</span>
                        </div>
                        <input
                          type="number"
                          step="50000"
                          value={loanInput.fireSumInsuredContent}
                          onChange={(e) => handleFireSumInsuredContentChange(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. MLTA / MRTA Insurance Configuration Panel */}
                {activeConfigSubTab === "mrta" && (
                  <div className="space-y-4 animate-fadeIn max-h-[420px] overflow-y-auto pr-1">
                    <div className="space-y-3">
                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                        <p className="text-[10px] text-blue-900 font-black flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-blue-600" />
                          ประกันชีวิตคุ้มครองวงเงินสินเชื่อ (MLTA / MRTA)
                        </p>
                        <p className="text-[8.5px] text-slate-500 leading-relaxed mt-1">
                          กรอกข้อมูลแยกสิทธิ์แต่ละผู้กู้ อ้างอิงสัญญากู้เดิม หากเลือกประเภท "กู้ร่วม" ระบบจะเปิดฟิลด์ข้อมูลคนที่สอง เวนคืนจะคำนวณจากสัดส่วน 13.57 บาทต่อวงเงิน 1,000 บาท
                        </p>
                      </div>
                    </div>

                    {/* Borrower 1 Section */}
                    <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-3">
                      <p className="text-[10.5px] font-extrabold text-indigo-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                        <span className="w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[9px] font-black">1</span>
                        ผู้กู้หลัก (Borrower 1)
                      </p>

                      {/* 1. Premium */}
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-slate-500 font-extrabold uppercase block">ค่าเบี้ยประกันชีวิต (บาท)</label>
                        <input
                          type="number"
                          step="1000"
                          value={loanInput.mrta1Premium}
                          onChange={(e) => handleMrta1FieldChange("mrta1Premium", Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>

                      {/* 2. Sum Insured */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9.5px]">
                          <label className="text-slate-500 font-extrabold uppercase">จำนวนเงินเอาประกันภัย (บาท)</label>
                          <span className="font-mono text-indigo-600 font-bold">{formatCurrency(loanInput.mrta1SumInsured)}</span>
                        </div>
                        <input
                          type="number"
                          step="100000"
                          value={loanInput.mrta1SumInsured}
                          onChange={(e) => handleMrta1FieldChange("mrta1SumInsured", Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>

                      {/* 3. Insurance Type */}
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-slate-500 font-extrabold uppercase block">แบบประกันภัย</label>
                        <select
                          value={loanInput.mrta1Type}
                          onChange={(e) => handleMrta1FieldChange("mrta1Type", e.target.value)}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                        >
                          <option value="decreasing">แบบลดลงตามระยะเวลา (Decreasing)</option>
                          <option value="constant">แบบคงที่ตามระยะเวลา (Constant)</option>
                        </select>
                      </div>

                      {/* 4. Payment Pattern */}
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-slate-500 font-extrabold uppercase block">รูปแบบการชำระเบี้ย</label>
                        <select
                          value={loanInput.mrta1PaymentPattern}
                          onChange={(e) => handleMrta1FieldChange("mrta1PaymentPattern", e.target.value)}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                        >
                          <option value="single">จ่ายครั้งเดียว (Single Premium)</option>
                          <option value="yearly">จ่ายรายปี (Yearly)</option>
                          <option value="monthly">จ่ายรายเดือน (Monthly)</option>
                        </select>
                      </div>

                      {/* 5. Surrender cash scale per 1,000 Sum Insured */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9.5px]">
                          <label className="text-slate-500 font-extrabold uppercase">สัดส่วนเงินเวนคืนเมื่อครบ 3 ปี (ต่อ 1,000 บาท)</label>
                          <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded font-black">ค่าแนะนำ: 13.57 บาท</span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={loanInput.mrta1SurrenderRate3Yr}
                            onChange={(e) => handleMrta1FieldChange("mrta1SurrenderRate3Yr", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none pr-28"
                          />
                          <span className="absolute right-3 top-2 text-slate-400 text-[10px] font-semibold">บาทต่อ 1,000 บ.</span>
                        </div>
                        {/* Dynamic Surrender estimation */}
                        <div className="text-[9.5px] text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg leading-relaxed font-bold">
                          💡 พยากรณ์กระแสเงินเวนคืนเว้นปีที่ 3 (ผู้กู้ 1): ~ {formatCurrency((loanInput.mrta1SumInsured * loanInput.mrta1SurrenderRate3Yr) / 1000)} บาท
                        </div>
                      </div>
                    </div>

                    {/* Borrower 2 Section */}
                    {loanInput.borrowerType === "joint" ? (
                      <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-3 animate-fadeIn">
                        <p className="text-[10.5px] font-extrabold text-indigo-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                          <span className="w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-[9px] font-black">2</span>
                          ผู้กู้ร่วมหลักที่สอง (Borrower 2)
                        </p>

                        {/* 1. Premium */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] text-slate-500 font-extrabold uppercase block">ค่าเบี้ยประกันชีวิต (บาท)</label>
                          <input
                            type="number"
                            step="1000"
                            value={loanInput.mrta2Premium}
                            onChange={(e) => handleMrta2FieldChange("mrta2Premium", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>

                        {/* 2. Sum Insured */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9.5px]">
                            <label className="text-slate-500 font-extrabold uppercase">จำนวนเงินเอาประกันภัย (บาท)</label>
                            <span className="font-mono text-indigo-600 font-bold">{formatCurrency(loanInput.mrta2SumInsured)}</span>
                          </div>
                          <input
                            type="number"
                            step="100000"
                            value={loanInput.mrta2SumInsured}
                            onChange={(e) => handleMrta2FieldChange("mrta2SumInsured", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>

                        {/* 3. Insurance Type */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] text-slate-500 font-extrabold uppercase block">แบบประกันภัย</label>
                          <select
                            value={loanInput.mrta2Type}
                            onChange={(e) => handleMrta2FieldChange("mrta2Type", e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                          >
                            <option value="decreasing">แบบลดลงตามระยะเวลา (Decreasing)</option>
                            <option value="constant">แบบคงที่ตามระยะเวลา (Constant)</option>
                          </select>
                        </div>

                        {/* 4. Payment Pattern */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] text-slate-500 font-extrabold uppercase block">รูปแบบการชำระเบี้ย</label>
                          <select
                            value={loanInput.mrta2PaymentPattern}
                            onChange={(e) => handleMrta2FieldChange("mrta2PaymentPattern", e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                          >
                            <option value="single">จ่ายครั้งเดียว (Single Premium)</option>
                            <option value="yearly">จ่ายรายปี (Yearly)</option>
                            <option value="monthly">จ่ายรายเดือน (Monthly)</option>
                          </select>
                        </div>

                        {/* 5. Surrender cash scale per 1,000 Sum Insured */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9.5px]">
                            <label className="text-slate-500 font-extrabold uppercase">สัดส่วนเงินเวนคืนเมื่อครบ 3 ปี (ต่อ 1,000 บาท)</label>
                            <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded font-black font-semibold">ค่าแนะนำ: 13.57 บาท</span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={loanInput.mrta2SurrenderRate3Yr}
                              onChange={(e) => handleMrta2FieldChange("mrta2SurrenderRate3Yr", Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none pr-28"
                            />
                            <span className="absolute right-3 top-2 text-slate-400 text-[10px] font-semibold">บาทต่อ 1,000 บ.</span>
                          </div>
                          {/* Dynamic Surrender estimation */}
                          <div className="text-[9.5px] text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg leading-relaxed font-bold">
                            💡 พยากรณ์กระแสเงินเวนคืนเว้นปีที่ 3 (ผู้กู้ 2): ~ {formatCurrency((loanInput.mrta2SumInsured * loanInput.mrta2SurrenderRate3Yr) / 1000)} บาท
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-slate-100 text-[10px] text-slate-500 rounded-xl text-center italic border border-dashed border-slate-200">
                        * ระบบตรวจพบเป็นสัญญากู้เดี่ยว หากประสงค์ระบุข้อมูลผู้ร่วมกู้คนที่สอง กรุณาเลือกสัญญากู้ประเภท "กู้ร่วม" ในแท็บ 'ผู้กู้ & สัญญา'
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Step Teaser Rates & Monthly Installments Panel */}
                {activeConfigSubTab === "teaser_rates" && (
                  <div className="space-y-3 animate-fadeIn max-h-[360px] overflow-y-auto pr-1">
                    <p className="text-[10px] text-slate-400 font-bold mb-2">
                      ระบุอัตราดอกเบี้ยเดิมแต่ละปี เพื่อใช่คำนวณยอดผ่อนจริง
                    </p>

                    {/* Year 1 Teaser */}
                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-2">
                      <p className="text-[10.5px] font-black text-slate-700 flex justify-between">
                        <span>ปีที่ 1</span>
                        <span className="text-[9px] text-emerald-700 font-mono bg-emerald-50 px-1 py-0.2 rounded font-black">
                          {loanInput.currentYr1Rate.type === 'fixed'
                            ? `Rate ${loanInput.currentYr1Rate.value}%`
                            : `MRR-${Math.abs(loanInput.currentYr1Rate.value)}% (${resolveRate(currentBankMrrVal, loanInput.currentYr1Rate).toFixed(2)}%)`
                          }
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <select
                            value={loanInput.currentYr1Rate.type}
                            onChange={(e) => handleCurrentRatePeriodChange("currentYr1Rate", "type", e.target.value)}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-slate-600"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="mrr">MRR Modifier</option>
                          </select>
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.05"
                            value={loanInput.currentYr1Rate.type === 'mrr' ? Math.abs(loanInput.currentYr1Rate.value) : loanInput.currentYr1Rate.value}
                            onChange={(e) => handleCurrentRatePeriodChange("currentYr1Rate", "value", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      </div>
                      
                      {loanInput.currentYr1Rate.type === 'mrr' && (
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-bold">MRR ของธนาคารปัจจุบัน</label>
                          <input
                             type="number"
                             step="0.01"
                             value={loanInput.currentYr1Rate.mrrBaseline || currentBankMrrVal}
                             onChange={(e) => handleCurrentRatePeriodChange("currentYr1Rate", "mrrBaseline", Number(e.target.value))}
                             className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold">ค่างวดผ่อนปีที่ 1 (บาท/เดือน)</label>
                        <input
                          type="number"
                          step="500"
                          value={loanInput.currentYr1Installment}
                          onChange={(e) => handleCurrentInstallmentPeriodChange("currentYr1Installment", Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Year 2 Teaser */}
                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-2">
                      <p className="text-[10.5px] font-black text-slate-700 flex justify-between">
                        <span>ปีที่ 2</span>
                        <span className="text-[9px] text-emerald-700 font-mono bg-emerald-50 px-1 py-0.2 rounded font-black">
                          {loanInput.currentYr2Rate.type === 'fixed'
                            ? `Rate ${loanInput.currentYr2Rate.value}%`
                            : `MRR-${Math.abs(loanInput.currentYr2Rate.value)}% (${resolveRate(currentBankMrrVal, loanInput.currentYr2Rate).toFixed(2)}%)`
                          }
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <select
                            value={loanInput.currentYr2Rate.type}
                            onChange={(e) => handleCurrentRatePeriodChange("currentYr2Rate", "type", e.target.value)}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-slate-600"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="mrr">MRR Modifier</option>
                          </select>
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.05"
                            value={loanInput.currentYr2Rate.type === 'mrr' ? Math.abs(loanInput.currentYr2Rate.value) : loanInput.currentYr2Rate.value}
                            onChange={(e) => handleCurrentRatePeriodChange("currentYr2Rate", "value", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      </div>
                      
                      {loanInput.currentYr2Rate.type === 'mrr' && (
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-bold">MRR ของธนาคารปัจจุบัน</label>
                          <input
                             type="number"
                             step="0.01"
                             value={loanInput.currentYr2Rate.mrrBaseline || currentBankMrrVal}
                             onChange={(e) => handleCurrentRatePeriodChange("currentYr2Rate", "mrrBaseline", Number(e.target.value))}
                             className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold">ค่างวดผ่อนปีที่ 2 (บาท/เดือน)</label>
                        <input
                          type="number"
                          step="500"
                          value={loanInput.currentYr2Installment}
                          onChange={(e) => handleCurrentInstallmentPeriodChange("currentYr2Installment", Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Year 3 Teaser */}
                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-2">
                      <p className="text-[10.5px] font-black text-slate-700 flex justify-between">
                        <span>ปีที่ 3</span>
                        <span className="text-[9px] text-emerald-700 font-mono bg-emerald-50 px-1 py-0.2 rounded font-black">
                          {loanInput.currentYr3Rate.type === 'fixed'
                            ? `Rate ${loanInput.currentYr3Rate.value}%`
                            : `MRR-${Math.abs(loanInput.currentYr3Rate.value)}% (${resolveRate(currentBankMrrVal, loanInput.currentYr3Rate).toFixed(2)}%)`
                          }
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <select
                            value={loanInput.currentYr3Rate.type}
                            onChange={(e) => handleCurrentRatePeriodChange("currentYr3Rate", "type", e.target.value)}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-slate-600"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="mrr">MRR Modifier</option>
                          </select>
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.05"
                            value={loanInput.currentYr3Rate.type === 'mrr' ? Math.abs(loanInput.currentYr3Rate.value) : loanInput.currentYr3Rate.value}
                            onChange={(e) => handleCurrentRatePeriodChange("currentYr3Rate", "value", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      </div>
                      
                      {loanInput.currentYr3Rate.type === 'mrr' && (
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-bold">MRR ของธนาคารปัจจุบัน</label>
                          <input
                             type="number"
                             step="0.01"
                             value={loanInput.currentYr3Rate.mrrBaseline || currentBankMrrVal}
                             onChange={(e) => handleCurrentRatePeriodChange("currentYr3Rate", "mrrBaseline", Number(e.target.value))}
                             className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold">ค่างวดผ่อนปีที่ 3 (บาท/เดือน)</label>
                        <input
                          type="number"
                          step="500"
                          value={loanInput.currentYr3Installment}
                          onChange={(e) => handleCurrentInstallmentPeriodChange("currentYr3Installment", Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Year 4+ Teaser */}
                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-2">
                      <p className="text-[10.5px] font-black text-slate-700 flex justify-between">
                        <span>ตั้งแต่ปีที่ 4 เป็นต้นไป</span>
                        <span className="text-[9px] text-rose-700 font-mono bg-rose-50 px-1 py-0.2 rounded font-black">
                          {loanInput.currentYr4PlusRate.type === 'fixed'
                            ? `Rate ${loanInput.currentYr4PlusRate.value}%`
                            : `MRR-${Math.abs(loanInput.currentYr4PlusRate.value)}% (${resolveRate(currentBankMrrVal, loanInput.currentYr4PlusRate).toFixed(2)}%)`
                          }
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <select
                            value={loanInput.currentYr4PlusRate.type}
                            onChange={(e) => handleCurrentRatePeriodChange("currentYr4PlusRate", "type", e.target.value)}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-slate-600"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="mrr">MRR Modifier</option>
                          </select>
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.05"
                            value={loanInput.currentYr4PlusRate.type === 'mrr' ? Math.abs(loanInput.currentYr4PlusRate.value) : loanInput.currentYr4PlusRate.value}
                            onChange={(e) => handleCurrentRatePeriodChange("currentYr4PlusRate", "value", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      </div>
                      
                      {loanInput.currentYr4PlusRate.type === 'mrr' && (
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-bold">MRR ของธนาคารปัจจุบัน</label>
                          <input
                             type="number"
                             step="0.01"
                             value={loanInput.currentYr4PlusRate.mrrBaseline || currentBankMrrVal}
                             onChange={(e) => handleCurrentRatePeriodChange("currentYr4PlusRate", "mrrBaseline", Number(e.target.value))}
                             className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold">ค่างวดผ่อนปีที่ 4+ (บาท/เดือน)</label>
                        <input
                          type="number"
                          step="500"
                          value={loanInput.currentYr4PlusInstallment}
                          onChange={(e) => handleCurrentInstallmentPeriodChange("currentYr4PlusInstallment", Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg"
                        />
                      </div>
                    </div>

                  </div>
                )}

                {/* 3. Penalties, Subsidies & Prepayment Lock-in Conditions Panel */}
                {activeConfigSubTab === "penalties" && (
                  <div className="space-y-4 animate-fadeIn">
                    
                    {/* Prepayment Penalty (Early closing fine) */}
                    <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 space-y-2">
                      <p className="text-[11px] font-extrabold text-rose-800 flex items-center gap-1">
                        <BadgeAlert className="w-3.5 h-3.5" />
                        ค่าปรับปิดสัญญาก่อนครบกำหนด (Prepayment Fee)
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold">อัตราค่าปรับ (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={loanInput.prepaymentFeeRate}
                            onChange={(e) => handlePrepaymentFeeRateChange(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 px-2 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold">ห้ามปิดก่อน (เดือน)</label>
                          <input
                            type="number"
                            value={loanInput.prepaymentLockMonths}
                            onChange={(e) => handlePrepaymentLockMonthsChange(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 px-2 py-1 text-[10px] font-bold rounded-lg text-center"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subsidized Advances / Subsidy Refunds */}
                    <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-extrabold text-indigo-900 flex items-center gap-1">
                          <PiggyBank className="w-4 h-4 text-indigo-500" />
                          ค่าจดจำนองทดรองจ่าย (Subsidy)
                        </span>
                        <input
                          type="checkbox"
                          checked={loanInput.receivesSubsidy}
                          onChange={(e) => handleReceivesSubsidyChange(e.target.checked)}
                          className="cursor-pointer accent-indigo-600 rounded"
                        />
                      </div>
                      
                      {loanInput.receivesSubsidy && (
                        <div className="space-y-2.5 pt-1.5 animate-fadeIn">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] text-slate-500 font-bold">ยอดจำนองสำรอง (฿)</label>
                              <input
                                type="number"
                                step="1000"
                                value={loanInput.subsidyAmount}
                                onChange={(e) => handleSubsidyAmountChange(Number(e.target.value))}
                                className="w-full bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold rounded"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-slate-500 font-bold">ห้ามย้ายก่อน (เดือน)</label>
                              <input
                                type="number"
                                value={loanInput.subsidyLockMonths}
                                onChange={(e) => handleSubsidyLockMonthsChange(Number(e.target.value))}
                                className="w-full bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold rounded text-center"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                              <span>ผ่อนผ่านมาแล้วกี่งวด (เดือน):</span>
                              <span className="text-indigo-600">{loanInput.elapsedMonths} / {loanInput.subsidyLockMonths} ด.</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="72"
                              value={loanInput.elapsedMonths}
                              onChange={(e) => handleElapsedMonthsChange(Number(e.target.value))}
                              className="w-full h-1 bg-slate-150 rounded cursor-pointer accent-indigo-600"
                            />
                            {loanInput.elapsedMonths < loanInput.subsidyLockMonths ? (
                              <p className="text-[8.5px] text-rose-500 font-medium">🚨 ย้ายค่ายตอนนี้ จะถูกเรียกคืนค่าจดจำนอง {formatCurrency(loanInput.subsidyAmount)} บาท!</p>
                            ) : (
                              <p className="text-[8.5px] text-emerald-600 font-medium">✅ ปลอดหนี้ค่าจดจำนองเดิมเป็นที่เรียบร้อย!</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Insurance Premium Cancellation Penalties */}
                    <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-extrabold text-amber-800 flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                          ค่าปรับเวนคืนประกัน (MRTA Penalty)
                        </span>
                        <input
                          type="checkbox"
                          checked={loanInput.hasInsurancePenalty}
                          onChange={(e) => handleHasInsurancePenaltyChange(e.target.checked)}
                          className="cursor-pointer accent-amber-600 rounded"
                        />
                      </div>
                      
                      {loanInput.hasInsurancePenalty && (
                        <div className="grid grid-cols-2 gap-2 pt-1 animate-fadeIn">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold">สัดส่วนค่าปรับสูงสุด (%)</label>
                            <input
                              type="number"
                              step="0.05"
                              value={loanInput.insurancePenaltyRate}
                              onChange={(e) => handleInsurancePenaltyRateChange(Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold rounded text-center"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold">ระยะปรับ (งวด)</label>
                            <input
                              type="number"
                              value={loanInput.insurancePenaltyMonths}
                              onChange={(e) => handleInsurancePenaltyMonthsChange(Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold rounded text-center"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>
            </div>

            {/* 3. INTERACTIVE PAYMENT LEDGER TABLE */}
            <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden flex flex-col">
              
              <div className="p-4 bg-slate-50 border-b border-slate-200 text-slate-800 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-extrabold tracking-wide uppercase flex items-center gap-1.5 text-emerald-900">
                    <ClipboardList className="w-4 h-4 text-emerald-600" />
                    2. ประวัติงวดผ่อนย้อนหลัง
                  </h4>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 font-bold">ระบุยอดและวันที่จ่ายจริงเพื่อหักเงินต้นแบบลดต้นลดดอก</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLoanInput(prev => ({ ...prev, historicalPayments: [] }))}
                    className="bg-rose-600/90 hover:bg-rose-500 text-white p-1 px-2 rounded-md transition-all cursor-pointer flex items-center gap-1 text-[10px] font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
                    title="เคลียประวัติทั้งหมด (Reset)"
                    disabled={loanInput.historicalPayments.length === 0}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <label 
                    title="นำเข้า CSV (DD/MM/YY,Amount)"
                    className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded-md transition cursor-pointer flex items-center justify-center"
                  >
                    <Import className="w-3.5 h-3.5" />
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleImportCsv} 
                      className="hidden" 
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLedgerRow}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded-md transition cursor-pointer"
                    title="เพิ่มงวดประวัติใหม่"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3.5 space-y-3">
                <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                        <th className="py-1.5 px-2 text-center">งวด</th>
                        <th className="py-1.5 px-2">วันที่จ่าย</th>
                        <th className="py-1.5 px-2 text-right">ยอดผ่อน (฿)</th>
                        <th className="py-1.5 px-2 text-center">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold font-mono text-slate-700">
                      {loanInput.historicalPayments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 font-normal">
                            ไม่มีประวัติตารางผ่อนย้อนหลัง กดปุ่มเพื่อเพิ่มงวด
                          </td>
                        </tr>
                      ) : (
                        loanInput.historicalPayments.map(pay => (
                          <tr key={pay.id} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-2 text-center text-slate-400 font-bold">
                              {pay.monthIndex}
                            </td>
                            <td className="py-1.5 px-1">
                              <LedgerDateInput 
                                initialValue={pay.payDate} 
                                onChange={(val) => handleUpdateLedgerRow(pay.id, "payDate", val)} 
                              />
                            </td>
                            <td className="py-1.5 px-1 text-right">
                              <LedgerAmountInput 
                                initialValue={pay.paymentAmount} 
                                onChange={(val) => handleUpdateLedgerRow(pay.id, "paymentAmount", val)} 
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteLedgerRow(pay.id)}
                                className="text-rose-500 hover:text-rose-700 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Ledger metrics outputs summaries */}
                {loanInput.historicalPayments.length > 0 && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden text-[9.5px]">
                    <div className="bg-slate-100/60 py-1.5 px-2.5 border-b border-slate-200 flex justify-between items-center">
                      <span className="font-extrabold text-slate-600">📋 ตารางแสดงผลการคำนวณลดต้นลดดอก</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-bold">Real Decrual</span>
                        <button
                          type="button"
                          onClick={() => setIsHistoryCalcTableCollapsed(!isHistoryCalcTableCollapsed)}
                          className="text-slate-500 hover:text-slate-800 p-0.5 transition-all cursor-pointer flex items-center justify-center rounded hover:bg-slate-200/60"
                          title={isHistoryCalcTableCollapsed ? "แสดงตาราง" : "ซ่อนตาราง"}
                        >
                          {isHistoryCalcTableCollapsed ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronUp className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {!isHistoryCalcTableCollapsed && (
                      <>
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-2.5 text-center">งวด</th>
                              <th className="py-2 px-2 text-right">ค่างวด (฿)</th>
                              <th className="py-2 px-2 text-right">ดอกเบี้ย (฿)</th>
                              <th className="py-2 px-2 text-right">ตัดเงินต้น (฿)</th>
                              <th className="py-2 px-2.5 text-right">ยอดคงเหลือปลาย (฿)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 font-semibold font-mono text-slate-700">
                            <tr className="bg-slate-50/50">
                              <td className="py-1.5 px-2.5 text-center text-slate-400 font-normal">แรกเริ่ม</td>
                              <td className="py-1.5 px-2 text-slate-300 text-right">-</td>
                              <td className="py-1.5 px-2 text-slate-300 text-right">-</td>
                              <td className="py-1.5 px-2 text-slate-300 text-right">-</td>
                              <td className="py-1.5 px-2.5 text-right text-slate-500 font-bold">{formatCurrency(loanInput.startingLoanAmount)}</td>
                            </tr>
                            {loanInput.historicalPayments.map(pay => (
                              <tr key={pay.id} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="py-1.5 px-2.5 text-center font-bold text-slate-500">
                                  {pay.monthIndex}
                                </td>
                                <td className="py-1.5 px-2 text-right text-slate-800">
                                  {formatCurrency(pay.paymentAmount)}
                                </td>
                                <td className="py-1.5 px-2 text-right text-rose-600">
                                  {formatCurrency(pay.interestCalculated)}
                                </td>
                                <td className="py-1.5 px-2 text-right text-emerald-600">
                                  {formatCurrency(pay.principalDeducted)}
                                </td>
                                <td className="py-1.5 px-2.5 text-right text-indigo-950 font-bold">
                                  {formatCurrency(pay.endingBalance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="bg-indigo-50/50 p-2.5 border-t border-slate-200/60 flex justify-between font-bold text-indigo-950 text-[10px]">
                          <span>ยอดคงเหลือ:</span>
                          <span className="font-mono text-[10.5px] font-black text-indigo-700">{formatCurrency(loanInput.historicalPayments[loanInput.historicalPayments.length - 1].endingBalance)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSyncBalanceFromLedger}
                  className="w-full bg-indigo-50 hover:bg-indigo-150 text-indigo-700 active:scale-95 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border border-indigo-100/50 cursor-pointer flex justify-center items-center gap-1.5"
                  disabled={loanInput.historicalPayments.length === 0}
                >
                  <Check className="w-3.5 h-3.5" />
                  ซิงค์เงินคงเหลือล่าสุดไปยัง "ยอดหนี้ต้นคงเหลือปัจจุบัน"
                </button>

                {/* DYNAMIC ANALYSIS, GRAPH & SIMULATION FOR THE PAST PAYMENTS */}
                {loanInput.historicalPayments.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-850 font-bold text-[11px]">
                        <TrendingUp className="w-4 h-4 text-indigo-600 animate-pulse" />
                        <span>เปรียบเทียบวงเงินผ่อนจริง vs ธนาคารกำหนด vs จำลองแผนโปะ</span>
                      </div>
                      
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setLedgerVisualTab("balance")}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            ledgerVisualTab === "balance"
                              ? "bg-white text-indigo-700 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          หนี้ต้นคงเหลือ
                        </button>
                        <button
                          type="button"
                          onClick={() => setLedgerVisualTab("payments")}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            ledgerVisualTab === "payments"
                              ? "bg-white text-indigo-700 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          ค่างวดรายงวด
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3.5 shadow-xs">
                      {/* CHART PLOT AREA */}
                      {(() => {
                        const sim = getComparisonSimulations();
                        if (!sim) return null;

                        const { standardTimeline, actualTimeline, simulatedTimeline } = sim;

                        // For balance rundown we add the contract start point at the beginning
                        const fullStandard = ledgerVisualTab === "balance"
                          ? [{ payDate: loanInput.contractStartDate, amount: 0, interest: 0, principal: 0, balance: loanInput.startingLoanAmount, monthIndex: "เริ่ม" }, ...standardTimeline]
                          : standardTimeline;
                        const fullActual = ledgerVisualTab === "balance"
                          ? [{ payDate: loanInput.contractStartDate, amount: 0, interest: 0, principal: 0, balance: loanInput.startingLoanAmount, monthIndex: "เริ่ม" }, ...actualTimeline]
                          : actualTimeline;
                        const fullSimulated = ledgerVisualTab === "balance"
                          ? [{ payDate: loanInput.contractStartDate, amount: 0, interest: 0, principal: 0, balance: loanInput.startingLoanAmount, monthIndex: "เริ่ม" }, ...simulatedTimeline]
                          : simulatedTimeline;

                        const M = fullActual.length;

                        if (ledgerVisualTab === "balance") {
                          // 1. Balance Run-down graph math
                          const maxVal = Math.max(
                            loanInput.startingLoanAmount,
                            ...fullStandard.map(t => t.balance),
                            ...fullActual.map(t => t.balance),
                            ...fullSimulated.map(t => t.balance)
                          );

                          const minVal = Math.min(
                            ...fullStandard.map(t => t.balance),
                            ...fullActual.map(t => t.balance),
                            ...fullSimulated.map(t => t.balance)
                          );

                          const diffY = maxVal - minVal || 1;

                          const getCoords = (idx: number, val: number) => {
                            const x = 50 + (idx / (M - 1 || 1)) * 420;
                            const rawPct = (maxVal - val) / diffY;
                            const pct = Math.max(0, Math.min(1, rawPct));
                            const y = 25 + pct * 150;
                            return { x, y };
                          };

                          let pStd = "";
                          let pAct = "";
                          let pSim = "";

                          fullStandard.forEach((t, i) => {
                            const { x, y } = getCoords(i, t.balance);
                            pStd += (i === 0 ? "M " : " L ") + `${x.toFixed(1)},${y.toFixed(1)}`;
                          });

                          fullActual.forEach((t, i) => {
                            const { x, y } = getCoords(i, t.balance);
                            pAct += (i === 0 ? "M " : " L ") + `${x.toFixed(1)},${y.toFixed(1)}`;
                          });

                          fullSimulated.forEach((t, i) => {
                            const { x, y } = getCoords(i, t.balance);
                            pSim += (i === 0 ? "M " : " L ") + `${x.toFixed(1)},${y.toFixed(1)}`;
                          });

                          return (
                            <div className="relative">
                              <p className="text-[10px] font-bold text-slate-400 mb-2 text-center">
                                กราฟยอดเงินต้นคงเหลือ (บาท)
                              </p>
                              
                              <svg viewBox="0 0 500 215" className="w-full h-auto overflow-visible select-none">
                                {/* Grid lines */}
                                {[0, 1, 2, 3, 4].map((tick) => {
                                  const val = maxVal - (diffY * tick) / 4;
                                  const y = 25 + (tick / 4) * 150;
                                  return (
                                    <g key={tick} className="opacity-40">
                                      <line x1="50" y1={y} x2="480" y2={y} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3,3" />
                                      <text x="45" y={y + 3} className="text-[8.5px] font-mono font-bold text-right text-slate-400" textAnchor="end">
                                        {val >= 1000000 ? `${(val/1000000).toFixed(2)}M` : `${(val/1000).toFixed(0)}k`}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Lines */}
                                <path d={pStd} fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4,2" className="opacity-60" />
                                <path d={pAct} fill="none" stroke="#059669" strokeWidth="2.5" />
                                <path d={pSim} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="3,1" />

                                {/* Interactive Dots */}
                                {fullActual.map((t, i) => {
                                  const cStd = getCoords(i, fullStandard[i]?.balance ?? t.balance);
                                  const cAct = getCoords(i, t.balance);
                                  const cSim = getCoords(i, fullSimulated[i]?.balance ?? t.balance);

                                  const isSelected = hoveredInstallmentIndex === i;

                                  return (
                                    <g key={i}>
                                      {/* Standard Dot */}
                                      <circle cx={cStd.x} cy={cStd.y} r={isSelected ? 4 : 2.5} fill="#f43f5e" />
                                      {/* Actual Dot */}
                                      <circle cx={cAct.x} cy={cAct.y} r={isSelected ? 5 : 3.5} fill="#059669" stroke="#fff" strokeWidth="1" />
                                      {/* Simulated Dot */}
                                      <circle cx={cSim.x} cy={cSim.y} r={isSelected ? 4 : 2.5} fill="#d97706" />

                                      {/* Hover sensor zone */}
                                      <rect
                                        x={cAct.x - 12}
                                        y="10"
                                        width="24"
                                        height="180"
                                        fill="transparent"
                                        className="cursor-pointer"
                                        onMouseEnter={() => setHoveredInstallmentIndex(i)}
                                        onMouseLeave={() => setHoveredInstallmentIndex(null)}
                                      />
                                    </g>
                                  );
                                })}

                                {/* Bottom labels - REVERSED to match visual curve left-to-right (old -> new) */}
                                {fullActual.map((t, i) => {
                                  const x = 50 + (i / (M - 1 || 1)) * 420;
                                  const labelStep = Math.max(1, Math.ceil(M / 6));
                                  const shouldShow = i === 0 || i === M - 1 || i % labelStep === 0;
                                  if (!shouldShow) return null;
                                  
                                  let labelText = t.monthIndex === "เริ่ม" ? "เริ่ม" : t.payDate.substring(0, 7);
                                  if (labelText !== "เริ่ม" && t.payDate) {
                                    const d = new Date(t.payDate);
                                    labelText = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
                                  }

                                  return (
                                    <text key={i} x={x} y="200" className="text-[8.5px] font-mono text-slate-400" textAnchor="middle">
                                      {labelText}
                                    </text>
                                  );
                                })}
                              </svg>

                              <div className="flex items-center justify-center gap-4 text-[9.5px] font-bold mt-2">
                                <span className="flex items-center gap-1 text-rose-500">
                                  <span className="w-3.5 h-0.5 border-t-2 border-rose-500 border-dashed inline-block"></span>
                                  ธนาคารกำหนด
                                </span>
                                <span className="flex items-center gap-1 text-emerald-600 font-extraboldIcon">
                                  <span className="w-3.5 h-0.5 border-t-2 border-emerald-600 inline-block"></span>
                                  จ่ายจริง
                                </span>
                                <span className="flex items-center gap-1 text-amber-600">
                                  <span className="w-3.5 h-0.5 border-t-2 border-amber-600 border-dotted inline-block"></span>
                                  จำลองโปะเพิ่ม
                                </span>
                              </div>
                            </div>
                          );
                        } else {
                          // 2. Payments comparison graph math
                          const maxPayment = Math.max(
                            ...fullStandard.map(t => t.amount),
                            ...fullActual.map(t => t.amount),
                            ...fullSimulated.map(t => t.amount),
                            5000
                          ) * 1.12;

                          const getCoords = (idx: number, val: number) => {
                            const x = 50 + (idx / (M - 1 || 1)) * 420;
                            const y = 25 + (1 - val / maxPayment) * 150;
                            return { x, y };
                          };

                          let pStd = "";
                          let pAct = "";
                          let pSim = "";

                          fullStandard.forEach((t, i) => {
                            const { x, y } = getCoords(i, t.amount);
                            pStd += (i === 0 ? "M " : " L ") + `${x.toFixed(1)},${y.toFixed(1)}`;
                          });

                          fullActual.forEach((t, i) => {
                            const { x, y } = getCoords(i, t.amount);
                            pAct += (i === 0 ? "M " : " L ") + `${x.toFixed(1)},${y.toFixed(1)}`;
                          });

                          fullSimulated.forEach((t, i) => {
                            const { x, y } = getCoords(i, t.amount);
                            pSim += (i === 0 ? "M " : " L ") + `${x.toFixed(1)},${y.toFixed(1)}`;
                          });

                          return (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 mb-2 text-center">
                                เปรียบเทียบยอดการส่งค่างวดต่องวดชำระ (บาท)
                              </p>

                              <svg viewBox="0 0 500 215" className="w-full h-auto overflow-visible select-none">
                                {/* Grid lines */}
                                {[0, 1, 2, 3, 4].map((tick) => {
                                  const val = maxPayment - (maxPayment * tick) / 4;
                                  const y = 25 + (tick / 4) * 150;
                                  return (
                                    <g key={tick} className="opacity-40">
                                      <line x1="50" y1={y} x2="480" y2={y} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3,3" />
                                      <text x="45" y={y + 3} className="text-[8.5px] font-mono font-bold text-right text-slate-400" textAnchor="end">
                                        {formatCurrency(val).replace("฿", "")}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Lines */}
                                <path d={pStd} fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4,2" className="opacity-60" />
                                <path d={pAct} fill="none" stroke="#059669" strokeWidth="2.5" />
                                <path d={pSim} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="3,1" />

                                {/* Interactive Dots */}
                                {fullActual.map((t, i) => {
                                  const cStd = getCoords(i, fullStandard[i]?.amount ?? t.amount);
                                  const cAct = getCoords(i, t.amount);
                                  const cSim = getCoords(i, fullSimulated[i]?.amount ?? t.amount);

                                  const isSelected = hoveredInstallmentIndex === i;

                                  return (
                                    <g key={i}>
                                      <circle cx={cStd.x} cy={cStd.y} r={isSelected ? 4 : 2.5} fill="#f43f5e" />
                                      <circle cx={cAct.x} cy={cAct.y} r={isSelected ? 5 : 3.5} fill="#059669" stroke="#fff" strokeWidth="1" />
                                      <circle cx={cSim.x} cy={cSim.y} r={isSelected ? 4 : 2.5} fill="#d97706" />

                                      {/* Sensor zone */}
                                      <rect
                                        x={cAct.x - 12}
                                        y="10"
                                        width="24"
                                        height="180"
                                        fill="transparent"
                                        className="cursor-pointer"
                                        onMouseEnter={() => setHoveredInstallmentIndex(i)}
                                        onMouseLeave={() => setHoveredInstallmentIndex(null)}
                                      />
                                    </g>
                                  );
                                })}

                                {/* Bottom labels - REVERSED to match visual curve left-to-right (old -> new) */}
                                {fullActual.map((t, i) => {
                                  const x = 50 + (i / (M - 1 || 1)) * 420;
                                  const labelStep = Math.max(1, Math.ceil(M / 6));
                                  const shouldShow = i === 0 || i === M - 1 || i % labelStep === 0;
                                  if (!shouldShow) return null;
                                  
                                  let labelText = (t.monthIndex === "แรกเริ่ม" || t.monthIndex === "เริ่ม") ? "เริ่ม" : t.payDate.substring(0, 7);
                                  if (labelText !== "เริ่ม" && t.payDate) {
                                    const d = new Date(t.payDate);
                                    labelText = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
                                  }

                                  return (
                                    <text key={i} x={x} y="200" className="text-[8.5px] font-mono text-slate-400" textAnchor="middle">
                                      {labelText}
                                    </text>
                                  );
                                })}
                              </svg>

                              <div className="flex items-center justify-center gap-4 text-[9.5px] font-bold mt-2">
                                <span className="flex items-center gap-1 text-rose-500">
                                  <span className="w-3.5 h-0.5 border-t-2 border-rose-500 border-dashed inline-block"></span>
                                  ธนาคารกำหนด
                                </span>
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <span className="w-3.5 h-0.5 border-t-2 border-emerald-600 inline-block"></span>
                                  จ่ายจริง
                                </span>
                                <span className="flex items-center gap-1 text-amber-600 font-extraboldIcon">
                                  <span className="w-3.5 h-0.5 border-t-2 border-amber-600 border-dotted inline-block"></span>
                                  จำลองโปะเพิ่ม
                                </span>
                              </div>
                            </div>
                          );
                        }
                      })()}

                      {/* Tooltip Card for hovered point */}
                      {hoveredInstallmentIndex !== null && (() => {
                        const sim = getComparisonSimulations();
                        if (!sim) return null;
                        const { standardTimeline, actualTimeline, simulatedTimeline } = sim;

                        const fullStandard = ledgerVisualTab === "balance"
                          ? [{ payDate: loanInput.contractStartDate, amount: 0, interest: 0, principal: 0, balance: loanInput.startingLoanAmount, monthIndex: "แรกเริ่ม" }, ...standardTimeline]
                          : standardTimeline;
                        const fullActual = ledgerVisualTab === "balance"
                          ? [{ payDate: loanInput.contractStartDate, amount: 0, interest: 0, principal: 0, balance: loanInput.startingLoanAmount, monthIndex: "แรกเริ่ม" }, ...actualTimeline]
                          : actualTimeline;
                        const fullSimulated = ledgerVisualTab === "balance"
                          ? [{ payDate: loanInput.contractStartDate, amount: 0, interest: 0, principal: 0, balance: loanInput.startingLoanAmount, monthIndex: "แรกเริ่ม" }, ...simulatedTimeline]
                          : simulatedTimeline;

                        const i = hoveredInstallmentIndex;
                        const act = fullActual[i];
                        const std = fullStandard[i];
                        const sml = fullSimulated[i];

                        if (!act || !std || !sml) return null;

                        const isStartNode = ledgerVisualTab === "balance" && i === 0;

                        return (
                          <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl p-4 text-[11px] shadow-lg space-y-2.5 animate-fadeIn">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                              <span className="font-extrabold text-[10.5px] text-indigo-700 uppercase">
                                {isStartNode ? "ตอนเริ่มต้นสัญญากู้" : `รายละเอียดค่างวดที่ ${act.monthIndex}`}
                              </span>
                              <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200/50">{act.payDate}</span>
                            </div>
                            {isStartNode ? (
                              <div className="text-center py-2 bg-indigo-50/50 border border-indigo-100/30 rounded-xl">
                                <p className="text-[10px] text-indigo-900 font-bold">ยอดหนี้เงินต้นเริ่มแรกกู้</p>
                                <p className="font-bold font-mono text-base text-indigo-700 mt-0.5">{formatCurrency(act.balance)}</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
                                <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                                  <p className="text-[8.5px] text-rose-600 font-bold uppercase tracking-wider">ธนาคารเรียกเก็บ</p>
                                  <p className="font-bold font-mono text-[13px] text-rose-700 mt-1">{formatCurrency(std.amount)}</p>
                                  <div className="text-[8px] text-slate-500 font-mono mt-1.5 border-t border-rose-200/40 pt-1 leading-normal">
                                    <div>ดอกเบี้ย {formatCurrency(std.interest)}</div>
                                    <div>ตัดต้น {formatCurrency(std.principal)}</div>
                                  </div>
                                </div>
                                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                  <p className="text-[8.5px] text-emerald-600 font-bold uppercase tracking-wider">ยอดชำระจริง</p>
                                  <p className="font-bold font-mono text-[13px] text-emerald-700 mt-1">{formatCurrency(act.amount)}</p>
                                  <div className="text-[8px] text-slate-500 font-mono mt-1.5 border-t border-emerald-200/40 pt-1 leading-normal">
                                    <div>ดอกเบี้ย {formatCurrency(act.interest)}</div>
                                    <div>ตัดต้น {formatCurrency(act.principal)}</div>
                                  </div>
                                </div>
                                <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
                                  <p className="text-[8.5px] text-amber-600 font-bold uppercase tracking-wider">ยอดตามแผนจำลองโปะ</p>
                                  <p className="font-bold font-mono text-[13px] text-amber-700 mt-1">{formatCurrency(sml.amount)}</p>
                                  <div className="text-[8px] text-slate-500 font-mono mt-1.5 border-t border-amber-200/40 pt-1 leading-normal">
                                    <div>ดอกเบี้ย {formatCurrency(sml.interest)}</div>
                                    <div>ตัดต้น {formatCurrency(sml.principal)}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="pt-2 flex justify-between items-center text-[9.5px] text-slate-500 border-t border-slate-100">
                              <span>ยอดเงินต้นคงเหลือหลังชำระ:</span>
                              <span className="font-mono">
                                ผ่อนจริง: <strong className="text-emerald-600">{formatCurrency(act.balance)}</strong> • 
                                ธนาคารกำหนด: <strong className="text-rose-600">{formatCurrency(std.balance)}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* INTERPRETATION & INSIGHTS (แปลผลลัพธ์) */}
                    {(() => {
                      const sim = getComparisonSimulations();
                      if (!sim) return null;
                      const { stats } = sim;
                      
                      const actualPaid = stats.actual.totalPaid;
                      const standardPaid = stats.standard.totalPaid;
                      const actualInterest = stats.actual.totalInterest;
                      const standardInterest = stats.standard.totalInterest;
                      const actualEnding = stats.actual.endingBalance;
                      const standardEnding = stats.standard.endingBalance;

                      const diffPaid = actualPaid - standardPaid; 
                      const diffInterest = standardInterest - actualInterest; 
                      const diffPrincipal = standardEnding - actualEnding; 

                      const behavesExtra = diffPaid > 1000;

                      return (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-3 shadow-xs">
                          <p className="font-extrabold text-slate-750 flex items-center gap-1.5 text-[11.5px]">
                            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                            <span>แปลผลประวัติการผ่อนชำระย้อนหลัง จ่ายจริง vs ธนาคารกำหนด</span>
                          </p>

                          <div className="grid grid-cols-2 gap-2 text-center font-bold text-[10px]">
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col justify-center">
                              <span className="text-[9px] text-slate-400">ประหยัดค่าดอกเบี้ยสะสมแล้ว</span>
                              <span className="text-sm font-black text-emerald-700 font-mono mt-0.5">
                                {diffInterest > 0 ? formatCurrency(diffInterest) : "฿0"}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col justify-center">
                              <span className="text-[9px] text-slate-400">หักเงินต้นตัดหนี้บ้านเร็วขึ้น</span>
                              <span className="text-sm font-black text-indigo-700 font-mono mt-0.5">
                                {diffPrincipal > 0 ? formatCurrency(diffPrincipal) : "฿0"}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-600 leading-relaxed space-y-2 bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                            {behavesExtra ? (
                              <p>
                                🎉 <strong>ยอดเยี่ยม!</strong> ยอดรวมชำระสะสมของท่านสูงกว่ายอดกำหนดขั้นต่ำอยู่ 
                                <strong className="text-emerald-600 font-mono"> {formatCurrency(diffPaid)}</strong> เงินก้อนนี้ตัดหนี้ตรงไปที่เงินต้น ทำให้เงินต้นลดลงต่ำกว่ากำหนดถึง 
                                <strong className="text-indigo-600 font-mono"> {formatCurrency(diffPrincipal)}</strong> ซึ่งทำให้ท่าน<strong>ประหยัดดอกเบี้ยสะสมไปแล้วถึง {formatCurrency(diffInterest)}</strong> ช่วยย่นระยะเวลาหนี้บ้านและให้เป็นอิสระทางการเงินได้เร็วขึ้น!
                              </p>
                            ) : diffPaid < -1000 ? (
                              <p>
                                ⚠️ <strong>โปรดระมัดระวัง!</strong> ยอดผ่อนชำระจริงของท่านน้อยกว่างวดขั้นต่ำตามสัญญารวม 
                                <strong className="text-rose-600 font-mono"> {formatCurrency(Math.abs(diffPaid))}</strong> ส่งผลให้ยอดหนี้ลดช้ามาก ดอกเบี้ยสะสมเพิ่มพูน แนะนำให้ปรับยอดหรือติดต่อสาขาเพื่อตรวจสอบ
                              </p>
                            ) : (
                              <p>
                                📈 <strong>วิเคราะห์ยอดผ่อน:</strong> ท่านชำระยอดสะสมเท่าเกณฑ์ควบคุมของสัญญากู้เดิมแบบมาตรฐาน ยอดเงินต้นลดลงตามแบบฉบับ ลดต้น-ลดดอก มีความปลอดภัยและวินัยทางการเงินที่ดีเยี่ยม
                              </p>
                            )}

                            <p className="text-[9.5px] text-slate-400 pt-1.5 border-t border-slate-100 mt-1.5 font-semibold">
                              * สถิตินี้คำนวณจากค่างวดจริงและช่วงระยะเวลารายวัน (Daily Compounding Amortization) เพื่อความเที่ยงตรงเทียบเท่าเคาน์เตอร์ธนาคาร
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* SIMULATION SCENARIO SLIDER BLOCK */}
                    <div className="bg-indigo-950/5 border border-indigo-150 rounded-2xl p-4 space-y-3.5 text-xs shadow-2xs">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-indigo-600" />
                          จำลองยอดรวมชำระต่องวด
                        </span>
                        <span className="bg-indigo-600 text-white font-mono font-bold text-[10.5px] px-2 py-0.5 rounded-lg shadow-sm">
                          {formatCurrency(simulatedTotalPayment)} /ด.
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 leading-normal font-medium">
                        ทดลองขยับแถบเลื่อนด้านล่างเพื่อกำหนด **"ยอดรวมชำระต่องวดทั้งหมด"** (ค่างวดหลัก + ยอดที่ต้องการโปะเพิ่ม) และวิเคราะห์ผลของการลดหนี้บ้านให้หมดเร็วยิ่งขึ้น
                      </p>

                      <div className="flex items-center gap-4 py-0.5">
                        <input
                          type="range"
                          min={loanInput.currentInstallment}
                          max={loanInput.currentInstallment + 50000}
                          step="1000"
                          value={simulatedTotalPayment}
                          onChange={(e) => setSimulatedTotalPayment(Number(e.target.value))}
                          className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setSimulatedTotalPayment(loanInput.currentInstallment)}
                          className="text-[10.5px] text-indigo-600 hover:text-indigo-800 font-extrabold underline cursor-pointer shrink-0 transition-colors whitespace-nowrap lg:whitespace-normal"
                        >
                          จ่ายปกติ (ไม่มีโปะ)
                        </button>
                      </div>

                      {(() => {
                        const sim = getComparisonSimulations();
                        if (!sim) return null;
                        const { stats } = sim;
                        const savedInterest = stats.standard.totalInterest - stats.simulated.totalInterest;
                        const excessPrincipal = stats.standard.endingBalance - stats.simulated.endingBalance;

                        if (simulatedPrepayAmount === 0) {
                          return (
                            <p className="text-[10px] text-slate-400 text-center font-bold bg-white rounded-lg py-2 border border-dashed border-slate-205">
                              ลองปรับเลื่อนแผนผ่อนเพื่อดูวงเงินเซฟดอกเบี้ยเพิ่มเติมต่องวดชำระ
                            </p>
                          );
                        }

                        return (
                          <div className="bg-white rounded-xl p-3 border border-indigo-100 text-[11px] leading-relaxed text-indigo-950 font-bold shadow-2xs">
                            💡 ผลของการชำระยอดรวมคงที่งวดละ <strong>{formatCurrency(simulatedTotalPayment)}</strong> (โปะเพิ่มเดือนละ {formatCurrency(simulatedPrepayAmount)}): 
                            จะทำให้ท่านสามารถ<strong>เซฟดอกเบี้ยสะสมไปได้ถึง {formatCurrency(savedInterest)}</strong> บาท 
                            และตัดยอดเงินต้นคงเหลือลดลงได้ดีกว่าแผนผ่อนเกณฑ์เดิม <strong>{formatCurrency(excessPrincipal)}</strong> บาท!
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* 2.5 ORIGINAL BANK RATE OFFERS AND 3-YEAR CALCULATION COMPARISON */}
            <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-slate-850">
                <div>
                  <h4 className="text-xs font-extrabold tracking-wide uppercase flex items-center gap-1.5 text-emerald-900">
                    <Percent className="w-4 h-4 text-emerald-600" />
                    3. RETENTION
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1 font-bold">
                    กรอกอัตราดอกเบี้ยและค่าผ่อนปัจจุบัน พร้อมคำนวณเปรียบเทียบดอกเบี้ยรวม 3 ปี
                  </p>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Bank / MRR Display */}
                <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">ธนาคารเดิมปัจจุบัน:</span>
                    {(() => {
                      const cb = banksList.find(b => b.id === currentBankId);
                      return (
                        <span className="text-indigo-700 font-extrabold font-sans">
                          {cb ? cb.nameTh : "ธนาคารเดิม"}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">ค่า MRR ของธนาคารเดิม (%):</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px] font-bold">MRR ปัจจุบัน:</span>
                      <span className="font-mono font-bold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded border border-slate-200">
                        {currentBankMrrVal.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date Retention Started */}
                <div className="bg-indigo-50/50 border border-indigo-150 p-2.5 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-indigo-900">วันที่เริ่มสัญญา Retention ใหม่:</span>
                    <span className="font-bold text-indigo-700 font-mono text-[11px]">{loanInput.retentionStartDate}</span>
                  </div>
                  <input
                    type="date"
                    value={loanInput.retentionStartDate}
                    onChange={(e) => handleRetentionStartDateChange(e.target.value)}
                    className="w-full bg-white border border-indigo-200 focus:border-indigo-500 rounded-lg py-1 px-2.5 text-xs font-bold text-slate-850 outline-none transition"
                  />
                  <p className="text-[9px] text-indigo-950 font-semibold leading-relaxed">
                    💡 กำหนดปฏิทินรอบลดดอกเบี้ยเมื่อครบ 3 ปี (ตั้งค่าเริ่มต้นเป็นวันที่เริ่มสัญญาเดิม + 3 ปี) เพื่อใช้คำนวณวันจริงงวดที่ 1 - 36
                  </p>
                </div>

                    {/* Grid of Year 1, 2, 3, 4+ rate configurations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Year 1 */}
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10.5px] font-black text-slate-700">ปีที่ 1</span>
                          <span className="text-[9px] text-emerald-700 font-mono bg-emerald-50 px-1 py-0.2 rounded font-black">
                            {origSimRates.yr1.type === 'fixed'
                              ? `${origSimRates.yr1.value.toFixed(2)}%`
                              : `MRR-${Math.abs(origSimRates.yr1.value).toFixed(2)}% (${resolveRate(currentBankMrrVal, origSimRates.yr1).toFixed(2)}%)`
                            }
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={origSimRates.yr1.type}
                            onChange={(e) => handleOrigSimRateChange("yr1", "type", e.target.value)}
                            className="bg-white border border-slate-200 px-1 py-0.5 text-[10px] font-bold rounded-lg text-slate-600 outline-none"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="mrr">MRR Mod</option>
                          </select>
                          <input
                            type="number"
                            step="0.05"
                            value={origSimRates.yr1.type === 'mrr' ? Math.abs(origSimRates.yr1.value) : origSimRates.yr1.value}
                            onChange={(e) => handleOrigSimRateChange("yr1", "value", Number(e.target.value))}
                            className="bg-white border border-slate-200 px-1 py-0.5 text-[10px] font-bold rounded-lg text-center outline-none w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[8.5px] text-slate-400 block font-bold leading-none mt-1">ค่างวดผ่อนปีที่ 1 (บาท/เดือน)</label>
                          <input
                            type="number"
                            step="500"
                            value={origSimInstallments.yr1}
                            onChange={(e) => setOrigSimInstallments(prev => ({...prev, yr1: Number(e.target.value)}))}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg mt-0.5 outline-none"
                          />
                        </div>
                      </div>

                      {/* Year 2 */}
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10.5px] font-black text-slate-700">ปีที่ 2</span>
                          <span className="text-[9px] text-emerald-700 font-mono bg-emerald-50 px-1 py-0.2 rounded font-black">
                            {origSimRates.yr2.type === 'fixed'
                              ? `${origSimRates.yr2.value.toFixed(2)}%`
                              : `MRR-${Math.abs(origSimRates.yr2.value).toFixed(2)}% (${resolveRate(currentBankMrrVal, origSimRates.yr2).toFixed(2)}%)`
                            }
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={origSimRates.yr2.type}
                            onChange={(e) => handleOrigSimRateChange("yr2", "type", e.target.value)}
                            className="bg-white border border-slate-200 px-1 py-0.5 text-[10px] font-bold rounded-lg text-slate-600 outline-none"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="mrr">MRR Mod</option>
                          </select>
                          <input
                            type="number"
                            step="0.05"
                            value={origSimRates.yr2.type === 'mrr' ? Math.abs(origSimRates.yr2.value) : origSimRates.yr2.value}
                            onChange={(e) => handleOrigSimRateChange("yr2", "value", Number(e.target.value))}
                            className="bg-white border border-slate-200 px-1 py-0.5 text-[10px] font-bold rounded-lg text-center outline-none w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[8.5px] text-slate-400 block font-bold leading-none mt-1">ค่างวดผ่อนปีที่ 2 (บาท/เดือน)</label>
                          <input
                            type="number"
                            step="500"
                            value={origSimInstallments.yr2}
                            onChange={(e) => setOrigSimInstallments(prev => ({...prev, yr2: Number(e.target.value)}))}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg mt-0.5 outline-none"
                          />
                        </div>
                      </div>

                      {/* Year 3 */}
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10.5px] font-black text-slate-700">ปีที่ 3</span>
                          <span className="text-[9px] text-emerald-700 font-mono bg-emerald-50 px-1 py-0.2 rounded font-black">
                            {origSimRates.yr3.type === 'fixed'
                              ? `${origSimRates.yr3.value.toFixed(2)}%`
                              : `MRR-${Math.abs(origSimRates.yr3.value).toFixed(2)}% (${resolveRate(currentBankMrrVal, origSimRates.yr3).toFixed(2)}%)`
                            }
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={origSimRates.yr3.type}
                            onChange={(e) => handleOrigSimRateChange("yr3", "type", e.target.value)}
                            className="bg-white border border-slate-200 px-1 py-0.5 text-[10px] font-bold rounded-lg text-slate-600 outline-none"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="mrr">MRR Mod</option>
                          </select>
                          <input
                            type="number"
                            step="0.05"
                            value={origSimRates.yr3.type === 'mrr' ? Math.abs(origSimRates.yr3.value) : origSimRates.yr3.value}
                            onChange={(e) => handleOrigSimRateChange("yr3", "value", Number(e.target.value))}
                            className="bg-white border border-slate-200 px-1 py-0.5 text-[10px] font-bold rounded-lg text-center outline-none w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[8.5px] text-slate-400 block font-bold leading-none mt-1">ค่างวดผ่อนปีที่ 3 (บาท/เดือน)</label>
                          <input
                            type="number"
                            step="500"
                            value={origSimInstallments.yr3}
                            onChange={(e) => setOrigSimInstallments(prev => ({...prev, yr3: Number(e.target.value)}))}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg mt-0.5 outline-none"
                          />
                        </div>
                      </div>

                      {/* Year 4+ */}
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10.5px] font-black text-slate-700">ปีที่ 4+</span>
                          <span className="text-[9px] text-emerald-700 font-mono bg-emerald-50 px-1 py-0.2 rounded font-black">
                            {origSimRates.yr4Plus.type === 'fixed'
                              ? `${origSimRates.yr4Plus.value.toFixed(2)}%`
                              : `MRR-${Math.abs(origSimRates.yr4Plus.value).toFixed(2)}% (${resolveRate(currentBankMrrVal, origSimRates.yr4Plus).toFixed(2)}%)`
                            }
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={origSimRates.yr4Plus.type}
                            onChange={(e) => handleOrigSimRateChange("yr4Plus", "type", e.target.value)}
                            className="bg-white border border-slate-200 px-1 py-0.5 text-[10px] font-bold rounded-lg text-slate-600 outline-none"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="mrr">MRR Mod</option>
                          </select>
                          <input
                            type="number"
                            step="0.05"
                            value={origSimRates.yr4Plus.type === 'mrr' ? Math.abs(origSimRates.yr4Plus.value) : origSimRates.yr4Plus.value}
                            onChange={(e) => handleOrigSimRateChange("yr4Plus", "value", Number(e.target.value))}
                            className="bg-white border border-slate-200 px-1 py-0.5 text-[10px] font-bold rounded-lg text-center outline-none w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[8.5px] text-slate-400 block font-bold leading-none mt-1">ค่างวดผ่อนปีที่ 4+ (บาท/เดือน)</label>
                          <input
                            type="number"
                            step="500"
                            value={origSimInstallments.yr4Plus}
                            onChange={(e) => setOrigSimInstallments(prev => ({...prev, yr4Plus: Number(e.target.value)}))}
                            className="w-full bg-white border border-slate-200 px-1.5 py-1 text-[10px] font-bold rounded-lg mt-0.5 outline-none"
                          />
                        </div>
                      </div>
                    </div>


                    {/* Fire Insurance for Retention */}
                    <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-3/2">
                      <div className="flex items-center gap-1.5 pb-2 border-b border-slate-200">
                        <Flame className="w-4 h-4 text-orange-600" />
                        <span className="text-[11px] font-black text-slate-800">
                          ค่าประกันอัคคีภัย (สำหรับ Retention สัญญาเดิม)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Premium */}
                        <div>
                          <label className="text-[9px] text-slate-500 font-extrabold uppercase font-sans block mb-1">
                            เบี้ยประกันภัยอัคคีภัย (บาท)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={retentionFirePremium}
                            onChange={(e) => setRetentionFirePremium(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg py-1 px-2 text-[11px] font-mono font-bold text-slate-800 outline-none transition"
                            placeholder="0"
                          />
                        </div>
                        {/* Duration */}
                        <div>
                          <label className="text-[9px] text-slate-500 font-extrabold uppercase font-sans block mb-1">
                            ระยะเวลาคุ้มครอง (ปี)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={retentionFireDuration}
                            onChange={(e) => setRetentionFireDuration(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg py-1 px-2 text-[11px] font-mono font-bold text-slate-800 outline-none transition"
                            placeholder="3"
                          />
                        </div>
                        {/* Sum Insured */}
                        <div>
                          <label className="text-[9px] text-slate-500 font-extrabold uppercase font-sans block mb-1">
                            ทุนประกันภัย (บาท)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="50000"
                            value={retentionFireSumInsured}
                            onChange={(e) => setRetentionFireSumInsured(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg py-1 px-2 text-[11px] font-mono font-bold text-slate-800 outline-none transition"
                            placeholder="2,500,000"
                          />
                        </div>
                      </div>
                    </div>


                {/* 3-Year Amortization Interest Calculation Results */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 space-y-3">
                  <p className="text-[11px] font-black text-indigo-950 flex items-center gap-1">
                    <TrendingDown className="w-4 h-4 text-indigo-600" />
                    <span>สรุปดอกเบี้ยบ้าน 3 ปีแรกจากสัญญาปัจจุบัน</span>
                  </p>

                  <div className="flex items-center gap-1 text-[8.5px] text-indigo-700 font-bold bg-white/50 px-2 py-1 rounded">
                    <HelpCircle className="w-3 h-3 shrink-0" />
                    <span>คำนวณลดต้นลดดอกรายวันจริง: ยอดเงินต้นคงเหลือ × (อัตราดอกเบี้ยต่อปี ÷ 100) ÷ 365 × จำนวนวันในเดือน</span>
                  </div>
                  
                  {/* Prepayment Input Simulation replaced with Simulated Total Monthly Payment */}
                  <div className="bg-white/50 p-2 rounded-lg border border-indigo-100/50">
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">
                      จำลองยอดชำระรวมต่องวด (บาท):
                    </label>
                    <input
                      type="number"
                      step="1000"
                      min={loanInput.currentInstallment}
                      value={simulatedTotalPayment}
                      onChange={(e) => setSimulatedTotalPayment(Number(e.target.value))}
                      className="w-full bg-white border border-slate-250 px-2 py-1.5 text-[11.5px] font-bold rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors"
                    />
                    <p className="text-[8.5px] text-slate-500 font-semibold mt-1">
                      * ผ่อนปกติ {formatCurrency(loanInput.currentInstallment)} บาท/ด. (เป็นยอดโปะ {formatCurrency(simulatedPrepayAmount)} บาท/ด.)
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-[10.5px]">
                    {/* Standard Case */}
                    <div className="flex justify-between items-center font-bold text-slate-700">
                      <span>1) ดอกเบี้ย 3 ปี (ยอดผ่อนปกติธนาคาร):</span>
                      <span className="font-mono text-sm font-extrabold text-slate-950 border-b border-dashed border-slate-400">
                        {formatCurrency(standardInt)}
                      </span>
                    </div>
                    
                    {/* Actual Prepayment Case */}
                    <div className="flex justify-between items-center font-bold text-emerald-800">
                      <span>2) ดอกเบี้ย 3 ปี (ผ่อนจริงรวม {formatCurrency(simulatedTotalPayment)}/ด.):</span>
                      <span className="font-mono text-sm font-extrabold text-emerald-900 border-b border-dashed border-emerald-400">
                        {formatCurrency(actualInt)}
                      </span>
                    </div>

                    {/* Retention Fire Insurance premium */}
                    <div className="flex justify-between items-center font-semibold text-slate-600 text-[10px] bg-slate-100/50 p-1.5 rounded border border-slate-200">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span>ค่าเบี้ยประกันภัยอัคคีภัยสัญญานี้ ({retentionFireDuration} ปี ทุน {formatCurrency(retentionFireSumInsured)}):</span>
                      </span>
                      <span className="font-mono text-slate-800 font-bold">
                        {formatCurrency(retentionFirePremium)}
                      </span>
                    </div>

                    {/* Total interest + fire insurance */}
                    <div className="flex justify-between items-center font-bold text-indigo-900 text-[10.5px]">
                      <span>รวม (ดอกเบี้ยผ่อนปกติ + อัคคีภัย 3 ปี):</span>
                      <span className="font-mono text-indigo-950 font-black">
                        {formatCurrency(standardInt + retentionFirePremium)}
                      </span>
                    </div>

                    {/* Saving Difference */}
                    {savings > 0 && (
                      <div className="pt-2 border-t border-indigo-200/50 flex justify-between items-center font-black text-emerald-700 text-[11px]">
                        <span>💡 เซฟเงินค่าดอกเบี้ยไปได้:</span>
                        <span className="font-mono text-sm font-black bg-emerald-100 px-2 py-0.5 rounded-lg text-emerald-800">
                          +{formatCurrency(savings)} บาท
                        </span>
                      </div>
                    )}

                    {/* Toggle button for monthly calculation schedule table */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowStdAmortizationTable(!showStdAmortizationTable)}
                        className="w-full text-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{showStdAmortizationTable ? "📊 ซ่อนตารางคำนวณดอกเบี้ย 3 ปี" : "📊 แสดงตารางคำนวณดอกเบี้ย 3 ปี"}</span>
                      </button>
                    </div>

                    {showStdAmortizationTable && (
                      <div className="mt-3 bg-white border border-indigo-150 rounded-lg overflow-hidden animate-fadeIn text-[9px] max-h-[320px] overflow-y-auto">
                        <div className="flex bg-slate-100 border-b border-indigo-150 p-1 sticky top-0 z-10 gap-1 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setAmortTableType("standard")}
                            className={`flex-1 py-1 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                              amortTableType === "standard"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            ตารางแบบปกติ ({formatCurrency(loanInput.currentInstallment)}/ด.)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmortTableType("simulated")}
                            className={`flex-1 py-1 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                              amortTableType === "simulated"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            ตารางแบบจำลอง ({formatCurrency(simulatedTotalPayment)}/ด.)
                          </button>
                        </div>
                        <table className="w-full border-collapse">
                          <thead className="bg-indigo-50/80 text-indigo-950 font-black border-b border-indigo-200 sticky top-[34px] z-10 bg-indigo-100">
                            <tr>
                              <th className="py-1 px-1.5 text-center">งวดที่</th>
                              <th className="py-1 px-1.5 text-center">ระยะเวลาคำนวณ (วัน)</th>
                              <th className="py-1 px-1.5 text-right">เงินต้นคงเหลือ (บาท)</th>
                              <th className="py-1 px-1.5 text-right">ดอกเบี้ย (บาท)</th>
                              <th className="py-1 px-1.5 text-right">ค่างวด (บาท)</th>
                              <th className="py-1 px-1.5 text-right">ตัดเงินต้น (บาท)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-50 font-medium text-slate-700">
                            {(amortTableType === "standard" ? standardSchedule : actualSchedule).map((row) => (
                              <tr key={row.month} className="hover:bg-indigo-50/40 font-mono">
                                <td className="py-1 px-1.5 text-center text-indigo-850 font-bold">{row.month}</td>
                                <td className="py-1 px-1.5 text-center text-slate-500 font-medium whitespace-nowrap">
                                  {row.dateRange} <span className="font-bold text-indigo-600">({row.days} วัน)</span>
                                </td>
                                <td className="py-1 px-1.5 text-right">{formatCurrency(row.begBal)}</td>
                                <td className="py-1 px-1.5 text-right text-rose-700 font-bold">{formatCurrency(row.interest)}</td>
                                <td className="py-1 px-1.5 text-right font-semibold text-slate-800">{formatCurrency(row.payment)}</td>
                                <td className="py-1 px-1.5 text-right text-emerald-700">{formatCurrency(row.principal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="font-bold text-[8.5px] p-2 bg-indigo-50/50 border-t border-indigo-100 text-indigo-950 space-y-0.5 leading-relaxed">
                          <p>💡 <strong>สูตรคำนวณดอกเบี้ยแต่ละงวดแบบรายวันจริง:</strong></p>
                          <p className="bg-white/80 p-1 rounded border border-indigo-100 font-mono text-[8px]">
                            ดอกเบี้ย = ยอดเงินต้นคงเหลือ × (อัตราดอกเบี้ยต่อปี ÷ 100) ÷ 365 × จำนวนวันในงวด
                          </p>
                          <p>เงินที่ชำระปกติจะหักดอกเบี้ยออกก่อน ยอดเงินที่เหลือจะนำไปชำระเงินต้น ส่งผลให้ยอดเงินต้นสะสมลดลงต่อเนื่อง (ลดต้นลดดอกเฉลี่ยรายวันจริง)</p>
                          <p className="text-indigo-950">รวมดอกเบี้ยที่ต้องจ่าย 3 ปี (36 เดือน) = <strong className="text-red-700 font-mono text-[10px]">{formatCurrency(amortTableType === "standard" ? standardInt : actualInt)} บาท</strong></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* 2. TABBED CUSTOM RATE EDITORS AND TRANSACTIONAL COST PANELS */}
            <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden space-y-0.5">
              
              <div className="p-4 bg-slate-50 border-b border-slate-200 text-slate-800">
                <h4 className="text-xs font-extrabold tracking-wide uppercase flex items-center gap-1.5 text-indigo-900">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  4. REFINANCE
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 font-bold">
                  ปรับเปลี่ยนประเภทอัตราดอกเบี้ยรายปี ปีที่ 1, 2, 3 และ ปีที่ 4+
                </p>
              </div>

              {/* Mini selector tabs within the sidebar editor */}
              <div className="flex bg-slate-100 p-1 border-b border-slate-200 overflow-x-auto gap-0.5">
                {customBanks.map(bank => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => setActiveEditorTab(bank.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      activeEditorTab === bank.id
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <BankLogo bankId={bank.id} size="sm" className="w-4 h-4 rounded-md" />
                    {bank.id.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Editor Fields Content Block */}
              <div className="p-4 space-y-4">
                {(() => {
                  const targetConfig = customBanks.find(b => b.id === activeEditorTab);

                  if (!targetConfig) {
                    return (
                      <p className="text-xs text-slate-400 text-center py-4 font-semibold">
                        โปรดเลือกธนาคารจากแผงด้านบนเพื่อเริ่มปรับแต่งอัตราดอกเบี้ย Refinance
                      </p>
                    );
                  }

                  // Calculate average 3 year rate for this customized bank config
                  const r1 = resolveRate(targetConfig.mrr, targetConfig.yr1);
                  const r2 = resolveRate(targetConfig.mrr, targetConfig.yr2);
                  const r3 = resolveRate(targetConfig.mrr, targetConfig.yr3);
                  const resolvedAverage = ((r1 + r2 + r3) / 3).toFixed(2);

                  const getPackageDetails = (p: RefiPackageConfig, mrr: number) => {
                    const rev1 = resolveRate(mrr, p.yr1);
                    const rev2 = resolveRate(mrr, p.yr2);
                    const rev3 = resolveRate(mrr, p.yr3);
                    const rev4 = resolveRate(mrr, p.yr4Plus);
                    const avg = (rev1 + rev2 + rev3) / 3;
                    
                    const fmtRate = (rp: RatePeriod, resolved: number) => {
                      if (rp.type === 'fixed') {
                        return `${resolved.toFixed(2)}%`;
                      } else {
                        const absVal = Math.abs(rp.value);
                        return `MRR-${absVal.toFixed(2)}% (${resolved.toFixed(2)}%)`;
                      }
                    };

                    const desc = `ปี 1: ${fmtRate(p.yr1, rev1)} | ปี 2: ${fmtRate(p.yr2, rev2)} | ปี 3: ${fmtRate(p.yr3, rev3)} | ปี 4+: ${fmtRate(p.yr4Plus, rev4)}`;
                    return { avg, desc };
                  };

                  const currentPackages = targetConfig.packages || getRefiPackagesForBank(
                    targetConfig.id,
                    targetConfig.mrr,
                    banksList.find(b => b.id === targetConfig.id)?.typicalRefinance3Yr || 3.50
                  ).map(pkg => ({
                    id: pkg.id,
                    label: pkg.label,
                    yr1: { type: "fixed" as const, value: pkg.rates[0] },
                    yr2: { type: "fixed" as const, value: pkg.rates[1] },
                    yr3: { type: "fixed" as const, value: pkg.rates[2] },
                    yr4Plus: { type: "mrr" as const, value: pkg.yr4PlusVal },
                    freeMortgage: pkg.freeMortgage,
                    hasMrta: pkg.id === 1 || pkg.id === 2,
                  }));

                  return (
                    <div className="space-y-4 animate-fadeIn">
                      
                      {/* Universal 4 Refinance Options Selector */}
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-950 font-black text-[11.5px]">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          <span>สิทธิประโยชน์และเงื่อนไข Refinance (4 ประเภทแบบแผนจำแนกชัดเจน)</span>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-normal font-semibold">
                          เลือกจากรูปแบบการทำประกัน MRTA/MLTA และการรับสิทธิ์ฟรีค่าจดจำนอง (1%):
                        </p>

                        {/* Refinance Start Date Picker */}
                        <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-amber-200 mt-1 shadow-sm">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span className="text-[10px] font-black text-amber-950 truncate">
                              วันที่เริ่มสัญญา Refinance
                            </span>
                          </div>
                          <input
                            type="date"
                            value={refinanceStartDate}
                            onChange={(e) => setRefinanceStartDate(e.target.value)}
                            className="bg-white border border-amber-300 focus:border-amber-500 rounded px-2 py-0.5 text-[10px] font-mono font-bold text-slate-800 outline-none text-center"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 mt-2">
                          {currentPackages.map((pkg) => {
                            const { avg, desc } = getPackageDetails(pkg, targetConfig.mrr);
                            const isMatch = targetConfig.activePackageId !== undefined
                              ? targetConfig.activePackageId === pkg.id
                              : (targetConfig.yr1.value === pkg.yr1.value &&
                                 targetConfig.yr2.value === pkg.yr2.value &&
                                 targetConfig.yr3.value === pkg.yr3.value &&
                                 targetConfig.freeMortgageFee === pkg.freeMortgage);

                            return (
                              <button
                                key={pkg.id}
                                type="button"
                                onClick={() => {
                                  setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? {
                                    ...b,
                                    activePackageId: pkg.id,
                                    yr1: { ...pkg.yr1 },
                                    yr2: { ...pkg.yr2 },
                                    yr3: { ...pkg.yr3 },
                                    yr4Plus: { ...pkg.yr4Plus },
                                    freeMortgageFee: pkg.freeMortgage,
                                    hasMrta: pkg.hasMrta,
                                    mrr: b.id === "lhbank" ? 8.18 : b.mrr, // lock MRR if lhbank
                                  } : b));
                                }}
                                className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all duration-200 cursor-pointer ${
                                  isMatch 
                                    ? "bg-amber-100 border-amber-400 shadow-sm font-semibold" 
                                    : "bg-white hover:bg-slate-50 border-slate-200"
                                }`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-extrabold text-indigo-900 text-[11px] flex items-center gap-1.5 font-sans">
                                    {pkg.label}
                                    {isMatch && (
                                      <span className="bg-emerald-600 text-white text-[8px] px-1.5 py-0.2 rounded font-bold">
                                        ใช้งานอยู่
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium">{desc}</span>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <div className="text-[10px] text-slate-500 font-semibold font-sans">
                                    เฉลี่ย 3 ปี: <span className="text-xs font-black text-slate-800 font-mono">{avg.toFixed(2)}%</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3-Year Interest Comparison Panel */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-[11.5px] border-b border-slate-200 pb-2">
                          <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                          <span>ตารางสรุปดอกเบี้ยสะสม 3 ปีแรก (ครบทั้ง 4 รูปแบบแผน)</span>
                        </div>
                        <div className="space-y-2">
                          {currentPackages.map((pkg) => {
                            const stdInstallment = targetConfig.isInstallmentAdjusted 
                              ? targetConfig.customInstallment 
                              : loanInput.currentInstallment;
                            
                            const pkgCals = computeRefiPackageSchedule3YrGlobal(
                              loanInput.outstandingPrincipal,
                              targetConfig.mrr,
                              refinanceStartDate,
                              pkg.yr1,
                              pkg.yr2,
                              pkg.yr3,
                              stdInstallment,
                              simulatedTotalPayment
                            );

                            const isActivePkg = targetConfig.activePackageId !== undefined
                              ? targetConfig.activePackageId === pkg.id
                              : (targetConfig.yr1.value === pkg.yr1.value &&
                                 targetConfig.yr2.value === pkg.yr2.value &&
                                 targetConfig.yr3.value === pkg.yr3.value &&
                                 targetConfig.freeMortgageFee === pkg.freeMortgage);

                            return (
                              <div key={pkg.id} className={`p-2.5 rounded-lg border text-xs transition duration-150 ${
                                isActivePkg 
                                  ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-500/10 shadow-sm" 
                                  : "bg-white border-slate-100"
                              }`}>
                                <div className="flex justify-between items-start gap-1">
                                  <div className="flex flex-col">
                                    <span className="font-extrabold text-[10.5px] text-slate-900 font-sans">
                                      {pkg.label}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-medium">
                                      {pkg.hasMrta ? "ทำประกัน MRTA/MLTA" : "ไม่ทำประกัน"} · {pkg.freeMortgage ? "ฟรีค่าจดจำนอง" : "ไม่ฟรีค่าจดจำนอง"}
                                    </span>
                                  </div>
                                  
                                  {/* Button to show table */}
                                  <button
                                    type="button"
                                    onClick={() => setRefiScheduleExpandedPkgId(
                                      refiScheduleExpandedPkgId === pkg.id ? null : pkg.id
                                    )}
                                    className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 underline transition cursor-pointer flex items-center gap-0.5 shrink-0"
                                  >
                                    <Calculator className="w-3 h-3" />
                                    <span>{refiScheduleExpandedPkgId === pkg.id ? "ปิดตาราง" : "ตารางคำนวณ 3 ปี"}</span>
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-[10.5px]">
                                  <div className="bg-slate-50 p-1.5 rounded flex flex-col">
                                    <span className="text-[9px] text-slate-500 font-bold font-sans">
                                      ผ่อนปกติธนาคาร
                                    </span>
                                    <span className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                                      ค่างวด {formatCurrency(stdInstallment)} บ.
                                    </span>
                                    <span className="text-[11.5px] font-black text-rose-600 font-mono mt-1">
                                      {formatCurrency(pkgCals.standardInterest)}
                                    </span>
                                  </div>

                                  <div className="bg-emerald-50/40 p-1.5 rounded flex flex-col border border-emerald-100/50">
                                    <span className="text-[9px] text-emerald-800 font-bold font-sans">
                                      จำลองการผ่อนจริงต่อเดือน
                                    </span>
                                    <span className="text-[9px] text-emerald-600 mt-0.5 leading-tight">
                                      ค่างวด {formatCurrency(Math.max(stdInstallment, simulatedTotalPayment))} บ.
                                    </span>
                                    <span className="text-[11.5px] font-black text-emerald-600 font-mono mt-1">
                                      {formatCurrency(pkgCals.simulatedInterest)}
                                    </span>
                                  </div>
                                </div>

                                {/* Month-by-month Schedule Table for this package */}
                                {refiScheduleExpandedPkgId === pkg.id && (
                                  <div className="mt-2.5 bg-white text-slate-800 border border-slate-200 rounded-lg overflow-hidden shadow-sm border-t-2 border-t-indigo-600 animate-fadeIn space-y-1.5">
                                    <div className="p-2 bg-slate-50 text-slate-700 flex justify-between items-center text-[10px] border-b border-slate-200">
                                      <span className="font-extrabold uppercase font-sans text-slate-800">
                                        ตารางคำนวณสะสม 3 ปี ({pkg.id === 1 ? "MRTA+ฟรีจดจำนอง" : pkg.id === 2 ? "MRTA+ไม่ฟรีจดจำนอง" : pkg.id === 3 ? "ไม่ทำ+ฟรีจดจำนอง" : "ไม่ทำ+ไม่ฟรีจดจำนอง"})
                                      </span>
                                      <div className="flex bg-slate-200/80 p-0.5 rounded border border-slate-300 font-bold shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setRefiScheduleType("standard")}
                                          className={`px-1.5 py-0.5 rounded text-[8px] cursor-pointer ${
                                            refiScheduleType === "standard" 
                                              ? "bg-white text-indigo-700 shadow-xs font-extrabold" 
                                              : "text-slate-500 hover:text-slate-800 font-normal"
                                          }`}
                                        >
                                          ผ่อนปกติ
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setRefiScheduleType("simulated")}
                                          className={`px-1.5 py-0.5 rounded text-[8px] cursor-pointer ${
                                            refiScheduleType === "simulated" 
                                              ? "bg-white text-indigo-700 shadow-xs font-extrabold" 
                                              : "text-slate-500 hover:text-slate-800 font-normal"
                                          }`}
                                        >
                                          จำลองผ่อนจริง
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <div className="overflow-x-auto max-h-[220px] text-[10px] w-full">
                                      <table className="w-full text-left border-collapse min-w-[500px]">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200 text-[9px] uppercase font-sans text-center">
                                            <th className="p-1 px-1.5 text-center w-8">งวด</th>
                                            <th className="p-1 text-center w-28">ช่วงวันที่สัญญา</th>
                                            <th className="p-1 text-center w-12">ดบ. (%)</th>
                                            <th className="p-1 text-right">ยอดต้นยกมา</th>
                                            <th className="p-1 text-right text-rose-600">ดอกเบี้ยคงงวด</th>
                                            <th className="p-1 text-right text-indigo-600">ชำระค่างวด</th>
                                            <th className="p-1 text-right text-emerald-600 font-bold">ตัดต้น</th>
                                            <th className="p-1 text-right pr-2">ยอดต้นยกไป</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono text-[9px] text-slate-700 bg-white">
                                          {(refiScheduleType === "standard" 
                                            ? pkgCals.standardSchedule 
                                            : pkgCals.simulatedSchedule
                                          ).map((row) => (
                                            <tr key={row.month} className="hover:bg-slate-50/80 transition-colors">
                                              <td className="p-1 text-center font-bold text-indigo-600">{row.month}</td>
                                              <td className="p-1 text-center text-slate-500 text-[8.5px]">{row.dateRange}</td>
                                              <td className="p-1 text-center font-bold text-slate-800">{row.rate.toFixed(2)}%</td>
                                              <td className="p-1 text-right text-slate-600">{formatCurrency(row.begBal)}</td>
                                              <td className="p-1 text-right text-rose-600 font-bold">{formatCurrency(row.interest)}</td>
                                              <td className="p-1 text-right text-indigo-600">{formatCurrency(row.payment)}</td>
                                              <td className="p-1 text-right text-emerald-600 font-bold">{formatCurrency(row.principal)}</td>
                                              <td className="p-1 text-right text-slate-900 font-extrabold pr-2">{formatCurrency(row.endBal)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="p-2 bg-slate-50 text-[8.5px] text-slate-500 text-center font-semibold leading-normal font-sans rounded-b-lg border-t border-slate-200">
                                      * คำนวณแบบลดต้นลดดอกตามจำนวนวันจ่ายในรอบเดือน ตั้งต้นจากเงินสัญญากู้ {formatCurrency(loanInput.outstandingPrincipal)} บ.
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Name & Reference MRR */}
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800">
                            {targetConfig.nameTh}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">
                            ID: {targetConfig.id.toUpperCase()}
                          </span>
                        </div>
                        
                        {/* MRR Edit field */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <label className="text-[11px] font-bold text-slate-500">
                            อัตราอ้างอิง MRR ของธนาคาร (%)
                          </label>
                          <div className="relative w-24">
                            <input
                              type="number"
                              step="0.05"
                              value={targetConfig.mrr}
                              onChange={(e) => handleMrrChange(targetConfig.id, Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded-lg py-0.5 px-2 text-xs font-bold text-center text-slate-800 outline-none focus:border-indigo-500"
                            />
                            <span className="absolute right-1.5 top-1.5 text-[8px] text-slate-400 font-bold">%</span>
                          </div>
                        </div>
                      </div>

                      {/* YEARLY RATES PARAMETERS (Req: 1, 2, 3, 4+ Fixed vs MRR) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                          <span>ตั้งค่าสัดส่วนรายดอกเบี้ยรายปี</span>
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-mono">
                            เฉลี่ย 3 ปี: {resolvedAverage}%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {renderRatePeriodEditor(targetConfig.id, "yr1", "ปีที่ 1", targetConfig.yr1, targetConfig.mrr)}
                          {renderRatePeriodEditor(targetConfig.id, "yr2", "ปีที่ 2", targetConfig.yr2, targetConfig.mrr)}
                          {renderRatePeriodEditor(targetConfig.id, "yr3", "ปีที่ 3", targetConfig.yr3, targetConfig.mrr)}
                          {renderRatePeriodEditor(targetConfig.id, "yr4Plus", "ปีที่ 4 เป็นต้นไป", targetConfig.yr4Plus, targetConfig.mrr)}
                        </div>
                      </div>

                      {/* SET-UP TRANSACT FEES SECTION */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-100">
                        <span className="text-xs font-black text-slate-700 block">
                          ค่าธรรมเนียมธุรกรรมแรกเริ่มของสัญญา
                        </span>

                        {/* Mortgage toggle */}
                        <div className="flex flex-col p-1.5 bg-slate-50/50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-600 text-[11px]">ค่าจดจำนองที่ดิน (ฟรี / จ่าย)</span>
                              <span className="text-[9px] text-slate-400">
                                {targetConfig.freeMortgageFee 
                                  ? "ยกเว้นเก็บค่าจดจำนอง" 
                                  : targetConfig.customMortgageFeeAmount !== undefined 
                                    ? `ระบุเอง: ${formatCurrency(targetConfig.customMortgageFeeAmount)} บาท` 
                                    : `คำนวณ (${targetConfig.customMortgageFeeRate}%): ${formatCurrency(loanInput.outstandingPrincipal * (targetConfig.customMortgageFeeRate / 100))} บาท`}
                              </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={targetConfig.freeMortgageFee}
                                onChange={(e) => handleFeeChange(targetConfig.id, "freeMortgageFee", e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                              <span className="ml-1.5 text-[9px] font-bold text-slate-500">
                                {targetConfig.freeMortgageFee ? "ฟรี" : "จ่าย"}
                              </span>
                            </label>
                          </div>
                          {!targetConfig.freeMortgageFee && (
                            <div className="flex flex-col gap-1.5 bg-amber-50/45 p-2 rounded-lg border border-amber-200/60 shadow-2xs">
                              <div className="flex items-center gap-1.5 justify-between">
                                <span className="text-[10px] text-slate-600 font-extrabold uppercase font-sans">
                                  ระบุจํานวนเงินค่าจดจำนองที่ดินโดยตรง (บาท):
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold font-mono">
                                  (คำนวณปกติ 1%: {formatCurrency(Math.round(loanInput.outstandingPrincipal * 0.01))} บาท)
                                </span>
                              </div>
                              <div className="relative flex items-center gap-2">
                                <input
                                  type="number"
                                  step="500"
                                  min="0"
                                  value={targetConfig.customMortgageFeeAmount !== undefined ? targetConfig.customMortgageFeeAmount : ""}
                                  placeholder={String(Math.round(loanInput.outstandingPrincipal * (targetConfig.customMortgageFeeRate / 100)))}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? undefined : Number(e.target.value);
                                    handleFeeChange(targetConfig.id, "customMortgageFeeAmount", val);
                                  }}
                                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg py-1 px-2.5 text-[11px] font-bold text-slate-800 outline-none transition"
                                />
                                <span className="text-[11px] font-bold text-slate-500">บาท</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Appraisal toggle */}
                        <div className="flex items-center justify-between p-1.5 bg-slate-50/50 rounded-lg border border-slate-100 text-xs">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-600 text-[11px]">ค่าประเมินมูลค่าหลักทรัพย์</span>
                            {!targetConfig.freeAppraisalFee && (
                              <div className="mt-1 relative w-20">
                                <input
                                  type="number"
                                  value={targetConfig.customAppraisalFee}
                                  onChange={(e) => handleFeeChange(targetConfig.id, "customAppraisalFee", Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded px-1 text-[10px] font-bold text-center"
                                />
                              </div>
                            )}
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={targetConfig.freeAppraisalFee}
                              onChange={(e) => handleFeeChange(targetConfig.id, "freeAppraisalFee", e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            <span className="ml-1.5 text-[9px] font-bold text-slate-500">
                              {targetConfig.freeAppraisalFee ? "ฟรี" : "จ่าย"}
                            </span>
                          </label>
                        </div>

                        {/* Duty Stamp toggle */}
                        <div className="flex flex-col p-1.5 bg-slate-50/50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-600 text-[11px]">ค่าอากรแสตมป์ (ฟรี / จ่าย)</span>
                              <span className="text-[9px] text-slate-400">
                                {targetConfig.freeDutyStamp 
                                  ? "ยกเว้นอากรแสตมป์" 
                                  : targetConfig.customDutyStampAmount !== undefined 
                                    ? `ระบุเอง: ${formatCurrency(targetConfig.customDutyStampAmount)} บาท` 
                                    : `คำนวณ (${targetConfig.customDutyStampRate !== undefined ? targetConfig.customDutyStampRate : 0.05}%): ${formatCurrency(loanInput.outstandingPrincipal * ((targetConfig.customDutyStampRate !== undefined ? targetConfig.customDutyStampRate : 0.05) / 100))} บาท`}
                              </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={targetConfig.freeDutyStamp}
                                onChange={(e) => handleFeeChange(targetConfig.id, "freeDutyStamp", e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                              <span className="ml-1.5 text-[9px] font-bold text-slate-500">
                                {targetConfig.freeDutyStamp ? "ฟรี" : "จ่าย"}
                              </span>
                            </label>
                          </div>
                          {!targetConfig.freeDutyStamp && (
                            <div className="flex flex-col gap-1.5 bg-amber-50/45 p-2 rounded-lg border border-amber-200/60 shadow-2xs">
                              <div className="flex items-center gap-1.5 justify-between">
                                <span className="text-[10px] text-slate-600 font-extrabold uppercase font-sans">
                                  ระบุจํานวนเงินค่าอากรแสตมป์โดยตรง (บาท):
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold font-mono">
                                  (คำนวณปกติ 0.05%: {formatCurrency(Math.round(loanInput.outstandingPrincipal * 0.0005))} บาท)
                                </span>
                              </div>
                              <div className="relative flex items-center gap-2">
                                <input
                                  type="number"
                                  step="50"
                                  min="0"
                                  value={targetConfig.customDutyStampAmount !== undefined ? targetConfig.customDutyStampAmount : ""}
                                  placeholder={String(Math.round(loanInput.outstandingPrincipal * ((targetConfig.customDutyStampRate !== undefined ? targetConfig.customDutyStampRate : 0.05) / 100)))}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? undefined : Number(e.target.value);
                                    handleFeeChange(targetConfig.id, "customDutyStampAmount", val);
                                  }}
                                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg py-1 px-2.5 text-[11px] font-bold text-slate-800 outline-none transition"
                                />
                                <span className="text-[11px] font-bold text-slate-500">บาท</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Other fees */}
                        <div className="space-y-1.5 p-1.5 bg-slate-50/50 rounded-lg border border-slate-100">
                          <div className="flex justify-between items-center bg-slate-100/50 p-1 rounded">
                            <span className="font-extrabold text-slate-700 text-[11px] flex items-center gap-1">
                              ค่าธรรมเนียมเบ็ดเตล็ดอื่น ๆ
                            </span>
                            <button
                              type="button"
                              onClick={() => addCustomFeeItem(targetConfig.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-md text-[9.5px] font-black cursor-pointer flex items-center gap-0.5 shadow-xs shrink-0 transition-all"
                            >
                              <Plus className="w-3 h-3" /> เพิ่ม
                            </button>
                          </div>

                          {/* Base "otherFees" as a fallback/compatibility check if no custom items exist */}
                          {(!targetConfig.customOtherFees || targetConfig.customOtherFees.length === 0) && (
                            <div className="flex justify-between items-center text-xs mt-1">
                              <span className="text-slate-500 text-[10px] italic">* ใส่ค่าเริ่มต้นหรือกดเพิ่มด้านบน:</span>
                              <div className="relative w-20">
                                <input
                                  type="number"
                                  value={targetConfig.otherFees}
                                  onChange={(e) => handleFeeChange(targetConfig.id, "otherFees", Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-center"
                                />
                              </div>
                            </div>
                          )}

                          {/* Render custom list of dynamic other fees */}
                          {targetConfig.customOtherFees && targetConfig.customOtherFees.length > 0 && (
                            <div className="space-y-1 mt-1">
                              {targetConfig.customOtherFees.map((item) => (
                                <div key={item.id} className="flex gap-1 items-center bg-white p-1 rounded border border-slate-200 shadow-2xs">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updateCustomFeeItem(targetConfig.id, item.id, "name", e.target.value)}
                                    className="flex-1 bg-slate-50 hover:bg-slate-100/70 focus:bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-800 rounded outline-none border border-transparent focus:border-slate-300 transition-all font-sans"
                                    placeholder="ชื่อค่าธรรมเนียม"
                                  />
                                  <div className="relative w-16 shrink-0">
                                    <input
                                      type="number"
                                      value={item.amount}
                                      onChange={(e) => updateCustomFeeItem(targetConfig.id, item.id, "amount", e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] font-mono font-bold text-center"
                                      placeholder="0"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeCustomFeeItem(targetConfig.id, item.id)}
                                    className="p-1 text-slate-400 hover:text-red-650 transition-colors cursor-pointer shrink-0"
                                    title="ลบรายการ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Fire Insurance for this Refinance Bank */}
                        <div className="p-2.5 bg-indigo-50/25 rounded-lg border border-indigo-100/50 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-orange-600 shrink-0" />
                            <span className="font-extrabold text-slate-700 text-[11px]">
                              ค่าประกันอัคคีภัย (สำหรับสัญญากู้ใหม่ Refinance)
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* Premium */}
                            <div>
                              <label className="text-[8.5px] text-slate-400 font-bold block mb-0.5">
                                เบี้ยประกันภัยอัคคีภัย (บาท)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={targetConfig.fireInsurancePremium !== undefined ? targetConfig.fireInsurancePremium : 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { ...b, fireInsurancePremium: val } : b));
                                }}
                                className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-center text-slate-800 outline-none focus:border-indigo-500"
                              />
                            </div>
                            {/* Duration */}
                            <div>
                              <label className="text-[8.5px] text-slate-400 font-bold block mb-0.5">
                                ระยะเวลาคุ้มครอง (ปี)
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="30"
                                value={targetConfig.fireInsuranceDuration !== undefined ? targetConfig.fireInsuranceDuration : 3}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { ...b, fireInsuranceDuration: val } : b));
                                }}
                                className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-center text-slate-800 outline-none focus:border-indigo-500"
                              />
                            </div>
                            {/* Sum Insured */}
                            <div>
                              <label className="text-[8.5px] text-slate-400 font-bold block mb-0.5">
                                ทุนประกันภัย (บาท)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="50000"
                                value={targetConfig.fireSumInsured !== undefined ? targetConfig.fireSumInsured : 2500000}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { ...b, fireSumInsured: val } : b));
                                }}
                                className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-center text-slate-800 outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 font-bold flex justify-between text-xs border border-rose-100/50">
                          <span>ค่าใช้จ่ายแรกเข้ารวม:</span>
                          <span>{formatCurrency(computeCustomBankFees(loanInput.outstandingPrincipal, targetConfig))}</span>
                        </div>
                      </div>

                      {/* MRTA CALCULATION ASSURANCE FOR THIS BANK */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-extrabold text-indigo-950">คุ้มครองวงเงิน (MRTA ของ {targetConfig.nameTh})</span>
                            <span className="text-[10px] text-slate-400 font-medium">บังคับกู้ทำประกันคุ้มครองความเสี่ยง</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={targetConfig.hasMrta}
                              onChange={(e) => {
                                setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { ...b, hasMrta: e.target.checked } : b));
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            <span className="ml-1.5 text-[10px] font-bold text-slate-500">
                              {targetConfig.hasMrta ? "ทํา" : "ไม่ทำ"}
                            </span>
                          </label>
                        </div>
                        
                        {targetConfig.hasMrta && (
                          <div className="animate-fadeIn pt-1 space-y-2">
                            {/* Override MRTA Custom Premium Field */}
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-3 shadow-2xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-amber-200/50">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black text-amber-950 uppercase tracking-wide">
                                    กำหนดราคาเบี้ยประกันภัย MRTA สัญญานี้
                                  </span>
                                  <span className="text-[9px] text-amber-700 font-medium">
                                    ระบุค่าเบี้ยประกันภัยเดี่ยวหรือกู้ร่วมโดยตรงเพื่อเปรียบเทียบ
                                  </span>
                                </div>
                                
                                <div className="flex bg-amber-100/60 p-0.5 rounded-lg border border-amber-200/50 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { 
                                        ...b, 
                                        customMrtaType: undefined,
                                        customMrtaPremium: undefined 
                                      } : b));
                                    }}
                                    className={`px-2 py-1 text-[9px] font-black rounded-md transition-all duration-150 cursor-pointer ${
                                      targetConfig.customMrtaType === undefined
                                        ? "bg-amber-600 text-white shadow-xs"
                                        : "text-amber-800 hover:text-amber-950"
                                    }`}
                                  >
                                    ประเมินอัตโนมัติ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { 
                                        ...b, 
                                        customMrtaType: "single",
                                        customMrtaPremium1: b.customMrtaPremium1 ?? b.customMrtaPremium ?? 0
                                      } : b));
                                    }}
                                    className={`px-2 py-1 text-[9px] font-black rounded-md transition-all duration-150 cursor-pointer ${
                                      targetConfig.customMrtaType === "single"
                                        ? "bg-amber-600 text-white shadow-xs"
                                        : "text-amber-800 hover:text-amber-950"
                                    }`}
                                  >
                                    กู้เดี่ยว (1 ช่อง)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { 
                                        ...b, 
                                        customMrtaType: "joint",
                                        customMrtaPremium1: b.customMrtaPremium1 ?? b.customMrtaPremium ?? 0,
                                        customMrtaPremium2: b.customMrtaPremium2 ?? 0
                                      } : b));
                                    }}
                                    className={`px-2 py-1 text-[9px] font-black rounded-md transition-all duration-150 cursor-pointer ${
                                      targetConfig.customMrtaType === "joint"
                                        ? "bg-amber-600 text-white shadow-xs"
                                        : "text-amber-800 hover:text-amber-950"
                                    }`}
                                  >
                                    กู้ร่วม (2 ช่อง)
                                  </button>
                                </div>
                              </div>

                              {/* Input boxes based on selection */}
                              {targetConfig.customMrtaType === undefined && (
                                <div className="text-[9.5px] text-amber-850/90 font-medium leading-relaxed bg-amber-100/30 p-2 rounded-lg border border-amber-200/30">
                                  💡 <strong>ระบบประเมินอัตโนมัติ:</strong> กำลังอ้างอิงตารางประเมินเงินเบี้ยอัตโนมัติตามเพศและอายุที่กรอก (เปิดเครื่องมือประเมินเบี้ยละเอียดด้านล่างเพื่อตรวจสอบข้อมูล)
                                </div>
                              )}

                              {targetConfig.customMrtaType === "single" && (
                                <div className="grid grid-cols-1 gap-2">
                                  <div>
                                    <label className="text-[9px] text-amber-800 font-extrabold uppercase font-sans block mb-1">
                                      ระบุเบี้ยประกันภัย MRTA โดยตรง (บาท)
                                    </label>
                                    <div className="relative flex items-center gap-2">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        value={targetConfig.customMrtaPremium1 !== undefined && targetConfig.customMrtaPremium1 !== 0 ? targetConfig.customMrtaPremium1 : ""}
                                        placeholder="ระบุค่าเบี้ยประกันภัย (บาท)"
                                        onChange={(e) => {
                                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                                          setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { ...b, customMrtaPremium1: val } : b));
                                        }}
                                        className="w-full bg-white border border-amber-300 focus:border-amber-500 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none transition"
                                      />
                                      <span className="text-xs text-amber-900 font-bold shrink-0">บาท</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {targetConfig.customMrtaType === "joint" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {/* Field 1 */}
                                  <div>
                                    <label className="text-[9px] text-amber-800 font-extrabold uppercase font-sans block mb-1">
                                      เบี้ยรวม - ผู้กู้ท่านแรก (บาท)
                                    </label>
                                    <div className="relative flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        value={targetConfig.customMrtaPremium1 !== undefined && targetConfig.customMrtaPremium1 !== 0 ? targetConfig.customMrtaPremium1 : ""}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                                          setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { ...b, customMrtaPremium1: val } : b));
                                        }}
                                        className="w-full bg-white border border-amber-300 focus:border-amber-500 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none transition"
                                      />
                                      <span className="text-[10px] text-amber-900 font-bold shrink-0">บาท</span>
                                    </div>
                                  </div>
                                  
                                  {/* Field 2 */}
                                  <div>
                                    <label className="text-[9px] text-amber-800 font-extrabold uppercase font-sans block mb-1">
                                      เบี้ยรวม - ผู้กู้หลักร่วม (บาท)
                                    </label>
                                    <div className="relative flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        value={targetConfig.customMrtaPremium2 !== undefined && targetConfig.customMrtaPremium2 !== 0 ? targetConfig.customMrtaPremium2 : ""}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                                          setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? { ...b, customMrtaPremium2: val } : b));
                                        }}
                                        className="w-full bg-white border border-amber-300 focus:border-amber-500 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none transition"
                                      />
                                      <span className="text-[10px] text-amber-900 font-bold shrink-0">บาท</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Toggle detailed MRTA calculator - Default is collapse */}
                            <button
                              type="button"
                              onClick={() => setMrtaCalculatorExpanded(prev => ({ ...prev, [targetConfig.id]: !prev[targetConfig.id] }))}
                              className="w-full flex items-center justify-between p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition duration-150 cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                                <span>เครื่องมือประเมินเบี้ยละเอียดจากเพศ/อายุ</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-extrabold uppercase">
                                <span>{mrtaCalculatorExpanded[targetConfig.id] ? "ดูน้อยลง" : "เปิดตารางคำนวณย้ายค่าย"}</span>
                                {mrtaCalculatorExpanded[targetConfig.id] ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </div>
                            </button>

                            {mrtaCalculatorExpanded[targetConfig.id] && (
                              <div className="animate-fadeIn pt-1">
                                <MrtaCalculator
                                  loanInput={loanInput}
                                  onUpdateLoanInput={setLoanInput}
                                  formatCurrency={formatCurrency}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })()}
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: DYNAMIC INTERACTIVE COMPARISON AND REPORT */}
          <div className="lg:col-span-8 space-y-6">

            {/* ACTIVE PATHWAYS CARDS GRID (Req: Compare Retention and up to 5 banks) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              
              {/* 1. หากกู้และผ่อนเดิม CARD */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 flex flex-col shadow-sm overflow-hidden min-h-[360px] hover:border-slate-300 transition-all">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-extrabold text-[11.5px] tracking-wider uppercase text-slate-900">กู้และผ่อนที่เดิม</span>
                  </div>
                  <span className="text-[9px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">ไม่เปลี่ยนที่</span>
                </div>
                
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-2 text-center rounded-lg border border-slate-150">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">สัดส่วนอัตราดอกเบี้ยปัจจุบัน</p>
                      <p className="text-2xl font-black text-rose-500 mt-0.5 font-mono">
                        {loanInput.currentInterestRate.toFixed(2)}% <span className="text-xs text-slate-400 font-semibold">(ลอยตัว)</span>
                      </p>
                    </div>

                    <div className="space-y-2 font-semibold text-xs text-slate-600">
                      <div className="flex justify-between items-center bg-slate-50/50 p-1.5 rounded border border-dashed border-slate-100">
                        <span>ค่างวดปกติธนาคาร:</span>
                        <span className="text-slate-800 font-mono font-bold">{formatCurrency(loanInput.currentInstallment)} /ด.</span>
                      </div>
                      
                      <div className="flex justify-between pt-1 divide-y divide-slate-100 flex-col gap-1.5">
                        <div className="flex justify-between">
                          <span>1) ดอกเบี้ย 3 ปี (ยอดผ่อนปกติ):</span>
                          <span className="text-rose-600 font-bold font-mono">{formatCurrency(currentLoan3YrStats.standardInterest)}</span>
                        </div>
                        <div className="flex justify-between pt-1 text-rose-800 bg-rose-50/40 p-1 rounded">
                          <span>2) ดอกเบี้ย 3 ปี (ผ่อนจริงถัวเฉลี่ย):</span>
                          <span className="font-bold font-mono">{formatCurrency(currentLoan3YrStats.simulatedInterest)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex justify-between">
                        <span>ค่าประกันอัคคีภัย (3 ปี):</span>
                        <span className="text-slate-800 font-mono">{formatCurrency(loanInput.fireInsurancePremium)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-150 mt-4 text-xs font-semibold">
                    <div className="space-y-1 bg-slate-100/50 p-2 rounded-xl mb-3 border border-slate-200">
                      <div className="flex justify-between uppercase text-slate-400 font-bold text-[9.5px]">
                        <span>ภาระจ่ายสุทธิ (ผ่อนปกติ):</span>
                        <span className="text-slate-800 font-mono font-black text-sm">
                          {formatCurrency(currentLoan3YrStats.standardInterest + loanInput.fireInsurancePremium)}
                        </span>
                      </div>
                      <div className="flex justify-between uppercase text-emerald-800 font-bold text-[9.5px] border-t border-dashed border-slate-200 pt-1 mt-1">
                        <span>ภาระจ่ายสุทธิ (ผ่อนจริง):</span>
                        <span className="text-emerald-950 font-mono font-black text-sm">
                          {formatCurrency(currentLoan3YrStats.simulatedInterest + loanInput.fireInsurancePremium)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const rows = generateOriginalScheduleRows(
                          loanInput.outstandingPrincipal,
                          loanInput.currentInterestRate,
                          loanInput.currentInstallment,
                          simulatedTotalPayment,
                          true
                        );
                        setActiveRefiSchedule({
                          title: "ตารางคำนวณดอกเบี้ย 3 ปี - หากกู้และผ่อนเดิม (แบบจำลองการผ่อนจริง)",
                          isSimulated: true,
                          setupFeesBreakdown: {
                            mortgageFee: 0,
                            appraisalFee: 0,
                            dutyStamp: 0,
                            mrtaPremium: 0,
                            fireInsurancePremium: loanInput.fireInsurancePremium,
                            otherFees: 0,
                            totalSetupFees: loanInput.fireInsurancePremium
                          },
                          rows
                        });
                      }}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[10.5px] py-1.5 rounded-lg border border-slate-200 text-center cursor-pointer transition-colors"
                    >
                      🔍 แสดงตารางคำนวณดอกเบี้ย 3 ปี
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Retention ธนาคารเดิม CARD */}
              <div className={`bg-white rounded-2xl border-2 flex flex-col shadow-sm overflow-hidden min-h-[360px] hover:shadow-md transition-all relative ${
                championCandidate && championCandidate.id === "retention" 
                  ? "border-indigo-600 ring-2 ring-indigo-50" 
                  : "border-emerald-500"
              }`}>
                {championCandidate && championCandidate.id === "retention" && (
                  <span className="absolute top-1 right-2 bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-extrabold animate-pulse z-10">
                    ⭐ คุ้มที่สุด (Retention)
                  </span>
                )}
                <div className="p-3 bg-emerald-700 border-b border-emerald-800 flex justify-between items-center text-white">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-extrabold text-[11.5px] tracking-wider uppercase">Retention ธนาคารเดิม</span>
                  </div>
                  <span className="text-[9px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">ขอลดหย่อนดอกเบี้ย</span>
                </div>
                
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="bg-emerald-50 text-center p-2 rounded-lg border border-emerald-150">
                      <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wide">สัดส่วนอัตราดอกเบี้ยปีที่ 1-3 (Retention)</p>
                      <p className="text-2xl font-black text-emerald-700 mt-0.5 font-mono">
                        {((resolveRate(currentBankMrrVal, origSimRates.yr1) + resolveRate(currentBankMrrVal, origSimRates.yr2) + resolveRate(currentBankMrrVal, origSimRates.yr3)) / 3).toFixed(2)}% <span className="text-xs text-slate-400 font-semibold">(เฉลี่ย)</span>
                      </p>
                    </div>

                    <div className="space-y-2 font-semibold text-xs text-slate-600">
                      <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-150">
                        <span>ยอดผ่อน Retention:</span>
                        <span className="text-slate-800 font-mono font-bold">{formatCurrency(origSimInstallments.yr1)} /ด.</span>
                      </div>
                      
                      <div className="flex justify-between pt-1 divide-y divide-slate-100 flex-col gap-1.5">
                        <div className="flex justify-between">
                          <span>1) ดอกเบี้ย 3 ปี (ยอดผ่อนปกติ):</span>
                          <span className="text-indigo-600 font-bold font-mono">{formatCurrency(standardInt)}</span>
                        </div>
                        <div className="flex justify-between pt-1 text-emerald-800 bg-emerald-50/40 p-1 rounded">
                          <span>2) ดอกเบี้ย 3 ปี (ผ่อนจริงถัวเฉลี่ย):</span>
                          <span className="font-bold font-mono">{formatCurrency(actualInt)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex justify-between">
                        <span>ค่าประกันอัคคีภัย Retention (3 ปี):</span>
                        <span className="text-slate-800 font-mono">{formatCurrency(retentionFirePremium)}</span>
                      </div>

                      {oldBankPenaltiesRetention.total > 0 && (
                        <div className="pt-2 border-t border-slate-100 flex flex-col gap-1 text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-100 animate-fadeIn">
                          <div className="flex justify-between text-[10.5px] font-bold">
                            <span>🚨 ภาระค่าปรับทำสัญญาก่อนกำหนด:</span>
                            <span className="font-mono font-black text-sm">+{formatCurrency(oldBankPenaltiesRetention.total)}</span>
                          </div>
                          <div className="text-[9px] text-slate-500 pl-2 space-y-0.5 font-medium">
                            {oldBankPenaltiesRetention.prepaymentCost > 0 && (
                              <div>• ค่าปรับปิดสัญญาเดิมก่อน 3 ปี ({loanInput.prepaymentFeeRate}%): {formatCurrency(oldBankPenaltiesRetention.prepaymentCost)} บ.</div>
                            )}
                            {oldBankPenaltiesRetention.subsidyRefundCost > 0 && (
                              <div>• คืนเงินช่วยเหลือค่าจดจำนองที่เดิม: {formatCurrency(oldBankPenaltiesRetention.subsidyRefundCost)} บ.</div>
                            )}
                            {oldBankPenaltiesRetention.insurancePenaltyCost > 0 && (
                              <div>• ค่าปรับเวนคืนประกันเดิม: {formatCurrency(oldBankPenaltiesRetention.insurancePenaltyCost)} บ.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-150 mt-4 text-xs font-semibold">
                    <div className="space-y-1 bg-emerald-50/30 p-2 rounded-xl mb-3 border border-emerald-200">
                      <div className="flex justify-between uppercase text-slate-400 font-bold text-[9.5px]">
                        <span>ภาระจ่ายสุทธิ (ผ่อนปกติ):</span>
                        <span className="text-slate-800 font-mono font-black text-sm">
                          {formatCurrency(standardInt + retentionFirePremium + oldBankPenaltiesRetention.total)}
                        </span>
                      </div>
                      <div className="flex justify-between uppercase text-emerald-800 font-bold text-[9.5px] border-t border-dashed border-emerald-200 pt-1 mt-1">
                        <span>ภาระจ่ายสุทธิ (ผ่อนจริง):</span>
                        <span className="text-emerald-950 font-mono font-black text-sm">
                          {formatCurrency(actualInt + retentionFirePremium + oldBankPenaltiesRetention.total)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const rows = generateRetentionScheduleRows(
                          loanInput.outstandingPrincipal,
                          currentBankMrrVal,
                          simulatedTotalPayment,
                          true
                        );
                        setActiveRefiSchedule({
                          title: "ตารางคำนวณดอกเบี้ย 3 ปี - Retention ธนาคารเดิม (แบบจำลองการผ่อนจริง)",
                          isSimulated: true,
                          setupFeesBreakdown: {
                            mortgageFee: 0,
                            appraisalFee: 0,
                            dutyStamp: 0,
                            mrtaPremium: 0,
                            fireInsurancePremium: retentionFirePremium,
                            otherFees: oldBankPenaltiesRetention.total,
                            totalSetupFees: retentionFirePremium + oldBankPenaltiesRetention.total
                          },
                          rows
                        });
                      }}
                      className="w-full bg-emerald-700 text-white font-extrabold text-[10.5px] py-1.5 rounded-lg text-center cursor-pointer hover:bg-emerald-800 transition"
                    >
                      🔍 แสดงตารางคำนวณดอกเบี้ย 3 ปี
                    </button>
                  </div>
                </div>
              </div>

              {/* 3+. Refinance ธนาคารต่าง ๆ CARDS */}
              {results.pathways.map((path) => {
                const isBest = championCandidate && championCandidate.type === "refinance" && championCandidate.id === path.id;

                // Find original source bank configuration to retrieve active package configuration
                const originConf = customBanks.find(b => b.id === path.id);
                if (!originConf) return null;

                const activePkgId = originConf.activePackageId || 1;

                // Compute dynamic stats for this refinance pathway and package
                const refiStats = computeRefiPackageSchedule3Yr(
                  loanInput.outstandingPrincipal,
                  originConf,
                  activePkgId,
                  simulatedTotalPayment
                );

                const r1 = resolveRate(originConf.mrr, originConf.yr1);
                const r2 = resolveRate(originConf.mrr, originConf.yr2);
                const r3 = resolveRate(originConf.mrr, originConf.yr3);
                const avgRate = ((r1 + r2 + r3) / 3).toFixed(2);

                return (
                  <div 
                    key={path.id} 
                    className={`bg-white rounded-2xl border-2 flex flex-col shadow-sm overflow-hidden min-h-[360px] transition-all relative hover:shadow-md ${
                      isBest 
                        ? "border-indigo-600 ring-2 ring-indigo-50" 
                        : "border-slate-200"
                    }`}
                  >
                    {isBest && (
                      <span className="absolute top-1 right-2 bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-extrabold animate-pulse z-10">
                        ⭐ คุ้มที่สุด (Refinance)
                      </span>
                    )}

                    <div 
                      className="p-3 border-b flex items-center justify-between text-white gap-2"
                      style={{ backgroundColor: originConf.color }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BankLogo bankId={path.id} size="sm" className="w-5.5 h-5.5 rounded-md bg-white text-slate-900 border border-black/5 flex-shrink-0" />
                        <span className="font-extrabold text-[11.5px] tracking-wider uppercase truncate">
                          Refinance {originConf.nameTh.replace("ธนาคาร", "")}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        ย้ายค่ายใหม่
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="bg-slate-50/80 p-2 text-center rounded-lg border border-slate-150">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">อัตราดอกเบี้ยเฉลี่ย 3 ปีแรก</p>
                          <p className="text-2xl font-black mt-0.5 font-mono" style={{ color: originConf.color }}>
                            {avgRate}% <span className="text-xs text-slate-400 font-semibold">(เฉลี่ย)</span>
                          </p>
                          <div className="text-[9px] font-bold text-slate-400 mt-1 flex justify-center gap-1.5">
                            <span>ปี1: {r1.toFixed(2)}%</span>
                            <span>•</span>
                            <span>ปี2: {r2.toFixed(2)}%</span>
                            <span>•</span>
                            <span>ปี3: {r3.toFixed(2)}%</span>
                          </div>
                        </div>

                        {/* Interactive Package Switcher Dropdown */}
                        <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                          <label className="text-[9px] font-black text-amber-950 uppercase block mb-1">สลับเลือกรูปแบบความคุ้มครอง:</label>
                          <select
                            value={activePkgId}
                            onChange={(e) => {
                              const selectedPkgId = Number(e.target.value);
                              const currentPackages = originConf.packages || getRefiPackagesForBank(
                                originConf.id,
                                originConf.mrr,
                                banksList.find(b => b.id === originConf.id)?.typicalRefinance3Yr || 3.50
                              ).map(pkg => ({
                                id: pkg.id,
                                label: pkg.label,
                                yr1: { type: "fixed" as const, value: pkg.rates[0] },
                                yr2: { type: "fixed" as const, value: pkg.rates[1] },
                                yr3: { type: "fixed" as const, value: pkg.rates[2] },
                                yr4Plus: { type: "mrr" as const, value: pkg.yr4PlusVal },
                                freeMortgage: pkg.freeMortgage,
                                hasMrta: pkg.id === 1 || pkg.id === 2,
                              }));
                              const targetPkg = currentPackages.find(p => p.id === selectedPkgId);
                              if (targetPkg) {
                                setCustomBanks(prev => prev.map(b => b.id === originConf.id ? {
                                  ...b,
                                  activePackageId: targetPkg.id,
                                  yr1: { ...targetPkg.yr1 },
                                  yr2: { ...targetPkg.yr2 },
                                  yr3: { ...targetPkg.yr3 },
                                  yr4Plus: { ...targetPkg.yr4Plus },
                                  freeMortgageFee: targetPkg.freeMortgage,
                                  hasMrta: targetPkg.hasMrta,
                                } : b));
                              }
                            }}
                            className="w-full bg-white text-[10px] font-bold text-slate-800 border border-slate-200 rounded px-1.5 py-1 outline-none cursor-pointer focus:border-indigo-500"
                          >
                            <option value={1}>1. ทำ MRTA + ฟรีค่าจดจำนอง (1%)</option>
                            <option value={2}>2. ทำ MRTA + ไม่ฟรีค่าจดจำนอง</option>
                            <option value={3}>3. ไม่ทำ MRTA + ฟรีค่าจดจำนอง (1%)</option>
                            <option value={4}>4. ไม่ทำ MRTA + ไม่ฟรีค่าจดจำนอง</option>
                          </select>
                        </div>

                        {/* Setup Expenses details */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 space-y-1 text-[10.5px] font-bold text-slate-500">
                          <div className="flex justify-between">
                            <span>ค่าจดจำนอง (1%):</span>
                            <span className="text-slate-800 font-mono">{formatCurrency(refiStats.mortgageFee)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ค่าประเมินราคาทรัพย์:</span>
                            <span className="text-slate-800 font-mono">{formatCurrency(refiStats.appraisalFee)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ค่าอากรแสตมป์:</span>
                            <span className="text-slate-800 font-mono">{formatCurrency(refiStats.dutyStamp)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ค่าประกัน MRTA/MLTA:</span>
                            <span className="text-indigo-600 font-mono">{formatCurrency(refiStats.mrtaPremium)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ค่าประกันอัคคีภัย Refi:</span>
                            <span className="text-slate-800 font-mono">{formatCurrency(refiStats.fireInsurancePremium)}</span>
                          </div>
                          {refiStats.otherFees > 0 && (
                            <div className="flex justify-between">
                              <span>ค่าธรรมเนียมเบ็ดเตล็ด:</span>
                              <span className="text-slate-800 font-mono">{formatCurrency(refiStats.otherFees)}</span>
                            </div>
                          )}
                          {refiStats.oldMrtaRefund !== undefined && refiStats.oldMrtaRefund > 0 && (
                            <div className="flex justify-between text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100/30">
                              <span>เงินคืนเวนคืน MRTA เดิม:</span>
                              <span className="font-mono font-extrabold text-emerald-700">-{formatCurrency(refiStats.oldMrtaRefund)}</span>
                            </div>
                          )}
                          {refiStats.totalPenalties > 0 && (
                            <div className="pt-1.5 border-t border-slate-200 flex flex-col gap-1 text-rose-600 bg-rose-50/50 p-1.5 rounded border border-rose-150 animate-fadeIn text-[10px]">
                              <div className="flex justify-between font-bold">
                                <span>🚨 ค่าปรับทำสัญญาก่อนกำหนด:</span>
                                <span className="font-mono font-black">+{formatCurrency(refiStats.totalPenalties)}</span>
                              </div>
                              <div className="text-[8.5px] text-slate-500 pl-2 space-y-0.5 font-medium">
                                {refiStats.prepaymentCost > 0 && (
                                  <div>• ค่าปรับปิดสัญญาเดิมก่อน 3 ปี ({loanInput.prepaymentFeeRate}%): {formatCurrency(refiStats.prepaymentCost)} บ.</div>
                                )}
                                {refiStats.subsidyRefundCost > 0 && (
                                  <div>• คืนเงินช่วยเหลือค่าจดจำนองที่เดิม: {formatCurrency(refiStats.subsidyRefundCost)} บ.</div>
                                )}
                                {refiStats.insurancePenaltyCost > 0 && (
                                  <div>• ค่าปรับเวนคืนประกันเดิม: {formatCurrency(refiStats.insurancePenaltyCost)} บ.</div>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-dashed border-slate-200 mt-1 pt-1 text-slate-800">
                            <span>รวมค่าใช้จ่ายแรกเข้าสะสมสุทธิ:</span>
                            <span className="font-mono font-extrabold">{formatCurrency(refiStats.totalSetupFees)}</span>
                          </div>
                        </div>

                        {/* Dividends & Interests */}
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-100 text-xs font-semibold text-slate-600">
                          <div className="flex justify-between">
                            <span>1) ดอกเบี้ย 3 ปี (ยอดผ่อนปกติ):</span>
                            <span className="text-slate-800 font-mono font-bold">{formatCurrency(refiStats.standardInterest)}</span>
                          </div>
                          <div className="flex justify-between text-indigo-700 bg-indigo-50/40 p-1 rounded">
                            <span>2) ดอกเบี้ย 3 ปี (ผ่อนจริงถัวเฉลี่ย):</span>
                            <span className="font-mono font-bold">{formatCurrency(refiStats.simulatedInterest)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Total Net Burden Row */}
                      <div className="pt-3 border-t border-slate-150 mt-4 text-xs font-semibold">
                        <div className="space-y-1 bg-slate-50 text-slate-800 p-2.5 rounded-xl mb-3 border border-slate-200">
                          <div className="flex justify-between uppercase text-slate-500 font-extrabold text-[9.5px]">
                            <span>ภาระปกติจ่ายสุทธิ:</span>
                            <span className="text-slate-850 font-mono font-black text-sm">
                              {formatCurrency(refiStats.standardInterest + refiStats.totalSetupFees)}
                            </span>
                          </div>
                          <div className="flex justify-between uppercase text-emerald-700 font-extrabold text-[9.5px] border-t border-dashed border-slate-200 pt-1 mt-1">
                            <span>ภาระจ่ายจริงสุทธิ (ผ่อนจริง):</span>
                            <span className="text-emerald-800 font-mono font-black text-sm">
                              {formatCurrency(refiStats.simulatedInterest + refiStats.totalSetupFees)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const rows = generateScheduleRows(
                              loanInput.outstandingPrincipal,
                              originConf,
                              activePkgId,
                              simulatedTotalPayment,
                              true
                            );
                            setActiveRefiSchedule({
                              title: `ตารางคำนวณดอกเบี้ย 3 ปี - Refinance ${originConf.nameTh} (${getPackageOptionLabel(activePkgId)})`,
                              isSimulated: true,
                              setupFeesBreakdown: {
                                mortgageFee: refiStats.mortgageFee,
                                appraisalFee: refiStats.appraisalFee,
                                dutyStamp: refiStats.dutyStamp,
                                mrtaPremium: refiStats.mrtaPremium,
                                fireInsurancePremium: refiStats.fireInsurancePremium,
                                otherFees: refiStats.otherFees,
                                oldMrtaRefund: refiStats.oldMrtaRefund,
                                totalSetupFees: refiStats.totalSetupFees
                              },
                              rows
                            });
                          }}
                          style={{ backgroundColor: originConf.color }}
                          className="w-full text-white font-extrabold text-[10.5px] py-1.5 rounded-lg text-center cursor-pointer hover:opacity-90 transition"
                        >
                          🔍 แสดงตารางคำนวณดอกเบี้ย 3 ปี
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>

            {/* BREAKEVEN & STATS METRICS BLOCK */}
            <div id="savings-dashboard" className="relative bg-white rounded-2xl border border-slate-150 p-6 shadow-sm space-y-6">
              
              {/* MCRAS Info Button */}
              <button
                id="mcras-info-trigger"
                type="button"
                onClick={() => setShowMcrasInfo(true)}
                className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-400 hover:text-indigo-600 p-1.5 rounded-full hover:bg-slate-50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100/60 z-10"
                title="ระบบประเมินผลอัจฉริยะ MCRAS"
              >
                <Info className="w-5 h-5" />
              </button>

              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-rose-100/40 gap-4 pr-8 lg:pr-10">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm md:text-md tracking-wide flex items-center gap-1.5 matches-title">
                    <span className="text-rose-600">📊</span>
                    ระบบประเมินผลอัจฉริยะ MCRAS (Multi-Criteria Rating & Advisory System)
                  </h3>
                  <p className="text-[11.5px] text-slate-450 mt-0.5">ระบบจะวิเคราะห์ประเมินเปรียบเทียบสัญญาอัตราดอกเบี้ยและค่าธรรมเนียมแฝงครอบคลุม 5 มิติความคุ้มค่ารอบด้าน</p>
                </div>
              </div>

              {/* Interactive Persona Strategy Selector */}
              <div className="space-y-3">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">
                  🎯 เลือกแผนกลยุทธ์ตามพฤติกรรมและความต้องการของคุณ (Interactive Persona)
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {(["balanced", "max_savings", "cash_preservation", "maximum_convenience", "rate_stability"] as const).map((strategy) => {
                    const isSelected = optimizationStrategy === strategy;
                    let label = "";
                    let desc = "";
                    let iconColor = "";
                    let bgActive = "";
                    let iconElement = null;

                    switch (strategy) {
                      case "balanced":
                        label = "สมบูรณ์ทุกด้าน";
                        desc = "เกลี่ยน้ำหนักให้คะแนน 5 มิติสัดส่วนเท่ากัน";
                        iconColor = "text-indigo-650";
                        bgActive = "border-indigo-300 bg-indigo-50/10";
                        iconElement = <Sparkles className="w-5 h-5" />;
                        break;
                      case "max_savings":
                        label = "ประหยัดหนี้สุทธิสุด";
                        desc = "เน้นเซฟต้นและดอกสะสมรวมสูงสุด 3 ปี";
                        iconColor = "text-emerald-650";
                        bgActive = "border-emerald-300 bg-emerald-50/10";
                        iconElement = <PiggyBank className="w-5 h-5" />;
                        break;
                      case "cash_preservation":
                        label = "เน้นกระแสเงินสด";
                        desc = "ค่างวดผ่อนต่ำสุด รักษาสภาพคล่องส่วนตัว";
                        iconColor = "text-amber-650";
                        bgActive = "border-amber-300 bg-amber-50/10";
                        iconElement = <Coins className="w-5 h-5" />;
                        break;
                      case "maximum_convenience":
                        label = "ขั้นตอนง่ายรวดเร็ว";
                        desc = "เน้นเอกสารน้อยและไม่ย้ายค่ายยุ่งยาก";
                        iconColor = "text-sky-650";
                        bgActive = "border-sky-300 bg-sky-50/10";
                        iconElement = <ClipboardList className="w-5 h-5" />;
                        break;
                      case "rate_stability":
                        label = "ดอกเบี้ยเสถียรคงที่";
                        desc = "เลี่ยงความผันผวน MRR ด้วยช่วงล็อคคงที่ยาว";
                        iconColor = "text-pink-650";
                        bgActive = "border-pink-300 bg-pink-50/10";
                        iconElement = <ShieldCheck className="w-5 h-5" />;
                        break;
                    }

                    return (
                      <button
                        key={strategy}
                        type="button"
                        onClick={() => setOptimizationStrategy(strategy)}
                        className={`p-3 rounded-xl border-2 text-left cursor-pointer transition duration-200 font-sans flex flex-col justify-between h-28 ${
                          isSelected 
                            ? `${bgActive} ring-2 ring-indigo-500/10 shadow-sm` 
                            : "border-slate-150 bg-white hover:border-slate-250 hover:bg-slate-50/30"
                        }`}
                      >
                        <div className="flex items-start justify-between w-full">
                          <span className={iconColor}>{iconElement}</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-350"}`}>
                            {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full block" />}
                          </div>
                        </div>
                        <div className="mt-2 text-slate-800 leading-snug">
                          <p className="text-[11px] font-black">{label}</p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5 leading-tight line-clamp-2">{desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scored Proposals Ranked List */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">
                  💡 ผลลัพธ์อันดับความเหมาะสมเรียงตามความคุ้มค่า (MCRAS Performance Ranking)
                </p>
                <div className="space-y-3">
                  {scoredPathways && scoredPathways.map((p, index) => {
                    const isWinner = index === 0;
                    return (
                      <div 
                        key={p.id} 
                        className={`p-4 rounded-xl border transition duration-300 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 relative overflow-hidden ${
                          isWinner ? "border-indigo-200 bg-indigo-50/5 ring-1 ring-indigo-500/10 shadow-xs" : "border-slate-150 bg-white hover:border-slate-250 shadow-xs"
                        }`}
                      >
                        {isWinner && (
                          <span className="absolute top-0 right-0 bg-indigo-600 text-white font-extrabold text-[8px] uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                            MCRAS Choice
                          </span>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black font-mono transition ${isWinner ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-200 text-slate-700"}`}>
                              {index + 1}
                            </span>
                            <h4 className="font-bold text-[12.5px] text-slate-800 flex items-center gap-1.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full block shrink-0" style={{ backgroundColor: p.color }}></span>
                              <span className="truncate">{p.nameTh}</span>
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-extrabold rounded text-[9px]">
                              {p.tagTh}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold rounded text-[9px] font-mono">
                              คะแนนแนะนำ: {p.compositeScore}%
                            </span>
                            {p.setupFees === 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[9px]">
                                ฟรี! ไม่มีแรกเข้า
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-extrabold font-mono">
                                ค่าแรกเข้า: {formatCurrency(p.setupFees)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Rating Progress Bar */}
                        <div className="flex-1 max-w-sm space-y-1 self-stretch lg:self-center">
                          <div className="flex justify-between text-[10px] font-black text-slate-600 pl-0.5">
                            <span>ดัชนีคุณค่าเชิงประสิทธิผลรวม</span>
                            <span className="font-mono font-black text-indigo-600">{p.compositeScore} / 100</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${p.compositeScore}%`,
                                backgroundColor: p.color
                              }}
                            />
                          </div>
                          <div className="text-[9.5px] text-slate-500 font-semibold pl-0.5 italic leading-tight">
                            * {p.verdictTh}
                          </div>
                        </div>

                        {/* Sub-criteria Ratings Grid */}
                        <div className="grid grid-cols-5 gap-1.5 text-center min-w-[270px] shrink-0 self-center">
                          <div className="p-1 px-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block uppercase">เซฟประหยัด</span>
                            <span className="text-[11px] font-black font-mono text-emerald-600 block mt-0.5">{p.scoreSavings}</span>
                            <span className="text-[7px] text-slate-400 font-bold">(3 ปี)</span>
                          </div>

                          <div className="p-1 px-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block uppercase">สภาพคล่อง</span>
                            <span className="text-[11px] font-black font-mono text-indigo-650 block mt-0.5">{p.scoreLiquidity}</span>
                            <span className="text-[7px] text-slate-400 font-bold">(ค่างวด)</span>
                          </div>

                          <div className="p-1 px-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block uppercase">คืนทุนไว</span>
                            <span className="text-[11px] font-black font-mono text-amber-600 block mt-0.5">{p.scoreBreakeven}</span>
                            <span className="text-[7px] text-slate-400 font-bold">({p.breakevenMonths > 0 ? `${p.breakevenMonths}ด.` : "ทันที"})</span>
                          </div>

                          <div className="p-1 px-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block uppercase">ความคงที่</span>
                            <span className="text-[11px] font-black font-mono text-pink-650 block mt-0.5">{p.scoreStability}</span>
                            <span className="text-[7px] text-slate-400 font-bold">({p.fixedMonths}ด.)</span>
                          </div>

                          <div className="p-1 px-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block uppercase">ขั้นตอนง่าย</span>
                            <span className="text-[11px] font-black font-mono text-sky-650 block mt-0.5">{p.scoreConvenience}</span>
                            <span className="text-[7px] text-slate-400 font-bold">(เอกสาร)</span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed First-Bound 3-Year Interest Rates Scenario Matrix */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-[9.5px] font-mono select-none">COMPARATIVE</span>
                    <h4 className="font-extrabold text-slate-800 text-[13px] flex items-center gap-1.5 leading-snug">
                      <Landmark className="w-4 h-4 text-indigo-600" />
                      ตารางเปรียบเทียบโครงสร้างอัตราดอกเบี้ยและงบค่าธรรมเนียมรวม (3-Year Complete Scenario Interest Rate Matrix)
                    </h4>
                  </div>
                  <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 font-extrabold px-2.5 py-0.5 rounded-full select-none">
                    จำลองบนยอด: {formatCurrency(loanInput.outstandingPrincipal)}
                  </span>
                </div>
                
                <p className="text-[11.5px] text-slate-500 leading-relaxed font-semibold">
                  พิจารณาโครงสร้างช่วงคงที่ (Fixed) เทียบกับแบบลอยตัว (Float) ของแต่ละธนาคาร รวมถึงค่าแรกเข้าแรกเริ่ม และงบประมาณการประหยัดสุทธิเพื่อความคุ้มค่าสูงสุดในการตัดสินใจ
                </p>

                {/* Desktop and Mobile optimized view */}
                <div className="overflow-x-auto rounded-xl border border-slate-205 shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs select-none">
                    <thead>
                      <tr className="bg-slate-50 text-slate-650 border-b border-slate-200 font-black text-[10.5px]">
                        <th className="py-2.5 px-3">กรณีศึกษา / สถาบันการเงิน</th>
                        <th className="py-2.5 px-2 text-center border-l border-slate-200 bg-slate-100/10">ปีที่ 1</th>
                        <th className="py-2.5 px-2 text-center bg-slate-100/10">ปีที่ 2</th>
                        <th className="py-2.5 px-2 text-center bg-slate-100/10">ปีที่ 3</th>
                        <th className="py-2.5 px-3 text-center border-l border-slate-200 bg-indigo-50/20 text-indigo-900">อัตราเฉลี่ย 3 ปี</th>
                        <th className="py-2.5 px-3 border-l border-slate-150">ดอกเบี้ยรวม 3 ปี</th>
                        <th className="py-2.5 px-3">ค่าแรกเข้า/ค่าจดจำนอง</th>
                        <th className="py-2.5 px-3 border-l border-slate-150 bg-slate-50/40 text-slate-700">ภาระรวมสุทธิ (Net Costs)</th>
                        <th className="py-2.5 px-3 border-l border-slate-150 bg-emerald-50/20 text-emerald-950 font-black">งบประมาณประหยัดสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-bold font-mono text-[11px]">
                      {allComparisonOptions.map((opt) => {
                        const isChamp = smartChampion && smartChampion.id === opt.id;
                        const isCurrent = opt.id === "current";

                        return (
                          <tr 
                            key={opt.id} 
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isChamp ? "bg-indigo-50/5" : ""
                            }`}
                          >
                            {/* Option Name Column */}
                            <td className="py-3 px-3 font-semibold select-all font-sans min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0 block" style={{ backgroundColor: opt.color }} />
                                <div>
                                  <span className="font-extrabold text-slate-800 text-[11.5px] block">
                                    {opt.nameTh}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                                    {opt.tagTh}
                                  </span>
                                </div>
                                {isChamp && (
                                  <span className="bg-indigo-650 text-white font-extrabold text-[8px] uppercase px-1.5 py-0.2 rounded-xs tracking-wider shrink-0 ml-1.5 animate-pulse">
                                    MCRAS Choice
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Year 1 Rate */}
                            <td className="py-3 px-2 text-center text-slate-700 border-l border-slate-100 font-medium font-mono">
                              {opt.yr1Rate.toFixed(2)}%
                            </td>

                            {/* Year 2 Rate */}
                            <td className="py-3 px-2 text-center text-slate-700 font-medium font-mono">
                              {opt.yr2Rate.toFixed(2)}%
                            </td>

                            {/* Year 3 Rate */}
                            <td className="py-3 px-2 text-center text-slate-700 font-medium font-mono">
                              {opt.yr3Rate.toFixed(2)}%
                            </td>

                            {/* 3-Year Average Rate */}
                            <td className="py-3 px-3 text-center border-l border-slate-200 bg-indigo-50/10 text-indigo-700 font-black font-mono select-all text-xs">
                              {opt.avgRate.toFixed(3)}%
                            </td>

                            {/* Total Interest 3 Years */}
                            <td className="py-3 px-3 border-l border-slate-150 text-slate-600">
                              {formatCurrency(opt.interest)}
                            </td>

                            {/* Setup Fees */}
                            <td className="py-3 px-3 text-slate-500 font-medium">
                              {opt.setupFees === 0 ? (
                                <span className="text-emerald-600 font-extrabold">ฟรีไม่มีรายจ่ายแรกเข้า</span>
                              ) : (
                                formatCurrency(opt.setupFees)
                              )}
                            </td>

                            {/* Net Costs */}
                            <td className="py-3 px-3 border-l border-slate-150 bg-slate-50/30 text-slate-800 font-black">
                              {formatCurrency(opt.netExpense)}
                            </td>

                            {/* Net Savings */}
                            <td className={`py-3 px-3 border-l border-slate-150 font-black text-xs ${
                              isCurrent ? "text-slate-400 font-medium" : "text-emerald-700 bg-emerald-50/10"
                            }`}>
                              {isCurrent ? (
                                "ฐานเปรียบเทียบ"
                              ) : opt.savings > 0 ? (
                                <span className="flex items-center gap-1">
                                  <span>+{formatCurrency(opt.savings)} บ.</span>
                                  {isChamp && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded-sm">คุ้มสุด</span>}
                                </span>
                              ) : (
                                <span className="text-rose-600">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[10.5px] font-semibold text-slate-500">
                  <div className="p-2 bg-slate-50 rounded-lg flex items-start gap-2 border border-slate-150">
                    <span className="text-indigo-600 text-[12px] shrink-0 mt-0.5">💡</span>
                    <div>
                      <span className="font-extrabold text-slate-700 block">เทคนิคการเปรียบเทียบ</span>
                      การเทียบแค่อัตราดอกเบี้ยเบื้องต้นอาจจะไม่ครอบคลุมทั้งหมด ควรพิจารณายอดผ่อนชำระเฉลี่ย และผลต่างจากฝั่งประหยัดสุทธิที่รวมค่าธรรมเนียมแล้วเสมอ
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg flex items-start gap-2 border border-slate-150">
                    <span className="text-emerald-600 text-[12px] shrink-0 mt-0.5">🛡️</span>
                    <div>
                      <span className="font-extrabold text-slate-700 block">ช่วงอัตราดอกเบี้ยคงที่ (Fixed)</span>
                      ในยุคที่มีการเปลี่ยนแปลงขยับเกณฑ์ MRR บ่อย การเลือกรีไฟแนนซ์หรือปรับสัญญาแบบคงที่ (Fixed Block) จะช่วยป้องกันความเสี่ยงอัตราดอกเบี้ยได้อย่างมีระเบียบวินัย
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg flex items-start gap-2 border border-slate-150">
                    <span className="text-amber-500 text-[12px] shrink-0 mt-0.5">⚡</span>
                    <div>
                      <span className="font-extrabold text-slate-700 block">ค่าปรับปิดบัญชีก่อนครบกำหนด</span>
                      เมื่อประสงค์จะย้ายค่ายรีไฟแนนซ์ ควรประเมินระยะเวลาการเวนคืนรวมถึงตรวจเช็คดีลค่าปรับและระยะเวลาการหามูลค่าประนอมหนี้แบงก์เก่าเพื่อเลี่ยงผลปรับสูงสุด 3%
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* TAB SELECTOR: CHART AND AMORTIZATION DETAILED TABLES */}
            <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-6">
              
              {/* Definitions and memos for all pathways in order to display inside the matrix */}
              {(() => {
                const activeRetentionSchedule = refiScheduleType === "simulated" ? actualSchedule : standardSchedule;
                const activeRetentionScheduleWithAccInt = (() => {
                  let accInt = 0;
                  return activeRetentionSchedule.map(r => {
                    accInt += r.interest;
                    return { ...r, accumulatedInterest: accInt };
                  });
                })();

                const allComparisonOptions = [
                  {
                    id: "current",
                    nameTh: "กู้เดิมแบบปล่อยลอยตัวต่อเนื่อง",
                    color: "#94a3b8",
                    installment: refiScheduleType === "simulated" ? Math.max(loanInput.currentYr1Installment, simulatedTotalPayment) : loanInput.currentYr1Installment,
                    interest: refiScheduleType === "simulated" ? currentLoan3YrStats.simulatedInterest : currentLoan3YrStats.standardInterest,
                    setupFees: 0,
                    netExpense: refiScheduleType === "simulated" ? currentLoan3YrStats.simulatedInterest : currentLoan3YrStats.standardInterest,
                    savings: 0,
                    avgRate: ((resolveRate(currentBankMrrVal, loanInput.currentYr1Rate) + resolveRate(currentBankMrrVal, loanInput.currentYr2Rate) + resolveRate(currentBankMrrVal, loanInput.currentYr3Rate)) / 3),
                    yr1Rate: resolveRate(currentBankMrrVal, loanInput.currentYr1Rate),
                    yr2Rate: resolveRate(currentBankMrrVal, loanInput.currentYr2Rate),
                    yr3Rate: resolveRate(currentBankMrrVal, loanInput.currentYr3Rate),
                    tagTh: "ดอกเบี้ยลอยตัวแบงก์เดิม",
                  },
                  {
                    id: "retention",
                    nameTh: "Retention ต่อสัญญากับแบงก์เก่า",
                    color: "#10b981",
                    installment: refiScheduleType === "simulated" ? Math.max(origSimInstallments.yr1, simulatedTotalPayment) : origSimInstallments.yr1,
                    interest: refiScheduleType === "simulated" ? actualInt : standardInt,
                    setupFees: retentionFirePremium + oldBankPenaltiesRetention.total,
                    netExpense: (refiScheduleType === "simulated" ? actualInt : standardInt) + retentionFirePremium + oldBankPenaltiesRetention.total,
                    savings: refiScheduleType === "simulated" ? (currentLoan3YrStats.simulatedInterest - (actualInt + retentionFirePremium + oldBankPenaltiesRetention.total)) : (currentLoan3YrStats.standardInterest - (standardInt + retentionFirePremium + oldBankPenaltiesRetention.total)),
                    avgRate: ((resolveRate(currentBankMrrVal, origSimRates.yr1) + resolveRate(currentBankMrrVal, origSimRates.yr2) + resolveRate(currentBankMrrVal, origSimRates.yr3)) / 3),
                    yr1Rate: resolveRate(currentBankMrrVal, origSimRates.yr1),
                    yr2Rate: resolveRate(currentBankMrrVal, origSimRates.yr2),
                    yr3Rate: resolveRate(currentBankMrrVal, origSimRates.yr3),
                    tagTh: "ปรับลดดอกเบี้ยแบงก์เก่า",
                  }
                ];

                customBanks.forEach(bank => {
                  const activePkgId = bank.activePackageId || 1;
                  const refiStats = computeRefiPackageSchedule3Yr(
                    loanInput.outstandingPrincipal,
                    bank,
                    activePkgId,
                    simulatedTotalPayment
                  );

                  let yr1R = 0, yr2R = 0, yr3R = 0;
                  const pkgObj = bank.packages?.find(p => p.id === activePkgId) || bank.packages?.[0];
                  if (pkgObj) {
                    yr1R = resolveRate(bank.mrr, pkgObj.yr1);
                    yr2R = resolveRate(bank.mrr, pkgObj.yr2);
                    yr3R = resolveRate(bank.mrr, pkgObj.yr3);
                  } else {
                    yr1R = resolveRate(bank.mrr, bank.yr1);
                    yr2R = resolveRate(bank.mrr, bank.yr2);
                    yr3R = resolveRate(bank.mrr, bank.yr3);
                  }

                  const interestVal = refiScheduleType === "simulated" ? refiStats.simulatedInterest : refiStats.standardInterest;
                  const netExpenseVal = interestVal + refiStats.totalSetupFees;
                  const savingsVal = refiScheduleType === "simulated" 
                    ? (currentLoan3YrStats.simulatedInterest - netExpenseVal)
                    : (currentLoan3YrStats.standardInterest - netExpenseVal);

                  allComparisonOptions.push({
                    id: bank.id,
                    nameTh: `Refinance ${bank.nameTh}`,
                    color: bank.color,
                    installment: refiScheduleType === "simulated" 
                      ? Math.max(bank.isInstallmentAdjusted ? bank.customInstallment : loanInput.currentInstallment, simulatedTotalPayment)
                      : (bank.isInstallmentAdjusted ? bank.customInstallment : loanInput.currentInstallment),
                    interest: interestVal,
                    setupFees: refiStats.totalSetupFees,
                    netExpense: netExpenseVal,
                    savings: savingsVal,
                    avgRate: (yr1R + yr2R + yr3R) / 3,
                    yr1Rate: yr1R,
                    yr2Rate: yr2R,
                    yr3Rate: yr3R,
                    tagTh: pkgObj ? `แพ็กเกจขอยื่นแบบ ${pkgObj.name || activePkgId}` : "ย้ายสู่สถาบันหลักทุนใหม่",
                  });
                });

                return (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm md:text-md flex items-center gap-1.5">
                          <Percent className="w-5 h-5 text-indigo-600" />
                          ตารางเปรียบเทียบอัตราดอกเบี้ยและแผนผ่อนภาระรวม (Rate & Financial Burden Comparative Matrix)
                        </h3>
                        <p className="text-[11px] text-slate-450 mt-0.5">พิจารณาดอกเบี้ยรายงวด ค่างวดผ่อน และค่าธรรมเนียมรวม เพื่อหาปลายทางที่เบาสุดอย่างเป็นธรรมเชิงประจักษ์</p>
                      </div>

                      <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto shrink-0 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setActiveTab("chart")}
                          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                            activeTab === "chart"
                              ? "bg-white text-indigo-700 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          สรุปภาพกราฟและแรงขับเคลื่อน
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("table")}
                          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                            activeTab === "table"
                              ? "bg-white text-indigo-700 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          บัญชีตารางค่างวด Amortization
                        </button>
                      </div>
                    </div>



                    {/* Conditional dynamic views based on activeTab */}
                    {activeTab === "chart" ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Segment Cumulative breakdown bars */}
                        <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 md:p-5 flex flex-col justify-between">
                          <div>
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-3 select-none">
                              <Percent className="w-4 h-4 text-indigo-600" />
                              เปรียบเทียบภาระสะสมทั้งหมดเมื่อหักกลบลบหนี้ (Cumulative Net Burden comparison)
                            </p>
                            <div className="space-y-4">
                              {allComparisonOptions.map((opt) => {
                                const maxExpense = Math.max(...allComparisonOptions.map(o => o.netExpense));
                                const pctRatio = (opt.netExpense / maxExpense) * 100;
                                const isChamp = championCandidate && championCandidate.id === opt.id;

                                return (
                                  <div key={opt.id} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs font-semibold select-none">
                                      <span className="flex items-center gap-1.5 font-bold" style={{ color: opt.color }}>
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                                        {opt.nameTh} {isChamp && <span className="ml-1 px-1 text-[8px] bg-emerald-100 text-emerald-800 rounded font-black font-mono">RECOMMENDED</span>}
                                      </span>
                                      <span className="text-slate-850 font-mono font-black">
                                        {formatCurrency(opt.netExpense)}
                                      </span>
                                    </div>
                                    <div className="w-full h-3.5 bg-white rounded-full overflow-hidden flex border border-slate-200 relative shadow-inner">
                                      <div 
                                        className="h-full rounded-full transition-all duration-1000" 
                                        style={{ 
                                          backgroundColor: opt.color,
                                          width: `${Math.min(100, Math.max(10, pctRatio))}%` 
                                        }}
                                      ></div>
                                      {opt.savings > 0 && (
                                        <span className="absolute right-2 top-0 text-[9px] font-black text-emerald-600 flex h-full items-center font-mono">
                                          เซฟสุทธิ +{formatCurrency(opt.savings)} บ.
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-450 mt-4 italic font-semibold leading-relaxed">💡 วิเคราะห์พิเศษ: เงินสะสมการประหยัด (Net Savings) คำนวณจากการนำเอารวมดอกเบี้ยตลอด 3 ปีลบด้วยค่าธรรมเนียมแรกเข้าทำเหนียว โดยสถาบันปลายทางส่วนใหญ่ให้ดีลพรีเมี่ยมจนชดเชยค่าจดจำนองคุ้มที่สุด!</p>
                        </div>

                        {/* Principal Decay SVG curve graph */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 flex flex-col justify-between text-slate-800">
                          <div>
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2 select-none">
                              <TrendingDown className="w-4 h-4 text-indigo-600" />
                              วิเคราะห์แนวทางลดต้นส่งผลให้เงินต้นกู้ลดหลั่นสะสม 36 งวด (Outstanding Balance Decay)
                            </p>
                            
                            <div className="relative h-56 w-full mt-2">
                              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
                                <line x1="20" y1="15" x2="480" y2="15" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
                                <line x1="20" y1="65" x2="480" y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
                                <line x1="20" y1="115" x2="480" y2="115" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
                                <line x1="20" y1="150" x2="480" y2="150" stroke="#cbd5e1" strokeWidth="1" />

                                {(() => {
                                  const maxVal = Math.max(
                                    loanInput.outstandingPrincipal,
                                    ...monthlyList.map(row => row.currentBalance),
                                    ...activeRetentionSchedule.map(row => row.endBal),
                                    ...monthlyList.flatMap(row => pathwaysToSimulate.map(p => row.paths[p.id]?.balance || 0))
                                  );
                                  const minVal = monthlyList[0] 
                                    ? Math.min(
                                        monthlyList[35]?.currentBalance || 0,
                                        activeRetentionSchedule[35]?.endBal || 0,
                                        ...pathwaysToSimulate.map(p => monthlyList[35]?.paths[p.id]?.balance || 0)
                                      ) 
                                    : 0;
                                  const diff = maxVal - minVal || 1;

                                  const getSVGPoint = (month: number, value: number) => {
                                    const x = 20 + (month / 36) * 460;
                                    const rawRatio = (maxVal - value) / diff;
                                    const ratio = Math.max(0, Math.min(1, rawRatio));
                                    const y = 15 + ratio * 130; 
                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                  };

                                  let currentPoints = `20,15`;
                                  let retentionPoints = `20,15`;
                                  const pathPointsMap: Record<string, string> = {};
                                  pathwaysToSimulate.forEach(p => {
                                    pathPointsMap[p.id] = `20,15`;
                                  });

                                  monthlyList.forEach((row, idx) => {
                                    const m = idx + 1;
                                    currentPoints += ` ${getSVGPoint(m, row.currentBalance)}`;
                                    retentionPoints += ` ${getSVGPoint(m, activeRetentionSchedule[idx]?.endBal || row.currentBalance)}`;
                                    pathwaysToSimulate.forEach(p => {
                                      pathPointsMap[p.id] += ` ${getSVGPoint(m, row.paths[p.id]?.balance || row.currentBalance)}`;
                                    });
                                  });

                                  return (
                                    <>
                                      {/* Baseline */}
                                      <polyline fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3" points={currentPoints} />
                                      
                                      {/* Retention */}
                                      <polyline fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" points={retentionPoints} />

                                      {/* Refinancing lines */}
                                      {pathwaysToSimulate.map(p => (
                                        <polyline 
                                          key={p.id}
                                          fill="none" 
                                          stroke={p.color} 
                                          strokeWidth="2.5" 
                                          strokeLinecap="round" 
                                          points={pathPointsMap[p.id]} 
                                        />
                                      ))}
                                    </>
                                  );
                                })()}
                              </svg>

                              {/* Interactive Legendary label box inside */}
                              <div className="absolute top-1 right-1 bg-white/95 border border-slate-200/80 p-2 rounded-xl text-[9px] space-y-1.5 z-10 leading-snug shadow-xs max-w-[170px]">
                                <div className="flex items-center gap-1.5 font-bold text-slate-500">
                                  <span className="w-2.5 h-0.5 border-t border-dashed border-slate-400 block shrink-0"></span>
                                  <span className="truncate">ปล่อยลอยตัวปกติ</span>
                                </div>
                                <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                                  <span className="w-2.5 h-1.5 block bg-[#10b981] shrink-0 rounded-xs"></span>
                                  <span className="truncate">Retention เดิม</span>
                                </div>
                                {pathwaysToSimulate.map(p => (
                                  <div key={p.id} className="flex items-center gap-1.5 font-bold" style={{ color: p.color }}>
                                    <span className="w-2.5 h-1.5 block shrink-0 rounded-xs" style={{ backgroundColor: p.color }}></span>
                                    <span className="truncate">Refi {p.nameThTh || p.nameTh}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="absolute left-1 top-0 text-[8px] text-slate-400 font-bold bg-white/60 px-1 rounded select-none">
                                เงินต้นตั้งต้น: {formatCurrency(loanInput.outstandingPrincipal)}
                              </div>
                            </div>

                            {/* X axis lines with labels */}
                            <div className="flex justify-between text-[8px] font-black text-slate-400 pt-1.5 border-t border-slate-100 font-mono px-[20px] select-none">
                              <span>เริ่มต้น</span>
                              <span>ปีที่ 1 (งวด 12)</span>
                              <span>ปีที่ 2 (งวด 24)</span>
                              <span>ปีที่ 3 (งวด 36)</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      
                      /* Month-by-month table analysis with full comparative detail */
                      <div id="amortization-table-grid" className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs bg-white">
                        <table className="w-full text-left border-collapse text-xs select-none">
                          <thead>
                            <tr className="bg-slate-50 text-slate-650 border-b border-slate-200 font-black text-[10.5px]">
                              <th className="py-2.5 px-3 text-center">งวดที่</th>
                              <th className="py-2.5 px-3 border-r border-slate-200 bg-slate-100/30 text-slate-700">
                                ยอดค้างเดิมลอยตัว
                              </th>
                              <th className="py-2.5 px-3 border-r border-slate-200 bg-emerald-50/20 text-emerald-800">
                                Retention เดิม (ลดคุ้มถัดไป)
                              </th>
                              {customBanks.map(bank => (
                                <th 
                                  key={bank.id} 
                                  className="py-2.5 px-3 border-r border-slate-200 font-black"
                                  style={{ backgroundColor: `${bank.color}0a`, color: bank.color }}
                                >
                                  {bank.nameTh.replace("ธนาคาร", "")} Refi
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 font-bold font-mono text-[11px]">
                            {monthlyList.map((row, idx) => {
                              return (
                                <tr key={row.monthNumber} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-2 px-3 text-slate-550 text-center font-extrabold select-none">
                                    <span className="block">{row.monthNumber}</span>
                                    {row.monthNumber % 12 === 0 && (
                                      <span className="block text-[8px] bg-indigo-50 text-indigo-700 px-1 rounded-sm mt-0.5 font-black">
                                        ปีที่ {row.monthNumber / 12}
                                      </span>
                                    )}
                                  </td>

                                  {/* Current default base value */}
                                  <td className="py-2 px-3 border-r border-slate-150 bg-slate-50/25 text-slate-600">
                                    <p>{formatCurrency(row.currentBalance)}</p>
                                    <p className="text-[10px] text-slate-400 font-semibold">ดบ.{formatCurrency(row.currentInterest)}</p>
                                  </td>

                                  {/* Contracted retention balance */}
                                  <td className="py-2 px-3 border-r border-slate-150 bg-emerald-50/5 text-slate-700">
                                    <p className="text-emerald-950 font-extrabold">{formatCurrency(activeRetentionSchedule[idx]?.endBal || 0)}</p>
                                    <div className="text-[9.5px] flex justify-between gap-1 mt-0.5 select-none font-semibold">
                                      <span className="text-emerald-600 block">ดบ.{formatCurrency(activeRetentionSchedule[idx]?.interest || 0)}</span>
                                      <span className="text-emerald-700 font-mono font-black block bg-emerald-100/50 px-1 rounded-xs">
                                        เซฟ +{formatCurrency(row.currentAccumulatedInterest - (activeRetentionScheduleWithAccInt[idx]?.accumulatedInterest || 0))}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Specific bank simulated rows */}
                                  {customBanks.map(bank => {
                                    const bankRowResult = row.paths[bank.id];
                                    return (
                                      <td 
                                        key={bank.id} 
                                        className="py-2 px-3 border-r border-slate-100"
                                        style={{ backgroundColor: `${bank.color}01` }}
                                      >
                                        <p className="font-extrabold text-slate-800">{formatCurrency(bankRowResult?.balance || 0)}</p>
                                        <div className="text-[9.5px] flex justify-between gap-1 mt-0.5 font-bold">
                                          <span style={{ color: bank.color }}>ดบ.{formatCurrency(bankRowResult?.interest || 0)}</span>
                                          <span className="text-indigo-700 font-mono font-black bg-indigo-50 px-1 rounded-xs">
                                            เซฟ +{formatCurrency(row.currentAccumulatedInterest - (bankRowResult?.accumulatedInterest || 0))}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* FINANCIAL TIPS & ADVISORY FOOTER */}
            <div id="calculator-disclaimer" className="p-4 bg-slate-100 rounded-xl border border-slate-200/60 text-slate-500 text-[11px] leading-relaxed relative overflow-hidden font-sans">
              <div className="absolute top-0 right-0 h-full w-1 bg-slate-300"></div>
              <h4 className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                ข้อชี้แนะระบบทางเลือกทางการเงินสำหรับการทำ Retention vs Refinance
              </h4>
              <ul className="list-disc pl-4 space-y-1 leading-normal font-sans text-slate-600 font-semibold">
                <li>การทำ Retention ใช้ปริมาณเอกสารและการรวบรวมข้อมูลสถานการณ์บูโรน้อยและยืดหยุ่นกว่ารีไฟแนนซ์ จึงอนุมัติได้ไวภายใน 2-3 สัปดาห์ข้างต้น</li>
                <li>การ Refinance ไปสถาบันกู้ปลายทางใหม่ ถือเป็นการรวบกระบวนการจดจำนองที่ดินใหม่ทั้งหมดตามกฎหมาย จึงมีส่วนต่างมูลค่าสะสมค่าจดสัญญา และค่าประเมิน</li>
                <li>ท่านควรประสานงานแบงก์เก่าเพื่อเช็คสิทธิ์ปิดสัญญาลดหย่อนดอกเบี้ยก่อนครบกำหนด 3 ปี (ป้องกันเบี้ยปรับปิดสัญญาปิดบัญชีกู้ด่วนก่อนเวลากำหนด 0.5% - 3%)</li>
              </ul>
            </div>

          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer id="app-footer" className="bg-white text-slate-500 border-t border-slate-200 py-6 text-center text-xs print:hidden mt-auto">
        <p>© 2569 Thai Home Loan Retention & Refinance Multi-Compare. สงวนลิขสิทธิ์</p>
        <p className="opacity-60 text-[10px] mt-1">คู่คิดคำนวณเบี้ยสัดส่วนอย่างแม่นยำรายเดือนตามหลัก Effective Rate อพาร์ทเมนท์และยอดสินเชื่อมวลชน</p>
      </footer>

      {activeRefiSchedule && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200 text-slate-800">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 text-slate-800 p-4 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-sm md:text-base tracking-wide flex items-center gap-1.5 text-indigo-900">
                <span>📊 {activeRefiSchedule.title}</span>
              </h3>
              <button 
                type="button"
                onClick={() => setActiveRefiSchedule(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg bg-slate-200/50 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Fees Summary if provided */}
            {activeRefiSchedule.setupFeesBreakdown && activeRefiSchedule.setupFeesBreakdown.totalSetupFees > 0 && (
              <div id="setup-fees-popup-grid" className={`bg-amber-50/70 p-4 border-b border-amber-100 grid grid-cols-2 ${activeRefiSchedule.setupFeesBreakdown.oldMrtaRefund && activeRefiSchedule.setupFeesBreakdown.oldMrtaRefund > 0 ? "md:grid-cols-5" : "md:grid-cols-4"} gap-3 shrink-0`}>
                <div>
                  <span className="text-[10px] text-amber-900 uppercase font-black block">รวมค่าจดจำนอง + อากร:</span>
                  <span className="text-xs font-bold text-amber-950 font-mono">
                    {formatCurrency(activeRefiSchedule.setupFeesBreakdown.mortgageFee + activeRefiSchedule.setupFeesBreakdown.dutyStamp)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-900 uppercase font-black block">ค่าประเมินราคาทรัพย์:</span>
                  <span className="text-xs font-bold text-amber-950 font-mono">
                    {formatCurrency(activeRefiSchedule.setupFeesBreakdown.appraisalFee)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-900 uppercase font-black block">ค่าประกัน (MRTA + อัคคีภัย):</span>
                  <span className="text-xs font-bold text-amber-950 font-mono">
                    {formatCurrency(activeRefiSchedule.setupFeesBreakdown.mrtaPremium + activeRefiSchedule.setupFeesBreakdown.fireInsurancePremium)}
                  </span>
                </div>
                {activeRefiSchedule.setupFeesBreakdown.oldMrtaRefund !== undefined && activeRefiSchedule.setupFeesBreakdown.oldMrtaRefund > 0 && (
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase font-black block">เวนคืน MRTA ธนาคารเดิม:</span>
                    <span className="text-xs font-bold text-emerald-700 font-mono">
                      -{formatCurrency(activeRefiSchedule.setupFeesBreakdown.oldMrtaRefund)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-amber-900 uppercase font-black block">รวมค่าสถาปนาแรกเข้าสุทธิ:</span>
                  <span className="text-xs font-extrabold text-amber-950 font-mono bg-amber-100 p-1 rounded">
                    {formatCurrency(activeRefiSchedule.setupFeesBreakdown.totalSetupFees)}
                  </span>
                </div>
              </div>
            )}

            {/* Table wrapper */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              <div className="text-center font-bold text-slate-500 text-[10px] uppercase mb-2">ตารางแจกแจงรายเดือน 3 ปีแรก (36 งวดต้นลดดอกเบี้ย)</div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-[11px] font-mono font-bold text-left border-collapse text-slate-700">
                  <thead className="bg-slate-200 text-slate-800 tracking-wider">
                    <tr>
                      <th className="py-2 px-2.5 text-center">งวดที่</th>
                      <th className="py-2 px-2.5">เงินต้นคงเหลือต้นงวด</th>
                      <th className="py-2 px-2.5 text-center">อัตราดบ.(%)</th>
                      <th className="py-2 px-2.5 text-right">ยอดผ่อนชำระ</th>
                      <th className="py-2 px-2.5 text-right text-rose-600">หักดอกเบี้ย</th>
                      <th className="py-2 px-2.5 text-right text-emerald-600">หักเงินต้น</th>
                      <th className="py-2 px-2.5 text-right">คงเหลือคงค้าง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {activeRefiSchedule.rows.map((row) => (
                      <tr key={row.month} className="hover:bg-indigo-50/30">
                        <td className="py-1.5 px-2.5 text-center text-slate-500 font-extrabold border-r border-slate-100">{row.month}</td>
                        <td className="py-1.5 px-2.5 border-r border-slate-100">{formatCurrency(row.beginning)}</td>
                        <td className="py-1.5 px-2.5 text-center text-slate-600 border-r border-slate-100">{row.rate.toFixed(2)}%</td>
                        <td className="py-1.5 px-2.5 text-right font-black border-r border-slate-100">{formatCurrency(row.payment)}</td>
                        <td className="py-1.5 px-2.5 text-right text-rose-600 border-r border-slate-100">{formatCurrency(row.interest)}</td>
                        <td className="py-1.5 px-2.5 text-right text-emerald-600 border-r border-slate-100">{formatCurrency(row.principal)}</td>
                        <td className="py-1.5 px-2.5 text-right text-slate-900 bg-slate-50/50">{formatCurrency(row.ending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-100 p-3 text-center border-t border-slate-200 flex justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase self-center">จำลองการรันระบบโดยวิธี Effective Rate 365 วัน/ปี</span>
              <button
                type="button"
                onClick={() => setActiveRefiSchedule(null)}
                className="bg-slate-900 text-white font-extrabold text-[11px] px-4 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800 transition"
              >
                ปิดตาราง
              </button>
            </div>
          </div>
        </div>
      )}

      {showMcrasInfo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200 text-slate-800">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 text-slate-800 p-4 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-sm md:text-base tracking-wide flex items-center gap-1.5 text-indigo-900">
                <Info className="w-5 h-5 text-indigo-600 animate-pulse" />
                <span>ระบบประเมินผลอัจฉริยะ MCRAS คืออะไร?</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowMcrasInfo(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg bg-slate-200/50 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content Wrapper */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              
              <div className="bg-gradient-to-r from-indigo-50 to-rose-50/50 p-4 rounded-xl border border-indigo-100/60 shadow-xs">
                <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-semibold">
                  <span className="text-indigo-900 font-bold">MCRAS (Multi-Criteria Rating & Advisory System)</span> คือ ระบบประเมินผลอัจฉริยะที่วิเคราะห์เปรียบเทียบข้อเสนอและสัญญาอัตราดอกเบี้ยและค่าใช้จ่ายของที่อยู่อาศัยแบบบูรณาการ 5 มิติ มุ่งเน้นการให้คำปรึกษาเชิงลึกด้านพฤติกรรมทางการเงิน (Financial Advisory Model) ร่วมกับแผนผ่อนที่ตอบสนองแบบเรียลไทม์
                </p>
              </div>

              {/* 5 Dimensions Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <span>📊</span> หลักเกณฑ์การวิเคราะห์และตัดสินใจของระบบ (How It Works & Analyzes)
                </h4>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-2xs hover:border-indigo-200 hover:shadow-xs transition duration-200">
                    <h5 className="font-bold text-slate-900 text-[13px] flex items-center gap-2">
                      <span className="p-1 bg-indigo-50 text-indigo-600 rounded text-xs">1</span>
                      <span className="text-indigo-900">💰 Cost Efficiency</span>
                      <span className="text-[11px] text-slate-450 font-normal">(ประสิทธิภาพความประหยัดต้นทุน)</span>
                    </h5>
                    <p className="text-slate-650 text-xs mt-1.5 leading-relaxed pl-7">
                      คำนวณและถ่วงน้ำหนักตามมูลค่ารวมของ <span className="font-extrabold text-indigo-900">"ดอกเบี้ยที่เซฟลงได้สุทธิ"</span> ภายในวงจรทองคำ 3 ปีแรก โดยเป็นการเปรียบเทียบดอกเบี้ยของธนาคารใหม่กับเดิมของคุณ หลังหักลบด้วยค่าธรรมเนียมจัดตั้งสถาปนาแรกเข้าทั้งหมดแล้ว
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-2xs hover:border-emerald-200 hover:shadow-xs transition duration-200">
                    <h5 className="font-bold text-slate-900 text-[13px] flex items-center gap-2">
                      <span className="p-1 bg-emerald-50 text-emerald-600 rounded text-xs">2</span>
                      <span className="text-emerald-900">💧 Cash Preservation</span>
                      <span className="text-[11px] text-slate-450 font-normal">(ความสะดวกการสำรองเงินสด)</span>
                    </h5>
                    <p className="text-slate-650 text-xs mt-1.5 leading-relaxed pl-7">
                      วิเคราะห์ผลกระทบด้านลบที่อาจเกิดขึ้นกับสภาพคล่องและเงินสดสำรองตั้งต้นในวันทำสัญญา (Upfront Liquidity Pressure) เช่น ค่าจดจำนอง 1%, ค่าประเมินทรัพย์สิน, ดีลอากรแสตมป์ และเบี้ยประกันภัย MRTA ที่ต้องการควักจ่ายล่วงหน้า เพื่อดูความคุ้มค่าและความเหมาะสมทางเงินสด
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-2xs hover:border-amber-200 hover:shadow-xs transition duration-200">
                    <h5 className="font-bold text-slate-900 text-[13px] flex items-center gap-2">
                      <span className="p-1 bg-amber-50 text-amber-600 rounded text-xs">3</span>
                      <span className="text-amber-900">⚡️ Breakeven Velocity</span>
                      <span className="text-[11px] text-slate-450 font-normal">(อัตราความเร็วคุ้มทุน)</span>
                    </h5>
                    <p className="text-slate-650 text-xs mt-1.5 leading-relaxed pl-7">
                      คำนวณช่วงเวลาคืนทุน (Breakeven Period) แสดงความรวดเร็วในการกู้คืนทุนจากส่วนต่างของอัตราดอกเบี้ยและค่าใช้จ่ายรวม ยิ่งคืนทุนได้เร็ว ยิ่งได้รับคะแนนมิตินี้สูงกว่าปกติ
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-2xs hover:border-blue-200 hover:shadow-xs transition duration-200">
                    <h5 className="font-bold text-slate-900 text-[13px] flex items-center gap-2">
                      <span className="p-1 bg-blue-50 text-blue-600 rounded text-xs">4</span>
                      <span className="text-blue-900">🛡️ Rate Volatility Stability</span>
                      <span className="text-[11px] text-slate-450 font-normal">(ความคุ้มค่าเสถียรภาพดอกเบี้ยและอัตราเปลี่ยนผ่าน)</span>
                    </h5>
                    <p className="text-slate-650 text-xs mt-1.5 leading-relaxed pl-7">
                      ระบุความทนทานต่อทิศทางนโยบายดอกเบี้ยขาขึ้น ยิ่งมีระยะเวลา <span className="font-extrabold text-blue-900">"ล็อกดอกเบี้ยคงที่ (Fixed Interes Rate)"</span> นานเท่าใด ก็จะยิ่งช่วยป้องกันความเสี่ยงจากอัตราลอยตัวและตลาดได้ดีขึ้นเท่านั้น
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-2xs hover:border-rose-200 hover:shadow-xs transition duration-200">
                    <h5 className="font-bold text-slate-900 text-[13px] flex items-center gap-2">
                      <span className="p-1 bg-rose-50 text-rose-600 rounded text-xs">5</span>
                      <span className="text-rose-900">📋 Process Convenience</span>
                      <span className="text-[11px] text-slate-450 font-normal">(ความสะดวกในการดำเนินงาน)</span>
                    </h5>
                    <p className="text-slate-650 text-xs mt-1.5 leading-relaxed pl-7">
                      ประเมินคะแนนเชิงความรวดเร็วและความซับซ้อนเชิงเอกสาร กรณีต่ออายุธนาคารเดิม (<span className="font-semibold text-rose-900">Retention</span>) จะได้ความสะดวกสูงสุด 95-100 คะแนน แทบไม่มีงานเอกสารเพิ่ม ขณะที่การย้ายค่ายยื่นเรื่องใหม่จะอยู่ประมาณ 45 คะแนน จากภาระการประเมินหลักทรัพย์ ตรวจบูโร และจดจำนองใหม่หมด
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Personalized Analysis Section */}
              <div className="bg-amber-50/70 p-4 border border-amber-200 rounded-xl space-y-2.5">
                <h5 className="font-extrabold text-xs uppercase text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span>🤖 บทวิเคราะห์พฤติกรรม & คำแนะนำสไตล์ผ่อนของคุณ (ข้อมูลคำนวณเรียลไทม์)</span>
                </h5>
                <p className="text-slate-705 leading-relaxed text-[11.5px]">
                  กลยุทธ์ปัจจุบันที่คุณเลือกปักธง: <strong className="text-indigo-900 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">"{optimizationStrategy === "balanced" ? "สมบูรณ์ทุกด้าน" : 
                                         optimizationStrategy === "max_savings" ? "ประหยัดสูงสุด" : 
                                         optimizationStrategy === "cash_preservation" ? "สภาพคล่องเงินสด" : 
                                         optimizationStrategy === "maximum_convenience" ? "สะดวก รวดเร็ว" : "ล็อคความมั่นคง"}"</strong>
                </p>
                <div className="text-slate-650 leading-relaxed text-[11px] space-y-1.5 bg-white/70 p-3 rounded-lg border border-amber-100/60">
                  <p>
                    • ทางเลือกที่คุ้มที่สุดของคุณคือ <strong className="text-indigo-900 font-bold">{smartChampion ? smartChampion.nameTh : "ไม่มี"}</strong> ด้วยดัชนีคะแนนรวมรอบด้าน <span className="font-mono font-black text-indigo-600">{smartChampion ? smartChampion.compositeScore : 0}%</span> 
                  </p>
                  <p>
                    {smartChampion?.id === "retention" ? (
                      <span>• สัญญาตัวนี้โดดเด่นด้วย <span className="text-emerald-700 font-semibold">ค่าธรรมเนียมธุรกรรมแรกเข้าเริ่มต้นที่ ฿0</span> ประหยัดค่าจดจำนอง คืนสภาพคล่องเงินสดในทันใด</span>
                    ) : (
                      <span>• ธนาคารสถาบันใหม่นี้ประหยัดลดดอกเบี้ยระยะยาวได้ดีที่สุด แม้ต้องจ่ายค่าจดสิทธิที่ดิน 1% แต่แผนสรุปสอดคล้องคืนทุนสะสมได้รวดเร็ว</span>
                    )}
                  </p>
                  <p>
                    • อัตราดอกเบี้ยรวมสัญญากลางปัจจุบัน (3 ปีแรก) คาดว่าสูงเฉลี่ยถึง <strong className="text-slate-900 font-mono font-bold">{formatCurrency(refiScheduleType === "simulated" ? currentLoan3YrStats.simulatedInterest : currentLoan3YrStats.standardInterest)}</strong> หากเปลี่ยนผ่านเข้าสู่ยอดเลือกแนะนำ จะประหยัดเบี้ยจ่ายไปได้สูงสุด!
                  </p>
                </div>
              </div>

              {/* Persona Selector Description */}
              <div className="bg-indigo-950 text-indigo-100 p-4 rounded-xl space-y-2 border border-indigo-900 shadow-md">
                <h5 className="font-bold text-xs uppercase text-indigo-300 flex items-center gap-1.5">
                  <span className="text-amber-400">⚡️</span> Interactive Persona Strategy Selector
                </h5>
                <p className="text-[11px] leading-relaxed text-indigo-200">
                  ระบบรองรับสไตล์ความพึงพอใจการผ่อนชำระแบบตอบสนองทันที (Interactive Persona Strategy Selector) โดยการจำแนกเป้าหมายของผู้กู้ เช่น สมดุลรอบด้าน ประหยัดสูงสุด หรือรักษาเงินสดสำรอง ซึ่งเมื่อมีคำสั่งกดเลือก แผนคำนวณและประเมินผลจะ <span className="text-white font-bold">หมุนปรับเปลี่ยนค่าน้ำหนักความสำคัญและจัดอันดับใหม่แบบเรียลไทม์ 100%</span> ตอบโจทย์เป้าหมายการเงินที่แท้จริงของคุณ!
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-slate-100 p-3 text-right border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setShowMcrasInfo(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-1.5 rounded-lg cursor-pointer transition"
              >
                เข้าใจและปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
