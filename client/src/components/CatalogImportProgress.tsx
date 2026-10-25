import React from "react";

interface CatalogImportProgressProps {
  status: string;
  message: string;
  progress?: number; // 0-100
}

export function CatalogImportProgress({
  status,
  message,
  progress = 0,
}: CatalogImportProgressProps) {
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isProcessing = !isCompleted && !isFailed;

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      <div className="flex flex-col items-center space-y-6">
        {/* Large Spinning Circle */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          {isCompleted ? (
            <div className="w-32 h-32 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
              <div className="text-6xl text-green-600">✓</div>
            </div>
          ) : isFailed ? (
            <div className="w-32 h-32 rounded-full bg-red-100 flex items-center justify-center">
              <div className="text-6xl text-red-600">✗</div>
            </div>
          ) : (
            <>
              {/* Spinning circle with progress */}
              <svg
                className="w-32 h-32 transform -rotate-90"
                style={{
                  animation: "spin 3s linear infinite",
                }}
                viewBox="0 0 100 100"
              >
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  style={{
                    transition: "stroke-dashoffset 0.5s ease-in-out",
                  }}
                />
              </svg>
              {/* Percentage text in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">{progress}%</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Status and message */}
        <div className="text-center space-y-2">
          <p className="font-semibold text-lg capitalize text-gray-900">
            {status}
          </p>
          <p className="text-sm text-gray-600 max-w-md">{message}</p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(-90deg);
          }
          to {
            transform: rotate(270deg);
          }
        }
      `}</style>
    </div>
  );
}
