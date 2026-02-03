'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';

interface ImageUploadProps {
  onImageChange: (image: string | undefined) => void;
  currentImage?: string;
}

export default function ImageUpload({ onImageChange, currentImage }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      // Max 5MB
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onImageChange(base64);
      };
      reader.readAsDataURL(file);
    },
    [onImageChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((item) =>
        item.type.startsWith('image/')
      );
      if (item) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleFile(file);
        }
      }
    },
    [handleFile]
  );

  const handleRemove = useCallback(() => {
    onImageChange(undefined);
  }, [onImageChange]);

  if (currentImage) {
    return (
      <div className="relative">
        <Image
          src={currentImage}
          alt="Upload preview"
          width={400}
          height={192}
          className="w-full h-40 sm:h-48 object-cover rounded-lg"
          unoptimized
        />
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-2 right-2 p-1.5 sm:p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors active:scale-95"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onPaste={handlePaste}
      tabIndex={0}
      role="button"
      aria-label="Upload image: click, drag and drop, or paste"
      className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400 active:border-blue-400'
      }`}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        id="image-upload"
      />
      <label htmlFor="image-upload" className="cursor-pointer">
        <svg
          className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium text-blue-600 hover:text-blue-500">
            Tap to upload
          </span>{' '}
          <span className="hidden sm:inline">or drag and drop, or paste (Ctrl+V)</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
      </label>
    </div>
  );
}
