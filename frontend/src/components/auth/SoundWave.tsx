'use client';

interface SoundWaveProps {
  className?: string;
  barCount?: number;
  color?: string;
}

export function SoundWave({ className = '', barCount = 7, color = 'bg-primary-500' }: SoundWaveProps) {
  const heightClass = className.trim().length > 0 ? '' : 'h-8';
  return (
    <div className={`flex items-center justify-center gap-1 ${heightClass} ${className}`.trim()}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={`soundwave-bar w-1 rounded-full ${color}`}
          style={{
            height: '100%',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
