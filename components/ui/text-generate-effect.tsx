"use client";
import { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
}: {
  words: string;
  className?: string;
}) => {
  const controls = useAnimation();
  const wordsArray = words.split(" ");

  useEffect(() => {
    controls.start((i) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { 
        duration: 0.8, 
        delay: i * 0.15, // Slower stagger for drama
        ease: "easeOut" 
      },
    }));
  }, [controls]);

  return (
    <div className={cn("font-bold", className)}>
      <motion.div className="mt-4">
        <div className="leading-snug tracking-wide">
          {wordsArray.map((word, idx) => {
            return (
              <motion.span
                key={word + idx}
                custom={idx}
                className="opacity-0 inline-block mr-2"
                style={{ filter: "blur(10px)", transform: "translateY(20px)" }} // Initial state via style to prevent flash
                animate={controls}
              >
                {word}
              </motion.span>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
