import React from 'react';

// 1. Simple SVG Bar Chart
interface BarChartProps {
  data: Array<{ label: string; value1: number; value2?: number }>;
  legend1?: string;
  legend2?: string;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  legend1 = 'Barang Masuk',
  legend2 = 'Barang Keluar',
  height = 180,
}) => {
  const max = Math.max(...data.map(d => Math.max(d.value1, d.value2 || 0)), 1);

  return (
    <div className="w-full">
      <div className="flex items-center justify-end gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
          <span>{legend1}</span>
        </div>
        {legend2 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span>{legend2}</span>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 md:gap-4 justify-between h-[180px] pt-4 px-2 border-b border-slate-200 dark:border-slate-800">
        {data.map((item, idx) => {
          const h1 = Math.round((item.value1 / max) * 140);
          const h2 = item.value2 !== undefined ? Math.round((item.value2 / max) * 140) : 0;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[11px] px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-10">
                {legend1}: {item.value1} {item.value2 !== undefined ? `| ${legend2}: ${item.value2}` : ''}
              </div>

              <div className="flex items-end gap-1 w-full justify-center">
                <div
                  style={{ height: `${Math.max(h1, 4)}px` }}
                  className="w-3 sm:w-5 bg-indigo-500 rounded-t transition-all duration-300 hover:bg-indigo-600"
                />
                {item.value2 !== undefined && (
                  <div
                    style={{ height: `${Math.max(h2, 4)}px` }}
                    className="w-3 sm:w-5 bg-amber-500 rounded-t transition-all duration-300 hover:bg-amber-600"
                  />
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[48px] text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. Simple SVG Donut / Category Chart
interface DonutChartProps {
  items: Array<{ label: string; count: number; color: string }>;
}

export const DonutChart: React.FC<DonutChartProps> = ({ items }) => {
  const total = items.reduce((acc, curr) => acc + curr.count, 0) || 1;

  let cumulativeAngle = 0;
  const segments = items.map(item => {
    const fraction = item.count / total;
    const start = cumulativeAngle;
    const end = cumulativeAngle + fraction * 360;
    cumulativeAngle = end;
    return { ...item, fraction, start, end };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      {/* SVG Donut */}
      <div className="relative w-36 h-36 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {segments.map((seg, i) => {
            const strokeDasharray = `${seg.fraction * 251.2} 251.2`;
            const strokeDashoffset = -((seg.start / 360) * 251.2);
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={seg.color}
                strokeWidth="16"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 hover:opacity-80"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{total}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Unit</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 w-full max-w-[220px]">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 dark:text-slate-300 truncate">{item.label}</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100 ml-2">
              {item.count} ({Math.round((item.count / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
