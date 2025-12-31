import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

export function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        {/* Logo Design - Pin with Camera Aperture */}
        <div className="relative mb-8">
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto"
          >
            {/* Map Pin Shape */}
            <path
              d="M40 5C28.402 5 19 14.402 19 26C19 38.5 40 65 40 65C40 65 61 38.5 61 26C61 14.402 51.598 5 40 5Z"
              fill="white"
              stroke="white"
              strokeWidth="2"
            />
            {/* Camera Aperture Circle */}
            <circle cx="40" cy="26" r="10" fill="black" />
            {/* Aperture Blades */}
            <path
              d="M40 18L42.5 23.5L40 26L37.5 23.5L40 18Z"
              fill="white"
            />
            <path
              d="M48 26L42.5 28.5L40 26L42.5 23.5L48 26Z"
              fill="white"
            />
            <path
              d="M40 34L37.5 28.5L40 26L42.5 28.5L40 34Z"
              fill="white"
            />
            <path
              d="M32 26L37.5 23.5L40 26L37.5 28.5L32 26Z"
              fill="white"
            />
          </svg>
        </div>
        <h1 className="text-white text-6xl mb-8 tracking-tight">Photlas</h1>
        <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
      </motion.div>
    </motion.div>
  );
}
