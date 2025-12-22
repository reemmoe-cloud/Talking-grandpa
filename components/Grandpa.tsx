
import React, { useEffect, useState, useRef } from 'react';
import { GrandpaState } from '../types';

interface GrandpaProps {
  state: GrandpaState;
  onPoke: () => void;
  voice: string;
}

const Grandpa: React.FC<GrandpaProps> = ({ state, onPoke, voice }) => {
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
      if (!containerRef.current) return;

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
  }, []);

  const isOutside = state.location === 'outside';
  const isKitchen = state.location === 'kitchen';
  const isLivingRoom = state.location === 'livingRoom';

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
        @keyframes horse-bounce {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(5px, -10px); }
        }
        .animate-horse {
          animation: horse-bounce 0.8s ease-in-out infinite;
        }
        @keyframes steam {
          0% { transform: translateY(0) opacity(0); }
          50% { opacity: 0.5; }
          100% { transform: translateY(-10px) opacity(0); }
        }
        .steam-line {
          animation: steam 2s infinite ease-out;
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
            <rect x="0" y="0" width="200" height="240" fill="#87CEEB" />
            <rect x="0" y="180" width="200" height="60" fill="#4CAF50" />
            <circle cx="170" cy="30" r="15" fill="#FFD700" />
            <circle cx="40" cy="40" r="10" fill="white" opacity="0.8" />
            <circle cx="55" cy="45" r="12" fill="white" opacity="0.8" />
            
            <g transform="translate(140, 160) scale(0.6)" className={state.isPlayingWithHorse ? 'animate-horse' : ''}>
                <path d="M10 40 L50 40 L60 10 L80 15 L70 45 L80 50 L80 80 L65 80 L65 55 L55 55 L55 80 L40 80 L40 55 L30 55 L30 80 L15 80 L15 50 Z" fill="#795548" />
                <path d="M60 10 Q70 0 80 15" fill="#5D4037" />
                <circle cx="72" cy="18" r="2" fill="black" />
                {state.isPlayingWithHorse && (
                    <text x="0" y="-10" fontSize="20">🍎</text>
                )}
            </g>
          </>
        ) : isKitchen ? (
          <>
            <rect x="0" y="0" width="200" height="240" fill="#FFF9C4" />
            <rect x="0" y="190" width="200" height="50" fill="#E0E0E0" />
            <rect x="0" y="170" width="200" height="30" fill="#8D6E63" />
            
            <g transform="translate(20, 155)">
                <path d="M0 15 Q15 0 30 15 Z" fill="#FFB74D" />
                <rect x="0" y="15" width="30" height="5" fill="#F57C00" />
                <path d="M5 5 Q7 -5 9 5" fill="none" stroke="white" strokeWidth="1" opacity="0.6" className="steam-line" style={{animationDelay: '0s'}} />
                <path d="M15 5 Q17 -5 19 5" fill="none" stroke="white" strokeWidth="1" opacity="0.6" className="steam-line" style={{animationDelay: '0.5s'}} />
                <path d="M25 5 Q27 -5 29 5" fill="none" stroke="white" strokeWidth="1" opacity="0.6" className="steam-line" style={{animationDelay: '1s'}} />
            </g>
            
            <g transform="translate(140, 150)">
                <path d="M0 20 Q20 40 40 20 Z" fill="#E0E0E0" />
                <circle cx="10" cy="15" r="7" fill="#F44336" />
                <circle cx="20" cy="12" r="7" fill="#F44336" />
                <circle cx="30" cy="15" r="7" fill="#FFEB3B" />
                <path d="M15 15 Q25 5 35 15" fill="none" stroke="#FFEB3B" strokeWidth="4" />
            </g>

            <g transform="translate(80, 158) rotate(-10)">
                <ellipse cx="15" cy="10" rx="15" ry="10" fill="#A1887F" />
                <rect x="25" y="8" width="15" height="4" rx="2" fill="#F5F5F5" />
            </g>

            <g transform="translate(115, 160)">
                <rect x="0" y="5" width="15" height="10" fill="#D1C4E9" />
                <circle cx="7.5" cy="5" r="8" fill="#F06292" />
                <circle cx="7.5" cy="0" r="3" fill="#E91E63" />
            </g>

            <g transform="translate(60, 162)">
                <rect x="0" y="0" width="20" height="8" rx="4" fill="#D84315" />
                <path d="M4 2 L6 6 M10 2 L12 6 M16 2 L18 6" stroke="#BF360C" strokeWidth="1" />
            </g>
          </>
        ) : (
          <>
            <rect x="0" y="0" width="200" height="240" fill="#EADBC8" />
            {/* Comfy Armchair */}
            <g transform="translate(30, 140)">
                <path d="M10 0 Q70 -10 130 0 L140 100 H0 Z" fill="#795548" /> {/* Backrest */}
                <rect x="-10" y="40" width="30" height="60" rx="10" fill="#5D4037" /> {/* Left Arm */}
                <rect x="120" y="40" width="30" height="60" rx="10" fill="#5D4037" /> {/* Right Arm */}
                <rect x="10" y="60" width="120" height="40" fill="#8D6E63" /> {/* Seat */}
            </g>
            {/* Small Table and Phone */}
            <g transform="translate(140, 170)">
                <rect x="0" y="0" width="50" height="10" fill="#6D4C41" /> {/* Table Top */}
                <rect x="10" y="10" width="5" height="60" fill="#5D4037" /> {/* Leg */}
                <rect x="35" y="10" width="5" height="60" fill="#5D4037" /> {/* Leg */}
                
                {/* Phone Base */}
                <g className={state.isPhoneRinging ? 'animate-ring' : ''}>
                    <path d="M5 -15 L45 -15 L40 -2 L10 -2 Z" fill="#B71C1C" />
                    {!state.isHandRaised && (
                         <path d="M5 -20 Q25 -25 45 -20 L42 -15 Q25 -18 8 -15 Z" fill="#D32F2F" /> /* Handset */
                    )}
                </g>
            </g>
          </>
        )}
        
        {/* Grandpa Head */}
        <ellipse cx="100" cy="85" rx="48" ry="58" fill="#FFCCBC" />
        
        {/* Fluffy Hair */}
        <g fill="#EEEEEE">
            <circle cx="60" cy="55" r="15" />
            <circle cx="140" cy="55" r="15" />
            <circle cx="50" cy="70" r="12" />
            <circle cx="150" cy="70" r="12" />
            <ellipse cx="100" cy="40" rx="30" ry="10" />
        </g>

        {/* Eyes & Tracking */}
        {!state.isBlinking ? (
            <>
                <circle cx={85 + eyeOffset.x} cy={75 + eyeOffset.y} r="6" fill="#333" />
                <circle cx={115 + eyeOffset.x} cy={75 + eyeOffset.y} r="6" fill="#333" />
            </>
        ) : (
            <>
                <path d="M78 75 Q85 72 92 75" fill="none" stroke="#333" strokeWidth="2" />
                <path d="M108 75 Q115 72 122 75" fill="none" stroke="#333" strokeWidth="2" />
            </>
        )}

        {/* Glasses */}
        <g>
            <circle cx="85" cy="75" r="16" fill="rgba(255,255,255,0.2)" stroke="#37474F" strokeWidth="2" />
            <circle cx="115" cy="75" r="16" fill="rgba(255,255,255,0.2)" stroke="#37474F" strokeWidth="2" />
            <path d="M98 75 L102 75" stroke="#37474F" strokeWidth="2" />
            <path d="M69 75 L60 75" stroke="#37474F" strokeWidth="1" />
            <path d="M131 75 L140 75" stroke="#37474F" strokeWidth="1" />
        </g>

        {/* Mouth */}
        <rect 
          x={100 - (15)} 
          y={115} 
          width={30} 
          height={Math.max(4, 30 * state.mouthOpen)} 
          rx="10" 
          fill="#4E342E" 
        />

        {/* Big Bushy Mustache */}
        <g fill="#EEEEEE" transform={`translate(0, ${state.mouthOpen * 5})`}>
            <path d="M70 115 Q85 105 100 115 Q115 105 130 115 Q135 130 100 125 Q65 130 70 115" />
        </g>
        
        {/* Cardigan */}
        <path d="M60 140 Q100 130 140 140 L150 240 H50 Z" fill="#4E342E" className="animate-breathing" />

        {/* Hand with Phone */}
        {state.isHandRaised && (
            <g transform="translate(130, 90)">
                 <path d="M0 0 Q-10 -10 -20 0 L-15 15 Q-5 5 5 15 Z" fill="#FFCCBC" /> {/* Hand */}
                 <path d="M-25 -10 Q-15 -15 -5 -10 L-8 -5 Q-15 -8 -22 -5 Z" fill="#D32F2F" transform="rotate(-30)" /> {/* Handset */}
            </g>
        )}
      </svg>
      
      {isOutside && (
        <div className="absolute top-2 left-2 animate-bounce">
            <span className="bg-white/80 px-2 py-1 rounded-full text-xs font-bold text-green-700">HAPPY OUTSIDE!</span>
        </div>
      )}

      {isKitchen && (
        <div className="absolute top-2 left-2 animate-pulse">
            <span className="bg-white/80 px-2 py-1 rounded-full text-xs font-bold text-orange-700">YUMMY FOOD!</span>
        </div>
      )}

      {state.isPhoneRinging && (
        <div className="absolute top-2 left-2 animate-ring">
            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-black shadow-lg">RING RING!</span>
        </div>
      )}
    </div>
  );
};

export default Grandpa;
