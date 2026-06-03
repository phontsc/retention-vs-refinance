/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shorthand type for a period's rate structure (e.g., Year 1, Year 2, Year 3, Year 4+)
export interface RatePeriod {
  type: "fixed" | "mrr"; // "fixed" or "mrr"
  value: number; // For fixed: e.g. 3.25, for MRR: modifier/offset e.g. -3.50 or +0.50
  mrrBaseline?: number; // Optional. Baseline for "mrr" type, e.g. 6.50
}

export interface BankRate {
  id: string;
  nameTh: string;
  nameEn: string;
  mrr: number;
  typicalRefinance3Yr: number;
  typicalRetention3Yr: number;
  color: string;
}

export interface HistoricalPayment {
  id: string;
  monthIndex: number; // ลำดับงวด เช่น งวดที่ 1
  payDate: string;     // วันที่ชำระ เช่น 2026-05-01
  paymentAmount: number; // ยอดชำระจริง (บาท)
  interestCalculated: number; // ดอกเบี้ยที่จ่าย
  principalDeducted: number;  // เงินตัดเงินต้น
  endingBalance: number;      // ยอดเงินต้นคงเหลือ
}

export interface LoanInput {
  // Outstanding Principal & Standard config
  outstandingPrincipal: number; // เงินต้นคงเหลือปัจจุบัน (บาท)
  currentInterestRate: number;  // อัตาดอกเบี้ยเฉลี่ย (กรณีใช้ตัวแปรทั่วไป)
  remainingTermMonths: number;  // ระยะเวลาผ่อนคงเหลือ (แปลงเป็นเดือนแล้ว)
  currentInstallment: number;   // ค่างวดผ่อนทั่วไปต่อเดือน

  // Extended fields requested by user
  borrowerType: "single" | "joint"; // สัญญากู้เดี่ยว / กู้ร่วม
  gender: "male" | "female"; // เพศ
  borrowerAge: number;              // อายุผู้กู้ (ปี)
  borrowerAgeAtContract: number;    // อายุตอนทำสัญญาของผู้กู้หลัก (ปี)
  borrower2Age?: number;            // อายุปัจจุบันของผู้กู้ร่วม (ปี)
  borrower2Gender?: "male" | "female"; // เพศของผู้กู้ร่วม
  startingLoanAmount: number;       // วงเงินกู้เริ่มต้น (บาท)
  mrtaDecreasingRate?: number;       // อัตราลดเงินเอาประกันลดหลั่น (เช่น 8%)

  // Contract dates
  contractStartDate: string;        // วันที่เริ่มทำสัญญา เช่น "2024-01-01"
  retentionStartDate: string;       // วันที่เริ่มสัญญาลดดอกเบี้ย / Retention / Refinance
  startingTermMonths: number;       // ระยะเวลาสัญญาเริ่มต้น (เดือน เช่น 360 ด = 30 ปี)

  // Related Transaction Expenses
  appraisalFee: number;             // ค่าสำรวจและประเมินหลักประกัน (เช่น 3,000)
  mortgageFeeRate: number;          // ค่าจดจำนอง (ร้อยละ ของวงเงินจำนอง เช่น 1%)
  dutyStampRate: number;            // ค่าอากรแสตมป์ (ร้อยละ ของวงเงินสินเชื่อ เช่น 0.05%)

  // Fire Insurance
  fireInsurancePremium: number;     // ค่าเบี้ยประกันภัยอัคคีภัย (บาท)
  fireInsuranceDuration: number;    // ระยะเวลาคุ้มครอง (ปี)
  fireSumInsuredBuilding: number;   // เงินเอาประกันภัย: สิ่งปลูกสร้างไม่รวมฐานราก (บาท)
  fireSumInsuredContent: number;    // เงินเอาประกันภัย: ทรัพย์สินภายในสิ่งปลูกสร้าง (บาท)

