export default function WaveIndicator({ state = "idle" }: { state?: "active" | "idle" | "success" }) {
  const colorMap = {
    active: "var(--color-accent-soft)",
    idle: "var(--color-text-muted)",
    success: "var(--color-success)",
  };
  const fill = colorMap[state];
  const animClass = state === "active" ? "wave-indicator-active" : "";

  return (
    <svg
      width="20"
      height="12"
      viewBox="0 0 48 24"
      fill="none"
      className={animClass}
      aria-hidden="true"
    >
      <rect x="2"  y={state === "idle" ? "10" : "8"}  width="4" height={state === "idle" ? "4" : "8"}  rx="2" fill={fill} />
      <rect x="10" y={state === "idle" ? "10" : "4"}  width="4" height={state === "idle" ? "4" : "16"} rx="2" fill={fill} />
      <rect x="18" y="10" width="4" height="4"  rx="2" fill={fill} />
      <rect x="26" y={state === "idle" ? "10" : "2"}  width="4" height={state === "idle" ? "4" : "20"} rx="2" fill={fill} />
      <rect x="34" y={state === "idle" ? "10" : "6"}  width="4" height={state === "idle" ? "4" : "12"} rx="2" fill={fill} />
      <rect x="42" y={state === "idle" ? "10" : "9"}  width="4" height={state === "idle" ? "4" : "6"}  rx="2" fill={fill} />
    </svg>
  );
}
