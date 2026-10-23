/**
 * Slant — parallelogram photo frame used across the tennis-club layout.
 * dir "right" leans like "/", "left" leans like "\".
 */
const CLIP = {
  right: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)",
  left: "polygon(0 0, 86% 0, 100% 100%, 14% 100%)",
};

export default function Slant({ src, alt = "", dir = "right", className = "" }) {
  return (
    <div className={`overflow-hidden bg-[#00765C] ${className}`} style={{ clipPath: CLIP[dir] }}>
      {src && <img src={src} alt={alt} width={1600} height={894} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
    </div>
  );
}
