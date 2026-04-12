import React, { useState, useEffect } from 'react';
import { stories as storiesApi } from '@/lib/services/api';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

type Story = {
  id: number;
  type: 'image' | 'component';
  src?: string;
};

// Final "download the app" screen — always appended after API stories
const DOWNLOAD_STORY: Story = { id: -1, type: 'component' };

const STORY_DURATION = 5000; // 5 seconds per story

export function StoriesPage() {
  const [storyList, setStoryList] = useState<Story[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storiesApi.list()
      .then((data) => {
        const imageStories: Story[] = data.map((s) => ({
          id: s.id,
          type: 'image',
          src: `${API_BASE}/uploads/stories/${s.filename}`,
        }));
        setStoryList([...imageStories, DOWNLOAD_STORY]);
      })
      .catch(() => {
        // Fallback to just the download screen if API unavailable
        setStoryList([DOWNLOAD_STORY]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (storyList.length === 0) return;
    if (currentIdx < storyList.length - 1) {
      const timer = setTimeout(() => {
        setCurrentIdx(c => c + 1);
      }, STORY_DURATION);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, storyList.length]);

  const handleNext = () => {
    if (currentIdx < storyList.length - 1) setCurrentIdx(currentIdx + 1);
  };

  const handlePrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const handleTouch = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const screenWidth = window.innerWidth;
    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = (e as React.MouseEvent).clientX;
    }
    if (clientX < screenWidth * 0.33) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentStory = storyList[currentIdx];
  const bgColor = currentStory.type === 'component' ? 'bg-[#FE6601]' : 'bg-black';

  return (
    <div className={`h-[100dvh] w-full flex flex-col ${bgColor} text-white relative transition-colors duration-300 overflow-hidden`}>
      <style>
        {`
          @keyframes story-progress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}
      </style>

      {/* Progress Bars */}
      <div className="absolute top-0 left-0 w-full pt-4 px-2 flex gap-1 z-20">
        {storyList.map((story, idx) => (
          <div key={story.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div
              key={idx === currentIdx ? `animating-${currentIdx}` : `static-${idx}`}
              className="h-full bg-white transition-opacity"
              style={
                idx < currentIdx
                  ? { width: '100%', opacity: 1 }
                  : idx === currentIdx
                    ? { animation: `story-progress ${STORY_DURATION}ms linear forwards`, opacity: 1 }
                    : { width: '0%', opacity: 0 }
              }
            />
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div
        className="flex-1 w-full flex flex-col items-center justify-center relative touch-manipulation cursor-pointer"
        onClick={handleTouch}
      >
        {/* Images */}
        {storyList.map((story, idx) => story.type === 'image' && (
          <img
            key={story.id}
            src={story.src}
            alt={`Story ${story.id}`}
            className={`absolute top-0 left-0 w-full h-full object-contain transition-opacity duration-300 ${idx === currentIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          />
        ))}

        {/* Final Download Component */}
        {currentStory.type === 'component' && (
          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center pt-[15vh] px-8 text-center z-10 bg-[#FE6601]">
            <h1 className="text-4xl font-bold mb-4 drop-shadow-md">Скачайте приложение</h1>
            <p className="text-xl opacity-90 mb-12 drop-shadow-md max-w-sm">Получите доступ ко всем функциям, бонусам и специальным предложениям.</p>

            <div
              className="flex flex-col gap-4 w-full max-w-sm mt-8 z-30 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href="https://apps.apple.com/ru/app/aparu-%D0%BB%D1%83%D1%87%D1%88%D0%B5-%D1%87%D0%B5%D0%BC-%D1%82%D0%B0%D0%BA%D1%81%D0%B8/id997499904"
                target="_blank" rel="noopener noreferrer"
                className="bg-black text-white px-6 py-4 rounded-xl flex items-center justify-center gap-3 font-medium shadow-lg hover:scale-105 transition-transform"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91 1.65.17 3.19.89 4.22 2.44-3.52 2.1-2.96 7.21.6 8.54-.7 1.83-1.54 3.54-2.03 4.68z"/>
                  <path d="M15.11 3.53c-.7.83-1.76 1.34-2.82 1.28-.15-1.12.35-2.26 1-3 .71-.82 1.86-1.35 2.87-1.31.17 1.14-.32 2.18-1.05 3.03z"/>
                </svg>
                Загрузить в App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=kz.aparu.aparupassenger"
                target="_blank" rel="noopener noreferrer"
                className="bg-[#000000] text-white px-6 py-4 rounded-xl flex items-center justify-center gap-3 font-medium shadow-lg hover:scale-105 transition-transform border border-white/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#34A853]">
                  <path d="M4.5 2.5C4.22 2.78 4 3.25 4 3.87v16.26c0 .62.22 1.09.5 1.37l.14.14 9.38-9.39v-.51L4.64 2.36 4.5 2.5zm10.74 8.7L12.5 8.46l-7.3-7.3 12.63 7.2c.42.24.68.65.68 1.11 0 .46-.26.87-.68 1.11zM18.7 13l-3.46-3.46L11 12.5v.51l4.24 4.24L18.7 13zm-8.2-8.2z"/>
                </svg>
                Доступно в Google Play
              </a>
              <a
                href="https://appgallery.huawei.com/#/app/C103097503"
                target="_blank" rel="noopener noreferrer"
                className="bg-[#000000] text-white px-6 py-4 rounded-xl flex items-center justify-center gap-3 font-medium shadow-lg hover:scale-105 transition-transform border border-white/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.11 16.3h-1.63v-3.26h-2.17v3.26H11.6v-3.26H9.43v3.26H7.8V7.7h1.63v3.26h2.17V7.7h1.72v3.26h2.17V7.7h1.62v8.6z"/>
                </svg>
                Откройте в AppGallery
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
