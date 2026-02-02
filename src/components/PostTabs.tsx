'use client';

import { useState } from 'react';
import QuickPost from './QuickPost';
import JobForm from './JobForm';

type Tab = 'quick' | 'job';

export default function PostTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('quick');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tab Buttons */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveTab('quick')}
          className={`flex-1 px-4 py-3 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition-all ${
            activeTab === 'quick'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Quick Post
        </button>
        <button
          onClick={() => setActiveTab('job')}
          className={`flex-1 px-4 py-3 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition-all ${
            activeTab === 'job'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Job Post
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'quick' ? <QuickPost /> : <JobForm />}
    </div>
  );
}
