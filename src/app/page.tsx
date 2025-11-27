"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

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
    <main className="min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white pb-12 pt-8 px-4 md:px-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">
                宏福苑報平安【齋睇】
              </h1>
              <p className="text-blue-100 text-sm md:text-base opacity-90">
                此頁面只供查閱，無法在此直接報平安
              </p>
            </div>
          </div>

          {/* Status Bar in Header */}
          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-blue-100/80 bg-black/10 inline-flex px-4 py-2 rounded-lg backdrop-blur-sm">
            {lastUpdated && (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                最後更新：{lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {nextRefreshIn > 0 && (
              <span className="opacity-75 border-l border-white/20 pl-4">
                {formatCountdown(nextRefreshIn)} 後自動更新
              </span>
            )}
            {loading && <span className="text-white font-semibold animate-pulse">更新中...</span>}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-8">
        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSc64NpaVIcAkg92fanI5W34xXwpoTnxXu0QozccOiRf3cAZYw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center p-4 bg-white rounded-xl shadow-md border border-blue-100 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
          >
            <div className="bg-blue-50 text-blue-600 rounded-full p-3 mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900 group-hover:text-blue-700">我要報平安/失聯/求救</div>
              <div className="text-gray-500 text-sm">前往 Google 表格填寫資料</div>
            </div>
            <svg className="w-5 h-5 ml-auto text-gray-300 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <Link
            href="/sos"
            className="group flex items-center p-4 bg-white rounded-xl shadow-md border border-red-100 hover:border-red-300 hover:shadow-lg transition-all duration-200"
          >
            <div className="bg-red-50 text-red-600 rounded-full p-3 mr-4 group-hover:bg-red-600 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900 group-hover:text-red-700">失聯/求救名單</div>
              <div className="text-gray-500 text-sm">查看受保護的求助列表</div>
            </div>
            <svg className="w-5 h-5 ml-auto text-gray-300 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm mb-6 flex items-start">
            <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在載入試算表...</p>
          </div>
        )}

        {data && (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 md:p-6 mb-8">
            {/* Tab Navigation */}
            {data.tabs && data.tabs.length > 0 && (
              <div className="mb-6 overflow-x-auto pb-2 no-scrollbar">
                <div className="flex gap-2 min-w-max">
                  {data.tabs.map((tab) => (
                    <button
                      key={tab.gid}
                      onClick={() => handleTabChange(tab.gid)}
                      className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                        activeTab === tab.gid
                          ? "bg-gray-900 text-white shadow-md transform scale-105"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Iframe Container */}
            <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-inner min-h-[600px]">
              {iframeSrc && (
                <iframe
                  key={iframeKey}
                  src={iframeSrc}
                  className="w-full h-[80vh] min-h-[600px]"
                  title="Google Sheet View"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
