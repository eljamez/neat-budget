import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neat Budget",
    short_name: "Neat Budget",
    description: "Take control of your finances with real-time budget tracking",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0d9488",
    icons: [
      {
        // SVG scales perfectly to any size — used for modern Chrome/Firefox/Edge
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        // 180×180 PNG — covers the 192×192 Android slot; iOS uses apple-icon automatically
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
