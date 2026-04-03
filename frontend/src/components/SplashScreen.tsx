import { useState, useEffect } from "react";
import { motion } from "motion/react";

/**
 * Issue#85: スプラッシュ画面
 *
 * アイコンのみを画面中央に配置し、ドロップバウンスアニメーションを表示する。
 * アニメーションはCSSで定義（コンポジタースレッド実行でスムーズ描画）。
 * box-shadowでビューポート境界の隙間を防止。
 *
 * アニメーションクラスは初回レンダリング後に遅延適用する。
 * iOS PWAの2回目以降の起動時にブラウザがキャッシュからCSSアニメーション状態を
 * 復元するとinline opacity:0がオーバーライドされるため、初回レンダリング時は
 * クラスを付与せずinline styleのみでアイコンを非表示に保つ。
 */
export function SplashScreen() {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(true), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      data-testid="splash-screen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0, left: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black',
        zIndex: 50,
        boxShadow: '0 0 0 50px black',
      }}
    >
      <div
        className={isAnimating ? "animate-drop-bounce" : ""}
        style={{ opacity: 0, transform: 'translateY(-100px)' }}
      >
        <svg
          viewBox="56 60 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '21.0vmin', height: '21.0vmin' }}
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
    </motion.div>
  );
}
