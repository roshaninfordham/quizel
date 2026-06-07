import type { BracketConnector } from "./bracketMath";

export function BracketConnectorSvg({ connectors }: { connectors: BracketConnector[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {connectors.map((connector) => {
        const x1 = connector.from.x + connector.from.size / 26;
        const x2 = connector.to.x - connector.to.size / 26;
        const y1 = connector.from.y;
        const y2 = connector.to.y;
        const mid = x1 + (x2 - x1) * 0.56;
        const path = `M ${x1.toFixed(2)} ${y1.toFixed(2)} C ${mid.toFixed(2)} ${y1.toFixed(2)}, ${mid.toFixed(2)} ${y2.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`;
        const stroke =
          connector.status === "won"
            ? "#FBBF24"
            : connector.status === "eliminated"
              ? "rgba(148,163,184,0.28)"
              : "rgba(255,255,255,0.38)";
        return (
          <path
            key={connector.id}
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={connector.status === "won" ? 0.82 : 0.58}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
