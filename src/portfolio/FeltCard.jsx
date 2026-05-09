import { motion } from "motion/react";

export function FeltCard({
  children,
  className = "",
  color = "white",
  rotate = 0,
  delay = 0,
  id,
}) {
  const bgColors = {
    green: "bg-[#2d4a3e] text-white",
    orange: "bg-[#d15a24] text-white",
    cream: "bg-[#f4f1ea] text-[#1a1a1a]",
    white: "bg-white text-[#1a1a1a]",
  };

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20, rotate: rotate - 2 }}
      whileInView={{ opacity: 1, y: 0, rotate }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={`
        relative p-6 felt-shadow felt-stitch rounded-sm
        ${bgColors[color]}
        ${className}
      `}
    >
      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-current opacity-30" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-current opacity-30" />

      {children}
    </motion.div>
  );
}
