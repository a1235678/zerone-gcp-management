export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// 每種語氣都有不同形狀的符號，色弱或黑白列印時仍可分辨
const glyphs: Record<Tone, JSX.Element> = {
  success: <circle cx="6" cy="6" r="3.5" fill="currentColor" />,
  warning: <path d="M6 2 10.5 10h-9z" fill="currentColor" />,
  danger: <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  info: <path d="M4 2.5 8.5 6 4 9.5z" fill="currentColor" />,
  neutral: <circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />,
};

export function StatusTag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`tag tag--${tone}`}>
      <svg className="tag__glyph" viewBox="0 0 12 12" aria-hidden="true">
        {glyphs[tone]}
      </svg>
      {children}
    </span>
  );
}
