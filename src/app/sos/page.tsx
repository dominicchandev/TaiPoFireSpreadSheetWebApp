"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface SheetTab {
  name: string;
  id: number;
}

interface SOSItem {
  timestamp: string;
  timestampObj: number;
  location: string;
  status: string;
  details: string;
  source: string;
}

interface SheetData {
  name: string;
  id: number;
  items: SOSItem[];
  cacheAge: number;
}

interface TabsResponse {
  tabs: SheetTab[];
  cacheAge: number;
  error?: string;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function SOSPage() {
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(0);
  
  // Filter state
  const [selectedStatus, setSelectedStatus] = useState<string>("全部");
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch tabs list
  const fetchTabs = useCallback(async () => {
    try {
      const res = await fetch("/api/sos");
      const data: TabsResponse = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to fetch tabs");
      
      setTabs(data.tabs);
      if (data.tabs.length > 0 && activeTabId === null) {
        setActiveTabId(data.tabs[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, [activeTabId]);

  // Fetch active sheet data
  const fetchSheetData = useCallback(async () => {
    if (activeTabId === null) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/sos?id=${activeTabId}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to fetch sheet data");
      
      setSheetData(data);
      
      // Extract unique statuses
      if (data.items) {
        const statuses = Array.from(new Set(data.items.map((i: SOSItem) => i.status))).filter(Boolean) as string[];
        setAvailableStatuses(["全部", ...statuses.sort()]);
        // Reset filter if current selection is no longer available
        if (selectedStatus !== "全部" && !statuses.includes(selectedStatus)) {
          setSelectedStatus("全部");
        }
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sheet data");
    } finally {
      setLoading(false);
    }
  }, [activeTabId]);

  // Initial load
  useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  // Load sheet data when active tab changes
  useEffect(() => {
    if (activeTabId !== null) {
      fetchSheetData();
    }
  }, [activeTabId, fetchSheetData]);

  // Auto-refresh logic
  const scheduleNextRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    setNextRefreshIn(Math.round(REFRESH_INTERVAL / 1000));

    countdownRef.current = setInterval(() => {
      setNextRefreshIn((prev) => Math.max(0, prev - 1));
    }, 1000);

    timerRef.current = setTimeout(() => {
      fetchSheetData();
      scheduleNextRefresh();
    }, REFRESH_INTERVAL);
  }, [fetchSheetData]);

  useEffect(() => {
    if (sheetData) {
      scheduleNextRefresh();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [sheetData, scheduleNextRefresh]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Filter items
  const filteredItems = sheetData?.items.filter(item => {
    const statusMatch = selectedStatus === "全部" || item.status === selectedStatus;
    const searchMatch = !searchQuery || item.location.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  }) || [];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-red-700 to-red-900 text-white pb-12 pt-8 px-4 md:px-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">
                失聯/求救名單
              </h1>
              <p className="text-red-100 text-sm md:text-base opacity-90">
                資料來源：報平安Google Form (Authenticated)
              </p>
            </div>
            <Link 
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-sm text-sm font-medium border border-white/20"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回主頁
            </Link>
          </div>

          {/* Status Bar in Header */}
          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-red-100/80 bg-black/10 inline-flex px-4 py-2 rounded-lg backdrop-blur-sm">
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
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm mb-6 flex items-start">
            <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Controls Container */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 md:p-6 mb-8">
            {/* Tabs */}
            {tabs.length > 0 && (
            <div className="mb-6 overflow-x-auto pb-2 no-scrollbar">
                <div className="flex gap-2 min-w-max">
                {tabs.map((tab) => (
                    <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                        activeTabId === tab.id
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

            {/* Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="relative w-full md:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    </div>
                    <input
                    type="text"
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all sm:text-sm text-gray-900"
                    placeholder="搜尋座數 / 樓層 / 單位..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                    <button
                        onClick={() => setSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    )}
                </div>

                {/* Status Filter */}
                {availableStatuses.length > 0 && (
                    <div className="flex-1 overflow-x-auto no-scrollbar w-full md:w-auto">
                    <div className="flex gap-2 min-w-max md:justify-end">
                        {availableStatuses.map((status) => (
                        <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={`px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap border ${
                            selectedStatus === status
                                ? "bg-red-50 text-red-700 border-red-200 shadow-sm ring-1 ring-red-500/20"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                            {status}
                        </button>
                        ))}
                    </div>
                    </div>
                )}
            </div>
        </div>

        {/* Data List */}
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pb-12">
            {filteredItems.map((item, i) => (
              <div key={i} className="group bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-lg hover:border-red-200 transition-all duration-200 flex flex-col h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.status.includes('危急') || item.status.includes('SOS') 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                        {item.status}
                    </span>
                </div>

                <div className="mb-4 pr-16">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 break-words leading-snug group-hover:text-red-700 transition-colors">
                        {item.location}
                    </h3>
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                        <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {item.timestamp}
                    </div>
                </div>
                
                <div className="flex-grow">
                  {item.details && (
                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-gray-700 border border-slate-100">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">詳細情況</span>
                      <p className="leading-relaxed">{item.details}</p>
                    </div>
                  )}
                </div>

                {item.source && (
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <div className="text-xs text-gray-500 break-words flex-1">
                        {item.source}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">暫無相關記錄</h3>
                <p className="text-gray-500">
                    {searchQuery 
                        ? "找不到符合搜尋條件的記錄，請嘗試其他關鍵字" 
                        : (selectedStatus === "全部" ? "目前沒有收到求救記錄" : "此狀態下暫無記錄")
                    }
                </p>
            </div>
          )
        )}
        
        {filteredItems.length > 0 && (
          <div className="text-center text-sm text-gray-400 pb-8">
            顯示共 {filteredItems.length} 筆記錄
          </div>
        )}
      </div>
    </main>
  );
}
