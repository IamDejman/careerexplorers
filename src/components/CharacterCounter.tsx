'use client';

import { X_CHAR_LIMIT } from '@/lib/utils';

interface CharacterCounterProps {
  count: number;
  needsThread: boolean;
  threadCount: number;
}

export default function CharacterCounter({
  count,
  needsThread,
  threadCount,
}: CharacterCounterProps) {
  const remaining = X_CHAR_LIMIT - count;
  const percentage = Math.min((count / X_CHAR_LIMIT) * 100, 100);

  const getColorClass = () => {
    if (count > X_CHAR_LIMIT) return 'text-blue-500';
    if (remaining <= 20) return 'text-red-500';
    if (remaining <= 50) return 'text-yellow-500';
    return 'text-gray-500';
  };

  const getProgressColor = () => {
    if (count > X_CHAR_LIMIT) return 'bg-blue-500';
    if (remaining <= 20) return 'bg-red-500';
    if (remaining <= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex items-center gap-4">
      {/* Progress bar */}
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Character count */}
      <div className={`text-sm font-medium ${getColorClass()}`}>
        {count > X_CHAR_LIMIT ? (
          <span>
            {count}/{X_CHAR_LIMIT}
          </span>
        ) : (
          <span>{remaining} left</span>
        )}
      </div>

      {/* Thread indicator */}
      {needsThread && (
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          <span>{threadCount} tweets</span>
        </div>
      )}
    </div>
  );
}
