"use client";
import { motion } from "framer-motion";
import { HiLightBulb, HiChartBar, HiVideoCamera } from "react-icons/hi";

const services = [
  {
    title: "Creative Direction",
    desc: "From concept to execution, we lead with imagination and vision.",
    icon: HiLightBulb,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
  },
  {
    title: "Digital Marketing",
    desc: "Maximize reach and engagement with strategic campaigns.",
    icon: HiChartBar,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
  },
  {
    title: "Content Production",
    desc: "Visuals, videos, and stories that connect with your audience.",
    icon: HiVideoCamera,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
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
      className="bg-gradient-to-br from-gray-50 to-white py-20 px-4"
    >
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-4xl font-extrabold mb-10 tracking-tight">
          What We Do
        </h2>
        <ul className="grid md:grid-cols-3 gap-10">
          {services.map(({ title, desc, icon: Icon, color, bgColor }, idx) => (
            <motion.li
              key={idx}
              variants={itemVariants}
              whileHover={{
                scale: 1.05,
                boxShadow: "0 8px 24px rgba(219, 39, 119, 0.3)",
              }}
              className={`bg-white p-8 rounded-3xl shadow-md cursor-pointer border-l-8 border-transparent hover:border-pink-400 transition-all duration-300`}
            >
              <div
                className={`inline-flex items-center justify-center w-14 h-14 mb-6 rounded-full ${bgColor}`}
              >
                <Icon className={`w-7 h-7 ${color}`} />
              </div>
              <h3 className="text-xl font-semibold mb-3">{title}</h3>
              <p className="text-gray-600">{desc}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}
