import { motion, Variants } from "framer-motion";
import { SparklesIcon } from "@heroicons/react/24/solid";

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.3,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { ease: "easeOut", duration: 0.8 } },
};

export default function About() {
  return (
    <section
      className="relative px-10 py-24 max-w-3xl mx-auto rounded-2xl shadow-2xl bg-gradient-to-tr from-pink-200 via-white to-pink-100
        hover:scale-[1.02] transition-transform duration-500 ease-in-out cursor-default overflow-hidden"
    >
      {/* Enhanced shimmer with glow */}
      <motion.div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        animate={{ x: ["-120%", "120%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,182,193,0.25) 50%, transparent 100%)",
          filter: "blur(60px)",
          mixBlendMode: "screen",
          opacity: 0.7,
        }}
      />

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
        className="py-20 px-8 bg-gradient-to-r from-pink-50 via-white to-pink-50 rounded-xl shadow-inner relative"
      >
        <motion.h2
          variants={itemVariants}
          className="text-5xl font-extrabold mb-6 tracking-tight relative inline-block text-pink-700 drop-shadow-lg cursor-pointer select-none"
          whileHover={{
            scale: 1.1,
            color: "#be185d",
            textShadow: "0 0 10px #f472b6",
          }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          Our Mission
          <span className="block h-1.5 w-24 bg-pink-600 rounded mt-3 mx-auto shadow-pink-400 shadow-md"></span>
        </motion.h2>

        <motion.p
          variants={itemVariants}
          className="text-xl max-w-3xl mx-auto text-gray-800 leading-relaxed tracking-wide mt-8"
        >
          At{" "}
          <span className="font-extrabold bg-gradient-to-r from-pink-700 via-pink-500 to-pink-600 bg-clip-text text-transparent">
            evr!t
          </span>
          , we bridge{" "}
          <span className="italic text-pink-600 underline decoration-pink-300 decoration-2 underline-offset-4">
            creativity
          </span>{" "}
          and{" "}
          <span className="italic text-pink-600 underline decoration-pink-300 decoration-2 underline-offset-4">
            technology
          </span>
          . We deliver{" "}
          <span className="font-semibold text-pink-700">
            impactful experiences
          </span>{" "}
          fueled by innovation, sustainability, and community.
        </motion.p>
      </motion.section>

      <motion.h2
        initial="hidden"
        whileInView="visible"
        variants={itemVariants}
        className="flex items-center justify-center gap-3 mt-14 mb-8 text-5xl font-extrabold text-pink-700 tracking-wide select-none cursor-default drop-shadow-md"
      >
        <SparklesIcon className="w-8 h-8 text-pink-500 animate-pulse" />
        About <span className="text-black">evr!t</span>
      </motion.h2>

      <motion.p
        initial="hidden"
        whileInView="visible"
        variants={itemVariants}
        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
        className="text-gray-900 text-lg leading-relaxed indent-10 first-letter:text-7xl first-letter:font-extrabold first-letter:text-pink-600 first-letter:mr-4 first-letter:float-left select-text drop-shadow-sm"
        style={{ whiteSpace: "pre-line" }}
      >
        evr!t is a creative force merging art, culture, and emotion into every
        post.
        {"\n\n"}
        From fashion to visual storytelling,{" "}
        <em className="italic text-pink-600 underline decoration-pink-300 decoration-2 underline-offset-4">
          evr!t invites you into a world where expression knows no limits.
        </em>
      </motion.p>
    </section>
  );
}
