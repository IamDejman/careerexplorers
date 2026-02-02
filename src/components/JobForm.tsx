'use client';

import { useState, useMemo, FormEvent } from 'react';
import { JobData, formatTwitterMessage, getCharacterStatus } from '@/lib/utils';
import CharacterCounter from './CharacterCounter';
import ImageUpload from './ImageUpload';
import PostPreview from './PostPreview';

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

export default function JobForm() {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('Full-time');
  const [description, setDescription] = useState('');
  const [applyLink, setApplyLink] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [image, setImage] = useState<string | undefined>();

  const [isPosting, setIsPosting] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hashtags = useMemo(() => {
    return hashtagInput
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, '').trim())
      .filter(Boolean);
  }, [hashtagInput]);

  const jobData: JobData = useMemo(
    () => ({
      title: title || 'Job Title',
      company: company || 'Company',
      location: location || 'Location',
      jobType: jobType || 'Full-time',
      description: description || 'Job description...',
      applyLink: applyLink || 'https://example.com',
      hashtags,
      image,
    }),
    [title, company, location, jobType, description, applyLink, hashtags, image]
  );

  const twitterMessage = useMemo(() => formatTwitterMessage(jobData), [jobData]);
  const characterStatus = useMemo(
    () => getCharacterStatus(twitterMessage),
    [twitterMessage]
  );

  const handleSubmit = async (
    e: FormEvent,
    platforms: ('twitter' | 'telegram')[]
  ) => {
    e.preventDefault();
    setIsPosting(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: {
            title,
            company,
            location,
            jobType,
            description,
            applyLink,
            hashtags,
            image,
          },
          platforms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.errors?.join(', ') || 'Failed to post');
        return;
      }

      setResult(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Form */}
      <form className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
          Create Job Post
        </h2>

        {/* Form fields - stack on mobile, 2 cols on tablet+ */}
        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4 lg:gap-6">
          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company *
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., TechCorp Inc."
              className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location *
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Remote, New York, NY"
              className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Job Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Type *
            </label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Contract</option>
              <option>Freelance</option>
              <option>Internship</option>
            </select>
          </div>
        </div>

        {/* Description - Full width */}
        <div className="mt-4 sm:mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the role, requirements, and what makes it exciting..."
            rows={4}
            className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            required
          />
          <div className="mt-2">
            <CharacterCounter
              count={characterStatus.count}
              needsThread={characterStatus.needsThread}
              threadCount={characterStatus.threadCount}
            />
          </div>
        </div>

        {/* Apply Link */}
        <div className="mt-4 sm:mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Apply Link *
          </label>
          <input
            type="url"
            value={applyLink}
            onChange={(e) => setApplyLink(e.target.value)}
            placeholder="https://yourcompany.com/careers/job-id"
            className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Hashtags */}
        <div className="mt-4 sm:mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hashtags (Optional)
          </label>
          <input
            type="text"
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            placeholder="hiring, remotejobs, tech"
            className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs sm:text-sm rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image Upload */}
        <div className="mt-4 sm:mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image (Optional)
          </label>
          <ImageUpload onImageChange={setImage} currentImage={image} />
        </div>

        {/* Submit Buttons - Stack on mobile */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, ['twitter', 'telegram'])}
            disabled={isPosting}
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
              disabled={isPosting}
              className="flex-1 sm:flex-none px-6 py-4 sm:py-3 bg-black text-white font-medium rounded-xl sm:rounded-lg hover:bg-gray-800 focus:ring-4 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              Post to X
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, ['telegram'])}
              disabled={isPosting}
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

      {/* Preview */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Preview</h2>
        <PostPreview job={jobData} />
      </div>
    </div>
  );
}
