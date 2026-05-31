import { ImageResponse } from "next/og";

export const alt = "Documentation Drift Detector";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Branded share card for report links. The per-report score and repo name are
 * carried in the page's <title>/description (set in generateMetadata), which is
 * what link unfurlers display next to this image.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#09090b",
          backgroundImage:
            "radial-gradient(900px 700px at 80% -20%, rgba(16,185,129,0.20), transparent 60%)",
          color: "#e4e4e7",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#10b981",
              color: "#022c22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            ⤳
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#a1a1aa" }}>
            Documentation Drift Detector
          </div>
        </div>

        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.1,
            marginTop: 40,
            maxWidth: 900,
          }}
        >
          When your docs lie to your developers,
          <span style={{ color: "#34d399" }}> catch it in 30 seconds.</span>
        </div>

        <div style={{ fontSize: 28, color: "#a1a1aa", marginTop: 28 }}>
          Code vs docs, diffed by Claude — with a drift score and the fix.
        </div>
      </div>
    ),
    { ...size },
  );
}
