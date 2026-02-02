import Image from 'next/image';
import PostTabs from '@/components/PostTabs';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header - Mobile optimized */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.jpeg"
              alt="Career Explorer Logo"
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                Career Explorer
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                Post to X and Telegram
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile optimized padding */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <PostTabs />
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
