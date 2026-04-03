import { motion } from "motion/react";

/**
 * Issue#85: スプラッシュ画面
 *
 * アイコンのみを画面中央に配置し、ドロップバウンスアニメーションを表示する。
 * - 100px上からフェードインしながら落下
 * - 25px、15pxの2回バウンド
 * - 約2秒で完了後、1.5秒待機してループ
 */

const DROP_BOUNCE_KEYFRAMES = [
  -100, // 開始: 100px上
  0,    // 着地
  -25,  // バウンド1回目（上）
  0,    // 着地
  -15,  // バウンド2回目（上）
  0,    // 着地
];

const OPACITY_KEYFRAMES = [
  0, // 開始: 透明
  1, // 落下完了時: 不透明
  1, 1, 1, 1, // バウンド中は不透明を維持
];

const ANIMATION_DURATION = 2;
const REPEAT_DELAY = 1.5;

export function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed -inset-px bg-black flex items-center justify-center z-50"
    >
      <motion.div
        animate={{
          y: DROP_BOUNCE_KEYFRAMES,
          opacity: OPACITY_KEYFRAMES,
        }}
        transition={{
          duration: ANIMATION_DURATION,
          ease: "easeOut",
          repeat: Infinity,
          repeatDelay: REPEAT_DELAY,
        }}
      >
        <svg
          viewBox="56 60 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '21.0vw', height: '21.0vw' }}
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
      </motion.div>
    </motion.div>
  );
}
