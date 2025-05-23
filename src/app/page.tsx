import About from "./components/About";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import InstagramEmbed from "./components/InstagramEmbed";
import WhatWeDoSection from "./components/WhatWeDo";
import Newsletter from "./components/Newsletter";

export default function Home() {
  return (
    <main
      className="border-[12px] border-black rounded-lg m-4 p-6 text-gray-900"
      style={{
        backgroundColor: "#fff",
        backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
        backgroundSize: "10px 10px",
      }}
    >
      <Hero />

      <About />

      <WhatWeDoSection />

      <InstagramEmbed />

      <Newsletter />

      <Footer />
    </main>
  );
}
