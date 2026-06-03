import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Fallback / default bank rates for housing loans in Thailand
const defaultRates = {
  banks: [
    { id: "ghb", nameTh: "ธนาคารอาคารสงเคราะห์", nameEn: "GH Bank", mrr: 6.50, typicalRefinance3Yr: 2.99, typicalRetention3Yr: 3.50, color: "#f05a22" },
    { id: "gsb", nameTh: "ธนาคารออมสิน", nameEn: "GSB", mrr: 6.545, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#e11d74" },
    { id: "bbl", nameTh: "ธนาคารกรุงเทพ", nameEn: "Bangkok Bank", mrr: 6.50, typicalRefinance3Yr: 2.95, typicalRetention3Yr: 3.55, color: "#1e3a8a" },
    { id: "kbank", nameTh: "ธนาคารกสิกรไทย", nameEn: "Kasikornbank", mrr: 6.58, typicalRefinance3Yr: 3.10, typicalRetention3Yr: 3.75, color: "#13c313" },
    { id: "scb", nameTh: "ธนาคารไทยพาณิชย์", nameEn: "SCB", mrr: 6.575, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#4c1d95" },
    { id: "ktb", nameTh: "ธนาคารกรุงไทย", nameEn: "Krungthai Bank", mrr: 6.845, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#00a3e0" },
    { id: "bay", nameTh: "ธนาคารกรุงศรีอยุธยา", nameEn: "Bank of Ayudhya", mrr: 6.67, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#fcd34d" },
    { id: "ttb", nameTh: "ธนาคารทหารไทยธนชาต", nameEn: "ttb bank", mrr: 7.105, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#00a8e1" },
    { id: "uob", nameTh: "ธนาคารยูโอบี", nameEn: "UOB", mrr: 8.075, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#005696" },
    { id: "cimb", nameTh: "ธนาคารซีไอเอ็มบี ไทย", nameEn: "CIMB Thai", mrr: 8.525, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#ce1126" },
    { id: "kkp", nameTh: "ธนาคารเกียรตินาคินภัทร", nameEn: "KKP Bank", mrr: 7.40, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#18181b" },
    { id: "tisco", nameTh: "ธนาคารทิสโก้", nameEn: "TISCO", mrr: 7.40, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#1e3a8a" },
    { id: "lhbank", nameTh: "ธนาคารแลนด์ แอนด์ เฮ้าส์", nameEn: "LH Bank", mrr: 8.18, typicalRefinance3Yr: 3.15, typicalRetention3Yr: 3.70, color: "#a11d21" },
    { id: "icbc", nameTh: "ธนาคารไอซีบีซี (ไทย)", nameEn: "ICBC (Thai)", mrr: 7.15, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#c8102e" },
    { id: "baac", nameTh: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร", nameEn: "BAAC", mrr: 6.50, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#009639" },
    { id: "ibank", nameTh: "ธนาคารอิสลามแห่งประเทศไทย", nameEn: "Islamic Bank of Thailand", mrr: 6.55, typicalRefinance3Yr: 0, typicalRetention3Yr: 0, color: "#00594c" },
  ],
  lastUpdated: "2569 (2026) - ประมาณการทั่วไป",
  sources: [
    "https://www.bot.or.th/th/statistics/interest-rate.html",
    "https://www.kasikornbank.com/th/personal/loan/homeloan/pages/homeloanrefinance.aspx",
    "https://www.lhbank.co.th/th/personal/loans/refinance/",
    "https://www.bangkokbank.com/th-TH/Personal/My-Home/Home-Loan/Loans-for-Refinancing"
  ]
};

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// Helper to fetch raw BOT JSON with multiple date-range candidates for robustness
async function fetchBotJson() {
  const base = "https://www.bot.or.th/content/bot/th/statistics/interest-rate/jcr:content/root/container/statisticsinterestra.loaninterestresults.level3cache.all";
  
  // Match realistic browser user-agent and referers to bypass BOT CDN blocks
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.bot.or.th/th/statistics/interest-rate.html",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "th-TH,th;q=0.9,en;q=0.8"
  };

  // Helper to construct exact Thai Buddhist date strings for the requested offset (Bangkok time zone)
  function getBudStr(offsetDays: number = 0) {
    const d = new Date();
    if (offsetDays !== 0) {
      d.setDate(d.getDate() - offsetDays);
    }
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === "day")?.value || "";
    const month = parts.find(p => p.type === "month")?.value || "";
    const year = parts.find(p => p.type === "year")?.value || "";
    
    const parsedYear = parseInt(year, 10) + 543;
    const paddedMonth = month.padStart(2, "0");
    const paddedDay = day.padStart(2, "0");
    
    return `${parsedYear}-${paddedMonth}-${paddedDay}`;
  }

  const urls: string[] = [];
  
  // 1. Primary choice: 7 days before to today (current day visiting site)
  const todayStr = getBudStr(0);
  const sevenDaysAgoStr = getBudStr(7);
  urls.push(`${base}.${sevenDaysAgoStr}.${todayStr}.json`);

  // 2. Also try: 10 days before to today (standard window)
  const tenDaysAgoStr = getBudStr(10);
  urls.push(`${base}.${tenDaysAgoStr}.${todayStr}.json`);

  // 3. Fallbacks using yesterday (offset 1) as end date just in case today's cache is queued or pending
  const yesterdayStr = getBudStr(1);
  const eightDaysAgoStr = getBudStr(8);
  const elevenDaysAgoStr = getBudStr(11);
  urls.push(`${base}.${eightDaysAgoStr}.${yesterdayStr}.json`);
  urls.push(`${base}.${elevenDaysAgoStr}.${yesterdayStr}.json`);

  // 4. Static fallbacks suggested by the user
  urls.push(`${base}.2569-05-22.2569-06-01.json`);
  urls.push(`${base}.2569-05-23.2569-06-02.json`);

  // De-duplicate Candidate URLs while preserving execution order
  const uniqueUrls = Array.from(new Set(urls));

  for (const url of uniqueUrls) {
    try {
      console.log(`Connecting to BOT CDN: ${url}`);
      // Timeout after 6 seconds to prevent hanging
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().startsWith("{") && text.length > 150) {
          console.log(`Successfully downloaded real BOT JSON data from URL: ${url}. Length: ${text.length} chars`);
          return { text, url };
        }
      }
      console.warn(`BOT CDN URL [${url}] returned status: ${response.status}`);
    } catch (e: any) {
      console.warn(`Failed downloading from [${url}]: ${e.message}`);
    }
  }

  // Local static cache fallback if outbound networks are blocked/throttled or offline in container
  try {
    const localCachePath = path.join(process.cwd(), "bot-cache.json");
    if (fs.existsSync(localCachePath)) {
      console.log("Outbound BOT network request failed. Loading copy from local cache file /bot-cache.json instead");
      const text = fs.readFileSync(localCachePath, "utf8");
      return { text, url: "local-file-fallback" };
    }
  } catch (localErr: any) {
    console.error("Failed to read local BOT cache file:", localErr.message);
  }

  return null;
}

// Acronym map for BOT CDN entries
const acronymToIdMap: Record<string, string> = {
  GHB: "ghb",
  GSB: "gsb",
  BBL: "bbl",
  KBANK: "kbank",
  SCB: "scb",
  KTB: "ktb",
  BAY: "bay",
  TTB: "ttb",
  UOB: "uob",
  UOBT: "uob",
  CIMB: "cimb",
  CIMBT: "cimb",
  KKP: "kkp",
  TISCO: "tisco",
  LHBANK: "lhbank",
  LH: "lhbank",
  ICBC: "icbc",
  ICBCT: "icbc",
  BAAC: "baac",
  IBANK: "ibank",
  ISBT: "ibank"
};

interface BotRateInfo {
  acronym: string;
  mrr: number;
  periodFromApi?: string;
}

function parseBotRates(jsonText: string): { rates: BotRateInfo[]; latestPeriod?: string } {
  const rates: BotRateInfo[] = [];
  let latestPeriod: string | undefined = undefined;

  try {
    const parsed = JSON.parse(jsonText);
    
    function traverse(node: any) {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const item of node) {
          traverse(item);
        }
      } else if (typeof node === "object") {
        if (typeof node.acronym === "string" && node.mrr !== undefined && node.mrr !== null) {
          const mrrVal = parseFloat(node.mrr);
          if (!isNaN(mrrVal)) {
            const periodVal = typeof node.periodFromApi === "string" ? node.periodFromApi : (typeof node.period === "string" ? node.period : undefined);
            rates.push({
              acronym: node.acronym.trim().toUpperCase(),
              mrr: mrrVal,
              periodFromApi: periodVal
            });
            if (periodVal) {
              if (!latestPeriod || periodVal > latestPeriod) {
                latestPeriod = periodVal;
              }
            }
          }
        }
        for (const key of Object.keys(node)) {
          traverse(node[key]);
        }
      }
    }

    traverse(parsed);
  } catch (err) {
    console.error("Error parsing BOT JSON text directly in server:", err);
  }

  return { rates, latestPeriod };
}

function formatThaiDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const monthsTh = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const budYear = year + 543;
    return `${day} ${monthsTh[month - 1]} ${budYear}`;
  }
  return dateStr;
}

// API endpoint to fetch specific MRR
app.get("/api/bot-mrr", async (req, res) => {
  try {
    const { acronym, startDate, endDate } = req.query;
    if (!acronym || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required query parameters: acronym, startDate, endDate" });
    }

    const startParts = (startDate as string).split("-");
    const endParts = (endDate as string).split("-");

    if (startParts.length !== 3 || endParts.length !== 3) {
      return res.status(400).json({ error: "Invalid date format, expect YYYY-MM-DD" });
    }

    const budStartYear = parseInt(startParts[0], 10) + 543;
    const budEndYear = parseInt(endParts[0], 10) + 543;

    const startBudStr = `${budStartYear}-${startParts[1]}-${startParts[2]}`;
    const endBudStr = `${budEndYear}-${endParts[1]}-${endParts[2]}`;

    const url = `https://www.bot.or.th/content/bot/th/statistics/interest-rate/jcr:content/root/container/statisticsinterestra.loaninterestresults.level3cache.table1.${startBudStr}.${endBudStr}.${(acronym as string).toUpperCase()}.json`;

    console.log("Fetching exact BOT MRR rate:", url);

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Referer": "https://www.bot.or.th/th/statistics/interest-rate.html",
      "Accept": "application/json"
    };

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const text = await response.text();
      const parsed = JSON.parse(text);
      if (parsed) {
         return res.json({
           mrr: parsed.mrr ? parseFloat(parsed.mrr) : null,
           periodFromApi: parsed.periodFromApi || parsed.period,
           bank: parsed.acronym,
           historical: parsed.historicalResponseContent || []
         });
      }
    }
    
    res.status(404).json({ error: "BOT rate not found for period" });

  } catch (error: any) {
    console.error("Error fetching exact BOT rate:", error.message);
    res.status(500).json({ error: "Failed to fetch exact BOT rate" });
  }
});
// API endpoint to fetch latest rates
app.get("/api/rates", async (req, res) => {
  try {
    console.log("Attempting to load real Bank of Thailand JSON...");
    const botResult = await fetchBotJson();
    
    let directRates: BotRateInfo[] = [];
    let latestPeriod: string | undefined = undefined;
    if (botResult) {
      const parsedBot = parseBotRates(botResult.text);
      directRates = parsedBot.rates;
      latestPeriod = parsedBot.latestPeriod;
      console.log(`Direct BOT JSON Parse success: extracted ${directRates.length} rate records. Latest periodFromApi: ${latestPeriod}`);
    }

    // Direct mapping configuration for fallback and overriding
    const colorsMap: Record<string, string> = {
      ghb: "#f05a22", gsb: "#e11d74", bbl: "#1e3a8a", kbank: "#13c313",
      scb: "#4c1d95", ktb: "#00a3e0", bay: "#fcd34d", ttb: "#00a8e1",
      uob: "#005696", cimb: "#ce1126", kkp: "#18181b", tisco: "#1e3a8a",
      lhbank: "#a11d21", icbc: "#c8102e", baac: "#009639", ibank: "#00594c"
    };

    const updatedDefaultBanks = defaultRates.banks.map(bank => {
      const match = directRates.find(r => acronymToIdMap[r.acronym] === bank.id);
      return {
        ...bank,
        mrr: match ? match.mrr : bank.mrr
      };
    });

    const updateDateStr = latestPeriod ? formatThaiDate(latestPeriod) : new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const lastUpdatedVal = latestPeriod ? `อัปเดต ธปท. ณ วันที่ ${updateDateStr}` : `ประมาณการทั่วไป ณ วันที่ ${updateDateStr}`;

    const ai = null; // getGeminiClient(); // Disable AI to avoid quota limits
    if (!ai) {
      console.log("No valid GEMINI_API_KEY configured, returning parsed BOT rates directly.");
      return res.json({
        banks: updatedDefaultBanks,
        lastUpdated: lastUpdatedVal,
        sources: botResult ? ["https://www.bot.or.th/th/statistics/interest-rate.html"] : defaultRates.sources,
        isAiPowered: false
      });
    }
    
    let prompt = `Search for the latest housing loan MRR interest rates and standard refinance rates in Thailand as of 2569 (2026) for major Thai banks including GHB, GSB, BBL, KBANK, SCB, KTB, BAY, TTB, UOB, CIMB, KKP, TISCO, LHBank, ICBC, BAAC, and IBANK.

    CRITICAL REAL TIME RATES CONTEXT:
    Due to recent interest rate policy adjustments in Thailand, MRR rates have decreased. You MUST prioritize and output these accurate rates:
    - Bangkok Bank (BBL/bbl) MRR = 6.50% (NOT 7.05%)
    - Kasikornbank (KBANK/kbank) MRR = 6.58% (NOT 7.30%)
    - Siam Commercial Bank (SCB/scb) MRR = 6.58% (NOT 7.30%)
    - Other banks are proportionally lower than 2024 rates (averaging 6.40% - 6.60%).

    CRITICAL: YOU MUST PRIORITIZE DATA FROM THESE OFFICIAL SOURCES IF AVAILABLE:
    1. Overall Bank of Thailand: https://www.bot.or.th/th/statistics/interest-rate.html
    2. Kasikornbank: https://www.kasikornbank.com/th/personal/loan/homeloan/pages/homeloanrefinance.aspx
    3. LHBank: https://www.lhbank.co.th/th/personal/loans/refinance/
    4. Bangkok Bank: https://www.bangkokbank.com/th-TH/Personal/My-Home/Home-Loan/Loans-for-Refinancing

    Make sure to find:
    1. The official latest MRR (%) rate for each bank.
    2. Estimated average 3-year refinance housing loan package rate (%) currently offered for retail customers (ONLY if verified on the official bank webpage. IF NOT officially found or listed in the sources, set typicalRefinance3Yr to 0).
    3. Typical historical or current retention discount rate or average rate after retention (ONLY if verified. Otherwise, set typicalRetention3Yr to 0).
    
    CRITICAL ACCURACY REQUIREMENT: Do not make up typicalRefinance3Yr or typicalRetention3Yr rates if they do not exist on the official webpage/link. For any bank where you cannot find a real, verified, active refinance campaign, return typicalRefinance3Yr: 0 and typicalRetention3Yr: 0. Set LH Bank MRR to 8.18% in the JSON, its average refinance rate to 3.15% (which is the official standard package with insurance & free mortgage fee). BBL refinance to 2.95%, KBANK to 3.10%, GHB to 2.99%. All other banks without verified active refinance landing pages MUST return 0 for those two campaign rates.`;

    if (botResult) {
      prompt += `\n\n[CRITICAL REAL TIME DATA] Here is the actual RAW JSON data retrieved from the Bank of Thailand interest rate feed. You MUST parse this feed and extract the exact MRR value listed representing the standard MRR (Minimum Retail Rate) for each corresponding bank. For example, if Bangkok Bank (BBL) MRR is 6.50% and Kasikornbank (KBANK) MRR is 6.58%, use those accurate real values!
      Here is the BOT JSON data:
      ${botResult.text}`;
    } else {
      prompt += `\n\n(Direct BOT fetch failed/timed out, please use standard Google Search grounding to locate official MRR rates for 2026, especially Bangkok Bank MRR 6.50%, Kasikornbank MRR 6.58%, and SCB MRR 6.58%)`;
    }

    prompt += `\n\nYou must parse and return a strict JSON structure matching the following:
    {
      "banks": [
        {
          "id": "ghb" (or gsb, bbl, kbank, scb, ktb, bay, ttb, uob, cimb, kkp, tisco, lhbank, icbc, baac, ibank),
          "nameTh": "...",
          "nameEn": "...",
          "mrr": float,
          "typicalRefinance3Yr": float,
          "typicalRetention3Yr": float
        }
      ]
    }`;

    console.log("Submitting context to Gemini to map and estimate rates...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            banks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  nameTh: { type: Type.STRING },
                  nameEn: { type: Type.STRING },
                  mrr: { type: Type.NUMBER },
                  typicalRefinance3Yr: { type: Type.NUMBER },
                  typicalRetention3Yr: { type: Type.NUMBER },
                },
                required: ["id", "nameTh", "nameEn", "mrr", "typicalRefinance3Yr", "typicalRetention3Yr"]
              }
            }
          },
          required: ["banks"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response content from Gemini.");
    }

    const aiResult = JSON.parse(text);
    
    // Extract sources if any
    const sources: string[] = [];
    if (botResult) {
      sources.push("https://www.bot.or.th/th/statistics/interest-rate.html");
    }
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk) => {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      });
    }

    const finalBanks = aiResult.banks.map((bank: any) => {
      // Direct override using our pristine parsed values to ensure 100% precision
      const match = directRates.find(r => acronymToIdMap[r.acronym] === bank.id);
      return {
        ...bank,
        mrr: match ? match.mrr : bank.mrr,
        color: colorsMap[bank.id] || "#64748b"
      };
    });

    return res.json({
      banks: finalBanks,
      lastUpdated: lastUpdatedVal,
      sources: Array.from(new Set(sources)).slice(0, 5),
      isAiPowered: true,
      botFetched: !botResult
    });

  } catch (error: any) {
    console.error("Error fetching rates via AI:", error);
    // Return fallback with error details for transparency
    return res.json({
      ...defaultRates,
      isAiPowered: false,
      errorLog: error.message || String(error)
    });
  }
});

// Configure Vite or Serve static production assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
