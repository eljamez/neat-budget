import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Wallet icon — teal rounded square, white wallet body, teal coin slot
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
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
            width: 20,
            height: 13,
            background: "white",
            borderRadius: 3,
            display: "flex",
            overflow: "hidden",
          }}
        >
          {/* Opening / flap line */}
          <div
            style={{
              position: "absolute",
              top: 5,
              left: 0,
              right: 0,
              height: 2,
              background: "#ccfbf1",
              display: "flex",
            }}
          />
          {/* Coin slot */}
          <div
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              bottom: 2,
              width: 5,
              background: "#0d9488",
              borderRadius: 1,
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
