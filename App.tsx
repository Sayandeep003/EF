import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Users, 
  TrendingUp, 
  Lock, 
  BrainCircuit, 
  ChevronUp,
  ChevronDown,
  ArrowDown
} from 'lucide-react';

// ===================== SHADER COMPONENTS =====================
const InteractiveShader = ({
  flowSpeed = 0.15, 
  colorIntensity = 1.1,
  noiseLayers = 4.0,
  mouseInfluence = 0.2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL is not supported in this browser.");
      return;
    }

    const vertexShaderSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec2 iMouse;
      uniform float uFlowSpeed;
      uniform float uColorIntensity;
      uniform float uNoiseLayers;
      uniform float uMouseInfluence;

      #define MARCH_STEPS 32

      float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p+45.32);
          return fract(p.x*p.y);
      }

      float fbm(vec3 p) {
          float f = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 8; i++) {
              if (float(i) >= uNoiseLayers) break;
              f += amp * hash(p.xy);
              p *= 2.0;
              amp *= 0.5;
          }
          return f;
      }

      float map(vec3 p) {
          vec3 q = p;
          q.z += iTime * uFlowSpeed;
          vec2 mouse = (iMouse.xy / iResolution.xy - 0.5) * 2.0;
          q.xy += mouse * uMouseInfluence;
          float f = fbm(q * 2.0);
          f *= sin(p.y * 2.0 + iTime) * 0.5 + 0.5;
          return clamp(f, 0.0, 1.0);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
        vec3 ro = vec3(0, -1, 0);
        vec3 rd = normalize(vec3(uv, 1.0));
        vec3 col = vec3(0);
        float t = 0.0;
        
        for (int i=0; i<MARCH_STEPS; i++) {
            vec3 p = ro + rd * t;
            float density = map(p);
            if (density > 0.0) {
                // Mystic aurora: deep purples, teals, soft whites
                vec3 auroraColor = 0.5 + 0.5 * cos(iTime * 0.2 + p.y * 2.0 + vec3(4.0, 2.0, 1.0));
                col += auroraColor * density * 0.12 * uColorIntensity;
            }
            t += 0.15;
        }
        
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      iResolution: gl.getUniformLocation(program, "iResolution"),
      iTime: gl.getUniformLocation(program, "iTime"),
      iMouse: gl.getUniformLocation(program, "iMouse"),
      uFlowSpeed: gl.getUniformLocation(program, "uFlowSpeed"),
      uColorIntensity: gl.getUniformLocation(program, "uColorIntensity"),
      uNoiseLayers: gl.getUniformLocation(program, "uNoiseLayers"),
      uMouseInfluence: gl.getUniformLocation(program, "uMouseInfluence")
    };

    const startTime = performance.now();
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
        mousePos.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    };
    window.addEventListener('mousemove', handleMouseMove);

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.uniform2f(uniforms.iResolution, gl.canvas.width, gl.canvas.height);
    };
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const renderLoop = () => {
      if (!gl || gl.isContextLost()) return;
      gl.uniform1f(uniforms.iTime, (performance.now() - startTime) / 1000.0);
      gl.uniform2f(uniforms.iMouse, mousePos.current.x * canvas.width, (1.0 - mousePos.current.y) * canvas.height);
      gl.uniform1f(uniforms.uFlowSpeed, flowSpeed);
      gl.uniform1f(uniforms.uColorIntensity, colorIntensity);
      gl.uniform1f(uniforms.uNoiseLayers, noiseLayers);
      gl.uniform1f(uniforms.uMouseInfluence, mouseInfluence);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [flowSpeed, colorIntensity, noiseLayers, mouseInfluence]);

  return (
    <div className="fixed inset-0 z-0 w-full h-full bg-[#050508]" aria-hidden>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/70" />
    </div>
  );
};

// ===================== UI COMPONENTS =====================

