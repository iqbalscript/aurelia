"use client";

import { useState } from "react";
import Image from "next/image";

export function Logo({ size = 32 }: { size?: number }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#948979]/40 bg-[#393E46] shadow-md transition-all hover:border-[#DFD0B8]/60"
      style={{ width: size, height: size }}
    >
      {!imageError ? (
        <Image
          src="/logo-aurelia.png"
          alt="AURELIA"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <AureliaMark size={size} />
      )}
    </div>
  );
}

export function AureliaMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full p-1.5"
    >
      {/* Background Subtle Gradient */}
      <circle cx="20" cy="20" r="18" fill="url(#bg-grad)" opacity="0.4" />

      {/* Outer Geometric Orbit Ring */}
      <circle
        cx="20"
        cy="20"
        r="15"
        stroke="#948979"
        strokeWidth="1.2"
        strokeDasharray="4 2"
        opacity="0.8"
      />

      {/* Inner Glowing Core Mark - Stylized A / Diamond Node */}
      <path
        d="M20 7L28 29H24.5L22.5 24H17.5L15.5 29H12L20 7Z"
        fill="#DFD0B8"
      />
      <path
        d="M18.8 19H21.2L20 15.5L18.8 19Z"
        fill="#222831"
      />

      {/* Dynamic Satellite Nodes */}
      <circle cx="20" cy="5" r="1.5" fill="#DFD0B8" />
      <circle cx="35" cy="20" r="1.5" fill="#948979" />
      <circle cx="5" cy="20" r="1.5" fill="#948979" />

      <defs>
        <radialGradient
          id="bg-grad"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(20 20) rotate(90) scale(18)"
        >
          <stop stopColor="#DFD0B8" stopOpacity="0.3" />
          <stop offset="1" stopColor="#393E46" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
