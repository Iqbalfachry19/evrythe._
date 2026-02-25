import { ImageResponse } from "next/og";


export const alt = "evr!t — Official";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e0e7ff",
          backgroundImage:
            "linear-gradient(148deg, rgba(224,231,255,0.96), rgba(199,210,254,0.92)), radial-gradient(circle at 18% 15%, rgba(99,102,241,0.24), transparent 44%), radial-gradient(circle at 82% 8%, rgba(129,140,248,0.2), transparent 38%)",
          fontFamily: "sans-serif",
          padding: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "16px solid #1e1b4b",
            borderRadius: "48px",
            width: "100%",
            height: "100%",
            boxShadow: "20px 20px 0 0 rgba(30,27,75,0.92)",
            backgroundColor: "rgba(255, 255, 255, 0.4)",
          }}
        >
          <h1
            style={{
              fontSize: "140px",
              fontWeight: 900,
              color: "#1e1b4b",
              margin: 0,
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            EVR!T
          </h1>
          <p
            style={{
              fontSize: "40px",
              color: "#3730a3",
              marginTop: "20px",
              fontWeight: 600,
              textAlign: "center",
              maxWidth: "800px",
            }}
          >
            Official site for evr!t. Art, culture, and novel store.
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
