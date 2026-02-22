interface MiniSparklineProps {
  data: number[];
  color?: string;
}

const MiniSparkline = ({ data, color = "hsl(199 89% 48%)" }: MiniSparklineProps) => {
  const filtered = data.filter((d) => d > 0);
  if (filtered.length === 0) return null;

  const max = Math.max(...filtered);
  const min = Math.min(...filtered);
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  const padding = 2;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = val === 0
        ? height - padding
        : height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  );
};

export default MiniSparkline;
