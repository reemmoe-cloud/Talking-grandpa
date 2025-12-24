
import React, { useEffect, useState, useRef } from 'react';
import { GrandpaState } from '../types';

interface GrandpaProps {
  state: GrandpaState;
  onPoke: () => void;
  onToggleLantern?: () => void;
  voice: string;
}

const Grandpa: React.FC<GrandpaProps> = ({ state, onPoke, onToggleLantern, voice }) => {
  const [wiggle, setWiggle] = useState(0);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.isPoked) {
      setWiggle(5);
      const timer = setTimeout(() => setWiggle(0), 300);
      return () => clearTimeout(timer);
    }
  }, [state.isPoked]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || state.isSleeping) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 3;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 300;
      const scale = Math.min(distance, maxDistance) / maxDistance;
      
      const angle = Math.atan2(dy, dx);
      const maxPupilOffset = 3;

      setEyeOffset({
        x: Math.cos(angle) * scale * maxPupilOffset,
        y: Math.sin(angle) * scale * maxPupilOffset
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [state.isSleeping]);

  const isOutside = state.location === 'outside';
  const isKitchen = state.location === 'kitchen';
  const isBedroom = state.location === 'bedroom';
  const isLivingRoom = state.location === 'livingRoom';
  const isV0 = state.theme === 'v0';

  // Theme colors
  const skinColor = state.theme === 'halloween' ? '#bdc3c7' : '#FFCCBC';
  const hairColor = state.theme === 'halloween' ? '#7f8c8d' : '#EEEEEE';

  return (
    <div 
      ref={containerRef}
      className={`relative w-full max-w-md mx-auto cursor-pointer select-none transition-transform duration-150`}
      style={{ transform: `translateY(${wiggle}px) rotate(${wiggle/2}deg)` }}
      onClick={onPoke}
    >
      <style>{`
        @keyframes breathing {
          0%, 100% { transform: scale(1, 1); }
          50% { transform: scale(1.01, 1.005); }
        }
        .animate-breathing {
          animation: breathing 4s ease-in-out infinite;
          transform-origin: center bottom;
        }
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 5px #ffd700); }
          50% { filter: drop-shadow(0 0 20px #ffd700); }
        }
        .animate-glow {
          animation: glow 2s infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes ring {
          0%, 100% { transform: rotate(0); }
          10%, 30%, 50%, 70%, 90% { transform: rotate(-5deg); }
          20%, 40%, 60%, 80% { transform: rotate(5deg); }
        }
        .animate-ring {
          animation: ring 0.2s infinite;
          transform-origin: center center;
        }
      `}</style>
      <svg 
        viewBox="0 0 200 240" 
        xmlns="http://www.w3.org/2000/svg" 
        className={`w-full h-auto drop-shadow-2xl rounded-3xl overflow-hidden transition-all duration-500`}
      >
        {/* Background Logic */}
        {isOutside ? (
          <>
            <rect x="0" y="0" width="200" height="240" fill={state.theme === 'halloween' ? '#1a252f' : '#87CEEB'} />
            <rect x="0" y="180" width="200" height="60" fill={state.theme === 'halloween' ? '#2c3e50' : '#4CAF50'} />
            {state.theme === 'christmas' && <text x="10" y="40" fontSize="30">❄️</text>}
            {state.theme === 'halloween' && <circle cx="170" cy="30" r="15" fill="#ecf0f1" opacity="0.8" />}
            {!isBedroom && state.theme === 'normal' && <circle cx="170" cy="30" r="15" fill="#FFD700" />}
          </>
        ) : isKitchen ? (
          <>
            <rect x="0" y="0" width="200" height="240" fill={state.theme === 'halloween' ? '#3e2723' : '#FFF9C4'} />
            <rect x="0" y="190" width="200" height="50" fill="#E0E0E0" />
            <rect x="0" y="170" width="200" height="30" fill="#8D6E63" />
            {state.theme === 'christmas' && <text x="160" y="165" fontSize="20">🍬</text>}
          </>
        ) : isBedroom ? (
          <>
            <rect x="0" y="0" width="200" height="240" fill={state.isLanternOn ? '#5D4037' : '#0a0a0a'} />
            {/* Bed */}
            <g transform="translate(20, 160)">
              <rect x="0" y="0" width="160" height="40" fill="#3E2723" />
              <rect x="5" y="-15" width="40" height="15" rx="5" fill="#E0E0E0" />
              <rect x="5" y="0" width="150" height="20" fill="#1A237E" opacity="0.8" />
            </g>
            {/* Interactive Lantern */}
            <g transform="translate(140, 130)" onClick={(e) => { e.stopPropagation(); onToggleLantern?.(); }}>
               <rect x="5" y="40" width="30" height="40" fill="#212121" />
               <g className={state.isLanternOn ? 'animate-glow' : ''}>
                 <rect x="10" y="10" width="20" height="30" rx="3" fill={state.isLanternOn ? '#FFD54F' : '#333'} />
                 <path d="M10 10 Q20 0 30 10" stroke="black" fill="none" />
               </g>
            </g>
          </>
        ) : (
          <>
            <rect x="0" y="0" width="200" height="240" fill={isV0 ? '#cccccc' : state.theme === 'christmas' ? '#8b0000' : state.theme === 'halloween' ? '#1a1a1a' : '#EADBC8'} />
            {state.theme === 'christmas' && <text x="160" y="40" fontSize="30">🎄</text>}
            {state.theme === 'halloween' && <text x="10" y="50" fontSize="30">🎃</text>}
            {!isV0 && (
              <g transform="translate(30, 140)">
                  <path d="M10 0 Q70 -10 130 0 L140 100 H0 Z" fill="#795548" />
                  <rect x="10" y="60" width="120" height="40" fill="#8D6E63" />
              </g>
            )}
            {!isV0 && (
              <g transform="translate(140, 170)">
                  <rect x="0" y="0" width="50" height="10" fill="#6D4C41" />
                  <g className={state.isPhoneRinging ? 'animate-ring' : ''}>
                      <path d="M5 -15 L45 -15 L40 -2 L10 -2 Z" fill="#B71C1C" />
                      {!state.isHandRaised && <path d="M5 -20 Q25 -25 45 -20 L42 -15 Q25 -18 8 -15 Z" fill="#D32F2F" />}
                  </g>
              </g>
            )}
          </>
        )}
        
        {/* Grandpa Rendering */}
        <g transform={isBedroom ? 'translate(0, 50) rotate(-5, 100, 85)' : ''}>
          {/* Main Body */}
          <g className="animate-breathing">
            {state.theme === 'christmas' ? (
                <path d="M60 140 Q100 130 140 140 L150 240 H50 Z" fill="#d32f2f" />
            ) : state.theme === 'halloween' ? (
                <g>
                  <path d="M60 140 Q100 130 140 140 L150 240 H50 Z" fill="#2c3e50" />
                  <path d="M60 140 L40 200 L60 220 Z" fill="#c0392b" /> {/* Vampire Cape */}
                  <path d="M140 140 L160 200 L140 220 Z" fill="#c0392b" />
                </g>
            ) : !isV0 ? (
                <path d="M60 140 Q100 130 140 140 L150 240 H50 Z" fill="#4E342E" />
            ) : null}
          </g>

          {/* Head */}
          <ellipse cx="100" cy="85" rx="48" ry="58" fill={skinColor} />
          
          {/* Hair - Hidden in V0 */}
          {!isV0 && (
            <g fill={hairColor}>
                <circle cx="60" cy="55" r="15" />
                <circle cx="140" cy="55" r="15" />
                <circle cx="50" cy="70" r="12" />
                <circle cx="150" cy="70" r="12" />
                <ellipse cx="100" cy="40" rx="30" ry="10" />
            </g>
          )}

          {/* Eyes Logic */}
          {state.isSleeping || state.isBlinking ? (
              <g stroke="#333" strokeWidth="2" fill="none">
                  <path d="M78 75 Q85 72 92 75" />
                  <path d="M108 75 Q115 72 122 75" />
              </g>
          ) : (
              <>
                  <circle cx={85 + eyeOffset.x} cy={75 + eyeOffset.y} r="6" fill="#333" />
                  <circle cx={115 + eyeOffset.x} cy={75 + eyeOffset.y} r="6" fill="#333" />
              </>
          )}

          {/* Glasses - Hidden in V0 */}
          {!isV0 && (
            <g opacity={state.isSleeping ? 0.2 : 1}>
                <circle cx="85" cy="75" r="16" fill="rgba(255,255,255,0.1)" stroke="#37474F" strokeWidth="2" />
                <circle cx="115" cy="75" r="16" fill="rgba(255,255,255,0.1)" stroke="#37474F" strokeWidth="2" />
                <path d="M98 75 L102 75" stroke="#37474F" strokeWidth="2" />
            </g>
          )}

          {/* Mouth */}
          <rect x={85} y={115} width={30} height={Math.max(4, 30 * state.mouthOpen)} rx="10" fill="#4E342E" />

          {/* Mustache - Hidden in V0 */}
          {!isV0 && (
            <g fill={hairColor} transform={`translate(0, ${state.mouthOpen * 5})`}>
                <path d="M70 115 Q85 105 100 115 Q115 105 130 115 Q135 130 100 125 Q65 130 70 115" />
            </g>
          )}
          
          {/* Costume Extras */}
          {state.theme === 'christmas' && (
              <g transform="translate(60, 20) rotate(-10)">
                  <path d="M0 25 L40 0 L80 25 Z" fill="#d32f2f" />
                  <rect x="0" y="20" width="80" height="10" rx="5" fill="white" />
                  <circle cx="40" cy="0" r="8" fill="white" />
              </g>
          )}
          {state.theme === 'halloween' && state.mouthOpen > 0.2 && (
              <g fill="white">
                  <path d="M88 115 L92 115 L90 125 Z" />
                  <path d="M108 115 L112 115 L110 125 Z" />
              </g>
          )}
        </g>

        {/* Dream Bubbles when sleeping */}
        {state.isSleeping && (
            <g className="animate-float" fill="white" opacity="0.6">
                <circle cx="150" cy="50" r="5" />
                <circle cx="165" cy="40" r="8" />
                <ellipse cx="170" cy="20" rx="25" ry="15" />
                <text x="155" y="25" fontSize="10" fill="#333" fontStyle="italic">Zzz...</text>
            </g>
        )}
      </svg>
    </div>
  );
};

export default Grandpa;
