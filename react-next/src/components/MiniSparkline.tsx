interface MiniSparklineProps {
  data: number[];
  color?: string;
}

const MiniSparkline = ({ data, color = "hsl(199 89% 48%)" }: MiniSparklineProps) => {
  if (!data.length) return null;

  const filtered = data.filter((d) => d > 0);
  const max = Math.max(...filtered);
  const min = Math.min(...filtered);
  const width = 80;
  const height = 24;
  const padding = 2;
  const flatY = height - padding - 1;

  if (filtered.length === 0) {
    const points = data
      .map((_, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * width;
        return `${x},${flatY}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35}
        />
      </svg>
    );
  }

  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = val === 0
        ? height - padding
        : height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
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
