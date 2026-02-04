'use client';

import { useState, useMemo, FormEvent } from 'react';
import { getCharacterStatus } from '@/lib/utils';
import CharacterCounter from './CharacterCounter';
import ImageUpload from './ImageUpload';

interface PostResult {
  twitter?: {
    success: boolean;
    tweetUrls?: string[];
    error?: string;
  };
  telegram?: {
    success: boolean;
    error?: string;
  };
}

interface PreviewData {
  twitterMessage: string;
  telegramMessage: string;
  trendingHashtags: string[];
}

export default function QuickPost() {
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [isPosting, setIsPosting] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  const characterStatus = useMemo(
    () => getCharacterStatus(message),
    [message]
  );

  const handleSubmit = async (
    e: FormEvent,
    platforms: ('twitter' | 'telegram')[]
  ) => {
    e.preventDefault();

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setIsPosting(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/quick-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          image,
          platforms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.errors?.join(', ') || 'Failed to post');
        return;
      }

      setResult(data.results);

      // Clear form on success
      if (data.results?.twitter?.success || data.results?.telegram?.success) {
        setMessage('');
        setImage(undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePreview = async () => {
    if (!message.trim()) {
      setError('Please enter a message to preview');
      return;
    }
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewOpen(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/quick-post?message=${encodeURIComponent(message.trim())}`
      );
      const data = await response.json();
      if (response.ok && data.preview) {
        setPreviewData(data.preview);
      } else {
        setPreviewData(null);
        setError(data.error || 'Failed to load preview');
      }
    } catch {
      setPreviewData(null);
      setError('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
        Quick Post
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Post a quick message to X and/or Telegram. Perfect for announcements, updates, or any text content.
      </p>

      <form>
        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind? Share an update, announcement, or anything..."
            rows={4}
            className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            required
          />
          <div className="mt-2">
            <CharacterCounter
              count={characterStatus.count}
              needsThread={characterStatus.needsThread}
              threadCount={characterStatus.threadCount}
              charLimit={characterStatus.charLimit}
            />
          </div>
        </div>

        {/* Image Upload */}
        <div className="mt-4 sm:mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image (Optional)
          </label>
          <ImageUpload onImageChange={setImage} currentImage={image} />
        </div>

        {/* Submit Buttons */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || !message.trim()}
            className="flex-1 sm:flex-none px-6 py-4 sm:py-3 bg-gray-100 text-gray-700 font-medium rounded-xl sm:rounded-lg hover:bg-gray-200 focus:ring-4 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-300"
          >
            {previewLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading...
              </span>
            ) : (
              'Preview'
            )}
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, ['twitter', 'telegram'])}
            disabled={isPosting || !message.trim()}
            className="w-full sm:flex-1 px-6 py-4 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl sm:rounded-lg hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {isPosting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Posting...
              </span>
            ) : (
              'Post to Both'
            )}
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={(e) => handleSubmit(e, ['twitter'])}
              disabled={isPosting || !message.trim()}
              className="flex-1 sm:flex-none px-6 py-4 sm:py-3 bg-black text-white font-medium rounded-xl sm:rounded-lg hover:bg-gray-800 focus:ring-4 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              Post to X
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, ['telegram'])}
              disabled={isPosting || !message.trim()}
              className="flex-1 sm:flex-none px-6 py-4 sm:py-3 bg-[#2AABEE] text-white font-medium rounded-xl sm:rounded-lg hover:bg-[#229ED9] focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              Telegram
            </button>
          </div>
        </div>

        {/* Result/Error Messages */}
        {error && (
          <div className="mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-2">
            {result.twitter && (
              <div
                className={`p-3 sm:p-4 rounded-lg text-sm ${
                  result.twitter.success
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                <strong>X/Twitter:</strong>{' '}
                {result.twitter.success ? (
                  <>
                    Posted successfully!{' '}
                    {result.twitter.tweetUrls?.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline ml-1"
                      >
                        View Tweet {(result.twitter?.tweetUrls?.length ?? 0) > 1 ? i + 1 : ''}
                      </a>
                    ))}
                  </>
                ) : (
                  result.twitter.error
                )}
              </div>
            )}
            {result.telegram && (
              <div
                className={`p-3 sm:p-4 rounded-lg text-sm ${
                  result.telegram.success
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                <strong>Telegram:</strong>{' '}
                {result.telegram.success
                  ? 'Posted successfully!'
                  : result.telegram.error}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Post Preview</h2>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="Close"
              >
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="animate-spin text-2xl">&#8635;</span>
                  <span className="ml-2 text-gray-600">Loading preview...</span>
                </div>
              ) : previewData ? (
                <>
                  {previewData.trendingHashtags.length > 0 && (
                    <div className="text-sm text-gray-500">
                      <span className="font-medium text-gray-700">Trending hashtags:</span>{' '}
                      {previewData.trendingHashtags.map((t) => `#${t}`).join(' ')}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="bg-black px-4 py-2.5">
                        <span className="text-white font-medium text-sm">X Preview</span>
                      </div>
                      <div className="p-4 bg-white">
                        <p className="text-gray-900 whitespace-pre-wrap break-words text-sm">
                          {previewData.twitterMessage}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="bg-[#2AABEE] px-4 py-2.5">
                        <span className="text-white font-medium text-sm">Telegram Preview</span>
                      </div>
                      <div className="p-4 bg-[#E5DDD5]">
                        <p className="text-gray-900 whitespace-pre-wrap break-words text-sm">
                          {previewData.telegramMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : error ? (
                <p className="text-center py-8 text-red-600">{error}</p>
              ) : (
                <p className="text-center py-8 text-gray-500">No preview available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
