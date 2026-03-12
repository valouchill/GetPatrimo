"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface PatrimoTrustGaugeProps {
  score: number; // 0-100
  isLoading?: boolean;
}

/**
 * Composant PatrimoTrustGauge - Jauge semi-circulaire Luxe-Tech
 * Affiche le score PatrimoTrust™ avec animations fluides et design premium
 */
export default function PatrimoTrustGauge({ score, isLoading = false }: PatrimoTrustGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Dimensions SVG
  const size = 280;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2; // Centre verticalement
  
  // Calcul de l'arc semi-circulaire (180 degrés)
  // Commence à gauche (-180°) et se termine à droite (0°)
  const startAngle = -180; // Commence à gauche
  const endAngle = 0; // Se termine à droite
  const circumference = Math.PI * radius; // Demi-circonférence (180 degrés)
  
  // Hauteur du SVG pour afficher uniquement la partie supérieure (demi-cercle)
  const svgHeight = size / 2 + strokeWidth;

  // Fonction pour obtenir le gradient de couleur selon le score
  const getGradientColor = (scoreValue: number): string => {
    if (scoreValue < 60) {
      return "from-red-500 to-rose-500"; // Gradient Red/Rose
    } else if (scoreValue < 80) {
      return "from-amber-500 to-orange-500"; // Gradient Amber/Orange
    } else {
      return "from-emerald-500 to-emerald-400"; // Gradient Emerald
    }
  };

  // Fonction pour obtenir l'ID du gradient unique
  const getGradientId = (scoreValue: number): string => {
    if (scoreValue < 60) return "gradient-red";
    if (scoreValue < 80) return "gradient-amber";
    return "gradient-emerald";
  };

  // Fonction pour obtenir l'ombre portée (glow) si score >= 80
  const getGlowFilter = (scoreValue: number): string => {
    if (scoreValue >= 80) {
      return "drop-shadow-lg"; // Tailwind drop-shadow-lg avec couleur émeraude
    }
    return "";
  };

  // Animation du compteur
  useEffect(() => {
    if (isLoading) {
      setDisplayScore(0);
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    const duration = 1500; // 1.5 secondes
    const steps = 60; // 60 frames
    const increment = score / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const newScore = Math.min(score, currentStep * increment);
      setDisplayScore(Math.round(newScore));

      if (currentStep >= steps) {
        setDisplayScore(score);
        setIsAnimating(false);
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [score, isLoading]);

  // Calcul du strokeDasharray et strokeDashoffset pour l'animation
  const progress = isLoading ? 0 : displayScore / 100;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (circumference * progress);

  // Fonction pour créer le path de l'arc semi-circulaire
  const createArcPath = (): string => {
    // Arc de 180 degrés : de -180° (gauche) à 0° (droite)
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    // largeArcFlag = 0 car on veut l'arc court (180 degrés)
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  const trackPath = createArcPath();
  const fillPath = createArcPath();

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size / 2 + 60 }}>
      {/* SVG Container */}
      <svg
        width={size}
        height={svgHeight}
        viewBox={`0 ${-size / 2 + strokeWidth} ${size} ${svgHeight}`}
        className="overflow-visible"
      >
        {/* Définitions des gradients */}
        <defs>
          {/* Gradient Red/Rose */}
          <linearGradient id="gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>
          
          {/* Gradient Amber/Orange */}
          <linearGradient id="gradient-amber" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          
          {/* Gradient Emerald */}
          <linearGradient id="gradient-emerald" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
          
          {/* Filtre Glow pour score >= 80 */}
          <filter id="glow-emerald" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Piste de fond (Track) */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgb(51, 65, 85)" // slate-700
          strokeWidth={strokeWidth}
          strokeOpacity={0.15}
          strokeLinecap="round"
          className={isLoading ? "animate-pulse" : ""}
        />

        {/* Barre de progression (Fill) - Animée */}
        {!isLoading && (
          <motion.path
            d={fillPath}
            fill="none"
            stroke={`url(#${getGradientId(score)})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{
              duration: 1.5,
              ease: [0.4, 0, 0.2, 1], // easeOut cubic-bezier
            }}
            style={{
              filter: score >= 80 ? "drop-shadow(0 0 12px rgba(16, 185, 129, 0.5))" : "none",
            }}
          />
        )}
      </svg>

      {/* Compteur Central */}
      <div className="absolute bottom-0 flex flex-col items-center justify-center" style={{ bottom: 40 }}>
        {isLoading ? (
          // État de chargement : pulsation discrète
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-full bg-slate-300"
          />
        ) : (
          <>
            {/* Score en très grand avec police Serif */}
            <motion.div
              key={displayScore}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="text-7xl font-serif font-bold text-navy"
              style={{
                fontFamily: "var(--font-playfair), 'Playfair Display', serif",
                lineHeight: 1,
              }}
            >
              {displayScore}
            </motion.div>
            
            {/* Label en petit (Inter, uppercase) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500"
              style={{
                fontFamily: "var(--font-inter), 'Inter', sans-serif",
                letterSpacing: "0.1em",
              }}
            >
              Score PatrimoTrust™
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
