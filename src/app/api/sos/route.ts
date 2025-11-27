import { NextRequest, NextResponse } from "next/server";
import { getSheetTabs, getSheetData } from "@/lib/google";

interface SheetTab {
  name: string;
  id: number;
}

export interface SOSItem {
  timestamp: string;
  timestampObj: number; // for sorting
  location: string;
  status: string;
  details: string;
  source: string;
}

interface GlobalCache {
  timestamp: number;
  tabs: SheetTab[];
  sheets: Map<number, string[][]>; // sheetId -> raw rows
}

let cache: GlobalCache | null = null;
let refreshPromise: Promise<void> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to parse Chinese date format: 2025年11月27日 上午09:38:26
function parseChineseDate(dateStr: string): number {
  try {
    const match = dateStr.match(/(\d+)年(\d+)月(\d+)日\s*(上午|下午)(\d+):(\d+):(\d+)/);
    if (!match) {
      // Try standard date parse as fallback
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }

    const [_, year, month, day, period, hour, minute, second] = match;
    let h = parseInt(hour);
    if (period === "下午" && h < 12) h += 12;
    if (period === "上午" && h === 12) h = 0;

    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(minute), parseInt(second)).getTime();
  } catch (e) {
    return 0;
  }
}

function processSheetData(rows: string[][]): SOSItem[] {
  if (!rows || rows.length < 2) return [];

  const header = rows[0];
  const dataRows = rows.slice(1);

  // Find column indices based on keywords
  const getColIndex = (keywords: string[]) => 
    header.findIndex(h => keywords.some(k => h.includes(k)));

  const idxTimestamp = getColIndex(["時間戳記"]);
  const idxLocation = getColIndex(["邊座", "樓層", "單位"]);
  const idxStatus = getColIndex(["現時情況"]);
  const idxDetails = getColIndex(["住戶情況"]);
  const idxSource = getColIndex(["消息來源"]);
  
  // Columns to exclude (we don't need indices, just ensuring we don't map them)
  // const idxReporterPhone = getColIndex(["通報人聯絡電話"]);
  // const idxVictimPhone = getColIndex(["被困人聯絡電話"]);

  if (idxTimestamp === -1 || idxLocation === -1 || idxStatus === -1) {
    console.warn("[SOS API] Missing required columns in sheet");
    return [];
  }

  return dataRows
    .map(row => {
      const status = row[idxStatus] || "";
      // Filter out "平安" (Safe)
      if (status.includes("平安")) return null;

      const timestamp = row[idxTimestamp] || "";
      
      return {
        timestamp,
        timestampObj: parseChineseDate(timestamp),
        location: row[idxLocation] || "",
        status,
        details: idxDetails !== -1 ? (row[idxDetails] || "") : "",
        source: idxSource !== -1 ? (row[idxSource] || "") : "",
      };
    })
    .filter((item): item is SOSItem => item !== null)
    .sort((a, b) => b.timestampObj - a.timestampObj); // Sort descending (newest first)
}

async function fetchAllData(sheetId: string): Promise<GlobalCache> {
  console.log(`[SOS API] Fetching tabs for sheet ${sheetId}`);
  const tabsData = await getSheetTabs(sheetId);
  
  const tabs: SheetTab[] = tabsData.map(t => ({
    name: t.title,
    id: t.sheetId || 0
  }));

  const sheets = new Map<number, string[][]>();

  // Fetch all sheets in parallel
  await Promise.all(tabs.map(async (tab) => {
    console.log(`[SOS API] Fetching data for tab "${tab.name}"`);
    try {
      // Fetch all data from the sheet
      const rows = await getSheetData(sheetId, `'${tab.name}'!A:Z`);
      sheets.set(tab.id, rows);
    } catch (err) {
      console.error(`[SOS API] Failed to fetch tab ${tab.name}:`, err);
      sheets.set(tab.id, []);
    }
  }));

  return {
    timestamp: Date.now(),
    tabs,
    sheets
  };
}

export async function GET(request: NextRequest) {
  const sheetId = process.env.SOS_SHEET_ID;

  if (!sheetId) {
    return NextResponse.json(
      { error: "SOS_SHEET_ID environment variable not configured" },
      { status: 500 }
    );
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Google Service Account credentials not configured" },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedSheetId = searchParams.get("id");

  try {
    // Check if cache needs refresh
    const now = Date.now();
    const isCacheExpired = !cache || (now - cache.timestamp > CACHE_TTL);

    if (isCacheExpired) {
      if (!refreshPromise) {
        console.log("[SOS API] Cache expired or empty, starting refresh...");
        refreshPromise = fetchAllData(sheetId)
          .then((newCache) => {
            cache = newCache;
            console.log("[SOS API] Cache updated successfully");
          })
          .catch((err) => {
            console.error("[SOS API] Refresh failed:", err);
            if (!cache) throw err;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      
      await refreshPromise;
    }

    if (!cache) {
      return NextResponse.json(
        { error: "Failed to load spreadsheet data" },
        { status: 500 }
      );
    }

    const cacheAge = Math.round((Date.now() - cache.timestamp) / 1000);

    // If specific sheet ID requested
    if (requestedSheetId) {
      const id = parseInt(requestedSheetId);
      const rows = cache.sheets.get(id);
      const tab = cache.tabs.find(t => t.id === id);

      if (!rows || !tab) {
        return NextResponse.json(
          { error: `Sheet with id ${requestedSheetId} not found` },
          { status: 404 }
        );
      }

      const processedItems = processSheetData(rows);

      return NextResponse.json({
        name: tab.name,
        id: tab.id,
        items: processedItems, // Return processed items instead of raw rows
        cacheAge
      });
    }

    // Return list of tabs
    return NextResponse.json({
      tabs: cache.tabs,
      cacheAge
    });

  } catch (error) {
    console.error("[SOS API] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch SOS data";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