const NewspaperClippings = () => {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-40 pointer-events-none mix-blend-overlay z-0 flex items-center justify-center">
      <div className="absolute top-[15%] left-[5%] rotate-[-12deg] bg-[#f4f1ea] text-black p-5 rounded-sm shadow-2xl max-w-xs font-serif">
        <h3 className="font-bold text-xl mb-2 border-b-2 border-black pb-1 leading-tight">The Silent Epidemic</h3>
        <p className="text-sm font-medium">Why 75% of those suffering from extreme distress choose to face it entirely alone...</p>
      </div>
      <div className="absolute top-[65%] left-[10%] rotate-[8deg] bg-[#f4f1ea] text-black p-5 rounded-sm shadow-2xl max-w-sm font-serif">
        <h3 className="font-bold text-2xl mb-1 leading-tight">Cost of Care Soars</h3>
        <p className="text-base font-bold italic border-t border-black pt-2 mt-2">Therapy waitlists hit 18 months in some regions. Who can wait?</p>
      </div>
      <div className="absolute top-[25%] right-[5%] rotate-[15deg] bg-[#f4f1ea] text-black p-6 rounded-sm shadow-2xl max-w-xs font-serif">
        <h3 className="font-bold text-3xl uppercase mb-2 border-b-4 border-black text-red-700">Exposed!</h3>
        <p className="text-sm font-medium">Data brokers selling mental health app info. Forums leak identities. Where is the safe middle ground?</p>
      </div>
    </div>
  );
};

// ===================== SLIDES =====================

const Slide1 = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-6 relative z-10 w-full max-w-6xl mx-auto">
    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-5 py-2 backdrop-blur-xl mb-10 shadow-lg">
      <Lock className="w-4 h-4 text-emerald-400" />
      <span className="text-sm font-medium tracking-widest text-white/90 uppercase">Confidential Pitch • Group 7</span>
    </div>
    
    <h1 className="text-7xl md:text-[9rem] font-light tracking-tight text-white mb-8 drop-shadow-2xl">
      Cloak<span className="text-emerald-400">.</span>
    </h1>
    
    <p className="text-2xl md:text-4xl font-light text-white max-w-3xl leading-relaxed drop-shadow-md bg-black/20 px-6 py-4 rounded-2xl backdrop-blur-sm border border-white/5">
      Anonymous support for life's hardest moments.
    </p>

    <div className="absolute bottom-12 animate-bounce flex flex-col items-center opacity-60">
      <span className="text-sm uppercase tracking-widest mb-2 font-semibold">Scroll Down</span>
      <ArrowDown className="w-5 h-5" />
    </div>
  </div>
);

const Slide2 = () => (
  <div className="flex flex-col justify-center h-full max-w-6xl mx-auto px-6 relative z-10 w-full">
    <NewspaperClippings />
    
    <div className="relative z-10 bg-black/60 backdrop-blur-2xl p-10 rounded-3xl border border-white/10 shadow-2xl">
      <h2 className="text-4xl md:text-5xl font-light text-white mb-4 drop-shadow-lg">
        The silence is not a personal failure. <br />
        <span className="font-semibold text-emerald-400">It's a market failure.</span>
      </h2>
      <p className="text-xl text-white/90 mb-12 max-w-3xl font-light">
        Existing solutions force an impossible choice between your wallet and your privacy. Life crises demand expert guidance urgently, but stigma stops people from asking.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl">
          <div className="text-6xl font-bold text-white mb-4">75%</div>
          <h3 className="text-xl font-medium text-white mb-2">Receive No Treatment</h3>
          <p className="text-sm text-white/70 font-medium leading-relaxed">of people with a mental health problem suffer in complete silence due to stigma and fear.</p>
        </div>
        
        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl">
          <div className="text-6xl font-bold text-white mb-4">12<span className="text-4xl text-white/60">+ mo</span></div>
          <h3 className="text-xl font-medium text-white mb-2">Wait to Seek Help</h3>
          <p className="text-sm text-white/70 font-medium leading-relaxed">The average time before a person in crisis reaches out to a professional due to lack of accessible options.</p>
        </div>

        <div className="bg-emerald-900/30 border border-emerald-500/30 p-8 rounded-2xl ring-1 ring-emerald-500/20">
          <div className="text-6xl font-bold text-white mb-4">0</div>
          <h3 className="text-xl font-medium text-emerald-300 mb-2">Privacy Options</h3>
          <p className="text-sm text-white/80 font-medium leading-relaxed">Reddit is 100% public. Generic AI lacks accountability. Apps demand your identity and data.</p>
        </div>
      </div>
    </div>
  </div>
);

