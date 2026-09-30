'use client';

'use client';

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TAGS = [
  "CONTROLE DE CARTEIRA",
  "COBRANÇA AUTOMÁTICA",
  "JUROS EM TEMPO REAL",
  "PORTAL DO CLIENTE",
  "CREDMAIS®"
];

export const Preloader = ({ onComplete }: { onComplete: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [tagIndex, setTagIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const finishTimeRef = useRef<number | null>(null);

  // Counter & Tag Switcher
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 1, 100);
        progressRef.current = next;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsVisible(false);
            setTimeout(onComplete, 600);
          }, 400);
          return 100;
        }
        return next;
      });
    }, 20);

    const tagInterval = setInterval(() => {
      setTagIndex((prev) => (prev + 1) % TAGS.length);
    }, 400);

    return () => {
      clearInterval(interval);
      clearInterval(tagInterval);
    };
  }, [onComplete]);

  // Particle Sphere Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    
    // Function to set canvas size based on parent container
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      return { width, height };
    };

    const dims = resizeCanvas() || { width: window.innerWidth, height: window.innerHeight };
    let w = dims.width;
    let h = dims.height;

    interface Particle {
      x: number;
      y: number;
      z: number;
      size: number;
      alpha: number;
      color: string;
      rx?: number;
      rz?: number;
    }

    const particles: Particle[] = [];
    const particleCount = 600;

    // Initialize particles on sphere surface using Fibonacci sphere algorithm
    for (let i = 0; i < particleCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;

        particles.push({
            x: Math.cos(theta) * Math.sin(phi),
            y: Math.sin(theta) * Math.sin(phi),
            z: Math.cos(phi),
            size: Math.random() * 1.5 + 0.3, // Smaller points
            alpha: Math.random() * 0.7 + 0.3,
            color: Math.random() > 0.4 ? '#FFFFFF' : '#444444'
        });
    }

    let rotation = 0;

    const render = () => {
      // Re-get dimensions in case of layout shifts
      const parent = canvas.parentElement;
      if (parent) {
        w = parent.clientWidth;
        h = parent.clientHeight;
      }

      // Clear entire canvas before any transformations
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Re-apply scale for the render
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      
      const currentProgress = progressRef.current / 100;
      let animProgress = currentProgress;

      // If at 100%, continue moving at a steady pace
      if (currentProgress >= 1) {
        if (!finishTimeRef.current) finishTimeRef.current = Date.now();
        const elapsed = (Date.now() - finishTimeRef.current) / 1000;
        animProgress = 1 + elapsed * 0.1; // Grow 10% per second consistently
      }
      
      // Continuous rotation - more consistent speed without drastic slowdown
      const rotationSpeed = 0.006 * (1 + (1 - Math.min(1, animProgress)) * 0.5);
      rotation += Math.max(0.001, rotationSpeed);
      
      const baseRadius = Math.min(w, h) * 0.35;
      
      // Linear progression to avoid the "stuck" feeling of ease-out
      const radius = baseRadius * (0.2 + animProgress * 0.8);

      ctx.save();
      ctx.translate(w / 2, h / 2);

      // Sort particles by rotated Z for depth consistency
      const sortedParticles = particles.map(p => {
        const rx = p.x * Math.cos(rotation) - p.z * Math.sin(rotation);
        const rz = p.x * Math.sin(rotation) + p.z * Math.cos(rotation);
        return { ...p, rx, rz };
      }).sort((a, b) => a.rz - b.rz);

      sortedParticles.forEach((p) => {
        // Perspective projection with rotated coordinates
        const perspective = 1000 / (1000 + p.rz * radius);
        const px = p.rx * radius * perspective;
        const py = p.y * radius * perspective;
        const size = p.size * perspective;
        
        // Opacity mapping (stays at max once reached)
        const alpha = p.alpha * Math.min(1, currentProgress) * perspective;

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fill();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      const size = resizeCanvas();
      if (size) {
        w = size.width;
        h = size.height;
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: 1.05,
            filter: "blur(40px)", // Blur only the whole container on exit as requested in step 3 earlier
            transition: { duration: 0.6, ease: [0.76, 0, 0.24, 1] }
          }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-black p-10 cursor-none"
        >
          {/* Top Counter */}
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex w-full items-center justify-between font-mono text-xs tracking-[0.4em] text-white/40"
          >
            <span>[ SISTEMA_PRONTO ]</span>
            <span className="text-white">{progress.toString().padStart(3, '0')}%</span>
          </motion.div>

          {/* Central Sphere Overlay */}
          <div className="relative flex flex-1 w-full items-center justify-center overflow-hidden">
             <canvas ref={canvasRef} className="z-0 h-full w-full" />
             {/* Removed radial blur container */}
          </div>

          {/* Bottom Tags */}
          <div className="flex w-full flex-col items-center gap-6">
            <motion.div 
              key={tagIndex}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="font-mono text-sm tracking-[0.5em] text-white"
            >
              / {TAGS[tagIndex]}
            </motion.div>
            
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/20">
              Preparando ambiente seguro
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
