import About from "./components/About";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import InstagramEmbed from "./components/InstagramEmbed";
import NovelStore from "./components/NovelStore";
import WhatWeDoSection from "./components/WhatWeDo";
import { getNovels } from "@/lib/novels-store";
import { getReviewStatsByBook } from "@/lib/reviews";

export default async function Home() {
  const novels = await getNovels();
  const reviewStats = getReviewStatsByBook();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const productGraph = novels.map((book) => {
    const stats = reviewStats[book.id];
    return {
      "@type": "Product",
      name: book.title,
      description: book.description,
      image: book.coverImage.startsWith("http")
        ? book.coverImage
        : `${appUrl}${book.coverImage}`,
      brand: { "@type": "Brand", name: "EVR!T" },
      sku: book.id,
      offers: {
        "@type": "Offer",
        priceCurrency: "IDR",
        price: String(book.priceIdr),
        availability: "https://schema.org/InStock",
        url: appUrl,
      },
      ...(stats
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: stats.averageRating,
              reviewCount: stats.reviewCount,
            },
          }
        : {}),
    };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": productGraph,
  };

  return (
    <main
      className="m-4 rounded-[24px] border-[10px] border-indigo-950 p-6 text-indigo-950 shadow-[10px_10px_0_0_rgba(30,27,75,0.92)]"
      style={{
        backgroundColor: "#e0e7ff",
        backgroundImage:
          "linear-gradient(148deg, rgba(224,231,255,0.96), rgba(199,210,254,0.92)), radial-gradient(circle at 18% 15%, rgba(99,102,241,0.24), transparent 44%), radial-gradient(circle at 82% 8%, rgba(129,140,248,0.2), transparent 38%)",
      }}
    >
      <Hero />

      <About />

      <WhatWeDoSection />

      <NovelStore />

      <InstagramEmbed />

      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
