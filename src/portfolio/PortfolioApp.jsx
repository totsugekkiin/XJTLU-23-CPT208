import { FeltCard } from "./FeltCard.jsx";
import {
  Users,
  Lightbulb,
  Code2,
  ClipboardCheck,
  Search,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Table as TableIcon,
  MessageSquare,
} from "lucide-react";
import { motion } from "motion/react";

export default function PortfolioApp() {
  return (
    <div className="min-h-screen px-4 py-12 md:px-8 lg:px-24 font-sans selection:bg-[#d15a24] selection:text-white">
      <div className="fixed top-4 left-4 right-4 z-50 flex flex-wrap items-center justify-between gap-2">
        <a
          href="index.html"
          className="inline-flex items-center px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider bg-white/95 felt-stitch felt-shadow rounded-sm hover:bg-[#2d4a3e] hover:text-white transition-colors"
        >
          ← 返回主页
        </a>
        <a
          href="appMain.html"
          className="inline-flex items-center px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider bg-white/95 felt-stitch felt-shadow rounded-sm hover:bg-[#d15a24] hover:text-white transition-colors"
        >
          阊门 →
        </a>
      </div>

      <header className="max-w-4xl mx-auto mb-20 relative">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10"
        >
          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none mb-4 text-[#1a1a1a]">
            Process <br />
            <span className="text-[#2d4a3e] flex items-center gap-4">
              Portfolio
              <div className="h-4 w-4 rounded-full bg-[#d15a24] mt-4" />
            </span>
          </h1>
          <FeltCard color="orange" className="inline-block px-4 py-1 -rotate-2 mb-8" rotate={-2}>
            <p className="text-xl font-bold uppercase tracking-widest text-center">Development Journey</p>
          </FeltCard>
        </motion.div>

        <div className="absolute top-0 right-0 text-6xl opacity-10 font-mono -rotate-12 hidden md:block">
          {"{</>}"}
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-32">
        <section id="motivation" className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5 space-y-6">
            <FeltCard color="green" rotate={1} id="section-1-badge">
              <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                <Search size={24} /> 01. Research
              </h2>
            </FeltCard>

            <FeltCard className="md:mt-12" rotate={-1}>
              <h3 className="text-xl font-bold mb-4">The Why</h3>
              <p className="text-sm leading-relaxed text-gray-700">
                Our group chose the <b>Heritage Track</b> because existing digital archives often feel cold
                and inaccessible. We wanted to bridge the gap between traditional history and modern
                interactive experiences, creating a playful portal into the Suzhou Grand Canal&apos;s
                forgotten stories. Our focus is on making culture feel &quot;tangible&quot; through digital
                means.
              </p>
            </FeltCard>
          </div>

          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeltCard rotate={1} className="sm:mt-20">
              <h3 className="text-lg font-bold mb-3 underline decoration-[#d15a24] decoration-2">Academic Gap</h3>
              <ul className="text-xs space-y-3 font-mono">
                <li>• Paper A: Strong theory, weak UI</li>
                <li>• Paper B: Tech-heavy, low empathy</li>
                <li>• App X: Playful but inaccurate</li>
                <li>• App Y: Accurate but boring</li>
              </ul>
            </FeltCard>
            <FeltCard color="cream" rotate={-2}>
              <Users className="mb-2 text-[#d15a24]" />
              <h3 className="text-lg font-bold mb-2">Stakeholders</h3>
              <div className="space-y-4">
                <div className="p-3 bg-white/50 rounded felt-stitch">
                  <p className="text-xs font-bold font-mono">PRIMARY: Student Lu</p>
                  <p className="text-[10px]">Wants bite-sized facts for research projects.</p>
                </div>
                <div className="p-3 bg-white/50 rounded felt-stitch">
                  <p className="text-xs font-bold font-mono">SECONDARY: Tourist Ken</p>
                  <p className="text-[10px]">Needs location-based storytelling on the go.</p>
                </div>
              </div>
            </FeltCard>
          </div>
        </section>

        <section id="requirements" className="relative">
          <div className="absolute -top-10 right-0 z-0 opacity-10">
            <Users size={200} />
          </div>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
            <FeltCard className="h-full" rotate={-0.5}>
              <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
                <ClipboardCheck size={24} className="text-[#d15a24]" /> 02. Requirements
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Playfulness Must-Haves
                  </h3>
                  <ul className="list-disc list-inside text-sm pl-2 space-y-1">
                    <li>Dynamic visual feedback on discovery</li>
                    <li>Hidden &quot;Easter Eggs&quot; in historical maps</li>
                    <li>Stitch-style UI elements that invite touch</li>
                  </ul>
                </div>
                <div className="border-t border-dashed border-gray-200 pt-4">
                  <h3 className="font-bold mb-2">Evidence of Life</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="aspect-square bg-gray-100 rounded felt-stitch flex items-center justify-center text-[10px] text-gray-400 font-mono"
                      >
                        PHOTO_{i}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FeltCard>

            <FeltCard color="orange" rotate={1} className="flex flex-col justify-center">
              <h3 className="text-xl font-bold mb-4">Journey Mapping</h3>
              <p className="text-sm opacity-90 mb-4 italic">
                &quot;I wish I could see what this bridge looked like 200 years ago without reading a 50-page
                PDF.&quot;
              </p>
              <div className="flex justify-between items-center px-4">
                <div className="text-center">
                  <div className="w-8 h-8 rounded-full bg-white text-orange-600 flex items-center justify-center mx-auto mb-1 text-xs font-bold">
                    1
                  </div>
                  <p className="text-[10px]">Curiosity</p>
                </div>
                <ArrowRight size={16} />
                <div className="text-center">
                  <div className="w-8 h-8 rounded-full bg-white text-orange-600 flex items-center justify-center mx-auto mb-1 text-xs font-bold">
                    2
                  </div>
                  <p className="text-[10px]">Discovery</p>
                </div>
                <ArrowRight size={16} />
                <div className="text-center">
                  <div className="w-8 h-8 rounded-full bg-white text-orange-600 flex items-center justify-center mx-auto mb-1 text-xs font-bold">
                    3
                  </div>
                  <p className="text-[10px]">Delight</p>
                </div>
              </div>
            </FeltCard>
          </div>
        </section>

        <section id="ideation" className="space-y-8">
          <div className="flex items-end gap-4 overflow-hidden">
            <FeltCard color="green" className="rotate-3 -mb-2" rotate={3}>
              <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                <Lightbulb size={24} /> 03. Ideation
              </h2>
            </FeltCard>
            <div className="flex-1 border-b-4 border-dashed border-[#2d4a3e] opacity-20" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeltCard className="md:col-span-2" rotate={-0.5}>
              <h3 className="font-bold mb-4 flex items-center gap-2">Crazy Eights & Sketches</h3>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] bg-[#f4f1ea] felt-stitch flex items-center justify-center"
                  >
                    <span className="text-[8px] font-mono opacity-20">SKETCH_{i + 1}</span>
                  </div>
                ))}
              </div>
            </FeltCard>
            <FeltCard color="cream" rotate={2}>
              <h3 className="font-bold mb-4">Alternatives</h3>
              <div className="space-y-4 text-xs">
                <div className="border-l-2 border-[#d15a24] pl-3">
                  <p className="font-bold">Option A: VR Experience</p>
                  <p className="opacity-70">Too expensive for users.</p>
                </div>
                <div className="border-l-2 border-[#2d4a3e] pl-3">
                  <p className="font-bold">Option B: Web Portal</p>
                  <p className="opacity-70 font-bold text-[#2d4a3e]">CONSENSUS: Best Accessibility.</p>
                </div>
              </div>
              <a
                href="#"
                className="mt-8 block w-full py-2 bg-[#1a1a1a] text-white text-center rounded felt-shadow text-xs font-bold tracking-widest hover:bg-[#d15a24] transition-colors"
              >
                VIEW FIGMA PROTOTYPE
              </a>
            </FeltCard>
          </div>
        </section>

        <section id="technical" className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8">
            <FeltCard className="h-full" rotate={-1}>
              <h2 className="text-2xl font-black uppercase mb-8 flex items-center gap-2">
                <Code2 size={24} className="text-blue-600" /> 04. Technical
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <GitBranch size={16} /> Architecture
                  </h3>
                  <div className="p-4 bg-gray-50 felt-stitch font-mono text-[10px] space-y-2">
                    <div className="border border-gray-300 p-2 text-center uppercase">User Client (React)</div>
                    <div className="flex justify-center">↓</div>
                    <div className="border border-gray-300 p-2 text-center uppercase">API Layer (Node/Vite)</div>
                    <div className="flex justify-center">↓</div>
                    <div className="border border-gray-300 p-2 text-center uppercase">Cloud Storage / Gemini API</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <TableIcon size={16} /> Contributions
                  </h3>
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left pb-2">Member</th>
                        <th className="text-left pb-2">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="py-2 font-bold">Alice</td>
                        <td className="py-2">UI & Frontend</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">Bob</td>
                        <td className="py-2">Back-end & AI</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">Charlie</td>
                        <td className="py-2">UX & Testing</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">Dani</td>
                        <td className="py-2">Content Strategy</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </FeltCard>
          </div>
          <FeltCard color="orange" className="md:col-span-4" rotate={2}>
            <div className="h-full flex flex-col justify-center text-center">
              <Code2 className="mx-auto mb-4" size={48} />
              <p className="font-black text-2xl uppercase mb-2 leading-none">LIVE PORTAL</p>
              <p className="text-[10px] mb-6 opacity-80 font-mono underline">project.github.io/final-app</p>
              <div className="w-full aspect-video bg-black/20 rounded felt-stitch" />
            </div>
          </FeltCard>
        </section>

        <section id="evaluation" className="pb-24">
          <div className="max-w-4xl mx-auto space-y-8">
            <FeltCard color="green" className="inline-block" rotate={-1}>
              <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                <ClipboardCheck size={24} /> 05. Evaluation
              </h2>
            </FeltCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FeltCard rotate={0.5}>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <MessageSquare size={16} /> Alpha Feedback
                </h3>
                <div className="space-y-4">
                  <div className="text-xs bg-[#f4f1ea] p-3 rounded italic border-l-4 border-gray-300">
                    &quot;The map is cool but I got lost in the submenus. Need a home button.&quot;
                  </div>
                  <p className="text-xs font-mono font-bold text-[#d15a24]">
                    REFINE: [Added Global Navigation Pins]
                  </p>
                </div>
              </FeltCard>
              <FeltCard rotate={-1}>
                <h3 className="font-bold mb-4 italic">Before & After</h3>
                <div className="flex gap-2">
                  <div className="flex-1 aspect-square bg-red-50 felt-stitch text-[9px] p-2 flex items-center justify-center text-center uppercase">
                    Old Grid Layout (Messy)
                  </div>
                  <div className="flex-1 aspect-square bg-green-50 felt-stitch text-[9px] p-2 flex items-center justify-center text-center uppercase">
                    New Felt Grid (Structured)
                  </div>
                </div>
              </FeltCard>
            </div>

            <FeltCard color="cream" rotate={0.2} className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d15a24] opacity-5 -mr-16 -mt-16 rounded-full" />
              <h3 className="text-xl font-bold mb-4">Final Reflection</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                This project highlighted the delicate balance between historical accuracy and user agency.
                By using Generative AI for content synthesis, we saved time but had to implement a strict
                human-in-the-loop verification process. Ethically, we prioritized giving voice to
                marginalized canal boat communities who rarely appear in traditional archives.
              </p>
            </FeltCard>
          </div>
        </section>
      </main>

      <footer className="mt-20 py-12 border-t-2 border-dashed border-[#1a1a1a] opacity-20 flex justify-between items-center px-4 font-mono text-[10px]">
        <p>© 2026 Process Portfolio Group</p>
        <p>Built with Felt & code</p>
      </footer>
    </div>
  );
}
