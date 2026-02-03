'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface QueueStats {
  pendingToday: number;
  postedToday: number;
  totalPosted: number;
}

interface PendingJob {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: string;
  applyUrl: string;
  scrapedAt: string;
}

interface HistoryEntry {
  id: string;
  postedAt: string;
  title: string;
  company: string;
}

interface PreviewItem {
  jobId: string;
  title: string;
  twitterMessage: string;
  telegramMessage: string;
}

interface QueueData {
  success: boolean;
  stats: QueueStats;
  pendingJobs: PendingJob[];
  pendingTotal: number;
  recentHistory: HistoryEntry[];
  historyTotal: number;
  error?: string;
}

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewItem[] | null>(null);

  const fetchData = useCallback(async (overrides?: { pendingPage?: number; historyPage?: number }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        pendingPage: String(overrides?.pendingPage ?? pendingPage),
        pendingLimit: String(PAGE_SIZE),
        historyPage: String(overrides?.historyPage ?? historyPage),
        historyLimit: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/queue?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch queue data');
      }

      setData(result);
      setError(null);
      if (overrides?.pendingPage !== undefined) setPendingPage(overrides.pendingPage);
      if (overrides?.historyPage !== undefined) setHistoryPage(overrides.historyPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [pendingPage, historyPage]);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleScrape = async () => {
    setActionLoading('scrape');
    setActionResult(null);
    try {
      const response = await fetch('/api/scrape');
      const result = await response.json();

      if (result.success) {
        setActionResult({
          type: 'success',
          message: result.message,
        });
        fetchData();
      } else {
        throw new Error(result.error || 'Scrape failed');
      }
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePost = async () => {
    setActionLoading('post');
    setActionResult(null);
    try {
      const response = await fetch('/api/auto-post');
      const result = await response.json();

      if (result.success) {
        setActionResult({
          type: 'success',
          message: result.message,
        });
        fetchData();
      } else {
        throw new Error(result.error || 'Post failed');
      }
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewOpen(true);
    try {
      const response = await fetch('/api/auto-post?dryRun=true');
      const result = await response.json();

      if (result.success && result.dryRun) {
        setPreviewData(result.preview || []);
      } else {
        setPreviewData([]);
      }
    } catch {
      setPreviewData([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClearPending = async () => {
    const count = data?.stats.pendingToday || 0;
    if (count === 0) return;
    if (!confirm(`Clear all ${count} pending job(s)? This cannot be undone.`)) return;

    setActionLoading('clear');
    setActionResult(null);
    try {
      const response = await fetch('/api/queue/clear', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        setActionResult({
          type: 'success',
          message: result.message,
        });
        fetchData({ pendingPage: 1 });
      } else {
        throw new Error(result.error || 'Clear failed');
      }
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400">Error: {error}</p>
            <button
              onClick={() => fetchData()}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Job Queue Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              MyJobMag Scraper & Auto-Poster
            </p>
          </div>
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Manual Posting
          </Link>
        </div>

        {/* Action Result */}
        {actionResult && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              actionResult.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}
          >
            <p
              className={
                actionResult.type === 'success'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-700 dark:text-red-400'
              }
            >
              {actionResult.message}
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending Today</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {data?.stats.pendingToday || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Posted Today</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {data?.stats.postedToday || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Posted (All Time)</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {data?.stats.totalPosted || 0}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-8">
          <button
            onClick={handleScrape}
            disabled={actionLoading !== null}
            className="px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {actionLoading === 'scrape' ? (
              <>
                <span className="animate-spin">&#8635;</span>
                Scraping...
              </>
            ) : (
              <>Scrape Now</>
            )}
          </button>
          <button
            onClick={handlePost}
            disabled={actionLoading !== null || (data?.stats.pendingToday || 0) === 0}
            className="px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {actionLoading === 'post' ? (
              <>
                <span className="animate-spin">&#8635;</span>
                Posting...
              </>
            ) : (
              <>Post Now (2 Jobs)</>
            )}
          </button>
          <button
            onClick={handlePreview}
            disabled={actionLoading !== null || previewLoading || (data?.stats.pendingToday || 0) === 0}
            className="px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {previewLoading ? (
              <>
                <span className="animate-spin">&#8635;</span>
                Previewing...
              </>
            ) : (
              <>Preview</>
            )}
          </button>
          <button
            onClick={handleClearPending}
            disabled={actionLoading !== null || (data?.stats.pendingToday || 0) === 0}
            className="px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {actionLoading === 'clear' ? (
              <>
                <span className="animate-spin">&#8635;</span>
                Clearing...
              </>
            ) : (
              <>Clear Pending</>
            )}
          </button>
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {/* Pending Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pending Jobs ({data?.pendingTotal ?? 0})
            </h2>
            {data && data.pendingTotal > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  Page {pendingPage} of {Math.ceil(data.pendingTotal / PAGE_SIZE) || 1}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    disabled={pendingPage <= 1}
                    className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPendingPage((p) => p + 1)}
                    disabled={pendingPage >= Math.ceil(data.pendingTotal / PAGE_SIZE)}
                    className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            {data?.pendingJobs.length === 0 ? (
              <p className="p-4 text-gray-500 dark:text-gray-400">
                No pending jobs. Click &quot;Scrape Now&quot; to fetch new jobs.
              </p>
            ) : (
              <>
                {/* Mobile: card layout */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {data?.pendingJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {job.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {job.company}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                        <span>{job.location}</span>
                        <span>{job.jobType}</span>
                        <span>{formatTime(job.scrapedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <table className="hidden md:table w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Job
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Scraped
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data?.pendingJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {job.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {job.company}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {job.location}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {job.jobType}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatTime(job.scrapedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Recent History */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Posted Today ({data?.historyTotal ?? 0})
            </h2>
            {data && data.historyTotal > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  Page {historyPage} of {Math.ceil(data.historyTotal / PAGE_SIZE) || 1}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                    className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setHistoryPage((p) => p + 1)}
                    disabled={historyPage >= Math.ceil(data.historyTotal / PAGE_SIZE)}
                    className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            {data?.recentHistory.length === 0 ? (
              <p className="p-4 text-gray-500 dark:text-gray-400">
                No jobs posted today yet.
              </p>
            ) : (
              <>
                {/* Mobile: card layout */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {data?.recentHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {entry.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {entry.company}
                      </p>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {formatTime(entry.postedAt)}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <table className="hidden md:table w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Job
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Posted At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data?.recentHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {entry.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {entry.company}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatTime(entry.postedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Scrapes every 40 min, posts every 10 min via Upstash QStash</p>
          <p className="mt-1">Last refreshed: {new Date().toLocaleTimeString()}</p>
        </div>

        {/* Preview Modal */}
        {previewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Post Preview
                </h2>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  aria-label="Close"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="animate-spin text-2xl">&#8635;</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Previewing...</span>
                  </div>
                ) : previewData && previewData.length > 0 ? (
                  previewData.map((item) => (
                    <div
                      key={item.jobId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                        <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                          <div className="bg-black px-4 py-2.5 flex items-center gap-2">
                            <span className="text-white font-medium text-sm">X Preview</span>
                          </div>
                          <div className="p-4 max-h-64 overflow-y-auto">
                            <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words text-sm">
                              {item.twitterMessage}
                            </p>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                          <div className="bg-[#2AABEE] px-4 py-2.5 flex items-center gap-2">
                            <span className="text-white font-medium text-sm">Telegram Preview</span>
                          </div>
                          <div className="p-4 bg-[#E5DDD5] dark:bg-gray-700">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                              <div
                                className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words"
                                dangerouslySetInnerHTML={{
                                  __html: item.telegramMessage
                                    .replace(/<b>/g, '<strong>')
                                    .replace(/<\/b>/g, '</strong>')
                                    .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '<a href="$1" class="text-blue-600 dark:text-blue-400 underline">$2</a>'),
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No jobs to preview. Scrape first or jobs may be excluded.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
