
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { GameState, GrandpaState, Location } from './types';
import { encode, decode, decodeAudioData } from './utils/audio-helpers';
import Grandpa from './components/Grandpa';
import { Mic, MicOff, Volume2, Wind, History, Play, Home, Moon, Sun, Clover, Utensils, Settings, Phone, PhoneOff } from 'lucide-react';

const SAMPLE_RATE_IN = 16000;
const SAMPLE_RATE_OUT = 24000;
const AVAILABLE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [grandpa, setGrandpa] = useState<GrandpaState>({
    isBlinking: false,
    mouthOpen: 0,
    isPoked: false,
    currentMood: 'happy',
    location: 'livingRoom',
    isPlayingWithHorse: false,
    isPhoneRinging: false,
    isHandRaised: false,
    isPhoneActive: false
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVoice, setCurrentVoice] = useState<string>('Puck');

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setGrandpa(prev => ({ ...prev, isBlinking: true }));
      setTimeout(() => setGrandpa(prev => ({ ...prev, isBlinking: false })), 200);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(blinkInterval);
  }, []);

  useEffect(() => {
    const updateMouth = () => {
      if (analyserRef.current && isSessionActive) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const mouthValue = Math.min(1, average / 40); 
        setGrandpa(prev => ({ ...prev, mouthOpen: mouthValue > 0.1 ? mouthValue : 0 }));
      } else if (!isSessionActive) {
        setGrandpa(prev => ({ ...prev, mouthOpen: 0 }));
      }
      animationFrameRef.current = requestAnimationFrame(updateMouth);
    };
    if (isSessionActive) animationFrameRef.current = requestAnimationFrame(updateMouth);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isSessionActive]);

  const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: `audio/pcm;rate=${SAMPLE_RATE_IN}` };
  };

  const getSystemInstruction = (state: GrandpaState) => {
    const { location, currentMood, isPhoneActive } = state;
    
    if (isPhoneActive) {
        return `ACT AS TALKING BEN ON THE PHONE.
        1. You are holding the phone and listening to the user.
        2. IF the user asks a question, answer ONLY with "Yes." or "No.". 
        3. IF the user doesn't ask a question (just talks), say something short like "Ho ho", "Mmm-hmm", or "I see".
        4. STAY on the phone. Do not repeat what they say. Only answer or acknowledge.
        5. Be decisive and very brief.`;
    }

    let locationContext = "";
    if (location === 'kitchen') locationContext = 'You are in your kitchen surrounded by a lot of food.';
    else if (location === 'outside') locationContext = 'You are outside in the garden with your favorite horse. You are very happy here.';
    else locationContext = 'You are in your living room sitting in your comfy brown chair next to your rotary phone.';

    let moodContext = "";
    if (location === 'outside') moodContext = "You are extremely happy, cheerful, and full of energy.";
    else {
        switch(currentMood) {
            case 'grumpy': moodContext = "Sound a bit grumpy and annoyed."; break;
            case 'surprised': moodContext = "Sound very shocked!"; break;
            case 'sleepy': moodContext = "Sound extremely sleepy and slow."; break;
            default: moodContext = "Sound happy and cheerful.";
        }
    }

    return `ACT AS A SWEET OLD GRANDPA REPEATER.
    CONTEXT: ${locationContext} ${moodContext}
    1. IMMEDIATELY REPEAT EXACTLY what the user said back to them.
    2. AFTER repeating, add a short grandpa phrase like "dearie", "ho ho", or something about your surroundings.
    3. Keep responses short. ONLY REPEAT AND MIMIC.`;
  };

  const stopSession = (keepActiveState: boolean = false) => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close());
      sessionPromiseRef.current = null;
    }
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (mediaStreamSourceRef.current) mediaStreamSourceRef.current.disconnect();
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    if (!keepActiveState) {
      setIsSessionActive(false);
      setGameState(GameState.IDLE);
    }
  };

  const startSession = async (voiceOverride?: string, forceState?: GrandpaState) => {
    const voiceToUse = voiceOverride || currentVoice;
    const stateToUse = forceState || grandpa;
    
    // Smooth transition: don't toggle isSessionActive off if we are already active
    const wasActive = isSessionActive;
    
    try {
      stopSession(wasActive);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_IN });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_OUT });
      
      if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
      if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();
      
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      outputNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(outputAudioContextRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setGameState(GameState.LISTENING);
            setIsSessionActive(true);
            mediaStreamSourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(stream);
            scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => { session.sendRealtimeInput({ media: pcmBlob }); });
            };
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setGameState(GameState.SPEAKING);
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, SAMPLE_RATE_OUT, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNodeRef.current!);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                    setGameState(GameState.LISTENING);
                }
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e) => { stopSession(); },
          onclose: () => { /* Handled via stopSession */ }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceToUse } } },
          systemInstruction: getSystemInstruction(stateToUse)
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) { 
        setError("I can't hear you, dearie!"); 
        setIsSessionActive(false);
    }
  };

  const handleAction = (type: string) => {
    let newMood: GrandpaState['currentMood'] = 'happy';
    switch(type) {
        case 'giggle': newMood = 'happy'; break;
        case 'hug': newMood = 'happy'; break;
        case 'nap': newMood = 'sleepy'; break;
        case 'poke': newMood = 'surprised'; break;
    }
    const newState = { ...grandpa, isPoked: true, currentMood: newMood };
    setGrandpa(newState);
    setTimeout(() => setGrandpa(prev => ({ ...prev, isPoked: false })), 300);
    // When poked/hugged, we update the mood in the system instruction
    if (isSessionActive) startSession(currentVoice, newState);
  };

  const handlePhoneCall = () => {
    if (grandpa.isPhoneRinging || grandpa.isHandRaised || grandpa.isPhoneActive) return;
    
    setGrandpa(prev => ({ ...prev, isPhoneRinging: true }));
    
    setTimeout(() => {
        const phoneState: GrandpaState = { 
            ...grandpa, 
            isPhoneRinging: false, 
            isHandRaised: true,
            isPhoneActive: true 
        };
        setGrandpa(phoneState);
        startSession(currentVoice, phoneState);
    }, 2000);
  };

  const handleHangUp = () => {
    const newState: GrandpaState = { 
        ...grandpa, 
        isHandRaised: false, 
        isPhoneActive: false,
        isPhoneRinging: false 
    };
    setGrandpa(newState);
    if (isSessionActive) startSession(currentVoice, newState);
  };

  const playWithHorse = () => {
    if (grandpa.location !== 'outside') return;
    setGrandpa(prev => ({ ...prev, isPlayingWithHorse: true, currentMood: 'happy' }));
    setTimeout(() => {
        setGrandpa(prev => ({ ...prev, isPlayingWithHorse: false }));
    }, 2000);
  };

  const switchLocation = (target?: Location) => {
    let next: Location;
    if (target) next = target;
    else {
        if (grandpa.location === 'livingRoom') next = 'kitchen';
        else if (grandpa.location === 'kitchen') next = 'outside';
        else next = 'livingRoom';
    }
    
    const newState = { 
        ...grandpa, 
        location: next, 
        currentMood: next === 'outside' ? 'happy' : grandpa.currentMood,
        isHandRaised: false,
        isPhoneRinging: false,
        isPhoneActive: false
    };
    setGrandpa(newState);
    if (isSessionActive) startSession(currentVoice, newState);
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVoice = e.target.value;
    setCurrentVoice(newVoice);
    if (isSessionActive) {
      startSession(newVoice);
    }
  };

  return (
    <div className={`min-h-screen bg-rose-50 flex flex-col items-center justify-between p-4 overflow-hidden transition-all duration-300`}>
      <header className={`w-full max-w-2xl flex flex-wrap justify-between items-center py-4 z-20 gap-4`}>
        <div className="flex flex-col">
          <h1 className={`text-3xl font-black text-rose-800 game-font tracking-tight drop-shadow-sm`}>
            TALKING <span className="text-amber-700">GRANDPA</span>
          </h1>
          {isSessionActive && (
              <div className={`flex items-center gap-2 mt-1 px-3 py-1 rounded-full w-fit ${gameState === GameState.LISTENING ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-blue-100 text-blue-700'}`}>
                  {gameState === GameState.LISTENING ? <Mic size={14} /> : <Volume2 size={14} />}
                  <span className="text-[10px] font-bold uppercase tracking-widest">{gameState}</span>
              </div>
          )}
        </div>

        <div className="flex items-center gap-2 bg-white/80 p-2 rounded-2xl shadow-sm border border-rose-100">
          <Settings size={18} className="text-rose-600" />
          <select 
            value={currentVoice} 
            onChange={handleVoiceChange}
            className="bg-transparent text-rose-900 font-bold text-sm outline-none cursor-pointer focus:ring-0"
          >
            {AVAILABLE_VOICES.map(v => (
              <option key={v} value={v}>{v} Voice</option>
            ))}
          </select>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg flex flex-col justify-center relative">
        {!isSessionActive ? (
          <div className="text-center space-y-8 z-10">
            <div className="relative group">
                <Grandpa state={grandpa} onPoke={() => handleAction('poke')} voice={currentVoice} />
                <div className="absolute inset-0 bg-rose-900/5 backdrop-blur-[1px] flex items-center justify-center rounded-3xl">
                    <button onClick={() => startSession()} className="bg-rose-600 hover:bg-rose-700 text-white p-6 rounded-full shadow-2xl transform transition hover:scale-110 active:scale-95"><Play size={48} fill="currentColor" /></button>
                </div>
            </div>
            <p className="text-rose-800 font-bold text-xl game-font">"Talk to me, dearie!"</p>
          </div>
        ) : (
          <div className={`relative z-10`}>
            <Grandpa state={grandpa} onPoke={() => handleAction('poke')} voice={currentVoice} />
          </div>
        )}
      </main>

      <footer className={`w-full max-w-2xl bg-white/95 backdrop-blur-md rounded-t-3xl p-6 shadow-2xl border-t border-rose-100 z-20`}>
        <div className={`grid gap-3 ${grandpa.location === 'livingRoom' ? 'grid-cols-6' : grandpa.location === 'outside' ? 'grid-cols-6' : 'grid-cols-5'}`}>
            <ActionButton 
                icon={grandpa.location === 'livingRoom' ? <Sun size={24} /> : <Home size={24} />} 
                label={grandpa.location === 'livingRoom' ? "Outside" : "Home"} 
                color="bg-amber-500" 
                onClick={() => switchLocation(grandpa.location === 'livingRoom' ? 'outside' : 'livingRoom')} 
                disabled={false}
            />
            {grandpa.location === 'outside' ? (
                <>
                    <ActionButton icon={<Clover size={24} />} label="Play Horse" color="bg-green-600" onClick={playWithHorse} disabled={false} />
                    <ActionButton icon={<Utensils size={24} />} label="Kitchen" color="bg-orange-500" onClick={() => switchLocation('kitchen')} disabled={false} />
                </>
            ) : grandpa.location === 'livingRoom' ? (
                <>
                    <ActionButton icon={<Utensils size={24} />} label="Kitchen" color="bg-orange-500" onClick={() => switchLocation('kitchen')} disabled={false} />
                    {grandpa.isPhoneActive ? (
                        <ActionButton icon={<PhoneOff size={24} />} label="Hang Up" color="bg-gray-800" onClick={handleHangUp} disabled={!isSessionActive} />
                    ) : (
                        <ActionButton icon={<Phone size={24} />} label="Call" color="bg-red-600" onClick={handlePhoneCall} disabled={!isSessionActive} />
                    )}
                </>
            ) : (
                <ActionButton icon={<Wind size={24} />} label="Giggle" color="bg-emerald-500" onClick={() => handleAction('giggle')} disabled={!isSessionActive} />
            )}
            <ActionButton icon={<History size={24} />} label="Hug" color="bg-rose-500" onClick={() => handleAction('hug')} disabled={!isSessionActive} />
            <ActionButton icon={<Moon size={24} />} label="Sleep" color="bg-indigo-600" onClick={() => handleAction('nap')} disabled={!isSessionActive} />
            <ActionButton icon={<MicOff size={24} />} label="Bye" color="bg-red-400" onClick={() => stopSession(false)} disabled={!isSessionActive} />
        </div>
      </footer>
    </div>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode, label: string, color: string, onClick: () => void, disabled: boolean }> = ({ icon, label, color, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`${color} text-white flex flex-col items-center justify-center p-3 rounded-2xl shadow-lg transition-all active:scale-90 ${disabled ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:-translate-y-1'}`}>
        {icon}
        <span className="text-[10px] uppercase font-black mt-1 tracking-wider text-center">{label}</span>
    </button>
);

export default App;