  // Borrower 1 - MLTA / MRTA
  mrta1Premium: number;             // เงินค่าเบี้ยประกัน (ผู้ที่ 1)
  mrta1SumInsured: number;          // จำนวนเงินเอาประกันภัย (ผู้ที่ 1)
  mrta1Type: "constant" | "decreasing"; // แบบประกันภัย เช่น แบบคงที่ หรือ รูปผดผันตามเวลา
  mrta1PaymentPattern: "single" | "yearly" | "monthly"; // รูปแบบการชำระ
  mrta1SurrenderRate3Yr: number;    // สัดส่วนเงินเวนคืนเมื่อครบ 3 ปี (บาท ต่อเงินเอาประกันภัย 1,000 บาท เช่น 13.57)

  // Borrower 2 - MLTA / MRTA (For Joint loan)
  mrta2Premium: number;             // เงินค่าเบี้ยประกัน (ผู้ที่ 2)
  mrta2SumInsured: number;          // จำนวนเงินเอาประกันภัย (ผู้ที่ 2)
  mrta2Type: "constant" | "decreasing";
  mrta2PaymentPattern: "single" | "yearly" | "monthly";
  mrta2SurrenderRate3Yr: number;    // สัดส่วนเงินเวนคืนประกันภัยเมื่อครบ 3 ปี (บาท ต่อ 1,000 บาท เช่น 13.57)

  // Current contract interest rate schema for year 1, 2, 3 and 4+
  currentYr1Rate: RatePeriod;
  currentYr2Rate: RatePeriod;
  currentYr3Rate: RatePeriod;
  currentYr4PlusRate: RatePeriod;

  // Stepped payments for year 1, 2, 3 and 4+
  currentYr1Installment: number;
  currentYr2Installment: number;
  currentYr3Installment: number;
  currentYr4PlusInstallment: number;

  // Prepayment parameters
  prepaymentFeeRate: number;      // เบี้ยวเสีย prepayment fee (%) เช่น 3%
  prepaymentLockMonths: number;   // ระยะเวลาที่ห้ามชำระครบ เช่น 36 เดือน

  // Transaction Subsidy parameters (เงินทดรองจ่ายที่ธนาคารจ่ายให้ตอนแรก)
  receivesSubsidy: boolean;       // มีเงินทดรองจ่าย เช่น ค่าจดจำนอง 1% ที่ธนาคารออกให้
  subsidyAmount: number;          // ค่าจดจำนอง หรือ ยอดเงินทดรองจ่ายจริง (บาท)
  subsidyLockMonths: number;      // ระยะเวลาขั้นต่ำที่ห้ามย้าย Refi เพื่อเลี่ยงจ่ายเงินคืน (เช่น 36 เดือน)
  elapsedMonths: number;          // จำนวนงวดสัญญากี่เดือนที่ผ่านมาแล้ว ณ ปัจจุบัน

  // Insurance Cancellation Penalty (ค่าปรับกรณียกเลิกประกัน MRTA ก่อนครบสัญญา)
  hasInsurancePenalty: boolean;
  insurancePenaltyRate: number;    // อัตราร้อยละค่าปรับ เช่น 0.35%
  insurancePenaltyMonths: number;  // ระยะงวดปรับที่โดน เช่น 36 งวด

  // Historical payments table
  historicalPayments: HistoricalPayment[];
}

export interface RefiPackageConfig {
  id: number;
  label: string;
  yr1: RatePeriod;
  yr2: RatePeriod;
  yr3: RatePeriod;
  yr4Plus: RatePeriod;
  freeMortgage: boolean;
  hasMrta: boolean;
}

export interface CustomFeeItem {
  id: string;
  name: string;
  amount: number;
}

// Representing a custom comparative path (whether Retention or a Refinance Bank option)
export interface CustomBankConfig {
  id: string; // "ghb", "bbl", "retention", etc.
  nameTh: string;
  nameEn: string;
  color: string;
  mrr: number;
  
  // Rate control for Year 1, 2, 3, 4+
  yr1: RatePeriod;
  yr2: RatePeriod;
  yr3: RatePeriod;
  yr4Plus: RatePeriod;
  
