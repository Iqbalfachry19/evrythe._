"use client";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-indigo-950 text-indigo-50">
      <div
        className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center opacity-25"
        aria-hidden="true"
      ></div>
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/78 via-indigo-900/68 to-indigo-950/92"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(165,180,252,0.24),transparent_40%),radial-gradient(circle_at_84%_0%,rgba(129,140,248,0.2),transparent_35%)]"></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 max-w-2xl rounded-[30px] border border-indigo-300/35 bg-indigo-950/50 px-6 py-12 text-center shadow-2xl backdrop-blur-sm"
      >
        <p className="mb-4 text-xs font-semibold tracking-[0.38em] text-indigo-200">
          @evrythe._
        </p>
        <h1 className="text-6xl font-bold uppercase tracking-[0.12em] drop-shadow-lg md:text-7xl">
          evr<span className="text-indigo-300">!</span>t
        </h1>
        <p className="mt-6 text-xl font-light tracking-wide text-indigo-100 md:text-2xl">
          Where <span className="font-semibold text-white">visual diary</span>{" "}
          meets <span className="font-semibold text-white">raw personality</span>.
        </p>
        <p className="mx-auto mt-4 max-w-lg text-sm text-indigo-200">
          Cinematic tones, emotional captions, and expressive style from the author.
        </p>

        <a
          href="https://www.instagram.com/evrythe._/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 inline-block rounded-full border border-indigo-100/80 bg-indigo-100 px-8 py-4 text-lg font-semibold text-indigo-950 shadow-lg transition hover:bg-indigo-200"
        >
          Follow on Instagram
        </a>
      </motion.div>
    </section>
  );
}
