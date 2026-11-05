import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * 單一數列的折線面積圖（SVG，不依賴圖表套件）。
 * Y 軸刻度取「好讀」的整數，所有點與刻度用同一個比例尺計算。
 */
export function LineChart({
  data,
  height = 240,
  formatValue,
  formatAxis,
  formatLabel,
  ariaLabel,
}: {
  data: { label: string; value: number }[];
  height?: number;
  formatValue: (v: number) => string;
  formatAxis: (v: number) => string;
  formatLabel: (label: string) => string;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // 依容器實際寬度繪製，文字大小不會跟著縮放
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const { ticks, max } = useMemo(() => niceTicks(Math.max(...data.map((d) => d.value)) * 1.08), [data]);
  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${pad.top + innerH} L${x(0).toFixed(1)},${pad.top + innerH} Z`;
  const labelEvery = Math.ceil(data.length / Math.max(3, Math.floor(innerW / 90)));
  const last = data.length - 1;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.left) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(last, i)));
  };

  const h = hover ?? last;
  return (
    <div className="chart" ref={wrap}>
      <div className="chart__readout" aria-live="polite">
        <span className="chart__readout-label">{formatLabel(data[h].label)}</span>
        <strong className="tnum">{formatValue(data[h].value)}</strong>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={pad.left - 8} y={y(t)} className="chart__axis" textAnchor="end" dominantBaseline="middle">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          (i % labelEvery === 0 && last - i >= labelEvery / 2) || i === last ? (
            <text key={d.label} x={x(i)} y={H - 8} className="chart__axis" textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>
              {formatLabel(d.label)}
            </text>
          ) : null,
        )}
        <path d={area} className="chart__area" />
        <path d={line} className="chart__line" />
        <line x1={x(h)} x2={x(h)} y1={pad.top} y2={pad.top + innerH} className="chart__cursor" />
        <circle cx={x(h)} cy={y(data[h].value)} r={4.5} className="chart__dot" />
      </svg>
    </div>
  );
}

function niceTicks(rawMax: number) {
  const step0 = rawMax / 4;
  const mag = 10 ** Math.floor(Math.log10(step0 || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const max = step * 4;
  return { ticks: [0, step, step * 2, step * 3, max], max };
}
