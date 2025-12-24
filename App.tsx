
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { GameState, GrandpaState, Location, Theme } from './types';
import { encode, decode, decodeAudioData } from './utils/audio-helpers';
import Grandpa from './components/Grandpa';
import { Mic, MicOff, Volume2, Wind, History, Play, Home, Moon, Sun, Clover, Utensils, Settings, Phone, PhoneOff, Layers, Zap, Ghost, Snowflake, Lightbulb, CircleHelp } from 'lucide-react';

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
    theme: 'normal',
    isPlayingWithHorse: false,
    isPhoneRinging: false,
    isHandRaised: false,
    isPhoneActive: false,
    isLanternOn: true,
    isSleeping: false
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
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
      }
      requestAnimationFrame(updateMouth);
    };
    requestAnimationFrame(updateMouth);
  }, [isSessionActive]);

  const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: `audio/pcm;rate=${SAMPLE_RATE_IN}` };
  };

  const getSystemInstruction = (state: GrandpaState) => {
    const { location, theme, isPhoneActive, isSleeping } = state;
    
    if (theme === 'v0') {
        return `ACT AS THE ORIGINAL VERSION 0.0 GRANDPA.
        1. You are just a floating head.
        2. You CANNOT repeat what the user says.
        3. You ONLY respond with "Yes." or "No.".
        4. No matter what the user asks, pick "Yes" or "No" based on the question context.
        5. DO NOT say anything else. Just "Yes." or "No.".`;
    }

    if (isSleeping) {
        return `ACT AS A DREAMING GRANDPA.
        1. You are deeply asleep.
        2. Respond to EVERYTHING with loud snoring noises like 'Zzzzz... snnn-kore!' or short nonsensical dream-mumbles.
        3. Do NOT repeat the user. Just snore and mumble.`;
    }

    if (isPhoneActive) {
        return `ACT AS TALKING BEN ON THE PHONE.
        1. You are on the phone. 
        2. Answer ONLY with "Yes." or "No.".
        3. If the user doesn't ask a question, say "Ho ho".
        4. Be extremely brief. Do not mimic.`;
    }

    let themeContext = "";
    if (theme === 'christmas') themeContext = "You are Santa Grandpa. Repeat things in a Santa voice.";
    if (theme === 'halloween') themeContext = "You are Scary Vampire Grandpa. Repeat things in a spooky vampire voice.";

    let locContext = `You are in the ${location}.`;

    return `ACT AS A MIMICRY REPEATER (TALKING TOM STYLE).
    CONTEXT: ${locContext} ${themeContext}
    1. YOUR ONLY JOB IS TO REPEAT EXACTLY WHAT THE USER SAID.
    2. DO NOT respond to questions. DO NOT answer the user.
    3. If they say "How are you?", you say "How are you?".
    4. If they laugh, you mimic the laugh.
    5. Be a perfect mimic. Do not add your own comments or thoughts.`;
  };

  const stopSession = (keepActive: boolean = false) => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(s => s.close());
      sessionPromiseRef.current = null;
    }
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (mediaStreamSourceRef.current) mediaStreamSourceRef.current.disconnect();
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    if (!keepActive) {
      setIsSessionActive(false);
      setGameState(GameState.IDLE);
    }
  };

  const startSession = async (voiceOverride?: string, forceState?: GrandpaState) => {
    const voiceToUse = voiceOverride || currentVoice;
    const stateToUse = forceState || grandpa;
    const wasActive = isSessionActive;
    
    try {
      stopSession(wasActive);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE_IN });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE_OUT });
      
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
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (msg) => {
            const base64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64) {
              setGameState(GameState.SPEAKING);
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(base64), ctx, SAMPLE_RATE_OUT, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputNodeRef.current!);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setGameState(GameState.LISTENING);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceToUse } } },
          systemInstruction: getSystemInstruction(stateToUse)
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) { setIsSessionActive(false); }
  };

  const setVersion = (ver: '0.0' | '1.0' | '2.0' | '3.0' | '4.0') => {
    let newState = { ...grandpa };
    if (ver === '0.0') { newState.theme = 'v0'; newState.location = 'livingRoom'; newState.isSleeping = false; }
    if (ver === '1.0') { newState.theme = 'normal'; newState.location = 'livingRoom'; newState.isSleeping = false; }
    if (ver === '2.0') { newState.theme = 'christmas'; newState.location = 'livingRoom'; newState.isSleeping = false; }
    if (ver === '3.0') { newState.theme = 'halloween'; newState.location = 'livingRoom'; newState.isSleeping = false; }
    if (ver === '4.0') { 
        newState.location = 'bedroom'; 
        newState.isSleeping = !newState.isLanternOn;
        newState.theme = 'normal';
    }
    setGrandpa(newState);
    setShowUpdates(false);
    if (isSessionActive) startSession(currentVoice, newState);
  };

  const handleToggleLantern = () => {
    const newState = { ...grandpa, isLanternOn: !grandpa.isLanternOn, isSleeping: grandpa.isLanternOn };
    setGrandpa(newState);
    if (isSessionActive) startSession(currentVoice, newState);
  };

  const handlePhoneCall = () => {
    if (grandpa.isPhoneRinging || grandpa.isHandRaised || grandpa.isPhoneActive) return;
    setGrandpa(prev => ({ ...prev, isPhoneRinging: true }));
    setTimeout(() => {
        const phoneState: GrandpaState = { ...grandpa, isPhoneRinging: false, isHandRaised: true, isPhoneActive: true };
        setGrandpa(phoneState);
        startSession(currentVoice, phoneState);
    }, 1500);
  };

  const handleHangUp = () => {
    const newState = { ...grandpa, isHandRaised: false, isPhoneActive: false, isPhoneRinging: false };
    setGrandpa(newState);
    if (isSessionActive) startSession(currentVoice, newState);
  };

  const switchLocation = (loc: Location) => {
    const newState = { ...grandpa, location: loc, isPhoneActive: false, isPhoneRinging: false, isHandRaised: false, isSleeping: loc === 'bedroom' ? !grandpa.isLanternOn : false };
    setGrandpa(newState);
    if (isSessionActive) startSession(currentVoice, newState);
  };

  return (
    <div className={`min-h-screen bg-rose-50 flex flex-col items-center justify-between p-4 transition-all duration-300`}>
      <header className="w-full max-w-2xl flex justify-between items-center py-4 z-20">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-rose-800 game-font">TALKING <span className="text-amber-700">GRANDPA</span></h1>
          <button onClick={() => setShowUpdates(!showUpdates)} className="flex items-center gap-1 bg-white/80 px-3 py-1 rounded-full text-xs font-bold text-rose-600 shadow-sm border border-rose-100 hover:bg-rose-100 transition-colors">
            <Layers size={14} /> UPDATES
          </button>
        </div>
        <div className="flex items-center gap-2">
            <select value={currentVoice} onChange={(e) => { setCurrentVoice(e.target.value); if(isSessionActive) startSession(e.target.value); }} className="bg-white/80 p-2 rounded-xl text-xs font-bold shadow-sm border border-rose-100 outline-none">
                {AVAILABLE_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
        </div>
      </header>

      {showUpdates && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border-4 border-rose-200">
                <h2 className="text-2xl font-black text-rose-800 game-font text-center mb-6">VERSIONS</h2>
                <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[60vh]">
                    <VersionBtn ver="0.0" label="Alpha Head" icon={<CircleHelp />} onClick={() => setVersion('0.0')} color="bg-gray-200" />
                    <VersionBtn ver="1.0" label="Original Grandpa" icon={<Zap />} onClick={() => setVersion('1.0')} color="bg-rose-100" />
                    <VersionBtn ver="2.0" label="Christmas Santa" icon={<Snowflake />} onClick={() => setVersion('2.0')} color="bg-green-100" />
                    <VersionBtn ver="3.0" label="Halloween Spooky" icon={<Ghost />} onClick={() => setVersion('3.0')} color="bg-orange-100" />
                    <VersionBtn ver="4.0" label="Sleep Room" icon={<Moon />} onClick={() => setVersion('4.0')} color="bg-indigo-100" />
                </div>
                <button onClick={() => setShowUpdates(false)} className="mt-4 w-full py-3 bg-rose-600 text-white font-black rounded-2xl">CLOSE</button>
            </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-lg flex flex-col justify-center relative">
        {!isSessionActive ? (
          <div className="text-center space-y-6">
            <Grandpa state={grandpa} onPoke={() => {}} voice={currentVoice} />
            <button onClick={() => startSession()} className="bg-rose-600 text-white px-10 py-5 rounded-full shadow-2xl font-black text-2xl hover:scale-110 active:scale-95 transition-transform flex items-center gap-2 mx-auto">
              <Play fill="currentColor" size={24} /> {grandpa.theme === 'v0' ? 'ASK QUESTION' : 'START GAME'}
            </button>
          </div>
        ) : (
          <Grandpa state={grandpa} onPoke={() => {}} onToggleLantern={handleToggleLantern} voice={currentVoice} />
        )}
      </main>

      {grandpa.theme !== 'v0' && (
        <footer className="w-full max-w-2xl bg-white/95 rounded-t-3xl p-6 shadow-2xl border-t border-rose-100 z-20">
          <div className="grid grid-cols-5 gap-2">
              <ActionButton icon={<Home />} label="Living" color="bg-rose-500" onClick={() => switchLocation('livingRoom')} disabled={!isSessionActive} />
              <ActionButton icon={<Utensils />} label="Kitchen" color="bg-orange-500" onClick={() => switchLocation('kitchen')} disabled={!isSessionActive} />
              <ActionButton icon={<Sun />} label="Outside" color="bg-green-500" onClick={() => switchLocation('outside')} disabled={!isSessionActive} />
              {grandpa.location === 'livingRoom' && (
                grandpa.isPhoneActive ? 
                <ActionButton icon={<PhoneOff />} label="End Call" color="bg-gray-800" onClick={handleHangUp} disabled={!isSessionActive} /> :
                <ActionButton icon={<Phone />} label="Phone" color="bg-red-600" onClick={handlePhoneCall} disabled={!isSessionActive} />
              )}
              <ActionButton icon={grandpa.isLanternOn ? <Moon /> : <Lightbulb />} label="Sleep" color="bg-indigo-600" onClick={() => setVersion('4.0')} disabled={!isSessionActive} />
              <ActionButton icon={<MicOff />} label="Exit" color="bg-red-400" onClick={() => stopSession(false)} disabled={!isSessionActive} />
          </div>
        </footer>
      )}
      
      {grandpa.theme === 'v0' && isSessionActive && (
        <div className="fixed bottom-10 z-30">
           <button onClick={() => stopSession(false)} className="bg-gray-800 text-white p-4 rounded-full shadow-xl">
             <MicOff />
           </button>
        </div>
      )}
    </div>
  );
};

const VersionBtn = ({ ver, label, icon, onClick, color }: any) => (
    <button onClick={onClick} className={`flex items-center gap-3 p-4 ${color} rounded-2xl hover:scale-[1.02] transition-transform w-full`}>
        <div className="text-rose-600">{icon}</div>
        <div className="flex flex-col items-start">
            <span className="text-[10px] uppercase font-black opacity-60">Update {ver}</span>
            <span className="font-bold text-rose-900">{label}</span>
        </div>
    </button>
);

const ActionButton = ({ icon, label, color, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} className={`${color} text-white flex flex-col items-center justify-center p-3 rounded-2xl shadow-lg transition-all active:scale-90 ${disabled ? 'opacity-30 grayscale' : 'hover:-translate-y-1'}`}>
        {icon} <span className="text-[10px] uppercase font-black mt-1">{label}</span>
    </button>
);

export default App;
