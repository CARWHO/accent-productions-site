'use client';

interface ProgressStepsProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
  className?: string;
}

export function ProgressSteps({
  currentStep,
  totalSteps,
  labels,
  className = ''
}: ProgressStepsProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-600">
          Step {currentStep} of {totalSteps}
        </span>
        {labels && labels[currentStep - 1] && (
          <span className="text-sm font-medium">{labels[currentStep - 1]}</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-[#000000] h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
