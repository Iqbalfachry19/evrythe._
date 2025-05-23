"use client";
import { motion, Variants } from "framer-motion";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-orbitron",
});

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.3,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ease: "easeOut", duration: 0.5 },
  },
};

export default function About() {
  return (
    <section
      className={`
        ${orbitron.className}
        max-w-3xl mx-auto px-8 py-16 sm:px-16 my-16 
        bg-white border-[10px] border-black rounded-lg shadow-lg
      `}
    >
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.7 }}
        variants={containerVariants}
      >
        <motion.h2
          variants={itemVariants}
          className="text-3xl sm:text-5xl font-extrabold text-black mb-8 border-b-[6px] border-black pb-3 select-none"
          style={{
            letterSpacing: "0.15em",
            textShadow:
              "2px 2px 0 #fff, -2px 2px 0 #fff, 2px -2px 0 #fff, -2px -2px 0 #fff, 0 0 6px black",
          }}
        >
          MY MISSION
        </motion.h2>

        <motion.p
          variants={itemVariants}
          className="text-black text-xl leading-relaxed mb-16 relative font-black"
          style={{
            lineHeight: 1.6,
            textShadow: "1px 1px 0 white",
          }}
        >
          At{" "}
          <strong
            style={{
              color: "#E11D48",
              textShadow: "1px 1px 0 black",
              WebkitTextStroke: "0.7px black",
            }}
          >
            evr!t
          </strong>
          , we bridge{" "}
          <em
            style={{
              color: "#E11D48",
              textShadow: "1px 1px 0 black",
              WebkitTextStroke: "0.5px black",
            }}
          >
            creativity
          </em>{" "}
          and{" "}
          <em
            style={{
              color: "#E11D48",
              textShadow: "1px 1px 0 black",
              WebkitTextStroke: "0.5px black",
            }}
          >
            technology
          </em>
          , delivering{" "}
          <strong
            style={{
              color: "#B91C1C",
              textShadow: "1px 1px 0 black",
              WebkitTextStroke: "0.7px black",
            }}
          >
            impactful experiences
          </strong>{" "}
          fueled by innovation, sustainability, and community.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="text-center max-w-2xl mx-auto mt-15 sm:mt-32"
        >
          <h3
            className="inline-flex items-center gap-3 text-4xl font-extrabold text-black tracking-widest select-none"
            style={{
              textShadow:
                "2px 2px 0 white, -2px 2px 0 white, 2px -2px 0 white, -2px -2px 0 white",
              WebkitTextStroke: "1.3px black",
            }}
          >
            <SparklesIcon className="w-9 h-9 stroke-2 stroke-black" />
            ABOUT EVR!T
          </h3>

          <p
            className="mt-8 text-black text-lg leading-relaxed font-extrabold"
            style={{
              textShadow: "1px 1px 0 white",
            }}
          >
            EVR!T is a creative force merging art, culture, and emotion into
            every post.
            <br />
            From fashion to visual storytelling,{" "}
            <em
              style={{
                textDecoration: "underline",
                color: "#E11D48",
                WebkitTextStroke: "0.5px black",
                textShadow: "1px 1px 0 black",
              }}
            >
              EVR!T invites you into a world where expression knows no limits.
            </em>
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
