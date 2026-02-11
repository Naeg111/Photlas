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
        {/* Logo Design - Pin with Camera */}
        <div className="relative mb-8">
          <svg
            width="80"
            height="80"
            viewBox="56 60 400 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto"
          >
            {/* Map Pin Shape */}
            <path
              d="M256 80C180 80 120 140 120 216c0 96 136 228 136 228s136-132 136-228C392 140 332 80 256 80z"
              fill="white"
            />
            {/* Camera Body */}
            <rect x="182" y="190" width="148" height="86" rx="12" fill="black" />
            {/* Camera Top */}
            <rect x="224" y="170" width="56" height="28" rx="6" fill="black" />
            {/* Lens Outer */}
            <circle cx="256" cy="230" r="30" fill="white" />
            {/* Lens Inner */}
            <circle cx="256" cy="230" r="18" fill="black" />
            {/* Flash */}
            <circle cx="316" cy="208" r="6" fill="white" opacity="0.6" />
          </svg>
        </div>
        <h1 className="text-white text-6xl mb-8 tracking-tight">Photlas</h1>
        <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
      </motion.div>
    </motion.div>
  );
}
