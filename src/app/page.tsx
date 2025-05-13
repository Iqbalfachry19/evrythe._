import About from "./components/About";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import InstagramEmbed from "./components/InstagramEmbed";

// app/page.tsx (for App Router)
export default function Home() {
  return (
    <main>
      <Hero />
      <About />
      <InstagramEmbed />
      <Footer />
    </main>
  );
}
