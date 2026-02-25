"use client";
import { motion } from "framer-motion";
import { HiLightBulb, HiChartBar, HiVideoCamera } from "react-icons/hi";

const services = [
  {
    title: "Menulis & Rilis Novel",
    desc: "Membangun cerita original EVR!T dari ide, worldbuilding, sampai jadi karya siap baca.",
    icon: HiLightBulb,
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
  },
  {
    title: "Storytelling di Instagram",
    desc: "Mengubah potongan narasi jadi konten visual yang emosional lewat caption, carousel, dan reels.",
    icon: HiChartBar,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    title: "Bangun Koneksi Audiens",
    desc: "Berinteraksi dengan followers lewat update karya, teaser buku, dan konten personal @evrythe._",
    icon: HiVideoCamera,
    color: "text-indigo-800",
    bgColor: "bg-indigo-100",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.25,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

export default function WhatWeDoSection() {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={containerVariants}
      className="bg-gradient-to-br from-indigo-50 via-indigo-100/40 to-white px-4 py-20"
    >
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="mb-10 text-4xl font-bold tracking-tight text-indigo-950">
          What I Do on Instagram
        </h2>
        <ul className="grid md:grid-cols-3 gap-10">
          {services.map(({ title, desc, icon: Icon, color, bgColor }, idx) => (
            <motion.li
              key={idx}
              variants={itemVariants}
              whileHover={{
                scale: 1.05,
                boxShadow: "0 10px 28px rgba(79, 70, 229, 0.28)",
              }}
              className="cursor-pointer rounded-3xl border border-indigo-300 bg-white p-8 shadow-[6px_6px_0_0_rgba(30,27,75,0.85)] transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className={`inline-flex items-center justify-center w-14 h-14 mb-6 rounded-full ${bgColor}`}
              >
                <Icon className={`w-7 h-7 ${color}`} />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-indigo-950">{title}</h3>
              <p className="text-indigo-700">{desc}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}
