import { NextRequest, NextResponse } from "next/server";

interface SheetTab {
  name: string;
  gid: string;
  pageUrl: string;
}

// In-memory cache with 5 minute TTL
interface GlobalCache {
  timestamp: number;
  tabs: SheetTab[];
  sheets: Map<string, string>; // gid -> html content
}

let cache: GlobalCache | null = null;
let refreshPromise: Promise<void> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Extract sheet tabs from htmlview JavaScript
function parseSheetTabs(html: string): SheetTab[] {
  const tabs: SheetTab[] = [];

  // Pattern: items.push({name: "xxx", pageUrl: "xxx", gid: "xxx", ...})
  const matches = html.matchAll(/items\.push\(\{name:\s*"([^"]+)",\s*pageUrl:\s*"([^"]+)",\s*gid:\s*"(\d+)"/g);

  for (const match of matches) {
    tabs.push({
      name: match[1],
      pageUrl: match[2].replace(/\\x3d/g, "=").replace(/\\\//g, "/"),
      gid: match[3],
    });
  }

  return tabs;
}

// Rewrite relative URLs to absolute Google URLs
function rewriteUrls(html: string): string {
  return html
    .replace(/href="\//g, 'href="https://docs.google.com/')
    .replace(/href='\//g, "href='https://docs.google.com/")
    .replace(/src="\//g, 'src="https://docs.google.com/')
    .replace(/src='\//g, "src='https://docs.google.com/")
    .replace(/url\(\//g, "url(https://docs.google.com/")
    .replace(/\/\/ssl\.gstatic\.com/g, "https://ssl.gstatic.com");
}

async function fetchAllData(sheetId: string): Promise<GlobalCache> {
  // 1. Fetch main page
  const mainUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
  console.log(`[FETCH] Fetching main htmlview: ${mainUrl}`);
  
  const mainResponse = await fetch(mainUrl, { cache: 'no-store' });
  if (!mainResponse.ok) {
    throw new Error(`Failed to fetch main page: ${mainResponse.status}`);
  }
  
  const mainHtml = await mainResponse.text();
  
  // 2. Parse tabs
  const tabs = parseSheetTabs(mainHtml);
  if (tabs.length === 0) {
    throw new Error("No sheets found in spreadsheet");
  }
  console.log(`[FETCH] Found ${tabs.length} tabs`);

  // 3. Fetch all tabs in parallel
  const sheets = new Map<string, string>();
  
  await Promise.all(tabs.map(async (tab) => {
    console.log(`[FETCH] Fetching tab "${tab.name}" (${tab.gid})`);
    try {
      const res = await fetch(tab.pageUrl, { cache: 'no-store' });
      if (!res.ok) {
        console.error(`[ERROR] Failed to fetch tab ${tab.name}: ${res.status}`);
        return;
      }
      let html = await res.text();
      html = rewriteUrls(html);
      sheets.set(tab.gid, html);
    } catch (err) {
      console.error(`[ERROR] Failed to fetch tab ${tab.name}:`, err);
    }
  }));

  return {
    timestamp: Date.now(),
    tabs,
    sheets
  };
}

export async function GET(request: NextRequest) {
  const sheetId = process.env.SHEET_ID;

  if (!sheetId) {
    return NextResponse.json(
      { error: "SHEET_ID environment variable not configured" },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedGid = searchParams.get("gid");

  try {
    // Check if cache needs refresh
    const now = Date.now();
    const isCacheExpired = !cache || (now - cache.timestamp > CACHE_TTL);

    if (isCacheExpired) {
      if (!refreshPromise) {
        console.log("[CACHE] Cache expired or empty, starting refresh...");
        refreshPromise = fetchAllData(sheetId)
          .then((newCache) => {
            cache = newCache;
            console.log("[CACHE] Cache updated successfully");
          })
          .catch((err) => {
            console.error("[CACHE] Refresh failed:", err);
            // If we have old cache, maybe keep it? But for now just fail if no cache
            if (!cache) throw err;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      
      // Wait for the refresh to complete
      await refreshPromise;
    }

    if (!cache) {
      return NextResponse.json(
        { error: "Failed to load spreadsheet data" },
        { status: 500 }
      );
    }

    const cacheAge = Math.round((Date.now() - cache.timestamp) / 1000);
    console.log(`[CACHE] Serving request from cache (age: ${cacheAge}s)`);

    // If gid is requested, return cached HTML for that specific sheet
    if (requestedGid) {
      const content = cache.sheets.get(requestedGid);

      if (!content) {
        return NextResponse.json(
          { error: `Sheet with gid ${requestedGid} not found` },
          { status: 404 }
        );
      }

      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          "X-Cache": "HIT",
          "X-Cache-Age": `${cacheAge}s`,
        },
      });
    }

    // No gid requested - return the list of tabs as JSON
    const response = NextResponse.json({
      tabs: cache.tabs.map((t) => ({ name: t.name, gid: t.gid })),
    });

    response.headers.set("X-Cache", "HIT");
    response.headers.set("X-Cache-Age", `${cacheAge}s`);

    return response;
  } catch (error) {
    console.error("[ERROR] Error fetching spreadsheet:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch spreadsheet data";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
