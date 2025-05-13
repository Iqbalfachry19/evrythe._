const title = "evr!t — Official";
const description = "Follow evr!t on Instagram for artistic updates in fashion, culture, and storytelling.";

export const SEO = {
  title,
  description,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://evrythe.vercel.app",
    site_name: "evr!t",
    images: [
      {
        url: "https://evrythe.vercel.app", // Make sure this exists
        width: 1200,
        height: 630,
        alt: "evr!t Instagram",
      },
    ],
  },
  twitter: {
    handle: "@evrit",
    site: "@evrit",
    cardType: "summary_large_image",
  },
};
