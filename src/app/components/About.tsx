"use client";

import { motion } from "framer-motion";

export default function About() {
  return (
    <section className="mx-auto my-16 max-w-4xl rounded-[28px] border border-indigo-900 bg-indigo-50/95 px-8 py-12 shadow-[10px_10px_0_0_rgba(30,27,75,0.9)] sm:px-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6 }}
      >
        <p className="text-xs font-semibold tracking-[0.32em] text-indigo-600">
          AUTHOR NOTE
        </p>
        <h2 className="mt-3 text-4xl font-bold text-indigo-950 sm:text-5xl">
          Story-led aesthetics, not trend-led noise.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-indigo-900">
          EVR!T menggabungkan fashion, mood, dan storytelling visual menjadi feed
          yang terasa personal. Setiap frame dipilih untuk membangun atmosfer:
          hangat, dramatis, dan tetap intimate.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-indigo-800">
          Fokus utamanya adalah ekspresi karakter, komposisi kuat, dan tone warna
          yang memberi kesan cinematic di setiap unggahan.
        </p>
      </motion.div>
    </section>
  );
}
