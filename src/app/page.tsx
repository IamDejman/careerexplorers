import JobForm from '@/components/JobForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header - Mobile optimized */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                Career Explorer
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                Post jobs to X and Telegram
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile optimized padding */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <JobForm />
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8 sm:mt-12">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 text-center text-gray-500 text-xs sm:text-sm">
          <p>
            Career Explorer &copy; {new Date().getFullYear()} | Built with Next.js
          </p>
        </div>
      </footer>
    </main>
  );
}