const Slide3 = () => (
  <div className="flex flex-col justify-center h-full max-w-7xl mx-auto px-6 relative z-10 w-full">
    <div className="bg-black/60 backdrop-blur-2xl p-10 rounded-3xl border border-white/10 shadow-2xl">
      <h2 className="text-4xl md:text-5xl font-light text-white mb-2 drop-shadow-lg">
        One platform. Three layers.
      </h2>
      <p className="text-2xl font-semibold text-emerald-400 mb-12 drop-shadow-md">
        Zero identity required.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-colors">
          <div className="h-14 w-14 rounded-full bg-black/50 border border-white/20 flex items-center justify-center mb-6 shadow-inner">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-2xl font-medium text-white mb-4">1. Anonymous Profile</h3>
          <ul className="text-white/80 font-medium space-y-3">
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> No name, no email, no judgment.</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Choose category: Mental health, financial, legal, relationship.</li>
          </ul>
        </div>
        
        <div className="bg-emerald-900/20 border border-emerald-500/30 p-8 rounded-2xl hover:bg-emerald-900/40 transition-colors relative overflow-hidden ring-1 ring-emerald-500/20">
          <div className="absolute top-0 right-0 bg-emerald-500/20 px-4 py-1.5 rounded-bl-xl border-b border-l border-emerald-500/30">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Start Here</span>
          </div>
          <div className="h-14 w-14 rounded-full bg-black/50 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-inner">
            <BrainCircuit className="w-7 h-7 text-emerald-300" />
          </div>
          <h3 className="text-2xl font-medium text-white mb-4">2. AI Triage</h3>
          <ul className="text-white/80 font-medium space-y-3">
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Immediate, 24/7 context-aware guidance.</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> <strong className="text-emerald-300">Free tier: 5 chats per day</strong></li>
          </ul>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-colors">
          <div className="h-14 w-14 rounded-full bg-black/50 border border-white/20 flex items-center justify-center mb-6 shadow-inner">
            <Users className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-2xl font-medium text-white mb-4">3. Human Escalate</h3>
          <ul className="text-white/80 font-medium space-y-3">
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Paid consultations with verified human experts (£30-£150).</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Access peer communities facing the exact same challenge.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

const Slide4 = () => (
  <div className="flex flex-col justify-center h-full max-w-6xl mx-auto px-6 relative z-10 w-full">
    <div className="bg-black/60 backdrop-blur-2xl p-10 rounded-3xl border border-white/10 shadow-2xl">
      <h2 className="text-4xl md:text-5xl font-light text-white mb-4 drop-shadow-lg">
        We are not fighting for the people already seeking help.
      </h2>
      <p className="text-xl text-emerald-400 mb-12 font-medium">
        We are building for the silent majority. The market no one has touched.
      </p>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-12 bg-white/5 p-8 rounded-2xl border border-white/10">
        <div className="flex-1 text-center">
          <div className="text-5xl font-bold text-white mb-2">16M</div>
          <div className="text-sm text-white/70 uppercase tracking-wide font-semibold">UK Adults in Need / Year</div>
        </div>
        <div className="text-4xl text-white/30 font-light hidden md:block">×</div>
        <div className="flex-1 text-center">
          <div className="text-5xl font-bold text-emerald-400 mb-2">1%</div>
          <div className="text-sm text-emerald-400/70 uppercase tracking-wide font-semibold">Conservative Capture</div>
        </div>
        <div className="text-4xl text-white/30 font-light hidden md:block">=</div>
        <div className="flex-1 text-center relative">
          <div className="text-5xl font-bold text-white mb-2">£23M</div>
          <div className="text-sm text-white/90 uppercase tracking-wide font-bold">ARR (from £12/mo Subs)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-xl"><TrendingUp className="w-6 h-6 text-emerald-400" /></div>
          <div>
            <h4 className="text-xl font-semibold text-white mb-2">Marketplace Upside</h4>
            <p className="text-white/70 font-medium leading-relaxed">
              The £23M ARR excludes our <strong>20% commission</strong> on expert consultations (£30-£150/session), which scales continuously with usage.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-xl"><TrendingUp className="w-6 h-6 text-emerald-400" /></div>
          <div>
            <h4 className="text-xl font-semibold text-white mb-2">£5B+ App Market</h4>
            <p className="text-white/70 font-medium leading-relaxed">
              Growing at 16% per year. The technology (mature AI triage, proven anonymity tech) allows this solution to exist <em>today</em>.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Slide5 = () => (
  <div className="flex flex-col justify-center h-full max-w-6xl mx-auto px-6 relative z-10 w-full">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-stretch">
      
      {/* The Ask */}
      <div className="bg-black/60 backdrop-blur-2xl p-10 rounded-3xl border border-emerald-500/30 shadow-2xl flex flex-col justify-center">
        <h2 className="text-4xl font-light text-white mb-2">Funding Round 1</h2>
        <p className="text-5xl font-bold text-emerald-400 mb-8">£40,000</p>
        
        <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">90-Day Milestones</h3>
        <ul className="space-y-5 mb-8">
          <li className="flex items-start gap-4">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-emerald-400 font-bold text-sm">1</span>
            </div>
            <span className="text-white/90 font-medium text-lg leading-tight">Launch MVP <br/><span className="text-sm text-white/60 font-normal">Free AI Triage & 3 crisis categories</span></span>
          </li>
          <li className="flex items-start gap-4">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-emerald-400 font-bold text-sm">2</span>
            </div>
            <span className="text-white/90 font-medium text-lg leading-tight">Prove Trust <br/><span className="text-sm text-white/60 font-normal">Acquire 500 active beta users</span></span>
          </li>
          <li className="flex items-start gap-4">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-emerald-400 font-bold text-sm">3</span>
            </div>
            <span className="text-white/90 font-medium text-lg leading-tight">Prove Value <br/><span className="text-sm text-white/60 font-normal">Average 3+ sessions per user</span></span>
          </li>
        </ul>
        <p className="text-white/50 text-sm font-medium italic bg-white/5 p-4 rounded-xl">Round 2 (£200K) unlocks once we prove users will be vulnerable on the platform.</p>
      </div>

      {/* The Team */}
      <div className="bg-black/60 backdrop-blur-2xl p-10 rounded-3xl border border-white/10 shadow-2xl flex flex-col justify-center">
        <h2 className="text-4xl font-light text-white mb-8 border-b border-white/10 pb-6">
          Team <span className="font-semibold">Cloak</span>
        </h2>
        
        <div className="grid grid-cols-2 gap-y-8 gap-x-6">
          <div className="flex flex-col bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xl font-semibold text-white">Lipi Ahuja</span>
            <span className="text-sm text-emerald-400 font-medium mt-1">Founder</span>
          </div>
          <div className="flex flex-col bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xl font-semibold text-white">Ankit Kumar</span>
            <span className="text-sm text-emerald-400 font-medium mt-1">Founder</span>
          </div>
          <div className="flex flex-col bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xl font-semibold text-white">Kashvi Goyal</span>
            <span className="text-sm text-emerald-400 font-medium mt-1">Founder</span>
          </div>
          <div className="flex flex-col bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xl font-semibold text-white">Sayandeep Pal</span>
            <span className="text-sm text-emerald-400 font-medium mt-1">Founder</span>
          </div>
          <div className="flex flex-col bg-white/5 p-4 rounded-xl border border-white/5 col-span-2 items-center text-center">
            <span className="text-xl font-semibold text-white">Manan Garg</span>
            <span className="text-sm text-emerald-400 font-medium mt-1">Founder</span>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Warwick Business School • Group 7</span>
        </div>
      </div>

    </div>
  </div>
);

// ===================== MAIN APP =====================

const PITCH_NOTES = [
  "HOOK: Cloak is an anonymous support platform that helps people facing life's hardest moments—mental health crises, financial distress, legal trouble, relationship breakdown—get real guidance without revealing who they are.",
  "PROBLEM: Every year, millions of people hit a crisis point and do nothing. Not because help doesn't exist, but because asking for it feels too risky. 75% of people with a mental health problem receive no treatment. The average wait is over a year. Therapy is expensive. Reddit is 100% public. Generic AI offers zero accountability. There is no safe, affordable, anonymous middle ground.",
  "SOLUTION: Cloak gives people three layers of support with zero identity required. 1. You create an anonymous profile. 2. You start with AI-powered triage—free up to 5 chats a day for immediate panic. 3. If you need more, you escalate to a verified human expert for a paid consultation. One platform. Three layers. Absolute privacy.",
  "MARKET: Sizing this bottom-up: In the UK alone, 16 million adults experience a mental health problem each year. At £12 a month for premium, capturing just 1% of that base yields £23 million in ARR. That's before our 20% commission on expert sessions. The mental health app market is £5B+. We aren't competing for the comfortable—we are building for the silent majority.",
  "TEAM & ASK: We are Group 7 from Warwick Business School. We are raising an initial £40,000. This gets us to MVP launch and proves our biggest assumption: getting 500 active beta users completing 3 or more sessions within 90 days. We have the right market, the right timing, and the right model. We are Cloak."
];

export default function PresentationApp() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  // Track which slide is visible to update the notes and indicator
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setCurrentSlide(index);
          }
        });
      },
      { threshold: 0.5 } // Trigger when slide is 50% visible
    );

    document.querySelectorAll('.slide-section').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-sans selection:bg-emerald-500/30">
      <InteractiveShader />
      
      {/* SCROLLABLE SNAP CONTAINER */}
      <div className="absolute inset-0 z-10 overflow-y-auto snap-y snap-mandatory scroll-smooth pb-32">
        <section data-index={0} className="slide-section w-full min-h-screen snap-center flex items-center justify-center py-20 relative">
          <Slide1 />
        </section>
        <section data-index={1} className="slide-section w-full min-h-screen snap-center flex items-center justify-center py-20 relative">
          <Slide2 />
        </section>
        <section data-index={2} className="slide-section w-full min-h-screen snap-center flex items-center justify-center py-20 relative">
          <Slide3 />
        </section>
        <section data-index={3} className="slide-section w-full min-h-screen snap-center flex items-center justify-center py-20 relative">
          <Slide4 />
        </section>
        <section data-index={4} className="slide-section w-full min-h-screen snap-center flex items-center justify-center py-20 relative">
          <Slide5 />
        </section>
      </div>

      {/* Progress Dots Indicator (Right side) */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 pointer-events-none">
        {[0, 1, 2, 3, 4].map((idx) => (
          <div 
            key={idx} 
            className={`w-2.5 rounded-full transition-all duration-300 ${currentSlide === idx ? 'h-10 bg-emerald-400' : 'h-2.5 bg-white/20'}`} 
          />
        ))}
      </div>

      {/* Speaker Notes Drawer (Bottom) */}
      <div 
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-5xl bg-black/90 backdrop-blur-2xl border-t border-x border-white/20 rounded-t-3xl transition-transform duration-500 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${showNotes ? 'translate-y-0' : 'translate-y-[calc(100%-3.5rem)]'}`}
      >
        <button 
          onClick={() => setShowNotes(!showNotes)}
          className="w-full flex items-center justify-center gap-3 py-4 text-white/70 hover:text-emerald-400 transition-colors"
        >
          {showNotes ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          <span className="text-sm font-bold uppercase tracking-widest">
            {showNotes ? 'Hide Speaker Notes' : `Show Speaker Notes (Slide ${currentSlide + 1})`}
          </span>
        </button>
        <div className="px-10 pt-4 pb-12">
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-3">What to say:</h4>
            <p className="text-xl font-medium leading-relaxed text-white/90">
              {PITCH_NOTES[currentSlide]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
