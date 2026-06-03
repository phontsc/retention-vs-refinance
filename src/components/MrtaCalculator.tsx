import React from "react";
import { Calculator, Shield, HelpCircle, Activity, ChevronRight } from "lucide-react";
import { LoanInput } from "../types";
import { computeMrtaPremium } from "../calculations";

interface MrtaCalculatorProps {
  loanInput: LoanInput;
  onUpdateLoanInput: React.Dispatch<React.SetStateAction<LoanInput>>;
  formatCurrency: (val: number) => string;
}

export const MrtaCalculator: React.FC<MrtaCalculatorProps> = ({ loanInput, onUpdateLoanInput, formatCurrency }) => {
  const currentAge = loanInput.borrowerAge || 35;
  const currentGender = loanInput.gender || "male";
  const currentCoverageYears = Math.max(1, Math.round(loanInput.remainingTermMonths / 12));
  const currentCoverAmount = loanInput.outstandingPrincipal;
  const currentDecreasingRate = loanInput.mrtaDecreasingRate || 8;

  // Compute premium based on our detailed calculations formula
  const computedPremium = computeMrtaPremium(
    currentCoverAmount,
    currentAge,
    loanInput.borrowerType,
    currentGender,
    currentCoverageYears,
    currentDecreasingRate
  );

  return (
    <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-4">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
          <Calculator className="w-4 h-4 text-indigo-600 animate-pulse" />
          <span>เครื่องมือประเมินเบี้ยประกันภัย MRTA (สูตรละเอียดย้ายค่าย)</span>
        </p>
        <span className="bg-indigo-100 text-indigo-800 text-[9px] font-extrabold px-2 py-0.5 rounded font-sans">
          8% Decreasing Model
        </span>
      </div>

      <p className="text-[10px] text-slate-500 leading-normal font-sans">
        การย้ายค่ายรีไฟแนนซ์ (Refinance) มักต้องเปรียบเทียบชุดอัตราดอกเบี้ยทางเลือกที่ผู้กู้ตกลงทำประกันชีวิตคุ้มครองวงเงิน (MRTA) ใหม่อีกครั้ง โดยมีเงื่อนไขเบี้ยประกันแตกต่างกันดังนี้
      </p>

      {/* Grid: 5 Variables Input Controls */}
      <div className="grid grid-cols-2 gap-3.5 pt-1">
        {/* 1. Gender Selection */}
        <div className="space-y-1">
          <label className="text-[9.5px] text-slate-500 font-extrabold uppercase font-sans">1. เพศผู้เอาประกันภัย</label>
          <div className="flex bg-white rounded-xl border border-slate-200 p-0.5">
            <button
              type="button"
              className={`flex-1 text-[10.5px] font-bold py-1 rounded-lg transition-all cursor-pointer ${
                currentGender === "male" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-600 hover:text-slate-800"
              }`}
              onClick={() => onUpdateLoanInput(prev => ({ ...prev, gender: "male" }))}
            >
              ชาย (Male)
            </button>
            <button
              type="button"
              className={`flex-1 text-[10.5px] font-bold py-1 rounded-lg transition-all cursor-pointer ${
                currentGender === "female" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-600 hover:text-slate-800"
              }`}
              onClick={() => onUpdateLoanInput(prev => ({ ...prev, gender: "female" }))}
            >
              หญิง (Female)
            </button>
          </div>
        </div>

        {/* 2. Borrower Age */}
        <div className="space-y-1">
          <label className="text-[9.5px] text-slate-500 font-extrabold uppercase font-sans">2. อายุผู้กู้ ณ วันที่ขอ (ปี)</label>
          <input
            type="number"
            min="20"
            max="70"
            value={currentAge}
            onChange={(e) => onUpdateLoanInput(prev => ({ ...prev, borrowerAge: Math.max(18, Number(e.target.value)) }))}
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-800 outline-none"
          />
        </div>

        {/* 3. Sum Insured Coverage */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[9.5px] text-slate-500 font-extrabold">
            <span className="uppercase font-sans">3. ทุนเอาประกันเริ่มต้น (บาท)</span>
          </div>
          <input
            type="number"
            step="100000"
            value={currentCoverAmount}
            onChange={(e) => onUpdateLoanInput(prev => ({ ...prev, outstandingPrincipal: Math.max(0, Number(e.target.value)) }))}
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-800 outline-none"
          />
        </div>

        {/* 4. Coverage Period */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[9.5px] text-slate-500 font-extrabold">
            <span className="uppercase font-sans">4. ระยะคุ้มครอง (ปี)</span>
          </div>
          <input
            type="number"
            min="1"
            max="40"
            value={currentCoverageYears}
            onChange={(e) => onUpdateLoanInput(prev => ({ ...prev, remainingTermMonths: Math.max(12, Number(e.target.value) * 12) }))}
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-800 outline-none text-center"
          />
        </div>

        {/* 5. Decreasing Rate Schema */}
        <div className="col-span-2 space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[9.5px] text-slate-500 font-extrabold uppercase font-sans">
              5. อัตราดอกเบี้ยลดหลั่นตารางเงินกู้ลดลง (Decreasing Rate)
            </label>
            <span className="text-[10px] text-indigo-700 font-bold font-mono font-sans">{currentDecreasingRate}% ต่อปี</span>
          </div>
          <div className="flex items-center gap-3 py-1">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={currentDecreasingRate}
              onChange={(e) => onUpdateLoanInput(prev => ({ ...prev, mrtaDecreasingRate: Number(e.target.value) }))}
              className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-bold font-mono px-0.5">
            <span>0%</span>
            <span>20%</span>
            <span>40%</span>
            <span>60%</span>
            <span>80%</span>
            <span>100%</span>
          </div>
          <p className="text-[8.5px] text-slate-400 leading-normal mt-1">
            * สไลด์เพื่อกำหนด "อัตราดอกเบี้ยลดหลั่น" ในการคุ้มครองตามแผนประกัน (ทั่วไปอ้างอิงเฉลี่ย 8% เพื่อให้สอดคล้องกับตัดยอดต้นเงินกู้)
          </p>
        </div>
      </div>

      {/* Primary Outputs Area */}
      <div className="bg-indigo-900 text-white p-3.5 rounded-xl space-y-2 border border-indigo-950">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <p className="text-[10px] text-indigo-200 font-bold tracking-wide uppercase font-sans">ประมาณการเบี้ยประกันภัยจ่ายครั้งเดียว</p>
            <p className="text-xl font-black font-mono">
              {formatCurrency(computedPremium)} บาท
            </p>
          </div>
          <div className="bg-white/10 p-2 rounded-lg">
            <Shield className="w-5 h-5 text-indigo-300" />
          </div>
        </div>

        {/* Breakdown details */}
        <div className="text-[9px] text-indigo-150 border-t border-white/10 pt-2 space-y-1 font-sans">
          <div className="flex justify-between">
            <span>ภาระกู้ความเสี่ยงเดี่ยว/ร่วม:</span>
            <span className="font-bold text-white uppercase">{loanInput.borrowerType === "joint" ? "กู้ร่วม (Joint Rate x1.5)" : "กู้เดี่ยว (Single)"}</span>
          </div>
          <div className="flex justify-between">
            <span>ตัวคูณปัจจัยเพศและสถิติ:</span>
            <span className="font-bold text-white">{currentGender === "male" ? "ชาย (100% Base)" : "หญิง (65% Discounted)"}</span>
          </div>
          <div className="flex justify-between">
            <span>ยอดชำระเฉลี่ยปีละประมาณ:</span>
            <span className="font-bold text-white">{formatCurrency(Math.round(computedPremium / currentCoverageYears))} บาท / ปี</span>
          </div>
        </div>
      </div>

    </div>
  );
};
