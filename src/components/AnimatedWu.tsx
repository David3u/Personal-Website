"use client";

import { motion, useReducedMotion } from "motion/react";

const LOOP_SECONDS = 5.4;
const LOOP_DELAY_SECONDS = 0.7;

function loop(times: number[]) {
  return {
    duration: LOOP_SECONDS,
    ease: "linear" as const,
    repeat: Infinity,
    repeatDelay: LOOP_DELAY_SECONDS,
    times,
  };
}

export default function AnimatedWu() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <span className="animated-wu animated-wu-static">Wu</span>;
  }

  return (
    <motion.span
      className="animated-wu"
      animate={{
        width: ["1.42em", "1.42em", "1.64em", "1.58em", "1em", "0.98em", "0.98em", "1.42em", "1.42em"],
      }}
      transition={loop([0, 0.2, 0.27, 0.43, 0.46, 0.56, 0.8, 0.9, 1])}
    >
      <motion.span
        className="animated-wu-glyph animated-wu-w"
        animate={{
          opacity: [1, 1, 1, 0, 0, 0, 0, 0.35, 1, 1],
          rotate: [0, 0, 0, 0, 0, 0, -270, -300, -360, -360],
          scaleX: [1, 1, 0.25, 0.08, 0.08, 0.08, 0.55, 0.72, 1.08, 1],
          scaleY: [1, 1, 1.18, 0.9, 0.9, 0.9, 0.72, 0.82, 0.94, 1],
          x: ["0em", "0em", "0.18em", "0.36em", "0.36em", "0.36em", "0em", "0em", "0em", "0em"],
        }}
        transition={loop([0, 0.14, 0.17, 0.2, 0.43, 0.74, 0.8, 0.84, 0.9, 1])}
      >
        W
      </motion.span>

      <motion.span
        className="animated-wu-glyph animated-wu-split-u"
        animate={{
          opacity: [0, 0, 1, 1, 1, 1, 0, 0],
          scaleX: [0.08, 0.08, 1.16, 1.04, 1.04, 1.04, 0.05, 0.05],
          scaleY: [0.78, 0.78, 0.88, 1.04, 1.04, 1.04, 0.82, 0.82],
          x: ["0.38em", "0.38em", "0em", "-0.06em", "-0.06em", "-0.06em", "0.38em", "0.38em"],
        }}
        transition={loop([0, 0.16, 0.2, 0.23, 0.35, 0.43, 0.46, 1])}
      >
        u
      </motion.span>

      <motion.span
        className="animated-wu-glyph animated-wu-split-u"
        animate={{
          opacity: [0, 0, 1, 1, 1, 1, 0, 0],
          scaleX: [0.08, 0.08, 1.16, 1.04, 1.04, 1.04, 0.05, 0.05],
          scaleY: [0.78, 0.78, 0.88, 1.04, 1.04, 1.04, 0.82, 0.82],
          x: ["0.38em", "0.38em", "0.42em", "0.48em", "0.48em", "0.48em", "0.38em", "0.38em"],
        }}
        transition={loop([0, 0.16, 0.2, 0.23, 0.35, 0.43, 0.46, 1])}
      >
        u
      </motion.span>

      <motion.span
        className="animated-wu-glyph animated-wu-main-u"
        animate={{
          x: ["0.84em", "0.84em", "1.12em", "0.94em", "1.08em", "1em", "1em", "1em", "0.44em", "0.52em", "0.56em", "0.56em", "0.84em", "0.84em"],
          y: ["0em", "0em", "0em", "0em", "0em", "0em", "0em", "0.48em", "0.3em", "-0.07em", "0em", "0em", "0em", "0em"],
          scaleX: [1, 1, 0.9, 1.08, 0.96, 1.03, 1, 1.2, 0.92, 1.05, 1, 1, 1, 1],
          scaleY: [1, 1, 1.05, 0.96, 1.02, 0.98, 1, 0.66, 1.08, 0.94, 1, 1, 1, 1],
        }}
        transition={loop([0, 0.2, 0.23, 0.27, 0.31, 0.35, 0.43, 0.46, 0.49, 0.53, 0.56, 0.8, 0.9, 1])}
      >
        u
      </motion.span>

      <motion.span
        className="animated-wu-glyph animated-wu-three"
        animate={{
          opacity: [0, 0, 1, 1, 1, 0, 0],
          rotate: [0, 0, 0, 0, -270, -300, -300],
          scale: [0.9, 0.9, 1.06, 1, 0.9, 0.72, 0.72],
          x: ["-0.62em", "-0.62em", "0em", "0em", "0em", "0em", "0em"],
        }}
        transition={loop([0, 0.5, 0.56, 0.73, 0.8, 0.84, 1])}
      >
        3
      </motion.span>

      <span className="animated-wu-space">Wu</span>
    </motion.span>
  );
}
