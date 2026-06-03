/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface BankLogoProps {
  bankId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function BankLogo({ bankId, size = "md", className = "" }: BankLogoProps) {
  const normId = bankId.toLowerCase().trim();

  // Determine width & height based on size preset
  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-9 h-9 text-[12px]",
    lg: "w-12 h-12 text-[14px]",
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  // Asset mapping
  const bankAssets: Record<string, string> = {
    kbank: "KBANK",
    scb: "SCB",
    bbl: "BBL",
    bay: "BAY",
    ttb: "TTB",
    uob: "UOB",
    cimb: "CIMB",
    kkp: "KKP",
    tisco: "TISCO",
    lhbank: "LHB",
    icbc: "ICBC",
    ghb: "GHB",
    gsb: "GSB",
    ktb: "KTB",
    baac: "BAAC",
    ibank: "IBANK"
  };

  const filename = bankAssets[normId];
  if (filename) {
    return (
      <div className={`relative rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-white border border-slate-100 ${currentSize} ${className}`}>
        <img src={`/assets/${filename}.png`} alt={bankId} className="w-full h-full object-contain" />
      </div>
    );
  }

  // Dynamic fallback - beautiful gradient monogram badge with bank initials
  const fallbackLetters = bankId.substring(0, 3).toUpperCase();
  return (
    <div id={`logo-fallback-${normId}`} className={`relative rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-mono font-black text-center shadow-md select-none shrink-0 ${currentSize} ${className}`}>
      {fallbackLetters}
    </div>
  );
}
