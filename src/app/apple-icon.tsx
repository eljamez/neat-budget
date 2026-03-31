import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — full bleed (no border-radius, iOS applies its own)
// Scaled from the 32×32 design: 180/32 ≈ 5.625×
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "linear-gradient(145deg, #0f766e, #0d9488)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Wallet body */}
        <div
          style={{
            position: "relative",
            width: 113,
            height: 74,
            background: "white",
            borderRadius: 17,
            display: "flex",
            overflow: "hidden",
          }}
        >
          {/* Opening / flap line */}
          <div
            style={{
              position: "absolute",
              top: 29,
              left: 0,
              right: 0,
              height: 11,
              background: "#ccfbf1",
              display: "flex",
            }}
          />
          {/* Coin slot */}
          <div
            style={{
              position: "absolute",
              top: 11,
              right: 11,
              bottom: 11,
              width: 29,
              background: "#0d9488",
              borderRadius: 9,
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
