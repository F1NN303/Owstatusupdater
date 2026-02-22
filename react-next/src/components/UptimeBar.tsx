interface UptimeBarProps {
  data: number[]; // array of 1 (up), 0.5 (degraded), 0 (down)
}

const UptimeBar = ({ data }: UptimeBarProps) => {
  return (
    <div className="flex items-center gap-[2px]">
      {data.map((val, i) => (
        <div
          key={i}
          className={`h-6 flex-1 rounded-[2px] transition-colors ${
            val === 1
              ? "bg-status-online/60"
              : val === 0.5
              ? "bg-status-degraded/70"
              : "bg-status-offline/70"
          }`}
        />
      ))}
    </div>
  );
};

export default UptimeBar;
