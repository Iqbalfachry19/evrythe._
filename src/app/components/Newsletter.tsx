"use client";
import { motion } from "framer-motion";

export default function Newsletter() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="bg-indigo-950 px-4 py-20 text-center text-white"
    >
      <h2 className="mb-6 text-4xl font-bold">Join My Newsletter</h2>
      <p className="mb-6 text-lg text-indigo-200">
        Stay in the loop with exclusive updates and stories.
      </p>
      <form className="flex flex-col md:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
        <input
          type="email"
          placeholder="Your email address"
          className="w-full rounded-md border border-indigo-800 bg-indigo-900 p-3 text-white placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 md:w-2/3"
        />
        <button className="rounded-md bg-indigo-500 px-6 py-3 font-medium text-white transition hover:bg-indigo-400">
          Subscribe
        </button>
      </form>
    </motion.section>
  );
}
