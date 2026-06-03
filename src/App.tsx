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
  Import
} from "lucide-react";
import { 
  BankRate, 
  LoanInput, 
  CustomBankConfig, 
  RatePeriod,
  PathMonthResult, 
  FinalComparisonResult,
  HistoricalPayment
} from "./types";
import { 
  performMultiAmortization, 
  calculateSuggestedInstallment, 
  computeCustomBankFees,
  resolveRate
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
    outstandingPrincipal: 3500000,
    currentInterestRate: 6.25,
    remainingTermMonths: 240, // 20 ปี = 240 เดือน
    currentInstallment: 24500,

    borrowerType: "single",
    gender: "male",
    borrowerAge: 35,
    borrowerAgeAtContract: 33,
    borrower2Age: 32,
    borrower2Gender: "female",
    startingLoanAmount: 4000000,

    // Contract dates
    contractStartDate: "2024-06-01",
    startingTermMonths: 360, // 30 ปี

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

    currentYr1Rate: { type: "fixed", value: 3.5 },
    currentYr2Rate: { type: "fixed", value: 3.8 },
    currentYr3Rate: { type: "fixed", value: 4.2 },
    currentYr4PlusRate: { type: "mrr", value: -1.0 },

    currentYr1Installment: 23000,
    currentYr2Installment: 24000,
    currentYr3Installment: 25000,
    currentYr4PlusInstallment: 26000,

    prepaymentFeeRate: 3.0,
    prepaymentLockMonths: 36,

    receivesSubsidy: true,
    subsidyAmount: 40000, // ค่าจดจำนองที่ธนาคารเดิมสำรองจ่ายให้ 1%
    subsidyLockMonths: 36,
    elapsedMonths: 18, // ผ่อนมาแล้ว 18 ด.

    hasInsurancePenalty: true,
    insurancePenaltyRate: 0.35,
    insurancePenaltyMonths: 36,

    historicalPayments: [
      { id: "h1", monthIndex: 1, payDate: "2026-01-02", paymentAmount: 23000, interestCalculated: 11666.67, principalDeducted: 11333.33, endingBalance: 3988666.67 },
      { id: "h2", monthIndex: 2, payDate: "2026-02-02", paymentAmount: 23000, interestCalculated: 11633.61, principalDeducted: 11366.39, endingBalance: 3977300.28 },
      { id: "h3", monthIndex: 3, payDate: "2026-03-02", paymentAmount: 23000, interestCalculated: 11600.46, principalDeducted: 11399.54, endingBalance: 3965900.74 }
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
    const defaultPkg = pkgs[0]; // Option 1 is default
    
    return {
      id: bank.id,
      nameTh: bank.nameTh,
      nameEn: bank.nameEn,
      color: bank.color,
      mrr: bank.mrr,
      yr1: { type: "fixed", value: defaultPkg.rates[0] },
      yr2: { type: "fixed", value: defaultPkg.rates[1] },
      yr3: { type: "fixed", value: defaultPkg.rates[2] },
      yr4Plus: { type: "mrr", value: defaultPkg.yr4PlusVal },
      
      freeMortgageFee: defaultPkg.freeMortgage,
      freeAppraisalFee: false,
      freeDutyStamp: false,
      customAppraisalFee: 3000,
      customMortgageFeeRate: 1.0,
      otherFees: 0,
      
      hasMrta: true, // option 1 ทำประกันเป็นค่าเริ่มต้น
      
      isInstallmentAdjusted: false,
      customInstallment: currentFormInstallment,
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
      return {
        ...prev,
        [periodKey]: {
          ...prev[periodKey],
          [field]: finalValue
        }
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
    setLoanInput(prev => ({ ...prev, elapsedMonths: val }));
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
      return {
        ...prev,
        contractStartDate: val,
        borrowerAgeAtContract: Math.max(18, prev.borrowerAge - elapsed)
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
      if (field === "value" && currentRate.type === "mrr" && val > 0) {
        finalValue = -val;
      }
      let updates: any = { [field]: finalValue };
      if (field === "type" && val === "mrr" && !currentRate.mrrBaseline) {
         updates.mrrBaseline = currentBankMrrVal;
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
          
          let totalInterest = 0;
          for (let k = 1; k <= diffDays; k++) {
            // Find representative UTC midnight timestamp for the start of day k
            const dayMs = utc1 + (k - 1) * (1000 * 60 * 60 * 24);
            
            // Teaser Rate change dates based on year anniversary y+1, y+2, y+3 boundaries
            const ann1 = Date.UTC(sParts.year + 1, sParts.month, sParts.day);
            const ann2 = Date.UTC(sParts.year + 2, sParts.month, sParts.day);
            const ann3 = Date.UTC(sParts.year + 3, sParts.month, sParts.day);
            
            let ratePeriod = r4;
            if (dayMs < ann1) ratePeriod = r1;
            else if (dayMs < ann2) ratePeriod = r2;
            else if (dayMs < ann3) ratePeriod = r3;
            
            let applicableMrr = mrr;
            if (ratePeriod.type === "mrr" && botMrrs[pay.id]) {
                const hist = botMrrs[pay.id];
                if (hist && hist.length > 0) {
                    let activeHistMrr: number | null = null;
                    for (const record of hist) {
                        if (!record.periodFromApi || !record.mrr || record.mrr === "-") continue;
                        const rParts = record.periodFromApi.split("-");
                        if (rParts.length !== 3) continue;
                        const rDate = Date.UTC(parseInt(rParts[0],10), parseInt(rParts[1],10)-1, parseInt(rParts[2],10));
                        if (dayMs >= rDate) {
                            activeHistMrr = parseFloat(record.mrr);
                            break;
                        }
                    }
                    if (activeHistMrr !== null && !isNaN(activeHistMrr)) {
                        applicableMrr = activeHistMrr;
                    } else {
                        // If dayMs is before all records (e.g. weekend start), just use the oldest record (last in array)
                        const oldest = hist[hist.length - 1];
                        if (oldest && oldest.mrr && oldest.mrr !== "-") {
                            applicableMrr = parseFloat(oldest.mrr);
                        }
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
           acronym: loanInput.currentBank 
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
  }, [loanInput.historicalPayments, loanInput.contractStartDate, loanInput.currentBank, loanInput.currentYr1Rate, loanInput.currentYr2Rate, loanInput.currentYr3Rate, loanInput.currentYr4PlusRate, botHistoricalMrrs]);

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
    loanInput.currentYr4PlusRate
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

      const newRow: HistoricalPayment = {
        id: Math.random().toString(36).substring(2, 9),
        monthIndex: nextIndex,
        payDate: new Date().toISOString().split("T")[0],
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
          
          let parsedDate = new Date().toISOString().split("T")[0];
          const dateParts = dateStr.split('/');
          if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const month = dateParts[1].padStart(2, '0');
            const yearStr = dateParts[2];
            const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
            parsedDate = `${year}-${month}-${day}`;
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

  return (
    <div id="calculator-root-container" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased print:bg-white">
      
      {/* HEADER SECTION */}
      <header id="app-header" className="bg-slate-900 text-white px-6 py-4 md:px-8 flex flex-col md:flex-row justify-between items-center shrink-0 shadow-md border-b border-slate-800 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
              Thai Loan Retention & Refinance Multi-Compare
            </h1>
            <p className="text-[11px] text-indigo-300/90 font-medium">
              วิเคราะห์เปรียบเทียบข้อเสนอขอลดดอกเบี้ยและการรีไฟแนนซ์พร้อมกันสูงสุด 5 สัญญา อย่างแม่นยำรายธนาคาร
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-3 md:mt-0 text-xs font-semibold">
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300">
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
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
                <div>
                  <h3 className="font-extrabold text-[12px] uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-indigo-400" />
                    1. ข้อมูลสัญญากู้เดิมของท่าน
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">กำหนดเงื่อนไขกู้แรกเริ่ม ผู้กู้ และดอกเบี้ยเดิม</p>
                </div>
                {(() => {
                  const cb = banksList.find(b => b.id === currentBankId);
                  return cb ? (
                    <span className="bg-white/10 text-slate-100 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-white/10 max-w-[100px] truncate">
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
                        * สัญญากู้เดี่ยวและกู้ร่วมส่งผลต่อการคำนวณราคาเบี้ยประกันคุ้มครองวงเงิน (MRTA) สำหรับผู้กู้ร่วม และสิทธิการลดอัตรารีไฟแนนซ์
                      </p>
                    </div>

                    {/* Borrower Profiles */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                      <p className="text-xs font-black text-indigo-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        ผู้กู้หลัก (Borrower 1)
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
                          ผู้กู้ร่วมคนที่สอง (Borrower 2)
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
                        <span className="font-extrabold text-slate-500 uppercase tracking-wide">วงเงินร่วมกู้เริ่มต้นแรกรับ (บาท)</span>
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
                      ระบุสเปกสัญญาลดหย่อน Teaser อัตราดอกเบี้ยเดิมแต่ละปี เพื่อทำการคำนวณ amortize และวัดยอดผ่อนจริง
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
              
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-extrabold tracking-wide uppercase flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-emerald-400" />
                    2. ประวัติงวดผ่อนย้อนหลัง
                  </h4>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">ระบุยอดและวันที่จ่ายจริงเพื่อหักเงินต้นแบบ Real Amortization</p>
                </div>
                <div className="flex items-center gap-2">
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
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 space-y-1.5 text-[9.5px]">
                    <div className="flex justify-between font-bold text-slate-500">
                      <span>ยอดค้างเริ่มต้น:</span>
                      <span className="text-slate-700 font-mono">{formatCurrency(loanInput.startingLoanAmount)}</span>
                    </div>
                    {loanInput.historicalPayments.map(pay => (
                      <div key={pay.id} className="flex justify-between text-slate-400 font-semibold font-mono pl-2 border-l border-slate-200">
                        <span>งวด {pay.monthIndex} (ดบ. {formatCurrency(pay.interestCalculated)} • ต้น {formatCurrency(pay.principalDeducted)}):</span>
                        <span className="text-slate-600 font-bold">{formatCurrency(pay.endingBalance)}</span>
                      </div>
                    ))}
                    <div className="pt-1.5 mt-1.5 border-t border-dashed border-slate-200 flex justify-between font-bold text-indigo-700">
                      <span>ยอดเหลือปลายสุดตารางคงเหลือ:</span>
                      <span className="font-mono">{formatCurrency(loanInput.historicalPayments[loanInput.historicalPayments.length - 1].endingBalance)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSyncBalanceFromLedger}
                  className="w-full bg-indigo-50 hover:bg-indigo-150 text-indigo-700 active:scale-95 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border border-indigo-100/50 cursor-pointer flex justify-center items-center gap-1.5"
                  disabled={loanInput.historicalPayments.length === 0}
                >
                  <Check className="w-3.5 h-3.5" />
                  ซิงค์เงินคงเหลือล่าสุดไปยัง "ยอดต้นปัจจุบัน"
                </button>
              </div>

            </div>

            {/* 2. TABBED CUSTOM RATE EDITORS AND TRANSACTIONAL COST PANELS */}
            <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden space-y-0.5">
              
              <div className="p-4 bg-slate-900 text-white">
                <h4 className="text-xs font-extrabold tracking-wide uppercase flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-indigo-400" />
                  4. Refinance
                </h4>
                <p className="text-[10px] text-slate-400 mt-1">
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
                        <div className="grid grid-cols-1 gap-1.5 mt-2">
                          {getRefiPackagesForBank(
                            targetConfig.id,
                            targetConfig.mrr,
                            banksList.find(b => b.id === targetConfig.id)?.typicalRefinance3Yr || 3.50
                          ).map((pkg, idx) => {
                            const isMatch = 
                              targetConfig.yr1.value === pkg.rates[0] &&
                              targetConfig.yr2.value === pkg.rates[1] &&
                              targetConfig.yr3.value === pkg.rates[2] &&
                              targetConfig.freeMortgageFee === pkg.freeMortgage;

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setCustomBanks(prev => prev.map(b => b.id === targetConfig.id ? {
                                    ...b,
                                    yr1: { type: "fixed", value: pkg.rates[0] },
                                    yr2: { type: "fixed", value: pkg.rates[1] },
                                    yr3: { type: "fixed", value: pkg.rates[2] },
                                    yr4Plus: { type: "mrr", value: pkg.yr4PlusVal },
                                    freeMortgageFee: pkg.freeMortgage,
                                    hasMrta: pkg.id === 1 || pkg.id === 2, // 1 และ 2 คือประเภททำประกัน MRTA
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
                                  <span className="text-[10.5px] text-slate-500 font-medium">{pkg.desc}</span>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <div className="text-[10px] text-slate-500 font-semibold font-sans">
                                    เฉลี่ย 3 ปี: <span className="text-xs font-black text-slate-800 font-mono">{pkg.avg.toFixed(2)}%</span>
                                  </div>
                                </div>
                              </button>
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
                        <div className="flex items-center justify-between p-1.5 bg-slate-50/50 rounded-lg border border-slate-100 text-xs">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-600 text-[11px]">ค่าจดจำนองที่ดิน (ปกติ 1%)</span>
                            <span className="text-[9px] text-slate-400">
                              คำนวณเบื้องต้น: {formatCurrency(loanInput.outstandingPrincipal * 0.01)}
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
                        <div className="flex items-center justify-between p-1.5 bg-slate-50/50 rounded-lg border border-slate-100 text-xs">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-600 text-[11px]">ค่าอากรแสตมป์ (0.05%)</span>
                            <span className="text-[9px] text-slate-400">
                              คำนวณ: {formatCurrency(loanInput.outstandingPrincipal * 0.0005)}
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

                        {/* Other fees */}
                        <div className="flex justify-between items-center p-1.5 bg-slate-50/50 rounded-lg border border-slate-100 text-xs">
                          <span className="font-bold text-slate-600 text-[11px]">ค่าธรรมเนียมเบ็ดเตล็ดอื่น ๆ</span>
                          <div className="relative w-20">
                            <input
                              type="number"
                              value={targetConfig.otherFees}
                              onChange={(e) => handleFeeChange(targetConfig.id, "otherFees", Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded px-1.5 text-[10px] font-bold text-center"
                            />
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 font-bold flex justify-between text-xs border border-rose-100/50">
                          <span>ค่าใช้จ่ายแรกเข้าสะสม:</span>
                          <span>{formatCurrency(computeCustomBankFees(loanInput.outstandingPrincipal, targetConfig))}</span>
                        </div>
                      </div>

                      {/* ADJUST INSTALLMENT PREFERENCES FOR THIS BANK */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">ปรับลดค่างวดผ่อนรายเดือน</span>
                            <span className="text-[10px] text-slate-400">คำนวณตามสูตรดอกต่ำ</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={targetConfig.isInstallmentAdjusted}
                              onChange={(e) => handleInstallmentSettingsChange(targetConfig.id, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        {targetConfig.isInstallmentAdjusted && (
                          <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-150 animate-fadeIn text-xs">
                            <label className="font-bold text-slate-500">ค่างวดผ่อนยอดปรับปรุงใหม่ (บาท/เดือน)</label>
                            <input
                              type="number"
                              step="500"
                              value={targetConfig.customInstallment}
                              onChange={(e) => handleInstallmentSettingsChange(targetConfig.id, true, Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs font-extrabold text-center mt-1"
                            />
                          </div>
                        )}
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
                          <div className="animate-fadeIn pt-1">
                            <MrtaCalculator
                              loanInput={loanInput}
                              onUpdateLoanInput={setLoanInput}
                              formatCurrency={formatCurrency}
                            />
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
              
              {/* STABLE CURRENT PATHWAY CARD */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 flex flex-col shadow-sm overflow-hidden min-h-[310px]">
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
                  <span className="font-extrabold text-[11px] tracking-wider uppercase">หากกู้และผ่อนเดิม</span>
                  <span className="text-[9px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">ไม่แปรเปลี่ยน</span>
                </div>
                
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">สัดส่วนดอกเบี้ยปี 1-3</p>
                      <p className="text-3xl font-black text-rose-500 mt-0.5 font-mono">
                        {loanInput.currentInterestRate.toFixed(2)}%
                      </p>
                    </div>

                    <div className="divide-y divide-slate-100 font-semibold text-xs text-slate-600 space-y-2">
                      <div className="flex justify-between pt-1.5"><span>ค่างวด:</span><span className="text-slate-800 font-mono">{formatCurrency(loanInput.currentInstallment)} /ด.</span></div>
                      <div className="flex justify-between pt-1.5"><span>ค่าธรรมเนียมกู้แฝง:</span><span className="text-slate-800 font-mono">0 บาท</span></div>
                      <div className="flex justify-between pt-1.5"><span>ดอกเบี้ยจ่ายสะสม 3 ปี:</span><span className="text-rose-600 font-bold font-mono">{formatCurrency(results.currentStats.threeYear.totalInterest)}</span></div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-4 text-xs font-semibold">
                    <p className="text-[10px] uppercase text-slate-400 font-bold">ภาระจ่ายรวมสุทธิ (3 ปีแรก)</p>
                    <p className="text-lg font-black text-slate-700 font-mono">{formatCurrency(results.currentStats.threeYear.totalPaid)}</p>
                    <p className="text-[9px] text-slate-400 font-normal mt-0.5">ยอดต้นเหลือปลายสัญญารีไฟแนนซ์: <span className="font-mono text-slate-600 font-bold">{formatCurrency(results.currentStats.threeYear.remainingPrincipal)}</span></p>
                  </div>
                </div>
              </div>

              {/* DYNAMIC COMBINED PATHWAYS CARDS (Selected customized Refinancing banks) */}
              {results.pathways.map((path) => {
                const isBest = bestPathwayObj && bestPathwayObj.id === path.id;

                // Find original source bank configuration to retrieve period rates
                const originConf = customBanks.find(b => b.id === path.id);
                if (!originConf) return null;

                // Calculate customized 3-Yr average rate
                const r1 = resolveRate(originConf.mrr, originConf.yr1);
                const r2 = resolveRate(originConf.mrr, originConf.yr2);
                const r3 = resolveRate(originConf.mrr, originConf.yr3);
                const avgRate = ((r1 + r2 + r3) / 3).toFixed(2);

                return (
                  <div 
                    key={path.id} 
                    className={`bg-white rounded-2xl border-2 flex flex-col shadow-sm overflow-hidden min-h-[310px] transition-all relative ${
                      isBest 
                        ? "border-emerald-500 ring-2 ring-emerald-50" 
                        : "border-indigo-600"
                    }`}
                  >
                    {isBest && (
                      <span className="absolute top-1 right-2 bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-full font-extrabold animate-pulse">
                        ⭐ คุ้มค่าที่สุด
                      </span>
                    )}

                    <div 
                      className="p-3 border-b flex items-center justify-between text-white gap-2"
                      style={{ backgroundColor: originConf.color }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BankLogo bankId={path.id} size="sm" className="w-5.5 h-5.5 rounded-md bg-white text-slate-900 border border-black/5 flex-shrink-0" />
                        <span className="font-extrabold text-[11.5px] tracking-wider uppercase truncate">
                          {originConf.nameTh.replace("ธนาคาร", "")}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        โปรค่าธรรมเนียมย้าย
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">สัดส่วนดอกเบี้ยปีเฉลี่ย 3 ปีแรก</p>
                          <p className="text-3xl font-black mt-0.5 font-mono" style={{ color: originConf.color }}>
                            {avgRate}%
                          </p>
                          <div className="text-[9.5px] text-slate-400 mt-0.5 flex gap-1 bg-slate-50 p-1 rounded font-semibold justify-center">
                            <span>ปี1: {r1.toFixed(2)}%</span>
                            <span>•</span>
                            <span>ปี2: {r2.toFixed(2)}%</span>
                            <span>•</span>
                            <span>ปี3: {r3.toFixed(2)}%</span>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100 font-semibold text-xs text-slate-600 space-y-2">
                          <div className="flex justify-between pt-1.5">
                            <span>ยอดผ่อนใหม่:</span>
                            <span className="font-mono text-slate-800">{formatCurrency(originConf.isInstallmentAdjusted ? originConf.customInstallment : loanInput.currentInstallment)} /ด.</span>
                          </div>
                          <div className="flex justify-between pt-1.5">
                            <span>ค่าทำธุรกแรกสัม:</span>
                            <span className="text-rose-600 font-mono">-{formatCurrency(path.threeYear.setupFees)}</span>
                          </div>
                          <div className="flex justify-between pt-1.5">
                            <span>ประหยัดดบ. 3 ปีเต็ม:</span>
                            <span className="text-emerald-600 font-mono font-bold">
                              +{formatCurrency(results.currentStats.threeYear.totalInterest - path.threeYear.totalInterest)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 mt-4 p-2 rounded-xl" style={{ backgroundColor: `${originConf.color}0c` }}>
                        <p className="text-[9px] uppercase font-extrabold text-slate-500">ยอดเงินคืนสุทธิหลังหักธุรกรรมแรกเข้า (3 ปีแลกรัน)</p>
                        <p className="text-lg font-black font-mono mt-0.5" style={{ color: originConf.color }}>
                          {path.threeYear.totalSavingsVsCurrent > 0 ? "+" : ""}
                          {formatCurrency(path.threeYear.totalSavingsVsCurrent)}
                        </p>
                        <p className="text-[9px] text-slate-500 font-normal">ค่างวดผ่อนต่ำลง + ต้นสะสมลดยอดได้สมบูรณ์</p>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>

            {/* BREAKEVEN & STATS METRICS BLOCK */}
            <div id="savings-dashboard" className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-5">
              
              <div className="flex items-center justify-between pb-3.5 border-b border-rose-100/40">
                <div>
                  <h3 className="font-bold text-slate-800 text-[14px] flex items-center gap-1.5">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                    วิเคราะห์เปรียบเทียบจุดคืนทุนพอยท์กระเป๋าและการประหยัดคอร์สหนี้
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">สมการเปรียบเทียบระหว่างสััญญากู้เดิม ข้อเสนอ Retention และ สัญญา Refinance ทั้งหมด</p>
                </div>
              </div>

              {/* Statistics Panel Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Best Savings Card */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">ยอดรวมประหยัดได้สะสมมากที่สุด (3 ปีแรก)</span>
                    <span className="text-2xl font-black text-emerald-600 font-mono">
                      {bestPathwayObj ? formatCurrency(bestPathwayObj.threeYear.totalSavingsVsCurrent) : "฿0"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 block mt-2 pt-2 border-t border-slate-100">
                    ทางเลือกที่มีความคุ้มค่ากระเป๋าโดดเด่น: <strong className="text-indigo-600">{bestPathwayObj ? bestPathwayObj.nameTh.replace("ธนาคาร", "") : "-"}</strong>
                  </p>
                </div>

                {/* 2. Breakeven summaries */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">ระยะเวลาคืนทุนธุรกรรมเข้าระบบข้ามธนาคาร</span>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {results.pathways.map(p => (
                        <div key={p.id} className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 font-semibold">{p.nameTh.replace("ธนาคาร", "")}:</span>
                          <span className="font-mono font-bold text-slate-700">
                            {p.breakevenMonths > 0 ? `คืนทุนใน ${p.breakevenMonths} ด.` : "คุ้มทุนทันที"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 block mt-1 leading-normal">
                    *เมื่อสะสมมูลค่าดอกเบี้ยที่จ่ายลดได้มากกว่าค่าจดจำนองและค่าปิดจดสัญญากับที่ดิน
                  </p>
                </div>

                {/* 3. Long-term saving projection */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">ผลประวันประหยัดระยะยาวตลอดแผน ({(loanInput.remainingTermMonths / 12).toFixed(1)} ปี)</span>
                    <span className="text-2xl font-black text-slate-800 font-mono">
                      {bestPathwayObj ? formatCurrency(bestPathwayObj.fullTerm.totalSavingsVsCurrent) : "฿0"}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 block mt-2">
                    *คํานวณตามเงื่อนไขของสัญญาปีที่ 4+ (คงที่ลอยตัวตามค่า MRR) ต่อเนื่องจนเคลียร์บัญชี
                  </p>
                </div>

              </div>

              {/* AIS Grounded AI Summaries */}
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs space-y-2 leading-relaxed font-sans">
                <span className="font-bold flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  สรุปผลวิเคราะห์เปรียบเทียบทางการเงินโดยโปรแกรมคำนวณสมองกล
                </span>
                <p>
                  จากการวิเคราะห์เงินต้นค้างชำระ <strong className="text-white font-mono">{formatCurrency(loanInput.outstandingPrincipal)}</strong> ดอกเบี้ยลอยตัวสัญญาเดิม {loanInput.currentInterestRate}% หากผ่อนรูปแบบเดิมต่อไป จะเสียดอกเบี้ยสะสม 3 ปีแรกสูงถึง <strong className="text-white font-mono">{formatCurrency(results.currentStats.threeYear.totalInterest)}</strong> โดยช่องทางข้อเสนอเปรียบเทียบที่ดีที่สุดช่วยให้ท่านประหยัดได้สุทธิสูงสุด <strong className="text-emerald-400 font-mono font-bold">{bestPathwayObj ? formatCurrency(bestPathwayObj.threeYear.totalSavingsVsCurrent) : "฿0"}</strong> บาท
                </p>
              </div>

            </div>

            {/* TAB SELECTOR: CHART AND AMORTIZATION DETAILED TABLES */}
            <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 mb-6 font-semibold">
                <div>
                  <h3 className="font-bold text-slate-800 text-[14px] flex items-center gap-1.5">
                    <Percent className="w-5 h-5 text-indigo-600" />
                    แบบแผนแสดงรายละเอียดตัวเลขทางสถิติและค่างวด Amortization
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">เลือกเพื่อเปิดแผนภาพรันดาวน์หลักทรัพย์เงินต้นกู้ยืมรายเดือน หรือ บัญชีแสดงค่างวด</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto shrink-0 border border-slate-200">
                  <button
                    onClick={() => setActiveTab("chart")}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                      activeTab === "chart"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    กราฟลดหลั่นเงินต้น 36 เดือน
                  </button>
                  <button
                    onClick={() => setActiveTab("table")}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                      activeTab === "table"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    ตารางค่างวด Amortization
                  </button>
                </div>
              </div>

              {/* CHART TAB CONTAINER */}
              {activeTab === "chart" ? (
                <div id="chart-representation" className="space-y-6">
                  
                  {/* Dynamic compare bar charts list */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      สรุปดอกเบี้ยสุทธิพรวมแรกเริ่มแฮนเนลแฝง 3 ปีแรก (ภาระผลเสียที่หลีกเลี่ยงไม่ได้)
                    </p>
                    <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-150">
                      
                      {/* Current default base value */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-slate-500 flex items-center gap-1.5 font-bold">
                            <span className="w-2 h-2 rounded bg-slate-400"></span>
                            อัตราเดิมของสินเชื่อบ้าน (ไม่มีแอฟฟาย)
                          </span>
                          <span className="text-slate-700 font-mono font-bold">{formatCurrency(results.currentStats.threeYear.totalInterest)}</span>
                        </div>
                        <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                          <div className="h-full bg-slate-400 rounded-full transition-all duration-1000" style={{ width: "100%" }}></div>
                        </div>
                      </div>

                      {/* Render pathways dynamically */}
                      {results.pathways.map(p => (
                        <div key={p.id} className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="flex items-center gap-1.5 font-bold" style={{ color: p.color }}>
                              <span className="w-2 h-2 rounded" style={{ backgroundColor: p.color }}></span>
                              {p.nameTh}
                            </span>
                            <span className="text-slate-700 flex items-center gap-1 font-mono font-bold">
                              {formatCurrency(p.threeYear.totalInterest + p.threeYear.setupFees)}
                              <span className="text-[10px] text-slate-400 font-medium">(รวมค่าธรรมเนียมกู้แถม)</span>
                            </span>
                          </div>
                          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200 shadow-inner">
                            <div 
                              className="h-full rounded-full transition-all duration-1000" 
                              style={{ 
                                backgroundColor: p.color,
                                width: `${Math.min(100, Math.max(15, ((p.threeYear.totalInterest + p.threeYear.setupFees) / results.currentStats.threeYear.totalInterest) * 100))}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}

                    </div>
                  </div>

                  {/* CUSTOM MULTI-LINE SVG PLOT */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      เปรียบเทียบภาระรันดาวน์เงินต้นคงค้าง (Outstanding Balance Run-down Timeline)
                    </p>
                    
                    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-md overflow-hidden text-white">
                      <div className="relative h-64 w-full">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                          <line x1="0" y1="20" x2="500" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3" />
                          <line x1="0" y1="85" x2="500" y2="85" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3" />
                          <line x1="0" y1="150" x2="500" y2="150" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3" />
                          <line x1="0" y1="200" x2="500" y2="200" stroke="#334155" strokeWidth="1" />

                          {(() => {
                            const maxVal = loanInput.outstandingPrincipal;
                            const minVal = monthlyList[0] 
                              ? Math.min(
                                  monthlyList[35]?.currentBalance || 0,
                                  ...pathwaysToSimulate.map(p => monthlyList[35]?.paths[p.id]?.balance || 0)
                                ) 
                              : 0;
                            const diff = maxVal - minVal || 1;

                            const getSVGPoint = (month: number, value: number) => {
                              const x = (month / 36) * 500;
                              const ratio = (maxVal - value) / diff;
                              const y = 20 + ratio * 155; 
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            };

                            let currentPoints = `0,${20}`;
                            const pathPointsMap: Record<string, string> = {};
                            pathwaysToSimulate.forEach(p => {
                              pathPointsMap[p.id] = `0,${20}`;
                            });

                            monthlyList.forEach((row, idx) => {
                              const m = idx + 1;
                              currentPoints += ` ${getSVGPoint(m, row.currentBalance)}`;
                              pathwaysToSimulate.forEach(p => {
                                pathPointsMap[p.id] += ` ${getSVGPoint(m, row.paths[p.id]?.balance || row.currentBalance)}`;
                              });
                            });

                            return (
                              <>
                                {/* Current baseline line */}
                                <polyline fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3" points={currentPoints} />
                                
                                {/* Simulated comparative paths */}
                                {pathwaysToSimulate.map(p => (
                                  <polyline 
                                    key={p.id}
                                    fill="none" 
                                    stroke={p.color} 
                                    strokeWidth="3.5" 
                                    strokeLinecap="round" 
                                    points={pathPointsMap[p.id]} 
                                  />
                                ))}
                              </>
                            );
                          })()}
                        </svg>

                        {/* Inside Legend Labels */}
                        <div className="absolute top-2 right-2 bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-[9px] space-y-1 z-10 leading-loose">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-1 border-t border-dashed border-slate-400 block"></span>
                            <span className="text-slate-300 font-bold">ยอดหนี้เดิมลอยตัว</span>
                          </div>
                          {pathwaysToSimulate.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5">
                              <span className="w-3 h-1.5 block" style={{ backgroundColor: p.color }}></span>
                              <span className="text-slate-200 font-bold">{p.nameThTh || p.nameTh}</span>
                            </div>
                          ))}
                        </div>

                        {/* Outer indicators */}
                        <div className="absolute left-1 top-1 text-[8px] text-slate-500 font-bold">
                          เริ่มผ่อน {formatCurrency(loanInput.outstandingPrincipal)}
                        </div>
                      </div>

                      {/* X-Axis Monthly */}
                      <div className="flex justify-between text-[9px] font-bold text-slate-400 pt-2 border-t border-slate-800 font-mono select-none">
                        <span>เดือน 1</span>
                        <span>เดือน 12 (ปีที่ 1)</span>
                        <span>เดือน 24 (ปีที่ 2)</span>
                        <span>เดือน 36 (ปีที่ 3 สิ้นสุดโปรอภิสิทธิ์สัญญาลดหย่อน)</span>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                
                /* TABLE DETAILED CONTAINER WITH HORIZONTAL AUTO-SCROLL */
                <div id="amortization-table-grid" className="overflow-x-auto rounded-xl border border-slate-150">
                  <table className="w-full text-left border-collapse text-xs select-none">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold select-none">
                        <th className="py-2.5 px-3">เดือนที่</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 bg-rose-50/20 text-rose-800">
                          ค้างชำระกู้เดิม
                        </th>
                        
                        {customBanks.map(bank => (
                          <th 
                            key={bank.id} 
                            className="py-2.5 px-3 border-r border-slate-200"
                            style={{ backgroundColor: `${bank.color}0a`, color: bank.color }}
                          >
                            {bank.nameTh.replace("ธนาคาร", "")} Refi (ยอดกู้ / ดอกเบี้ย)
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium font-mono">
                      {monthlyList.map((row) => {
                        return (
                          <tr key={row.monthNumber} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 text-slate-500 font-bold">
                              {row.monthNumber}
                              {row.monthNumber % 12 === 0 && (
                                <span className="block text-[8px] bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded mt-0.5 text-center font-bold">
                                  ปีที่ {row.monthNumber / 12}
                                </span>
                              )}
                            </td>

                            {/* Current Row columns */}
                            <td className="py-2 px-3 border-r border-slate-100 bg-rose-50/5 text-slate-600">
                              <p className="font-bold">{formatCurrency(row.currentBalance)}</p>
                              <p className="text-[10px] text-slate-400">ดบ. {formatCurrency(row.currentInterest)}</p>
                            </td>

                            {/* For each custom bank select */}
                            {customBanks.map(bank => {
                              const bankRowResult = row.paths[bank.id];
                              return (
                                <td 
                                  key={bank.id} 
                                  className="py-2 px-3 border-r border-slate-100"
                                  style={{ backgroundColor: `${bank.color}02` }}
                                >
                                  <p className="font-bold text-slate-800">{formatCurrency(bankRowResult?.balance || 0)}</p>
                                  <div className="text-[10px] flex justify-between gap-1.5 font-semibold">
                                    <span style={{ color: bank.color }}>ดบ. {formatCurrency(bankRowResult?.interest || 0)}</span>
                                    <span className="text-emerald-600 font-bold">
                                      +{formatCurrency(row.currentAccumulatedInterest - (bankRowResult?.accumulatedInterest || 0))}
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
      <footer id="app-footer" className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 text-center text-xs print:hidden mt-auto">
        <p>© 2569 Thai Home Loan Retention & Refinance Multi-Compare. สงวนลิขสิทธิ์</p>
        <p className="opacity-60 text-[10px] mt-1">คู่คิดคำนวณเบี้ยสัดส่วนอย่างแม่นยำรายเดือนตามหลัก Effective Rate อพาร์ทเมนท์และยอดสินเชื่อมวลชน</p>
      </footer>
    </div>
  );
}
