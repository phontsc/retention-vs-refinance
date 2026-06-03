/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, AlertCircle, Bookmark, Landmark, Check, ChevronDown, ChevronUp } from "lucide-react";
import { BankRate } from "../types";
import BankLogo from "./BankLogo";

interface BankOffersProps {
  selectedBankIds: string[];
  currentBankId: string;
  onToggleBank: (bank: BankRate) => void;
  onSetCurrentBank: (bank: BankRate) => void;
  onRatesLoaded: (banks: BankRate[]) => void;
}

export default function BankOffers({ 
  selectedBankIds, 
  currentBankId,
  onToggleBank, 
  onSetCurrentBank,
  onRatesLoaded 
}: BankOffersProps) {
  const [banks, setBanks] = useState<BankRate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAiPowered, setIsAiPowered] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rates");
      if (!response.ok) {
        throw new Error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ระบบดึงอัตราดอกเบี้ยได้");
      }
      const data = await response.json();
      const loadedBanks = data.banks || [];
      setBanks(loadedBanks);
      setLastUpdated(data.lastUpdated || "");
      setSources(data.sources || []);
      setIsAiPowered(!!data.isAiPowered);
      
      onRatesLoaded(loadedBanks);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลดอกเบี้ย");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const currentBank = banks.find(b => b.id === currentBankId);

  return (
    <div id="bank-offers-container" className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-600 shrink-0" />
            เปรียบเทียบอัตราดอกเบี้ยจริงของแต่ละธนาคาร (เปรียบเทียบได้สูงสุด 5 ธนาคาร)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ระบุธนาคารเจ้าหนี้เดิมของคุณ พร้อมเลือกรายธนาคารคู่ปรับข้อเสนอพิเศษ เพื่อเจรจาลดยอดเฉลี่ยหรือย้ายการขอกู้เงินสดใหม่
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer border border-slate-200"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                แสดงตารางธนาคาร
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                ย่อหน้าต่างนี้
              </>
            )}
          </button>
        </div>
      </div>

      {isCollapsed ? (
        <div className="mt-3 p-4 bg-indigo-50/10 border border-slate-150 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">🏦 ธนาคารเจ้าหนี้เดิมของคุณ:</span>
              {currentBank ? (
                <div className="flex items-center gap-1.5">
                  <BankLogo bankId={currentBank.id} size="sm" className="w-5 h-5 rounded" />
                  <span className="font-extrabold text-rose-600">{currentBank.nameTh}</span>
                  <span className="bg-rose-50 text-rose-700 font-mono text-[10.5px] px-1.5 py-0.2 rounded font-bold">MRR: {currentBank.mrr.toFixed(3)}%</span>
                </div>
              ) : (
                <span className="text-slate-500">ยึดตามที่ท่านกำหนดในหัวข้อ 1</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">🔄 เปรียบเทียบ Refinance ({selectedBankIds.length}):</span>
              {selectedBankIds.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {banks.filter(b => selectedBankIds.includes(b.id)).map(b => (
                    <div key={b.id} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-sm">
                      <BankLogo bankId={b.id} size="sm" className="w-4 h-4" />
                      <span className="text-[11px] font-bold text-indigo-700">{b.nameTh.replace("ธนาคาร", "")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 font-medium">ยังไม่ได้เลือกธนาคารคู่เทียบ Refinance</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="text-xs text-indigo-600 hover:underline font-bold"
          >
            ตั้งค่าปรับเปลี่ยน...
          </button>
        </div>
      ) : (
        <>
          {/* Selector Limits / Warning banner */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl mb-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span>ธนาคารสัญญากู้เดิมปัจจุบัน: </span>
                {currentBank ? (
                  <span className="bg-rose-50 border border-rose-100 text-rose-700 text-[11px] px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                    <BankLogo bankId={currentBank.id} size="sm" className="w-4 h-4 inline rounded" />
                    {currentBank.nameTh}
                  </span>
                ) : (
                  <span className="text-slate-400">ยังไม่ได้ระบุ</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <span>เปรียบเทียบ Refi: </span>
                <span className="bg-indigo-100/85 text-indigo-800 text-[11px] px-2 py-0.5 rounded-md font-bold">
                  {selectedBankIds.length} / 5 ธนาคาร
                </span>
              </div>
            </div>
            {selectedBankIds.length >= 5 && (
              <span className="text-amber-600 text-[10px] uppercase font-bold animate-pulse">
                ⚠️ เทียบครบกำหนด 5 ที่แล้ว (โปรดถอดธนาคารเดิมก่อนเลือกเปรียบเทียบเพิ่ม)
              </span>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 text-amber-800 border border-amber-150 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">ไม่สามารถดึงข้อมูลสดผ่าน AI ได้ในขณะนี้</p>
                <p className="opacity-90 mt-0.5">ระบบจะใช้ประมาณการค่ามาตรฐานปี 2569 ซึ่งท่านยังคงแก้ไขข้อมูลทั้งหมดได้อย่างอิสระ</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse bg-slate-50 h-28 rounded-xl border border-slate-100"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5">
              {banks.map((bank) => {
                const isCurrentBank = bank.id === currentBankId;
                const isRefiSelected = selectedBankIds.includes(bank.id);
                return (
                  <div
                    key={bank.id}
                    className={`p-3 rounded-xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between min-h-[10px] gap-1 ${
                      isRefiSelected 
                        ? "border-indigo-600 bg-indigo-50/20 shadow-sm ring-1 ring-indigo-500/10" 
                        : isCurrentBank
                          ? "border-rose-500 bg-rose-50/20 shadow-sm ring-1 ring-rose-500/10"
                          : "border-slate-150 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Bank bar */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-1" 
                      style={{ backgroundColor: bank.color }}
                    />

                    <div className="w-full flex items-start gap-2">
                      <BankLogo bankId={bank.id} size="sm" className="mt-0.5 rounded shadow-sm shrink-0" />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-0.5">
                          <span className="font-extrabold text-slate-800 text-[12px] leading-tight truncate">
                            {bank.nameTh.replace("ธนาคาร", "")}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-500 font-mono mt-0.5 font-bold">
                          {bank.id.toUpperCase()} <span className="text-slate-300">|</span> <span className="text-indigo-600 font-extrabold">MRR: {bank.mrr.toFixed(3)}%</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => onSetCurrentBank(bank)}
                        className={`text-[9.5px] py-1.5 font-extrabold rounded-lg border text-center transition-all cursor-pointer truncate ${
                          isCurrentBank
                            ? "bg-rose-600 border-rose-600 text-white shadow-sm font-black"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        title="ระบุเป็นธนาคารเจ้าหนี้ปัจจุบัน"
                      >
                        {isCurrentBank ? "🏦 หนี้ปัจจุบัน" : "🏦 หนี้ปัจจุบัน"}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => onToggleBank(bank)}
                        className={`text-[9.5px] py-1.5 font-extrabold rounded-lg border text-center transition-all cursor-pointer truncate ${
                          isRefiSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm font-black"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        title="เลือกเป็นคู่เทียบ Refinance"
                      >
                        {isRefiSelected ? "🔄 เทียบ Refi" : "🔄 เทียบ Refi"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
              <span>ฐานข้อมูลอ้างอิง: </span>
              <span className="font-semibold text-slate-600">{lastUpdated || "ประมาณการปี 2569"}</span>
              {isAiPowered && (
                <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded font-medium text-[9px]">
                  AI ดึงสด Realtime
                </span>
              )}
            </div>
            {sources && sources.length > 0 && (
              <div className="flex items-center gap-1.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                <span>แหล่งอ้างอิง: </span>
                <a 
                  href={sources[0]} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-indigo-500 hover:underline max-w-[200px] overflow-hidden text-ellipsis inline-block"
                >
                  {sources[0]}
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
