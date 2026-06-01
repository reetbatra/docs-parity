import { ImageResponse } from "next/og";

export const alt = "docsParity";
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
          {/* Parity mark drawn with CSS (no glyph font needed in next/og). */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 9999,
              backgroundImage: "linear-gradient(90deg, #10b981 50%, #064e3b 50%)",
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 700, color: "#a1a1aa" }}>
            docsParity
          </div>
        </div>

        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.1,
            marginTop: 40,
            maxWidth: 950,
          }}
        >
          Your docs drifted from your code.
          <span style={{ color: "#34d399" }}> docsParity finds where.</span>
        </div>

        <div style={{ fontSize: 28, color: "#a1a1aa", marginTop: 28 }}>
          Code vs docs, diffed by Claude — with a drift score and the fix.
        </div>
      </div>
    ),
    { ...size },
  );
}
