"use client";

interface Point {
  date: string;
  equity: number;
}

interface EquityCurveProps {
  data: Point[];
  referenceValue?: number; // e.g. starting capital — renders a dashed baseline
}

export function EquityCurve({ data, referenceValue }: EquityCurveProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-500 text-xs">
        Not enough data to render chart
      </div>
    );
  }

  const W = 800;
  const H = 160;
  const PAD = { top: 12, right: 16, bottom: 24, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const equities = data.map((d) => d.equity);
  // Include referenceValue in domain so baseline is always visible
  const allValues = referenceValue != null ? [...equities, referenceValue] : equities;
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  // Add 8% padding on each side so small changes aren't exaggerated
  const pad = (dataMax - dataMin) * 0.08 || dataMax * 0.01;
  const minE = dataMin - pad;
  const maxE = dataMax + pad;
  const range = maxE - minE || 1;

  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - ((v - minE) / range) * innerH;

  const polyline = data
    .map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.equity).toFixed(1)}`)
    .join(" ");

  // Fill area under the line
  const fillPoints = [
    `${xScale(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)}`,
    ...data.map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.equity).toFixed(1)}`),
    `${xScale(data.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)}`,
  ].join(" ");

  // Y-axis labels (3 ticks based on padded domain)
  const yTicks = [minE + pad, minE + range / 2, maxE - pad];

  // X-axis labels (first, mid, last date)
  const xLabels = [
    { i: 0, label: data[0].date.slice(0, 10) },
    { i: Math.floor(data.length / 2), label: data[Math.floor(data.length / 2)].date.slice(0, 10) },
    { i: data.length - 1, label: data[data.length - 1].date.slice(0, 10) },
  ];

  // Determine if overall trend is up or down
  const isUp = data[data.length - 1].equity >= data[0].equity;
  const lineColor = isUp ? "#34d399" : "#f87171"; // emerald-400 / red-400
  const fillId = isUp ? "fill-up" : "fill-down";
  const fillColor = isUp ? "#34d399" : "#f87171";

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: "320px", height: `${H * 1.2}px` }}
        aria-label="RL equity curve"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={yScale(v)}
            x2={PAD.left + innerW}
            y2={yScale(v)}
            stroke="#3f3f46"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
        ))}

        {/* Fill */}
        <polygon points={fillPoints} fill={`url(#${fillId})`} />

        {/* Reference line (e.g. starting capital) */}
        {referenceValue != null && (
          <line
            x1={PAD.left}
            y1={yScale(referenceValue)}
            x2={PAD.left + innerW}
            y2={yScale(referenceValue)}
            stroke="#71717a"
            strokeWidth="0.8"
            strokeDasharray="6 3"
          />
        )}

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={PAD.left - 6}
            y={yScale(v) + 3}
            textAnchor="end"
            fontSize="9"
            fill="#71717a"
            fontFamily="monospace"
          >
            ${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xScale(i)}
            y={H - 4}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            fontSize="9"
            fill="#71717a"
            fontFamily="monospace"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
