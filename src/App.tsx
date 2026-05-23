/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, cubicBezier } from 'motion/react';
import Hls from 'hls.js';
import { Sparkles } from 'lucide-react';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scalerOriginRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Responsive dimensions state
  const [dims, setDims] = useState(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : 1920,
    vh: typeof window !== 'undefined' ? window.innerHeight : 1080,
    cellW: 250,
    cellH: 300,
  }));

  // Mouse hover unblur tracking
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, isHovering: false });

  // Track prefers reduced motion
  const [prefersReduced, setPrefersReduced] = useState(false);

  // Track hover pointer support, ensuring mouse mask effects don't get stuck on mobile touch
  const [supportsHover, setSupportsHover] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = header.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y, isHovering: true });
    };

    const handleMouseEnter = () => {
      setMousePos((prev) => ({ ...prev, isHovering: true }));
    };

    const handleMouseLeave = () => {
      setMousePos((prev) => ({ ...prev, isHovering: false }));
    };

    header.addEventListener('mousemove', handleMouseMove);
    header.addEventListener('mouseenter', handleMouseEnter);
    header.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      header.removeEventListener('mousemove', handleMouseMove);
      header.removeEventListener('mouseenter', handleMouseEnter);
      header.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    // Check reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', listener);

    // Check pointer hover capabilities
    const hoverQuery = window.matchMedia('(hover: hover)');
    setSupportsHover(hoverQuery.matches);
    const hoverListener = (e: MediaQueryListEvent) => setSupportsHover(e.matches);
    hoverQuery.addEventListener('change', hoverListener);

    // Initial and resize updates
    const updateDimensions = () => {
      setDims({
        vw: window.innerWidth,
        vh: window.innerHeight,
        cellW: scalerOriginRef.current ? (scalerOriginRef.current.offsetWidth || 250) : 250,
        cellH: scalerOriginRef.current ? (scalerOriginRef.current.offsetHeight || 300) : 300,
      });
    };

    updateDimensions();

    // Use ResizeObserver for complete container-bound stability
    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    if (scalerOriginRef.current) {
      observer.observe(scalerOriginRef.current);
    }

    window.addEventListener('resize', updateDimensions);

    return () => {
      mediaQuery.removeEventListener('change', listener);
      hoverQuery.removeEventListener('change', hoverListener);
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const streamUrl = 'https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8';

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => console.log('HLS background autoplay blocked or failed:', err));
      });
      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.play().catch((err) => console.log('Native HLS autoplay blocked or failed:', err));
    }
  }, []);



  // Frame scroll tracking
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Easing curves matching Jhey's GSAP power values
  const easeWidth = cubicBezier(0.65, 0, 0.35, 1); // power2.inOut
  const easeHeight = cubicBezier(0.42, 0, 0.58, 1); // power1.inOut
  const easeLayerScale1 = cubicBezier(0.42, 0, 0.58, 1); // Layer 1: power1.inOut
  const easeLayerScale2 = cubicBezier(0.76, 0, 0.24, 1); // Layer 2: power3.inOut
  const easeLayerScale3 = cubicBezier(0.87, 0, 0.13, 1); // Layer 3: power4.inOut
  const easeOpacity = cubicBezier(0.61, 1, 0.88, 1); // sine.out

  // 1. Central Image width & height interpolation
  // Shrinks from viewport-wide dimensions down to original grid cell dimensions
  const imageWidth = useTransform(scrollYProgress, (progress) => {
    const targetW = dims.cellW;
    if (progress <= 0) return `${dims.vw}px`;
    if (progress >= 0.8) return `${targetW}px`;
    const t = progress / 0.8;
    const eased = easeWidth(t);
    return `${dims.vw + (targetW - dims.vw) * eased}px`;
  });

  const imageHeight = useTransform(scrollYProgress, (progress) => {
    const targetH = dims.cellH;
    if (progress <= 0) return `${dims.vh}px`;
    if (progress >= 0.8) return `${targetH}px`;
    const t = progress / 0.8;
    const eased = easeHeight(t);
    return `${dims.vh + (targetH - dims.vh) * eased}px`;
  });

  const imageBorderRadius = useTransform(scrollYProgress, [0, 0.8], ['0px', '16px']);

  // 2. Layer Animations (Scale and Opacity) with staggered endpoints
  // Layer 1 (Outer edge) scales from 0 -> 1 on scroll, ends at progress 1.0
  const scaleLayer1 = useTransform(scrollYProgress, [0, 0.3, 1], [0, 0, 1], {
    ease: [(v) => v, easeLayerScale1],
  });
  const opacityLayer1 = useTransform(scrollYProgress, [0, 0.55, 1], [0, 0, 1], {
    ease: [(v) => v, easeOpacity],
  });

  // Layer 2 (Inner columns) ends at progress 0.95
  const scaleLayer2 = useTransform(scrollYProgress, [0, 0.3, 0.95, 1], [0, 0, 1, 1], {
    ease: [(v) => v, easeLayerScale2, (v) => v],
  });
  const opacityLayer2 = useTransform(scrollYProgress, [0, 0.55, 0.95, 1], [0, 0, 1, 1], {
    ease: [(v) => v, easeOpacity, (v) => v],
  });

  // Layer 3 (Center column top and bottom) ends at progress 0.90
  const scaleLayer3 = useTransform(scrollYProgress, [0, 0.3, 0.9, 1], [0, 0, 1, 1], {
    ease: [(v) => v, easeLayerScale3, (v) => v],
  });
  const opacityLayer3 = useTransform(scrollYProgress, [0, 0.55, 0.9, 1], [0, 0, 1, 1], {
    ease: [(v) => v, easeOpacity, (v) => v],
  });

  const blurAmount = dims.vw < 768 ? '10px' : '20px';
  const maskStyle = (mousePos.isHovering && supportsHover)
    ? {
        backdropFilter: `blur(${blurAmount})`,
        WebkitBackdropFilter: `blur(${blurAmount})`,
        maskImage: `radial-gradient(circle 220px at ${mousePos.x}px ${mousePos.y}px, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 80%)`,
        WebkitMaskImage: `radial-gradient(circle 220px at ${mousePos.x}px ${mousePos.y}px, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 80%)`,
      }
    : {
        backdropFilter: `blur(${blurAmount})`,
        WebkitBackdropFilter: `blur(${blurAmount})`,
      };

  return (
    <div className="content-wrap selection:bg-zinc-800 selection:text-white">
      {/* Intro Header Section */}
      <header ref={headerRef} className="relative overflow-hidden bg-black">
        {/* High performance dynamic HLS background loop */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-60 mix-blend-screen pointer-events-none"
          muted
          autoPlay
          loop
          playsInline
        />
        {/* Dynamic backdrop blur masking layer that clears up around the cursor on hover */}
        <div 
          style={maskStyle}
          className="absolute inset-0 pointer-events-none transition-[backdrop-filter,WebkitBackdropFilter] duration-300"
        />
        {/* Depth gradients for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-black/20 to-black/70" />
        
        {/* Subtle background dynamic elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />
        
        {/* Top Minimalist Navigation / Portfolio Identity Header */}
        <div className="absolute top-0 inset-x-0 w-full z-[20] px-4 py-5 sm:px-6 sm:py-6 md:px-12 flex justify-between items-start pointer-events-auto select-none">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="flex flex-col gap-0.5 sm:gap-1"
          >
            <span className="font-sans font-extrabold text-[11px] sm:text-xs md:text-sm uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white whitespace-nowrap">
              RAFA'S PORTOFOLIO
            </span>
            <span className="font-mono text-[8px] sm:text-[9px] text-zinc-500 uppercase tracking-widest leading-none">
              DROP THE ALBUM / OSKY
            </span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.65 }}
            className="hidden md:flex flex-col items-center text-center gap-1.5"
          >
            <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-[0.3em] font-medium">
              VOLUME-01 / REHEARSAL INDEX
            </span>
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
            className="flex flex-col items-end gap-0.5 sm:gap-1"
          >
            <span className="font-mono text-[10px] sm:text-xs text-white tracking-[0.15em] sm:tracking-[0.2em] uppercase font-bold whitespace-nowrap">
              EST. 2026
            </span>
            <span className="font-mono text-[8px] sm:text-[9px] text-zinc-500 uppercase tracking-wider leading-none">
              CREATIVE DIRECTION
            </span>
          </motion.div>
        </div>

        {/* Floating Center Sub-Label Above the main Title */}
        <div className="absolute inset-x-0 top-[18%] sm:top-[22%] md:top-[25%] flex justify-center z-[15] pointer-events-none select-none px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
            className="flex items-center gap-2 sm:gap-3 px-3 py-1 sm:px-4 sm:py-1.5 bg-zinc-950/80 backdrop-blur-md border border-zinc-900/60 rounded-full shadow-lg max-w-full"
          >
            <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse shrink-0" />
            <span className="font-mono text-[8px] sm:text-[10px] text-zinc-300 uppercase tracking-[0.15em] sm:tracking-[0.3em] leading-none text-center truncate">
              RAFA'S OFFICIAL SOUNDCASE & VISION
            </span>
          </motion.div>
        </div>

        {/* Ambient Corner Editorial Metadata Panels (framing bottom photo, z-[10]) */}
        <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 z-[10] pointer-events-none select-none hidden sm:flex flex-col gap-1.5 text-left max-w-xs">
          <motion.span 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.8 }}
            className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest"
          >
            [ FOCUS SPECS ]
          </motion.span>
          <motion.p
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.9 }}
            className="font-mono text-[9px] text-zinc-600 uppercase tracking-wider leading-relaxed"
          >
            DIGITAL EXCLUSIVES<br />
            PRE-RELEASE ASSETS<br />
            REF: OSCAR-2026-DROP
          </motion.p>
        </div>

        <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 z-[10] pointer-events-none select-none hidden sm:flex flex-col gap-1.5 text-right max-w-xs">
          <motion.span 
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.8 }}
            className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest"
          >
            [ COORDINATES ]
          </motion.span>
          <motion.p
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.9 }}
            className="font-mono text-[9px] text-zinc-600 uppercase tracking-wider leading-relaxed"
          >
            LATITUDE: 45.1092<br />
            LONGITUDE: -12.2281<br />
            DESIGN BY RAFAEL
          </motion.p>
        </div>

        {/* Bottom-centered hero asset inside header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 120 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 2.1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 z-[8] w-full max-w-7xl px-4 flex justify-center pointer-events-none"
        >
          <img
            src="https://cdn.discordapp.com/attachments/874341182577205269/1507415093422588145/Untitled_Project.png?ex=6a11d134&is=6a107fb4&hm=b8f7821a86517d2d98bc7a35e51c80a45385b0e2d077d7ca8e306f9bedc8dc74&"
            alt="Hero Centered Asset"
            className="w-auto h-auto max-h-[92vh] sm:max-h-[85vh] md:max-h-[75vh] lg:max-h-[80vh] object-contain object-bottom drop-shadow-[0_10px_50px_rgba(0,0,0,0.85)] scale-[1.2] sm:scale-[1.1] md:scale-100 origin-bottom"
          />
        </motion.div>
        


        {/* Background filled text 'OSCAR' (behind the photo, z-[5]) */}
        <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center z-[5] select-none pointer-events-none text-center">
          <motion.h1 
            initial={{ opacity: 0, scale: 1.18, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="fluid uppercase"
          >
            OSCAR
          </motion.h1>
        </div>

        {/* Foreground stroked text 'OSCAR' (over the photo, z-[9]) */}
        <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center z-[9] select-none pointer-events-none text-center">
          <motion.h1 
            initial={{ opacity: 0, scale: 1.18, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="fluid-outline uppercase"
          >
            OSCAR
          </motion.h1>
        </div>


      </header>

      {/* Premium Infinite Scroll Ticker Tape */}
      <div className="relative w-full overflow-hidden bg-zinc-950 border-y border-zinc-900/90 py-3.5 sm:py-4.5 select-none z-[11] shadow-2xl">
        {/* Soft feather shading overlays on edges for cinema/editorial depth */}
        <div className="absolute inset-y-0 left-0 w-12 sm:w-20 md:w-32 bg-gradient-to-r from-black via-black/80 to-transparent z-[12] pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-12 sm:w-20 md:w-32 bg-gradient-to-l from-black via-black/80 to-transparent z-[12] pointer-events-none" />
        
        <div className="flex whitespace-nowrap overflow-hidden">
          <motion.div
            className="flex items-center gap-8 md:gap-16 pr-8 md:pr-16"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: 28,
              repeatType: "loop"
            }}
          >
            {/* Array doubled for mathematically flawless seamless loop overlap */}
            {[
              "RAFA PORTOFOLIO",
              "DROP THE ALBUM",
              "OSKY",
              "RAFA PORTOFOLIO",
              "DROP THE ALBUM",
              "OSKY",
              "RAFA PORTOFOLIO",
              "DROP THE ALBUM",
              "OSKY"
            ].concat([
              "RAFA PORTOFOLIO",
              "DROP THE ALBUM",
              "OSKY",
              "RAFA PORTOFOLIO",
              "DROP THE ALBUM",
              "OSKY",
              "RAFA PORTOFOLIO",
              "DROP THE ALBUM",
              "OSKY"
            ]).map((item, idx) => (
              <div key={idx} className="flex items-center gap-8 md:gap-16 font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] md:tracking-[0.35em] text-zinc-400">
                {item === "OSKY" ? (
                  <span className="text-white font-[Bebas Neue] font-normal tracking-[0.06em] text-lg sm:text-2xl px-2.5 py-0.5 sm:px-3 sm:py-0.5 bg-zinc-900 border border-zinc-850/80 rounded-sm">
                    {item}
                  </span>
                ) : (
                  <span className="opacity-85">{item}</span>
                )}
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-700 shrink-0" />
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <main>
        {/* Animated Scroll Pin Section */}
        <section ref={containerRef} className="relative">
          <div className="content">
            <div id="grid-element" className="grid">
              
              {/* Layer 1: Outer edges (6 images) */}
              <motion.div 
                style={{ 
                  scale: prefersReduced ? 1 : scaleLayer1, 
                  opacity: prefersReduced ? 1 : opacityLayer1 
                }} 
                className="layer layer-1"
              >
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400539405680720/solomon2025.jpeg?ex=6a11c3a6&is=6a107226&hm=1c81dc5303243daf21edaaeb389cdf6f8ca54cfb92bea989d10f58431e11cca8&" alt="solomon2025" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400559232159784/rafa67.jpeg?ex=6a11c3ab&is=6a10722b&hm=d25954ff113bc9a99a51e7477fc9ac3e74cf4317c9c9384cb27b4d0e6498fb9a&" alt="rafa67" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400602836144318/pozaflash.jpeg?ex=6a11c3b5&is=6a107235&hm=fedf6040c97a4a6ed6944ecfb153b95651b8219ae0c279341aea9e6b123f4a95&" alt="pozaflash" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400606678122496/pozatausanu.jpeg?ex=6a11c3b6&is=6a107236&hm=2c10497cf2fd5f5f8b50aa9bae5ec4db5ea9a49219a8600d79f58fc612acabeb&" alt="pozatausanu" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400612311072969/pozaaramanitravis.jpeg?ex=6a11c3b8&is=6a107238&hm=8f7a168665eca8f76c4f8fc349ae90fc7a9e71739b70ef1cd7298ea7e80c889a&" alt="pozaaramanitravis" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400691801657554/mateisiwilling.jpeg?ex=6a11c3cb&is=6a10724b&hm=72bb6b019d5eb498a85e4327401cec07647288576ebfa1a38d43fbb2cb3fd7a7&" alt="mateisiwilling" />
                </div>
              </motion.div>

              {/* Layer 2: Inner columns (6 images) */}
              <motion.div 
                style={{ 
                  scale: prefersReduced ? 1 : scaleLayer2, 
                  opacity: prefersReduced ? 1 : opacityLayer2 
                }} 
                className="layer layer-2"
              >
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400714958143609/mateisala.jpeg?ex=6a11c3d0&is=6a107250&hm=c1d02dcdbdf154ffc058416985f4fcbc65380acf6abaf1a2447db81005f8c29c&" alt="mateisala" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400743949303818/mateibeat.jpeg?ex=6a11c3d7&is=6a107257&hm=2ef1cce8fbe85c3a6550345f83ac9ecf6265ad338bffd407529a027774ecb813&" alt="mateibeat" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400951726735470/freelook.jpeg?ex=6a11c409&is=6a107289&hm=026e3b1e82b85a404bffbf006ab39c12fe10be56e49cdf9d1da2bc7c7c26b953&" alt="freelook" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400970819207198/dangratar.jpeg?ex=6a11c40d&is=6a10728d&hm=fb2aedc170146b1fdea677e0664810d3b39a49b1dde4ff466871e481638e8652&" alt="dangratar" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507400995901014207/danbeat.jpeg?ex=6a11c413&is=6a107293&hm=fb899307e0ff5044297dff65b189f7d2cbc6d6e13090a914579eb73fdc9083a1&" alt="danbeat" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507401019896627331/cuterevelion.jpeg?ex=6a11c419&is=6a107299&hm=939f3d371f3a7c87ee50060329016790be80d4c96cffde109d2e93ffa966f500&" alt="cuterevelion" />
                </div>
              </motion.div>

              {/* Layer 3: Center column top and bottom (2 images) */}
              <motion.div 
                style={{ 
                  scale: prefersReduced ? 1 : scaleLayer3, 
                  opacity: prefersReduced ? 1 : opacityLayer3 
                }} 
                className="layer layer-3"
              >
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507401034853519580/chamba.jpeg?ex=6a11c41c&is=6a10729c&hm=512a6d70e9173a7695e70ca53c217df6e923707ce6b0f7213e47282555d4d957&" alt="chamba" />
                </div>
                <div>
                  <img src="https://cdn.discordapp.com/attachments/874341182577205269/1507401058136227961/armanipixel.jpeg?ex=6a11c422&is=6a1072a2&hm=d8f3dd2092f2eae7e52e79bc3382545387cf104eb2f23c7b37f7065654f0fe76&" alt="armanipixel" />
                </div>
              </motion.div>

              <div 
                ref={scalerOriginRef} 
                id="scaler-container"
                className="scaler"
              >
                <motion.img
                  src="https://cdn.discordapp.com/attachments/874341182577205269/1507400641289519214/Image.png?ex=6a11c3bf&is=6a10723f&hm=497a4d23352e0b90464bda9df680fb4382cb50785e5151d6fbf88cd260c9a1e1&"
                  alt="Main central hero image"
                  style={{
                    width: prefersReduced ? '100%' : imageWidth,
                    height: prefersReduced ? '100%' : imageHeight,
                    borderRadius: prefersReduced ? '16px' : imageBorderRadius,
                  }}
                  className="z-20 pointer-events-auto object-cover shadow-2xl"
                />
              </div>

            </div>
          </div>
        </section>

        {/* Conclusion/Outro Section */}
        <section className="relative overflow-hidden bg-black text-center px-4 py-32 md:py-48">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(63,63,70,0.15),black)]" />
          
          <div className="max-w-5xl mx-auto flex flex-col items-center justify-center relative z-10">
            <h2 className="font-['Bebas_Neue',_sans-serif] text-[12vw] sm:text-[10vw] md:text-[8vw] lg:text-[7.5rem] leading-none tracking-tight text-white select-none relative">
              <span className="sr-only">BEST MEMORIES</span>
              <span className="flex flex-wrap justify-center items-center gap-x-[0.15em] perspective-[1000px]">
                {"BEST MEMORIES".split("").map((char, index) => (
                  <motion.span
                    key={index}
                    initial={{ 
                      opacity: 0, 
                      y: 60,
                      rotateX: -85,
                      filter: 'blur(12px)'
                    }}
                    whileInView={{ 
                      opacity: 1, 
                      y: 0,
                      rotateX: 0,
                      filter: 'blur(0px)'
                    }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{
                      duration: 0.9,
                      delay: index * 0.04,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    className="inline-block origin-top text-white selection:bg-[#339E6F]/30 bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text hover:text-[#339E6F] transition-colors duration-200"
                    style={{ 
                      whiteSpace: char === " " ? "pre" : "normal",
                      textShadow: '0 0 40px rgba(255,255,255,0.06)',
                    }}
                    whileHover={{
                      scale: 1.15,
                      y: -10,
                      filter: 'drop-shadow(0 0 15px rgba(51, 158, 111, 0.5))',
                      transition: { duration: 0.25, ease: "easeOut" }
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </span>
            </h2>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 0.6, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ delay: 0.8, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 text-sm sm:text-base md:text-lg tracking-[0.15em] font-mono lowercase text-zinc-400 selection:bg-[#339E6F]/20"
            >
              best friends I could ask for.
            </motion.p>
          </div>
        </section>
      </main>
    </div>
  );
}
