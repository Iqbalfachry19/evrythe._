"use client";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative text-white h-screen flex items-center justify-center bg-black overflow-hidden">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center opacity-20"
        aria-hidden="true"
      ></div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/90"></div>

      {/* Hero Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 text-center max-w-2xl px-6"
      >
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-widest uppercase drop-shadow-lg">
          evr<span className="text-pink-500">!</span>t
        </h1>
        <p className="mt-6 text-xl md:text-2xl font-light tracking-wide text-gray-300">
          Where <span className="text-white font-semibold">creativity</span>{" "}
          meets <span className="text-white font-semibold">authenticity</span>.
        </p>

        <a
          href="https://www.instagram.com/evrythe._/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 inline-block px-8 py-4 bg-white text-black text-lg rounded-full hover:bg-gray-200 transition shadow-lg"
        >
          Follow on Instagram
        </a>
      </motion.div>
    </section>
  );
}
