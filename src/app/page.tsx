"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SheetTab {
  name: string;
  gid: string;
}

interface ApiResponse {
  tabs: SheetTab[];
  error?: string;
}

// Fixed 5 minute interval
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [iframeKey, setIframeKey] = useState(0);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTabs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sheets");
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "載入失敗");
        setData(null);
      } else {
        setData(result);
        setLastUpdated(new Date());
        // Set first tab as active if not already set
        if (result.tabs?.length > 0 && !result.tabs.find((t: SheetTab) => t.gid === activeTab)) {
          setActiveTab(result.tabs[0].gid);
        }
        // Refresh iframe
        setIframeKey((k) => k + 1);
      }
    } catch {
      setError("網絡錯誤，請重試。");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Schedule next refresh with random interval
  const scheduleNextRefresh = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    setNextRefreshIn(Math.round(REFRESH_INTERVAL / 1000));

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setNextRefreshIn((prev) => Math.max(0, prev - 1));
    }, 1000);

    // Actual refresh timer - just refresh the iframe
    timerRef.current = setTimeout(() => {
      setIframeKey((k) => k + 1);
      setLastUpdated(new Date());
      scheduleNextRefresh();
    }, REFRESH_INTERVAL);
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  // Start auto-refresh after initial load
  useEffect(() => {
    if (data) {
      scheduleNextRefresh();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [data, scheduleNextRefresh]);

  const handleTabChange = (gid: string) => {
    setActiveTab(gid);
    setIframeKey((k) => k + 1);
  };

  // Format countdown as minutes:seconds
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // iframe loads from our API which caches Google's response
  const iframeSrc = activeTab ? `/api/sheets?gid=${activeTab}` : "";

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3">
          宏福苑報平安【齋睇】
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800 font-semibold mb-4 text-center">
            此頁面只供查閱，無法報平安！
          </p>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSc64NpaVIcAkg92fanI5W34xXwpoTnxXu0QozccOiRf3cAZYw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-4 transition-colors shadow-sm"
          >
            <div className="bg-white/20 rounded-full p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg">報平安</div>
              <div className="text-blue-100 text-sm">填寫 Google 表格</div>
            </div>
          </a>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在載入試算表...</p>
          </div>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-500">
              {lastUpdated && (
                <span>最後更新：{lastUpdated.toLocaleTimeString()}</span>
              )}
              {nextRefreshIn > 0 && (
                <span className="text-gray-400">
                  {formatCountdown(nextRefreshIn)} 後自動更新
                </span>
              )}
            </div>

            {/* Tab Navigation */}
            {data.tabs && data.tabs.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <div className="flex gap-1 border-b border-gray-300 min-w-max">
                  {data.tabs.map((tab) => (
                    <button
                      key={tab.gid}
                      onClick={() => handleTabChange(tab.gid)}
                      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                        activeTab === tab.gid
                          ? "bg-white text-blue-600 border-t border-l border-r border-gray-300 -mb-px"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sheet Content - iframe loading from our cached API */}
            {iframeSrc && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <iframe
                  key={iframeKey}
                  src={iframeSrc}
                  className="w-full border-0"
                  style={{ height: "75vh", minHeight: "500px" }}
                  title="試算表檢視"
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
