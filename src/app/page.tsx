"use client";
import About from "./components/About";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import InstagramEmbed from "./components/InstagramEmbed";
import { motion } from "framer-motion";
import WhatWeDoSection from "./components/WhatWeDo";

export default function Home() {
  return (
    <main className="bg-white text-gray-900">
      <Hero />

      <About />

      {/* Services Section */}
      <WhatWeDoSection />

      <InstagramEmbed />

      {/* Newsletter Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="py-20 px-4 bg-black text-white text-center"
      >
        <h2 className="text-4xl font-bold mb-6">Join Our Newsletter</h2>
        <p className="mb-6 text-lg text-gray-300">
          Stay in the loop with exclusive updates and stories.
        </p>
        <form className="flex flex-col md:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
          <input
            type="email"
            placeholder="Your email address"
            className="p-3 rounded-md w-full md:w-2/3 border border-gray-700 bg-gray-900 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <button className="bg-pink-500 text-white px-6 py-3 rounded-md hover:bg-pink-600 transition font-medium">
            Subscribe
          </button>
        </form>
      </motion.section>

      <Footer />
    </main>
  );
}
