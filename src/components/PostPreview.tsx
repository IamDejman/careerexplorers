'use client';

import Image from 'next/image';
import { JobData, formatTwitterMessage, formatTelegramMessage, splitIntoThread } from '@/lib/utils';

interface PostPreviewProps {
  job: JobData;
}

export default function PostPreview({ job }: PostPreviewProps) {
  const twitterMessage = formatTwitterMessage(job);
  const telegramMessage = formatTelegramMessage(job);
  const twitterThread = splitIntoThread(twitterMessage);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Twitter/X Preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-black px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span className="text-white font-medium text-sm sm:text-base">X Preview</span>
          {twitterThread.length > 1 && (
            <span className="ml-auto text-gray-400 text-xs sm:text-sm">
              Thread ({twitterThread.length} tweets)
            </span>
          )}
        </div>
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 max-h-80 sm:max-h-96 overflow-y-auto">
          {twitterThread.map((tweet, index) => (
            <div
              key={index}
              className={`${
                index > 0 ? 'border-t border-gray-100 pt-3 sm:pt-4' : ''
              }`}
            >
              <div className="flex gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-300 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm sm:text-base">Your Name</span>
                    <span className="text-gray-500 text-xs sm:text-sm">@yourhandle</span>
                  </div>
                  <p className="text-gray-900 whitespace-pre-wrap break-words mt-1 text-sm sm:text-base">
                    {tweet}
                  </p>
                  {index === 0 && job.image && (
                    <Image
                      src={job.image}
                      alt="Preview"
                      width={400}
                      height={192}
                      className="mt-2 sm:mt-3 rounded-xl max-h-40 sm:max-h-48 object-cover w-full"
                      unoptimized
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram Preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-[#2AABEE] px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          <span className="text-white font-medium text-sm sm:text-base">Telegram Preview</span>
        </div>
        <div className="p-3 sm:p-4 bg-[#E5DDD5]">
          <div className="bg-white rounded-lg p-2.5 sm:p-3 shadow-sm max-w-full sm:max-w-sm">
            {job.image && (
              <Image
                src={job.image}
                alt="Preview"
                width={400}
                height={128}
                className="w-full h-28 sm:h-32 object-cover rounded-lg mb-2"
                unoptimized
              />
            )}
            <div
              className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{
                __html: telegramMessage
                  .replace(/<b>/g, '<strong>')
                  .replace(/<\/b>/g, '</strong>')
                  .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '<a href="$1" class="text-blue-600 underline">$2</a>'),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