  // Set-up fees configuration
  freeMortgageFee: boolean; // ฟรีค่าจดจำนอง (1%)
  freeAppraisalFee: boolean; // ฟรีค่าประเมิน (3,000)
  freeDutyStamp: boolean; // ฟรีค่าอากรแสตมป์ (0.05%)
  
  customAppraisalFee: number;
  customMortgageFeeRate: number; // 1%
  customMortgageFeeAmount?: number; // จำนวนเงินจดจำนองโดยตรง (บาท)
  customDutyStampRate?: number; // 0.05%
  customDutyStampAmount?: number; // จำนวนเงินค่าอากรแสตมป์โดยตรง (บาท)
  otherFees: number;
  customOtherFees?: CustomFeeItem[];

  // MRTA configuration for Refinance options
  hasMrta: boolean; // เลือกว่าจะทำประกัน MRTA หรือไม่ (เพื่อประหยัดดอกเบี้ยงวดทดแทน)
  customMrtaPremium?: number; // จำนวนเงินเบี้ยประกัน MRTA โดยตรง (บาท)
  customMrtaType?: "single" | "joint"; // รูปแบบประกันเดี่ยวหรือร่วม
  customMrtaPremium1?: number; // จำนวนเงินเบี้ยคู่แรกหรือเดี่ยว (บาท)
  customMrtaPremium2?: number; // จำนวนเงินเบี้ยคู่สอง (บาท)
  
  // Fire Insurance for Refinance options
  fireInsurancePremium?: number;
  fireInsuranceDuration?: number;
  fireSumInsured?: number;

  // Installment preference
  isInstallmentAdjusted: boolean;
  customInstallment: number;

  // Dynamic Refinance packages
  packages?: RefiPackageConfig[];
  activePackageId?: number;
}

export interface AmortizationRow {
  month: number;
  interestPaid: number;
  principalPaid: number;
  endingBalance: number;
  accumulatedInterest: number;
  accumulatedPayment: number;
}

// A generic row in the monthly chart/table that contains rates, balances, and payments for EVERY compared pathway
export interface PathMonthResult {
  monthNumber: number;
  
  // Current pathway
  currentBalance: number;
  currentInterest: number;
  currentPayment: number;
  currentAccumulatedInterest: number;
  currentAccumulatedPayment: number;

  // Map of bank ID to its specific metrics at this month (to support up to 5 dynamic compared banks dynamically!)
  paths: Record<string, {
    balance: number;
    interest: number;
    payment: number;
    accumulatedInterest: number;
    accumulatedPayment: number;
  }>;
}

// Stats collected for a specific pathway
export interface PathComparisonStats {
  id: string;
  nameTh: string;
  color: string;
  
  // 3-Year block metrics
  threeYear: {
    totalPaid: number;
    totalInterest: number;
    remainingPrincipal: number;
    setupFees: number;
    mrtaPremium: number; // เบี้ยประกัน MRTA ที่บวกเสริมจากการกู้ย้าย
    prepaymentCost: number; // โดนเรียกเก็บเบี้ยปรับรีไฟแนนซ์ก่อนกำหนด
    subsidyRefundCost: number; // คืนเงินทดรองจ่ายกรณีผิดเงื่อนไขเดิม
    insurancePenaltyCost: number; // เบี้ยปรับกรณียกเลิกประกัน
    netExpense: number; // paid + setupFees + adjustments
    totalSavingsVsCurrent: number; // interest difference - overall fees
    mrtaSurrenderRefund?: number; // คืนเงินประกันของสัญญาธนาคารเดิมที่เวนคืนได้ ณ ปลายปีที่ 3
  };

  // Full-term block metrics
  fullTerm: {
    totalPaid: number;
    totalInterest: number;
    totalSavingsVsCurrent: number;
  };

  breakevenMonths: number;
}

export interface FinalComparisonResult {
  currentStats: {
    threeYear: {
      totalPaid: number;
      totalInterest: number;
      remainingPrincipal: number;
    };
    fullTerm: {
      totalPaid: number;
      totalInterest: number;
    };
  };
  
  pathways: PathComparisonStats[]; // List of compared paths containing Retention + selected Refinance banks (up to 5 banks)!
}
