import { FeltCard } from "./FeltCard.jsx";
import { ArchDiagram } from "./ArchDiagram.jsx";
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
  BookOpen,
  Tag,
  ExternalLink,
  GitFork,
  PenTool,
  Globe,
  Video,
  XCircle,
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
        <section id="overview" className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5 space-y-6">
            <FeltCard color="green" rotate={-1} id="section-0-badge">
              <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                <BookOpen size={24} /> 00. Project Overview
              </h2>
            </FeltCard>

            <FeltCard rotate={1} className="md:mt-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-3">Project Title</p>
              <h3 className="text-xl md:text-2xl font-black uppercase leading-tight mb-6">
                Chang Gate: Playful &amp; Immersive Heritage Experience
              </h3>

              <div className="space-y-3 mb-6">
                <p className="text-xs font-bold flex items-center gap-2 text-gray-600">
                  <Tag size={14} className="text-[#2d4a3e]" /> Track
                </p>
                <FeltCard color="orange" className="inline-block px-3 py-1.5 -rotate-1" rotate={-1}>
                  <p className="text-xs font-bold uppercase tracking-wide">Cultural heritage dissemination</p>
                </FeltCard>
              </div>

              <div className="border-t border-dashed border-gray-200 pt-5">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#2d4a3e] mb-2">
                  One-sentence Pitch
                </p>
                <p className="text-sm leading-relaxed text-gray-700">
                  Chang Gate is a playful and immersive heritage web experience that helps visitors explore Suzhou&apos;s Chang Gate through interactive storytelling, visual reconstruction, personalized routes, and engaging historical interactions.
                </p>
              </div>
            </FeltCard>
          </div>

          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeltCard color="cream" rotate={2} className="sm:col-span-2 sm:mt-6">
              <Users className="mb-2 text-[#d15a24]" />
              <h3 className="text-lg font-bold mb-1">Team Members</h3>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 mb-4">A1-6</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {["Jiayang Pang", "Jiaqi Fu", "Jiaming Gong", "Wenbin Ding"].map((name) => (
                  <div key={name} className="p-3 bg-white/50 rounded felt-stitch">
                    <p className="text-xs font-bold font-mono">{name}</p>
                  </div>
                ))}
              </div>
            </FeltCard>

            <FeltCard color="orange" rotate={-1} className="sm:col-span-2">
              <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                <ExternalLink size={20} /> Quick Links
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="https://changgate.vercel.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded bg-white text-[#1a1a1a] felt-shadow felt-stitch text-xs font-bold hover:bg-[#2d4a3e] hover:text-white transition-colors"
                >
                  <Globe size={18} className="shrink-0" />
                  <span className="text-left leading-snug">High-fi / Hosted Website</span>
                </a>
                <a
                  href="https://github.com/totsugekkiin/XJTLU-23-CPT208"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded bg-white text-[#1a1a1a] felt-shadow felt-stitch text-xs font-bold hover:bg-[#2d4a3e] hover:text-white transition-colors"
                >
                  <GitFork size={18} className="shrink-0" />
                  <span className="text-left leading-snug">GitHub / Source Code</span>
                </a>
                <a
                  href="https://www.figma.com/site/4gy7f2MvbMXyQow0V27y6R/Chang_Gate_A1-6?node-id=0-1&p=f"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded bg-white text-[#1a1a1a] felt-shadow felt-stitch text-xs font-bold hover:bg-[#2d4a3e] hover:text-white transition-colors"
                >
                  <PenTool size={18} className="shrink-0" />
                  <span className="text-left leading-snug">Figma Low-fi Prototype</span>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 px-4 py-3 rounded bg-white text-[#1a1a1a] felt-shadow felt-stitch text-xs font-bold hover:bg-[#2d4a3e] hover:text-white transition-colors"
                >
                  <Video size={18} className="shrink-0" />
                  <span className="text-left leading-snug">Demo Video</span>
                </a>
              </div>
            </FeltCard>
          </div>
        </section>

        <section id="motivation" className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5 space-y-6">
            <FeltCard color="green" rotate={1} id="section-1-badge">
              <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                <Search size={24} /> 01. Research
              </h2>
            </FeltCard>

            <FeltCard className="md:mt-12" rotate={-1}>
              <h3 className="text-xl font-bold mb-4">The Why</h3>
              <div className="text-sm leading-relaxed text-gray-700 space-y-4">
                <p>
                  We chose the Heritage track because Chang Gate is not only an important historical site in Suzhou, but also a place where many visitors struggle to connect with its deeper cultural meaning. Although Chang Gate was once one of the eight gates of ancient Suzhou and a key commercial and cultural entrance to the city, parts of its historical structure, such as the inner barbican, no longer exist today. As a result, visitors can see the site physically, but may find it difficult to imagine its original scale, historical function, and relationship with the city&apos;s past.
                </p>
                <p>
                  From our early field visit and questionnaire results, we found that many tourists are interested in history, but traditional heritage interpretation methods can feel passive, fragmented, or boring. Static signs, scattered information, and text-heavy explanations do not fully support curiosity, emotional engagement, or self-guided exploration. At the same time, visitors have different needs: some want quick and simple photo-based interactions, some need accessible guidance, while others prefer deeper historical content.
                </p>
                <p>
                  Therefore, our project aims to turn Chang Gate into a more playful and immersive learning experience. By combining visual reconstruction, interactive characters, personalized routes, and storytelling-based interaction, we hope to help visitors not only &quot;see&quot; Chang Gate, but also understand, remember, and emotionally engage with its history.
                </p>
              </div>
            </FeltCard>
          </div>

          <div className="md:col-span-7 space-y-4">
            <FeltCard rotate={1} className="sm:mt-12">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-2">The Gap</p>
              <h3 className="text-xl font-bold mb-4 underline decoration-[#d15a24] decoration-2 underline-offset-4">
                What current heritage communication is missing
              </h3>
              <p className="text-sm leading-relaxed text-gray-700">
                Based on our review of academic research and existing heritage-related websites, current heritage
                communication already provides useful foundations, but still lacks a <b>playful, user-centred, and
                immersive</b> way to help visitors understand Chang Gate.
              </p>
            </FeltCard>

            <FeltCard color="cream" rotate={-0.5}>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#2d4a3e] mb-3">
                Existing Products · Quick Audit
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/60 rounded felt-stitch space-y-3">
                  <h4 className="text-sm font-black uppercase flex items-center gap-2 text-[#2d4a3e]">
                    <CheckCircle2 size={16} /> 3 Things They Did Well
                  </h4>
                  <ol className="space-y-3 text-[12px] leading-snug list-decimal list-outside pl-4">
                    <li>
                      <p className="font-bold mb-1">Strong heritage restoration and spatial planning</p>
                      <p className="text-gray-700">
                        Existing projects, especially the Suzhou Ancient City Wall restoration work, show that
                        physical heritage can be repaired and planned together with surrounding landscapes,
                        walking routes, riverside spaces, and viewing points. This helps visitors feel the
                        historical atmosphere of the city more directly.
                      </p>
                    </li>
                    <li>
                      <p className="font-bold mb-1">Rich historical and cultural content</p>
                      <p className="text-gray-700">
                        Some existing websites provide comprehensive background information. For example, the
                        Fengqiao Night Mooring website includes history, poetry, cultural stories, maps, and local
                        canal-related content. Suzhou Museum also organizes its collections into categories and
                        provides digital collection displays.
                      </p>
                    </li>
                    <li>
                      <p className="font-bold mb-1">Use of digital and visual presentation methods</p>
                      <p className="text-gray-700">
                        Existing products already experiment with digital formats such as VR tours, panoramic
                        viewing, 3D collection displays, and online heritage introductions. These methods make
                        cultural sites more accessible beyond the physical visit and offer useful references for
                        our own web-based design.
                      </p>
                    </li>
                  </ol>
                </div>

                <div className="p-4 bg-white/60 rounded felt-stitch space-y-3">
                  <h4 className="text-sm font-black uppercase flex items-center gap-2 text-[#d15a24]">
                    <XCircle size={16} /> 3 Things They Missed
                  </h4>
                  <ol className="space-y-3 text-[12px] leading-snug list-decimal list-outside pl-4">
                    <li>
                      <p className="font-bold mb-1">Text-heavy and not interactive enough</p>
                      <p className="text-gray-700">
                        Many heritage websites explain history through long blocks of text. This may be useful for
                        professional or highly interested audiences, but for casual tourists it can feel difficult
                        to read, especially during or after a short offline visit. The information exists, but
                        users are not actively guided to explore it.
                      </p>
                    </li>
                    <li>
                      <p className="font-bold mb-1">Storytelling lacks immersion and emotional engagement</p>
                      <p className="text-gray-700">
                        Although some websites include historical background and cultural stories, the
                        presentation often remains static. Users read about the past, but they do not feel like
                        they are entering the historical scene or interacting with people, places, and events from
                        that time. This makes it harder to build curiosity and memory.
                      </p>
                    </li>
                    <li>
                      <p className="font-bold mb-1">Lack of playful, personalized, site-based exploration</p>
                      <p className="text-gray-700">
                        Existing platforms usually present the same content to all visitors. They rarely adapt to
                        different user types, such as casual photo-taking tourists, elderly visitors, or history
                        enthusiasts. They also do not fully connect online interaction with the visitor&apos;s
                        real movement around the heritage site. This creates an opportunity for our project to
                        design a playful system with visual reconstruction, character-based storytelling,
                        personalized routes, and interactive historical tasks.
                      </p>
                    </li>
                  </ol>
                </div>
              </div>
            </FeltCard>

            <FeltCard color="green" rotate={-1}>
              <h3 className="text-lg font-black uppercase mb-3 flex items-center gap-2">
                <Search size={18} /> Academic Gap
              </h3>
              <div className="space-y-3 text-sm leading-relaxed text-white/90">
                <p>
                  Academic research shows that digital heritage should not only preserve information, but also
                  connect virtual space with real historical sites, upgrade static explanation into immersive
                  storytelling, and encourage users to become active participants instead of passive viewers.
                  However, existing digital heritage projects often still focus on storing or displaying cultural
                  materials, while weaker areas include <b>narrative design, audience interaction, and recognizable
                  cultural IP</b>.
                </p>
                <p>
                  Research on contemporary heritage communication also emphasizes the importance of technology,
                  emotional storytelling, and younger forms of expression, which supports our decision to design a
                  more engaging web-based experience.
                </p>
                <p>
                  For Suzhou-related heritage, previous studies gave us useful references. The Suzhou Ancient City
                  Wall Projects show that restoration and planning around city walls, gates, riverside walking
                  spaces, and scenic routes can successfully strengthen the historical atmosphere of the city. The
                  study of Changmen Historical and Cultural Block also highlights the value of activating both
                  physical elements (city walls, streets, historical buildings) and intangible elements (traditional
                  crafts and folk activities).
                </p>
              </div>
            </FeltCard>

            <FeltCard rotate={0.5}>
              <h3 className="text-lg font-black uppercase mb-3 flex items-center gap-2">
                <Globe size={18} className="text-[#d15a24]" /> Product Gap
              </h3>
              <p className="text-sm leading-relaxed text-gray-700">
                Commercial products such as the <b>Suzhou Museum</b> website, the <b>Humble Administrator&apos;s
                Garden</b> VR tour, the <b>Fengqiao Night Mooring</b> introduction website, and <b>Shantang
                Street</b> VR/introduction pages show that many heritage platforms already contain rich historical
                information, image resources, virtual tours, and cultural background materials. For example, the
                Fengqiao website includes sections such as classical poetry, historical development, human stories,
                hand-drawn maps, canal culture, and local food, while the Suzhou Garden platform provides 720°
                virtual tours.
              </p>
            </FeltCard>

            <FeltCard color="cream" rotate={-1}>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#2d4a3e] mb-3">References</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase mb-2 flex items-center gap-2">
                    <BookOpen size={14} className="text-[#d15a24]" /> 4 Papers
                  </h4>
                  <ol className="text-[11px] leading-snug space-y-2 font-mono list-decimal list-outside pl-4">
                    <li>Wang Xinyan. Research on media memory reconstruction and digital communication innovation of historical and cultural heritage: A case study of Henan Yin-Shang cultural heritage[J]. Journal of Shangqiu Normal University, 2025, 41(8): 102–108.</li>
                    <li>Xu Haijun. Contemporary narratives of historical and cultural heritage: Protection, inheritance, and innovation: Reflections based on publicity and reporting practices in China Culture Daily[J]. Chinese Journalist, 2025(7): 37–40.</li>
                    <li>Suzhou Ancient City Wall Series Projects[J]. Landscape Architecture, 2022(S1): 147–149.</li>
                    <li>Zhang Shengmei. Conservation and renewal of Changmen Historical and Cultural Block guided by urban catalyst theory[J]. Shanxi Architecture, 2024(2): 79–81.</li>
                  </ol>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase mb-2 flex items-center gap-2">
                    <Globe size={14} className="text-[#2d4a3e]" /> 4 Commercial Products
                  </h4>
                  <ol className="text-[11px] leading-snug space-y-2 font-mono list-decimal list-outside pl-4">
                    <li>
                      Suzhou Museum Website{" "}
                      <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://www.szmuseum.com/" target="_blank" rel="noreferrer">
                        szmuseum.com
                      </a>
                    </li>
                    <li>
                      Suzhou Gardens · Humble Administrator&apos;s Garden{" "}
                      <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://web.lotsmall.cn/index?m_id=1939" target="_blank" rel="noreferrer">
                        web.lotsmall.cn
                      </a>
                    </li>
                    <li>
                      Ten Views of the Grand Canal · Night Mooring at Maple Bridge{" "}
                      <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://yhsj.jssvc.edu.cn/fengqiaoyebo/fengqiaoyebojianjie/" target="_blank" rel="noreferrer">
                        yhsj.jssvc.edu.cn
                      </a>
                    </li>
                    <li>
                      Shantang Street Introduction{" "}
                      <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://www.gerenjianli.com/area/suzhou/014rcplc.htm" target="_blank" rel="noreferrer">
                        gerenjianli.com
                      </a>{" "}
                      ·{" "}
                      <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://www.sds-vr.com/show/358" target="_blank" rel="noreferrer">
                        sds-vr.com
                      </a>
                    </li>
                  </ol>
                </div>
              </div>
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

        <section id="requirements" className="relative space-y-8">
          <div className="absolute -top-10 right-0 z-0 opacity-10">
            <Users size={200} />
          </div>

          <FeltCard className="relative z-10" rotate={-0.5}>
            <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
              <ClipboardCheck size={24} className="text-[#d15a24]" /> 02. Requirements
            </h2>

            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-lg font-black uppercase">User Journey Map</h3>
              <div className="flex-1 border-b-2 border-dashed border-[#1a1a1a] opacity-15" />
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-6">
              From arrival to reflection — the visitor&apos;s emotional path through Chang Gate
            </p>

            <div className="hidden md:block">
              <svg
                role="img"
                aria-label="User Journey Map: Arrive at Chang Gate, Interact with Web Site, End the Tour"
                viewBox="0 0 1200 460"
                className="w-full h-auto"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g fontFamily="ui-sans-serif, system-ui, sans-serif">
                  <g>
                    <rect x="20" y="210" width="200" height="56" rx="12" fill="#1a1a1a" />
                    <text x="120" y="244" textAnchor="middle" fill="#ffffff" fontSize="17" fontWeight="800">
                      User Journey Map
                    </text>
                  </g>

                  <path d="M 220 238 H 280" stroke="#e57373" strokeWidth="2.5" fill="none" />
                  <g>
                    <rect x="280" y="212" width="180" height="52" rx="10" fill="none" stroke="#e57373" strokeWidth="2.5" />
                    <text x="370" y="244" textAnchor="middle" fill="#1a1a1a" fontSize="14" fontWeight="700">
                      Arrive at Chang Gate
                    </text>
                  </g>

                  <path d="M 340 212 V 130 H 410" stroke="#e57373" strokeWidth="2.5" fill="none" />
                  <text x="422" y="124" fill="#1a1a1a" fontSize="13" fontWeight="700">
                    Feelings: Confused
                  </text>
                  <text x="422" y="156" fill="#1a1a1a" fontSize="12" fontWeight="600">
                    <tspan x="422" dy="0">No guider and don&apos;t know the</tspan>
                    <tspan x="422" dy="16">stories behind the ancient buildings.</tspan>
                  </text>

                  <path d="M 460 238 H 540" stroke="#f4a259" strokeWidth="2.5" fill="none" />
                  <g>
                    <rect x="540" y="212" width="200" height="52" rx="10" fill="none" stroke="#f4a259" strokeWidth="2.5" />
                    <text x="640" y="244" textAnchor="middle" fill="#1a1a1a" fontSize="14" fontWeight="700">
                      Interact with Web Site
                    </text>
                  </g>

                  <path d="M 610 264 V 340 H 680" stroke="#f4a259" strokeWidth="2.5" fill="none" />
                  <text x="692" y="334" fill="#1a1a1a" fontSize="13" fontWeight="700">
                    Feelings: Curious
                  </text>
                  <text x="692" y="366" fill="#1a1a1a" fontSize="12" fontWeight="600">
                    <tspan x="692" dy="0">Reading history stories and</tspan>
                    <tspan x="692" dy="16">interacting with AI guider.</tspan>
                  </text>

                  <path d="M 740 238 H 820" stroke="#5fb6a8" strokeWidth="2.5" fill="none" />
                  <g>
                    <rect x="820" y="212" width="140" height="52" rx="10" fill="none" stroke="#5fb6a8" strokeWidth="2.5" />
                    <text x="890" y="244" textAnchor="middle" fill="#1a1a1a" fontSize="14" fontWeight="700">
                      End the Tour
                    </text>
                  </g>

                  <path d="M 890 212 V 130 H 970" stroke="#5fb6a8" strokeWidth="2.5" fill="none" />
                  <text x="982" y="124" fill="#1a1a1a" fontSize="13" fontWeight="700">
                    Feelings: Satisfied and Engaged
                  </text>
                  <text x="982" y="156" fill="#1a1a1a" fontSize="12" fontWeight="600">
                    Wanting to share and learn more.
                  </text>
                </g>
              </svg>
            </div>

            <div className="md:hidden">
              <div className="inline-flex px-4 py-2 rounded-md bg-[#1a1a1a] text-white text-xs font-black uppercase tracking-wider mb-4">
                User Journey Map
              </div>
              <ol className="relative pl-5 space-y-5">
                <span className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#e57373] via-[#f4a259] to-[#5fb6a8]" aria-hidden="true" />

                <li className="relative">
                  <span className="absolute -left-3.5 top-1.5 w-3 h-3 rounded-full bg-[#e57373]" aria-hidden="true" />
                  <div className="rounded-md border-2 border-[#e57373] px-3 py-2 mb-2">
                    <p className="text-sm font-bold">Arrive at Chang Gate</p>
                  </div>
                  <p className="text-xs font-bold text-[#1a1a1a]">Feelings: Confused</p>
                  <p className="text-xs text-gray-700 leading-snug">
                    No guider and don&apos;t know the stories behind the ancient buildings.
                  </p>
                </li>

                <li className="relative">
                  <span className="absolute -left-3.5 top-1.5 w-3 h-3 rounded-full bg-[#f4a259]" aria-hidden="true" />
                  <div className="rounded-md border-2 border-[#f4a259] px-3 py-2 mb-2">
                    <p className="text-sm font-bold">Interact with Web Site</p>
                  </div>
                  <p className="text-xs font-bold text-[#1a1a1a]">Feelings: Curious</p>
                  <p className="text-xs text-gray-700 leading-snug">
                    Reading history stories and interacting with AI guider.
                  </p>
                </li>

                <li className="relative">
                  <span className="absolute -left-3.5 top-1.5 w-3 h-3 rounded-full bg-[#5fb6a8]" aria-hidden="true" />
                  <div className="rounded-md border-2 border-[#5fb6a8] px-3 py-2 mb-2">
                    <p className="text-sm font-bold">End the Tour</p>
                  </div>
                  <p className="text-xs font-bold text-[#1a1a1a]">Feelings: Satisfied and Engaged</p>
                  <p className="text-xs text-gray-700 leading-snug">Wanting to share and learn more.</p>
                </li>
              </ol>
            </div>
          </FeltCard>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
            <FeltCard className="h-full" rotate={-0.5}>
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Must-haves
                  </h3>
                  <ol className="list-decimal list-inside text-sm pl-2 space-y-1">
                    <li>Immersive Historical Storytelling and Interactive Content</li>
                    <li>Playful Visual Interaction and Engagement</li>
                    <li>Site-Based Visitor Tools</li>
                  </ol>
                </div>
                <div className="border-t border-dashed border-gray-200 pt-4">
                  <h3 className="font-bold mb-2">Evidence of Life</h3>
                  <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wider mb-3">
                    Field visit + interview notes from Chang Gate
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {[
                      {
                        src: "images/portfolio/evidence-gate.png",
                        alt: "Chang Gate city tower from the street",
                        caption: "On the city wall",
                      },
                      {
                        src: "images/portfolio/evidence-citywall.png",
                        alt: "Visitors walking on the city wall toward the gate tower",
                        caption: "Heritage marker stone",
                      },
                      {
                        src: "images/portfolio/evidence-stele.png",
                        alt: "Heritage marker stone: Chang Gate Site, Suzhou Cultural Heritage Unit",
                        caption: "Chang Gate city tower",
                      },
                      {
                        src: "images/portfolio/evidence-interview.png",
                        alt: "Field interview notes about visitors at Chang Gate",
                        caption: "Interview notes",
                      },
                      {
                        src: "images/portfolio/evidence-wallview.png",
                        alt: "View from the city wall: white-walled, black-tiled Suzhou rooftops stretching toward Chang Gate",
                        caption: "View from the wall",
                      },
                    ].map((it) => (
                      <figure key={it.src} className="rounded felt-stitch overflow-hidden bg-gray-100">
                        <div className="aspect-square overflow-hidden">
                          <img src={it.src} alt={it.alt} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        <figcaption className="px-2 py-1 text-[10px] font-mono text-gray-600 truncate">
                          {it.caption}
                        </figcaption>
                      </figure>
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
              <h3 className="font-bold mb-4 flex items-center gap-2">Crazy Eights &amp; Sketches</h3>
              <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wider mb-3">
                8 minutes · 8 ideas — early divergent thinking before convergence
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { src: "images/portfolio/crazy8-1.png", caption: "01 · Cover page" },
                  { src: "images/portfolio/crazy8-2.png", caption: "02 · Map + audio history" },
                  { src: "images/portfolio/crazy8-3.png", caption: "03 · Heritage info & photos" },
                  { src: "images/portfolio/crazy8-4.png", caption: "04 · River & boat intro" },
                  { src: "images/portfolio/crazy8-5.png", caption: "05 · AI guide: \"I will guide you\"" },
                  { src: "images/portfolio/crazy8-6.png", caption: "06 · Photo + year timeline" },
                  { src: "images/portfolio/crazy8-7.png", caption: "07 · Pet / agent flow" },
                  { src: "images/portfolio/crazy8-8.png", caption: "08 · Chang Gate · GO" },
                ].map((it, i) => (
                  <figure
                    key={it.src}
                    className="bg-[#f4f1ea] felt-stitch overflow-hidden"
                    style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 0.6}deg)` }}
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-white">
                      <img
                        src={it.src}
                        alt={it.caption}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <figcaption className="px-1.5 py-1 text-[9px] font-mono text-gray-600 truncate">
                      {it.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </FeltCard>
            <FeltCard color="cream" rotate={2}>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-1">3.2</p>
              <h3 className="font-bold mb-4">Design Alternatives</h3>
              <div className="space-y-4 text-xs">
                <div className="border-l-2 border-[#d15a24] pl-3">
                  <p className="font-bold">1 · Section-Based Display</p>
                  <p className="opacity-70 leading-snug">
                    Divide the website into clear sections, such as old photos, historical materials, and
                    visitor information.
                  </p>
                </div>
                <div className="border-l-2 border-[#1a1a1a] pl-3">
                  <p className="font-bold">2 · Embedded 3D Architectural Model</p>
                  <p className="opacity-70 leading-snug">
                    The website would include a 3D model of Chang Gate or its historical structures, allowing
                    users to rotate and view the building from different angles.
                  </p>
                </div>
                <div className="border-l-2 border-[#2d4a3e] pl-3">
                  <p className="font-bold">3 · Mobile-Friendly Storytelling Experience</p>
                  <p className="opacity-70 leading-snug">
                    The website would present Chang Gate&apos;s history through a scroll-based storytelling
                    format, combining timeline, images, short text, characters, and interactive elements.
                  </p>
                  <p className="font-bold text-[#2d4a3e] mt-1">CONSENSUS: Chosen direction.</p>
                </div>
              </div>

              <div className="mt-6 p-3 bg-white/60 rounded felt-stitch">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#2d4a3e] mb-1">
                  Why we chose 3
                </p>
                <p className="text-xs leading-snug text-gray-700">
                  It makes Chang Gate&apos;s history more attractive and easier to understand. A section-based
                  layout would be clear but not immersive, while a 3D model would be difficult to build and may
                  make the website too heavy to load smoothly. In comparison, a storytelling-based design allows
                  us to use existing historical photos, visual materials, timelines, and interactive components
                  in a more lightweight and engaging way.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-dashed border-[#1a1a1a]/20">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-1">3.3</p>
                <p className="text-sm font-bold mb-2">Low-Fi Prototype</p>
                <p className="text-xs text-gray-700 leading-snug mb-3">
                  Early Figma wireframes that turn the chosen storytelling direction into concrete screens —
                  cover, timeline, river journey, AI guide, and gate close-ups.
                </p>
              </div>

              <a
                href="https://www.figma.com/site/4gy7f2MvbMXyQow0V27y6R/Chang_Gate_A1-6?node-id=0-1&p=f"
                target="_blank"
                rel="noreferrer"
                className="mt-2 block w-full py-2 bg-[#1a1a1a] text-white text-center rounded felt-shadow text-xs font-bold tracking-widest hover:bg-[#d15a24] transition-colors"
              >
                VIEW FIGMA PROTOTYPE
              </a>
            </FeltCard>
          </div>
        </section>

        <section id="technical" className="space-y-8">
          <div className="flex items-end gap-4 overflow-hidden">
            <FeltCard color="green" className="rotate-1 -mb-2" rotate={-1}>
              <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                <Code2 size={24} /> 04. Technical Implementation
              </h2>
            </FeltCard>
            <div className="flex-1 border-b-4 border-dashed border-[#2d4a3e] opacity-20" />
          </div>

          <FeltCard rotate={-0.5}>
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-lg font-black uppercase flex items-center gap-2">
                <GitBranch size={18} className="text-[#d15a24]" /> 4.1 System Architecture
              </h3>
              <div className="flex-1 border-b-2 border-dashed border-[#1a1a1a] opacity-15" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">how the web app handles data</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 mb-6">
              Chang Gate is a <b>Vite multi-page static web app</b>: each HTML entry boots its own React tree. As soon
              as the immersive <i>appMain</i> page finishes its first paint, the React shell lazy-imports{" "}
              <code className="font-mono text-[11px]">js/appmain.js</code> and calls{" "}
              <code className="font-mono text-[11px]">bootstrapAppMain()</code> — this wires up the desktop pet (PIXI),
              the river canvas, and the scroll director in one go. Only the heavier <b>RouteSection / AMap</b> mount is
              deferred further, until the visitor actually scrolls into the river page, to avoid loading the WebGL map
              tiles up front. Map and AI features run through two external services —{" "}
              <b>AMap (Web JS API 2.0)</b> for routing and a <b>Vercel serverless function</b>{" "}
              (<code className="font-mono text-[11px]">/api/chat</code>) that proxies requests to the{" "}
              <b>Zhipu GLM-4-Flash</b> chat completions endpoint, keeping the API key off the client.
            </p>

            <ArchDiagram />

            <details className="mt-6 group">
              <summary className="cursor-pointer text-[11px] font-mono font-bold uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] flex items-center gap-1.5 select-none">
                <span className="inline-block transition-transform group-open:rotate-90">▸</span>
                Reference · static SVG layer view
              </summary>

            <div className="hidden md:block mt-3 bg-[#f4f1ea] felt-stitch rounded-sm p-4 overflow-hidden">
              <svg
                role="img"
                aria-label="System architecture diagram: browser, multi-page Vite app, lazy-loaded modules, serverless chat proxy, third-party services"
                viewBox="0 0 1200 640"
                className="w-full h-auto"
                xmlns="http://www.w3.org/2000/svg"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="#1a1a1a" />
                  </marker>
                  <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="#d15a24" />
                  </marker>
                  <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="#2d4a3e" />
                  </marker>
                </defs>

                <g>
                  <text x="20" y="36" fontSize="11" fontWeight="800" fill="#1a1a1a" letterSpacing="1.5">CLIENT · BROWSER</text>
                  <rect x="20" y="46" width="1160" height="2" fill="#1a1a1a" opacity="0.15" />

                  <rect x="40" y="70" width="1120" height="80" rx="10" fill="#ffffff" stroke="#1a1a1a" strokeWidth="2" strokeDasharray="6 4" />
                  <text x="60" y="98" fontSize="13" fontWeight="800" fill="#1a1a1a">Visitor (Desktop / Mobile)</text>
                  <text x="60" y="118" fontSize="11" fill="#1a1a1a">·  Scroll-driven storytelling   ·  Tap to drag pet   ·  Tap a route to plan walk</text>
                  <text x="60" y="136" fontSize="11" fill="#1a1a1a">·  Loads four entry pages: index.html · appMain.html · map.html · portfolio.html</text>
                </g>

                <line x1="600" y1="150" x2="600" y2="180" stroke="#1a1a1a" strokeWidth="2" markerEnd="url(#arrow)" />

                <g>
                  <text x="20" y="200" fontSize="11" fontWeight="800" fill="#1a1a1a" letterSpacing="1.5">PRESENTATION · VITE MULTI-PAGE APP (STATIC)</text>
                  <rect x="20" y="210" width="1160" height="2" fill="#1a1a1a" opacity="0.15" />

                  <rect x="40" y="225" width="265" height="135" rx="8" fill="#ffffff" stroke="#2d4a3e" strokeWidth="2" />
                  <text x="55" y="248" fontSize="12" fontWeight="800" fill="#2d4a3e">index.html · Landing</text>
                  <text x="55" y="268" fontSize="10" fill="#1a1a1a">React 18 + Tailwind v4</text>
                  <text x="55" y="284" fontSize="10" fill="#1a1a1a">HomePage / team / persona</text>
                  <text x="55" y="312" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">src/entries/index.jsx</text>

                  <rect x="320" y="225" width="265" height="135" rx="8" fill="#ffffff" stroke="#d15a24" strokeWidth="2.5" />
                  <text x="335" y="248" fontSize="12" fontWeight="800" fill="#d15a24">appMain.html · Story</text>
                  <text x="335" y="268" fontSize="10" fill="#1a1a1a">React shell + lazy bootstrap</text>
                  <text x="335" y="284" fontSize="10" fill="#1a1a1a">framer-motion · lucide-react</text>
                  <text x="335" y="312" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">src/pages/AppMainPage.jsx</text>
                  <text x="335" y="326" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">→ bootstrapAppMain()</text>

                  <rect x="600" y="225" width="265" height="135" rx="8" fill="#ffffff" stroke="#2d4a3e" strokeWidth="2" />
                  <text x="615" y="248" fontSize="12" fontWeight="800" fill="#2d4a3e">map.html · Standalone</text>
                  <text x="615" y="268" fontSize="10" fill="#1a1a1a">RouteSection</text>
                  <text x="615" y="284" fontSize="10" fill="#1a1a1a">AMap loader + walking plan</text>
                  <text x="615" y="312" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">src/pages/MapPage.jsx</text>

                  <rect x="880" y="225" width="280" height="135" rx="8" fill="#ffffff" stroke="#2d4a3e" strokeWidth="2" />
                  <text x="895" y="248" fontSize="12" fontWeight="800" fill="#2d4a3e">portfolio.html · This page</text>
                  <text x="895" y="268" fontSize="10" fill="#1a1a1a">React + Tailwind v4</text>
                  <text x="895" y="284" fontSize="10" fill="#1a1a1a">motion/react · lucide-react</text>
                  <text x="895" y="312" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">src/portfolio/PortfolioApp.jsx</text>
                </g>

                <line x1="452" y1="360" x2="452" y2="395" stroke="#d15a24" strokeWidth="2.5" markerEnd="url(#arrow-orange)" />
                <text x="462" y="378" fontSize="10" fontStyle="italic" fill="#d15a24">await import(&apos;js/appmain.js&apos;) — fired right after first paint of appMain page</text>
                <text x="462" y="392" fontSize="10" fontStyle="italic" fill="#d15a24">(RouteSection / AMap is the only piece deferred until the river page is reached)</text>

                <g>
                  <text x="20" y="415" fontSize="11" fontWeight="800" fill="#1a1a1a" letterSpacing="1.5">EXPERIENCE LAYER · LAZY-LOADED LEGACY MODULES (js/appmain/*)</text>
                  <rect x="20" y="425" width="1160" height="2" fill="#1a1a1a" opacity="0.15" />

                  <rect x="40" y="440" width="220" height="90" rx="8" fill="#fff7ee" stroke="#d15a24" strokeWidth="1.5" />
                  <text x="55" y="462" fontSize="11" fontWeight="800" fill="#1a1a1a">Scroll Director</text>
                  <text x="55" y="480" fontSize="10" fill="#1a1a1a">scrollMaskZoom · curtain</text>
                  <text x="55" y="496" fontSize="10" fill="#1a1a1a">GSAP timelines + native scroll</text>
                  <text x="55" y="518" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">scrollMaskZoom.js</text>

                  <rect x="275" y="440" width="220" height="90" rx="8" fill="#fff7ee" stroke="#d15a24" strokeWidth="1.5" />
                  <text x="290" y="462" fontSize="11" fontWeight="800" fill="#1a1a1a">River Scene</text>
                  <text x="290" y="480" fontSize="10" fill="#1a1a1a">Canvas 2D + GSAP boat</text>
                  <text x="290" y="496" fontSize="10" fill="#1a1a1a">Pixel water + island cards</text>
                  <text x="290" y="518" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">riverScene.js</text>

                  <rect x="510" y="440" width="220" height="90" rx="8" fill="#fff7ee" stroke="#d15a24" strokeWidth="1.5" />
                  <text x="525" y="462" fontSize="11" fontWeight="800" fill="#1a1a1a">Desktop Pet</text>
                  <text x="525" y="480" fontSize="10" fill="#1a1a1a">PIXI.js sprite + state machine</text>
                  <text x="525" y="496" fontSize="10" fill="#1a1a1a">Drag · target observer · chat</text>
                  <text x="525" y="518" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">js/appmain/pet/*</text>

                  <rect x="745" y="440" width="220" height="90" rx="8" fill="#fff7ee" stroke="#d15a24" strokeWidth="1.5" />
                  <text x="760" y="462" fontSize="11" fontWeight="800" fill="#1a1a1a">Route Section</text>
                  <text x="760" y="480" fontSize="10" fill="#1a1a1a">React island in story page</text>
                  <text x="760" y="496" fontSize="10" fill="#1a1a1a">Mounts AMap WebGL map</text>
                  <text x="760" y="518" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">RouteSection.jsx</text>

                  <rect x="980" y="440" width="180" height="90" rx="8" fill="#f4f1ea" stroke="#1a1a1a" strokeWidth="1.5" strokeDasharray="4 3" />
                  <text x="995" y="462" fontSize="11" fontWeight="800" fill="#1a1a1a">Static Assets</text>
                  <text x="995" y="480" fontSize="10" fill="#1a1a1a">images/ · fonts</text>
                  <text x="995" y="496" fontSize="10" fill="#1a1a1a">timeline · pet sprites</text>
                  <text x="995" y="518" fontSize="9" fontFamily="ui-monospace, monospace" fill="#666">public/images/</text>
                </g>

                <line x1="620" y1="530" x2="620" y2="565" stroke="#2d4a3e" strokeWidth="2.5" markerEnd="url(#arrow-green)" />
                <line x1="855" y1="530" x2="855" y2="565" stroke="#2d4a3e" strokeWidth="2.5" markerEnd="url(#arrow-green)" />
                <text x="320" y="555" fontSize="10" fontStyle="italic" fill="#2d4a3e">fetch (POST JSON)</text>
                <text x="870" y="555" fontSize="10" fontStyle="italic" fill="#2d4a3e">HTTPS · JSONP / REST</text>

                <g>
                  <text x="20" y="585" fontSize="11" fontWeight="800" fill="#1a1a1a" letterSpacing="1.5">EDGE / EXTERNAL SERVICES</text>
                  <rect x="20" y="595" width="1160" height="2" fill="#1a1a1a" opacity="0.15" />

                  <rect x="450" y="565" width="340" height="60" rx="8" fill="#2d4a3e" />
                  <text x="465" y="588" fontSize="11" fontWeight="800" fill="#ffffff">Vercel Serverless · /api/chat</text>
                  <text x="465" y="605" fontSize="10" fill="#ffffff">Hides API key · proxies to Zhipu GLM-4-Flash</text>
                  <text x="465" y="619" fontSize="9" fontFamily="ui-monospace, monospace" fill="#cdd8d2">api/chat.js</text>

                  <rect x="800" y="565" width="180" height="60" rx="8" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1.5" />
                  <text x="815" y="588" fontSize="11" fontWeight="800" fill="#1a1a1a">AMap Web API 2.0</text>
                  <text x="815" y="605" fontSize="10" fill="#1a1a1a">Tiles + AMap.Walking</text>

                  <rect x="990" y="565" width="170" height="60" rx="8" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1.5" />
                  <text x="1005" y="588" fontSize="11" fontWeight="800" fill="#1a1a1a">Zhipu BigModel</text>
                  <text x="1005" y="605" fontSize="10" fill="#1a1a1a">glm-4-flash chat API</text>

                  <line x1="790" y1="595" x2="990" y2="595" stroke="#1a1a1a" strokeWidth="1.5" strokeDasharray="3 3" />
                  <text x="845" y="588" fontSize="9" fontStyle="italic" fill="#666"></text>
                </g>

                <path d="M 790 595 Q 900 555 990 595" stroke="#2d4a3e" strokeWidth="2" fill="none" strokeDasharray="4 3" markerEnd="url(#arrow-green)" />
              </svg>
            </div>

            <div className="md:hidden mt-3 space-y-3">
              <p className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">Layered view (top → bottom)</p>
              <ol className="space-y-2 text-xs">
                {[
                  { tag: "Client", desc: "Visitor's browser. Loads one of four HTML entries." },
                  { tag: "Pages", desc: "index · appMain · map · portfolio — each is a React tree built by Vite." },
                  { tag: "Lazy modules", desc: "appMain awaits import('js/appmain.js') right after first paint, then bootstraps the pet, river canvas and scroll director. The AMap RouteSection is the only piece deferred until the visitor scrolls into the river page." },
                  { tag: "Serverless", desc: "/api/chat (Vercel) hides the LLM key and forwards prompts to Zhipu GLM-4-Flash." },
                  { tag: "Third-party", desc: "AMap Web API 2.0 for the walking route; static images served from public/images/." },
                ].map((row) => (
                  <li key={row.tag} className="p-2 bg-[#f4f1ea] felt-stitch rounded-sm">
                    <span className="inline-block px-1.5 py-0.5 bg-[#1a1a1a] text-white text-[9px] font-mono uppercase mr-2 align-middle">
                      {row.tag}
                    </span>
                    <span className="leading-snug">{row.desc}</span>
                  </li>
                ))}
              </ol>
            </div>
            </details>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { k: "Build", v: "Vite 5 (multi-page)" },
                { k: "UI", v: "React 18 · Tailwind v4" },
                { k: "Motion", v: "GSAP · framer-motion" },
                { k: "Render", v: "PIXI.js · Canvas 2D" },
                { k: "Map", v: "AMap JS API 2.0" },
                { k: "AI Proxy", v: "Vercel Serverless" },
                { k: "LLM", v: "Zhipu GLM-4-Flash" },
                { k: "Hosting", v: "Vercel (static + /api)" },
              ].map((it) => (
                <div key={it.k} className="p-2 bg-white felt-stitch rounded-sm">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#d15a24]">{it.k}</p>
                  <p className="text-[11px] font-bold leading-tight">{it.v}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t-2 border-dashed border-[#1a1a1a]/15">
              <div className="mb-4 flex items-center gap-2">
                <h4 className="text-base font-black uppercase flex items-center gap-2">
                  <GitBranch size={16} className="text-[#2d4a3e]" /> Data Flow · how a question reaches the LLM and returns
                </h4>
                <div className="flex-1 border-b-2 border-dashed border-[#1a1a1a] opacity-15" />
              </div>
              <p className="text-sm leading-relaxed text-gray-700 mb-5">
                Two representative flows live in the app: the <b>pet-chat round-trip</b> (browser → serverless proxy →
                Zhipu) and the <b>walking-route lookup</b> (browser → AMap directly via JSONP). The diagram below shows
                the exact endpoints, payload shape, and where the API key actually lives.
              </p>

              <div className="hidden md:block bg-[#f4f1ea] felt-stitch rounded-sm p-4 overflow-hidden">
                <svg
                  role="img"
                  aria-label="Sequence diagram of two data flows: pet chat through serverless proxy to Zhipu, and walking route directly to AMap"
                  viewBox="0 0 1200 720"
                  className="w-full h-auto"
                  xmlns="http://www.w3.org/2000/svg"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  <defs>
                    <marker id="seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 z" fill="#1a1a1a" />
                    </marker>
                    <marker id="seq-arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 z" fill="#d15a24" />
                    </marker>
                    <marker id="seq-arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 z" fill="#2d4a3e" />
                    </marker>
                  </defs>

                  <g>
                    <rect x="60" y="20" width="200" height="50" rx="8" fill="#1a1a1a" />
                    <text x="160" y="42" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">User</text>
                    <text x="160" y="58" textAnchor="middle" fill="#ffffff" fontSize="10">in pet bubble or map UI</text>

                    <rect x="290" y="20" width="220" height="50" rx="8" fill="#ffffff" stroke="#d15a24" strokeWidth="2.5" />
                    <text x="400" y="42" textAnchor="middle" fill="#1a1a1a" fontSize="13" fontWeight="800">Browser · appMain</text>
                    <text x="400" y="58" textAnchor="middle" fill="#1a1a1a" fontSize="10">js/appmain.js · sendToAI()</text>

                    <rect x="540" y="20" width="220" height="50" rx="8" fill="#2d4a3e" />
                    <text x="650" y="42" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">Vercel · /api/chat</text>
                    <text x="650" y="58" textAnchor="middle" fill="#ffffff" fontSize="10">api/chat.js · serverless</text>

                    <rect x="790" y="20" width="200" height="50" rx="8" fill="#ffffff" stroke="#1a1a1a" strokeWidth="2" />
                    <text x="890" y="42" textAnchor="middle" fill="#1a1a1a" fontSize="13" fontWeight="800">Zhipu BigModel</text>
                    <text x="890" y="58" textAnchor="middle" fill="#1a1a1a" fontSize="10">glm-4-flash</text>

                    <rect x="1020" y="20" width="160" height="50" rx="8" fill="#ffffff" stroke="#1a1a1a" strokeWidth="2" />
                    <text x="1100" y="42" textAnchor="middle" fill="#1a1a1a" fontSize="13" fontWeight="800">AMap Web API</text>
                    <text x="1100" y="58" textAnchor="middle" fill="#1a1a1a" fontSize="10">v2.0 · Walking</text>
                  </g>

                  <g stroke="#1a1a1a" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.35">
                    <line x1="160" y1="70" x2="160" y2="690" />
                    <line x1="400" y1="70" x2="400" y2="690" />
                    <line x1="650" y1="70" x2="650" y2="690" />
                    <line x1="890" y1="70" x2="890" y2="690" />
                    <line x1="1100" y1="70" x2="1100" y2="690" />
                  </g>

                  <g>
                    <rect x="20" y="92" width="80" height="22" rx="4" fill="#d15a24" />
                    <text x="60" y="108" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">FLOW A</text>
                    <text x="110" y="108" fill="#1a1a1a" fontSize="11" fontWeight="700">Pet chat — &quot;讲讲庚申之劫&quot;</text>
                  </g>

                  <g>
                    <line x1="160" y1="135" x2="395" y2="135" stroke="#1a1a1a" strokeWidth="2" markerEnd="url(#seq-arrow)" />
                    <text x="170" y="128" fontSize="11" fontWeight="700" fill="#1a1a1a">1 · type &amp; press Enter</text>
                    <text x="170" y="148" fontSize="10" fill="#666" fontStyle="italic">pet-inputbar onSubmit</text>
                  </g>

                  <g>
                    <line x1="400" y1="180" x2="645" y2="180" stroke="#d15a24" strokeWidth="2.5" markerEnd="url(#seq-arrow-orange)" />
                    <text x="410" y="173" fontSize="11" fontWeight="700" fill="#d15a24">2 · POST /api/chat</text>
                    <text x="410" y="193" fontSize="10" fontFamily="ui-monospace, monospace" fill="#1a1a1a">{"{ prompt: \"讲讲庚申之劫\" }"}</text>
                  </g>

                  <g>
                    <line x1="650" y1="225" x2="885" y2="225" stroke="#2d4a3e" strokeWidth="2.5" markerEnd="url(#seq-arrow-green)" />
                    <text x="660" y="218" fontSize="11" fontWeight="700" fill="#2d4a3e">3 · POST chat/completions</text>
                    <text x="660" y="238" fontSize="10" fontFamily="ui-monospace, monospace" fill="#1a1a1a">Authorization: Bearer ${"{process.env.agent}"}</text>
                    <text x="660" y="252" fontSize="10" fontFamily="ui-monospace, monospace" fill="#1a1a1a">model: glm-4-flash · system: 林黛玉 · user: prompt</text>
                  </g>

                  <g>
                    <rect x="540" y="268" width="220" height="44" rx="6" fill="#fff7ee" stroke="#d15a24" strokeWidth="1.5" />
                    <text x="650" y="285" textAnchor="middle" fontSize="10" fontWeight="800" fill="#d15a24">key stays server-side</text>
                    <text x="650" y="300" textAnchor="middle" fontSize="9" fill="#1a1a1a" fontStyle="italic">env var `agent` — never shipped to browser</text>
                  </g>

                  <g>
                    <line x1="885" y1="335" x2="655" y2="335" stroke="#2d4a3e" strokeWidth="2" markerEnd="url(#seq-arrow-green)" />
                    <text x="660" y="328" fontSize="11" fontWeight="700" fill="#2d4a3e">4 · 200 OK</text>
                    <text x="660" y="348" fontSize="10" fontFamily="ui-monospace, monospace" fill="#1a1a1a">choices[0].message.content</text>
                  </g>

                  <g>
                    <line x1="645" y1="380" x2="405" y2="380" stroke="#d15a24" strokeWidth="2" markerEnd="url(#seq-arrow-orange)" />
                    <text x="410" y="373" fontSize="11" fontWeight="700" fill="#d15a24">5 · 200 OK</text>
                    <text x="410" y="393" fontSize="10" fontFamily="ui-monospace, monospace" fill="#1a1a1a">{"{ reply: \"...\" }"}  — or 502 upstream_error</text>
                  </g>

                  <g>
                    <line x1="395" y1="425" x2="165" y2="425" stroke="#1a1a1a" strokeWidth="2" markerEnd="url(#seq-arrow)" />
                    <text x="170" y="418" fontSize="11" fontWeight="700" fill="#1a1a1a">6 · render in pet bubble</text>
                    <text x="170" y="438" fontSize="10" fill="#666" fontStyle="italic">petComicChat → typewriter into #pet-bubble-agent-text</text>
                  </g>

                  <line x1="20" y1="460" x2="1180" y2="460" stroke="#1a1a1a" strokeWidth="1" strokeDasharray="2 6" opacity="0.3" />

                  <g>
                    <rect x="20" y="480" width="80" height="22" rx="4" fill="#2d4a3e" />
                    <text x="60" y="496" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">FLOW B</text>
                    <text x="110" y="496" fill="#1a1a1a" fontSize="11" fontWeight="700">Walking route — visitor scrolls into river page</text>
                  </g>

                  <g>
                    <line x1="160" y1="525" x2="395" y2="525" stroke="#1a1a1a" strokeWidth="2" markerEnd="url(#seq-arrow)" />
                    <text x="170" y="518" fontSize="11" fontWeight="700" fill="#1a1a1a">1 · enter river page (scroll)</text>
                    <text x="170" y="538" fontSize="10" fill="#666" fontStyle="italic">body.is-river-page → mount &lt;RouteSection /&gt;</text>
                  </g>

                  <g>
                    <line x1="400" y1="568" x2="1095" y2="568" stroke="#2d4a3e" strokeWidth="2.5" markerEnd="url(#seq-arrow-green)" />
                    <text x="410" y="561" fontSize="11" fontWeight="700" fill="#2d4a3e">2 · AMapLoader.load() — fetch JS SDK + Walking plugin</text>
                    <text x="410" y="581" fontSize="10" fontFamily="ui-monospace, monospace" fill="#1a1a1a">key: AMAP_KEY (browser) · _AMapSecurityConfig</text>
                  </g>

                  <g>
                    <line x1="400" y1="613" x2="1095" y2="613" stroke="#2d4a3e" strokeWidth="2.5" markerEnd="url(#seq-arrow-green)" />
                    <text x="410" y="606" fontSize="11" fontWeight="700" fill="#2d4a3e">3 · walking.search(origin, destination) × N segments</text>
                    <text x="410" y="626" fontSize="10" fontFamily="ui-monospace, monospace" fill="#1a1a1a">via JSONP — Walking does not support multi-waypoint</text>
                  </g>

                  <g>
                    <line x1="1095" y1="660" x2="405" y2="660" stroke="#2d4a3e" strokeWidth="2" markerEnd="url(#seq-arrow-green)" />
                    <text x="410" y="653" fontSize="11" fontWeight="700" fill="#2d4a3e">4 · polyline segments</text>
                    <text x="410" y="673" fontSize="10" fontFamily="ui-monospace, monospace" fill="#1a1a1a">merge segments → draw on AMap canvas + island cards</text>
                  </g>
                </svg>
              </div>

              <div className="md:hidden space-y-4">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-2">
                    Flow A · Pet chat
                  </p>
                  <ol className="text-xs space-y-1.5 list-decimal list-inside text-gray-700">
                    <li>User types in pet bubble & hits Enter.</li>
                    <li>Browser <code className="font-mono text-[10px]">sendToAI()</code> POSTs <code className="font-mono text-[10px]">/api/chat</code> with <code className="font-mono text-[10px]">{"{ prompt }"}</code>.</li>
                    <li>Serverless function adds <i>林黛玉</i> system prompt and POSTs Zhipu <code className="font-mono text-[10px]">chat/completions</code> with key from env <code className="font-mono text-[10px]">agent</code>.</li>
                    <li>Zhipu replies → server unwraps <code className="font-mono text-[10px]">choices[0].message.content</code> → returns <code className="font-mono text-[10px]">{"{ reply }"}</code>.</li>
                    <li>Pet bubble typewriter-renders the reply.</li>
                  </ol>
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#2d4a3e] mb-2">
                    Flow B · Walking route
                  </p>
                  <ol className="text-xs space-y-1.5 list-decimal list-inside text-gray-700">
                    <li>Visitor scrolls into river page → <code className="font-mono text-[10px]">&lt;RouteSection /&gt;</code> mounts.</li>
                    <li>AMap loader fetches v2.0 SDK + <code className="font-mono text-[10px]">AMap.Walking</code> plugin.</li>
                    <li>For each leg, call <code className="font-mono text-[10px]">walking.search(origin, dest)</code> (JSONP) — Walking has no multi-waypoint API.</li>
                    <li>Merge polyline segments and draw on the AMap canvas.</li>
                  </ol>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 bg-[#fff7ee] felt-stitch rounded-sm">
                  <p className="font-mono font-bold uppercase text-[10px] text-[#d15a24] mb-1">Why a serverless proxy?</p>
                  <p className="leading-snug text-gray-700">
                    The Zhipu key is a private credential — putting it in JS would leak it to anyone opening DevTools.
                    The proxy also lets us inject the <i>林黛玉 tour-guide</i> system prompt server-side so the persona
                    can&apos;t be tampered with.
                  </p>
                </div>
                <div className="p-3 bg-white felt-stitch rounded-sm">
                  <p className="font-mono font-bold uppercase text-[10px] text-[#2d4a3e] mb-1">Why direct AMap?</p>
                  <p className="leading-snug text-gray-700">
                    AMap&apos;s browser SDK is designed to be called from the page (key + security code), and going through
                    our own proxy would block tile streaming. The single-leg <code className="font-mono">walking.search</code>{" "}
                    limit is worked around by chaining segments client-side.
                  </p>
                </div>
              </div>
            </div>
          </FeltCard>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <FeltCard color="orange" className="md:col-span-5" rotate={-1}>
              <div className="flex items-start gap-3 mb-4">
                <Globe className="shrink-0" size={28} />
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-80">4.2 High-Fi Prototype</p>
                  <h3 className="text-xl font-black uppercase leading-tight">Hosted Web App</h3>
                </div>
              </div>
              <p className="text-sm leading-relaxed opacity-95 mb-4">
                The full immersive experience — story timeline, river journey, walking route, and the GLM-powered
                pet companion — runs in your browser. No install, no login.
              </p>

              <a
                href="https://changgate.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="block w-full py-3 px-4 bg-white text-[#1a1a1a] text-center rounded felt-shadow felt-stitch text-sm font-black uppercase tracking-wider hover:bg-[#1a1a1a] hover:text-white transition-colors"
              >
                Open Live Site →
              </a>
              <p className="mt-2 text-[10px] font-mono opacity-80 text-center break-all">
                changgate.vercel.app
              </p>
            </FeltCard>

            <FeltCard className="md:col-span-7" rotate={0.5}>
              <div className="mb-4 flex items-center gap-2">
                <h3 className="text-lg font-black uppercase flex items-center gap-2">
                  <TableIcon size={18} className="text-[#2d4a3e]" /> 4.3 Individual Contributions
                </h3>
                <div className="flex-1 border-b-2 border-dashed border-[#1a1a1a] opacity-15" />
              </div>
              <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wider mb-4">
                What each of the 4 members built — Code · UI · Content · Testing
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#1a1a1a]">
                      <th className="text-left py-2 pr-3 font-black uppercase tracking-wider text-[10px]">Member</th>
                      <th className="text-left py-2 px-2 font-black uppercase tracking-wider text-[10px]">Primary Role</th>
                      <th className="text-left py-2 px-2 font-black uppercase tracking-wider text-[10px]">Concrete Deliverables</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-gray-200">
                    <tr className="align-top">
                      <td className="py-3 pr-3">
                        <p className="font-black">Jiayang Pang</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-[#d15a24] text-white text-[9px] font-mono uppercase rounded-sm">Code · UI Design</span>
                      </td>
                      <td className="py-3 px-2 font-bold">Frontend Engineering &amp; In-App UI</td>
                      <td className="py-3 px-2 leading-snug text-gray-700">
                        Set up the Vite multi-page build; wrote the appMain React shell, scroll director
                        (<code className="font-mono text-[10px]">scrollMaskZoom</code>, curtain transition), the river
                        canvas scene, and the PIXI desktop pet (state machine + drag + target observer); wired the{" "}
                        <code className="font-mono text-[10px]">/api/chat</code> serverless proxy to Zhipu GLM-4-Flash.
                        Also designed and implemented the in-app UI — felt/paper visual system on this portfolio,
                        hero stack cards, timeline filmstrip, pet comic bubble and the route island layout.
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="py-3 pr-3">
                        <p className="font-black">Jiaqi Fu</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-[#2d4a3e] text-white text-[9px] font-mono uppercase rounded-sm">Figma · Content</span>
                      </td>
                      <td className="py-3 px-2 font-bold">Figma Prototypes &amp; Copywriting</td>
                      <td className="py-3 px-2 leading-snug text-gray-700">
                        Produced the low-fi and high-fi Figma prototypes that defined screen flow, layout and
                        component hierarchy. Wrote the main body of on-page text: the timeline narrative for the
                        eight historical epochs (Helü&apos;s Capital → Contemporary), the recommended-route
                        descriptions, the 林黛玉-tone pet system prompt, and the cross-page tour copy.
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="py-3 pr-3">
                        <p className="font-black">Jiaming Gong</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-[#d15a24] text-white text-[9px] font-mono uppercase rounded-sm">Art Assets</span>
                      </td>
                      <td className="py-3 px-2 font-bold">Visual Asset Production</td>
                      <td className="py-3 px-2 leading-snug text-gray-700">
                        Produced and curated all art assets shipped under <code className="font-mono text-[10px]">public/images/</code>:
                        the eight timeline images (Pingjiang map, Ming Suzhou map, late-Qing scenes, contemporary
                        Chang Gate, etc.), the river-island photography, the desktop-pet sprites and the SVG motifs
                        used inside the hero stack cards.
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="py-3 pr-3">
                        <p className="font-black">Wenbin Ding</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-[#2d4a3e] text-white text-[9px] font-mono uppercase rounded-sm">Testing</span>
                      </td>
                      <td className="py-3 px-2 font-bold">QA, Map Integration &amp; User Testing</td>
                      <td className="py-3 px-2 leading-snug text-gray-700">
                        Integrated the AMap Web JS API 2.0 with <code className="font-mono text-[10px]">AMap.Walking</code>{" "}
                        for the recommended route; ran the alpha usability sessions, recorded the journey-map findings
                        (§02), tracked bug tickets across browsers, and produced the demo video and deployment checklist
                        on Vercel.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </FeltCard>
          </div>
        </section>

        <section id="evaluation" className="pb-24">
          <div className="max-w-4xl mx-auto space-y-8">
            <FeltCard color="green" className="inline-block" rotate={-1}>
              <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                <ClipboardCheck size={24} /> 05. Evaluation
              </h2>
            </FeltCard>

            <FeltCard rotate={0.5}>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <MessageSquare size={16} /> Alpha Feedback
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#2d4a3e] mb-2 flex items-center gap-1">
                    <CheckCircle2 size={12} /> What worked
                  </p>
                  <ul className="space-y-2 text-xs">
                    <li className="bg-[#f4f1ea] p-2.5 rounded border-l-4 border-[#2d4a3e]">
                      <p className="font-bold mb-0.5">Visual style</p>
                      <p className="text-gray-700 leading-snug">
                        Layout combines Suzhou heritage motifs with a clean modern look; the cute character appeals
                        to younger users.
                      </p>
                    </li>
                    <li className="bg-[#f4f1ea] p-2.5 rounded border-l-4 border-[#2d4a3e]">
                      <p className="font-bold mb-0.5">Interaction novelty</p>
                      <p className="text-gray-700 leading-snug italic">
                        &quot;Very immersive&quot; — testers liked the vertical/horizontal scroll-driven storytelling.
                      </p>
                    </li>
                    <li className="bg-[#f4f1ea] p-2.5 rounded border-l-4 border-[#2d4a3e]">
                      <p className="font-bold mb-0.5">Useful route planner</p>
                      <p className="text-gray-700 leading-snug">
                        Recommended walking route is clear and easy to follow — users said they would actually
                        &quot;walk along with it&quot;.
                      </p>
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-2 flex items-center gap-1">
                    <XCircle size={12} /> What needs work
                  </p>
                  <ul className="space-y-2 text-xs">
                    <li className="bg-white p-2.5 rounded border-l-4 border-[#d15a24]">
                      <p className="font-bold mb-0.5">Scroll sensitivity</p>
                      <p className="text-gray-700 leading-snug italic">
                        &quot;Either it won&apos;t move, or one tiny swipe sends it flying.&quot;
                      </p>
                    </li>
                    <li className="bg-white p-2.5 rounded border-l-4 border-[#d15a24]">
                      <p className="font-bold mb-0.5">Long opening path</p>
                      <p className="text-gray-700 leading-snug">
                        The initial &quot;Go&quot; downward-scroll segment is too long and drains user patience.
                      </p>
                    </li>
                    <li className="bg-white p-2.5 rounded border-l-4 border-[#d15a24]">
                      <p className="font-bold mb-0.5">Pet chat is hidden</p>
                      <p className="text-gray-700 leading-snug">
                        Users didn&apos;t realise the desktop pet was clickable / chattable — no on-boarding hint.
                      </p>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t-2 border-dashed border-[#1a1a1a]/15">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-1.5 py-0.5 bg-[#2d4a3e] text-white text-[9px] font-mono font-bold uppercase tracking-widest rounded-sm">
                    Iteration
                  </span>
                  <h4 className="text-sm font-black uppercase">What we changed after the alpha</h4>
                  <div className="flex-1 border-b-2 border-dashed border-[#1a1a1a] opacity-15" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#f4f1ea] p-3 rounded felt-stitch">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-1">Issue 1</p>
                    <p className="text-xs font-black mb-2">Scroll feel</p>
                    <p className="text-[11px] text-gray-700 leading-snug">
                      The story now uses a smooth follow-along motion — the scene catches up with your scroll instead
                      of snapping. On phones the easing is a bit faster so light swipes still register, and on iOS Safari
                      the page keeps animating between sparse scroll events so it never &quot;jumps&quot; suddenly.
                    </p>
                  </div>

                  <div className="bg-[#f4f1ea] p-3 rounded felt-stitch">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-1">Issue 2</p>
                    <p className="text-xs font-black mb-2">Shorter opening</p>
                    <p className="text-[11px] text-gray-700 leading-snug mb-3">
                      The opening &quot;Go&quot; section was cut by roughly 40% and the inner story beats were re-paced.
                      The top-right Guide menu also has a <b>Timeline</b> shortcut that jumps straight into the gate
                      transition, so users don&apos;t have to scroll all the way through the hero.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <figure className="rounded felt-stitch overflow-hidden bg-white">
                        <div className="aspect-[9/16] overflow-hidden">
                          <img
                            src="images/portfolio/iter-opening-before.png"
                            alt="Before iteration: timeline filmstrip with longer opening scroll segment"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <figcaption className="px-1.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-gray-500 text-center">
                          Before
                        </figcaption>
                      </figure>
                      <figure className="rounded felt-stitch overflow-hidden bg-white ring-2 ring-[#2d4a3e]/40">
                        <div className="aspect-[9/16] overflow-hidden">
                          <img
                            src="images/portfolio/iter-opening-after.png"
                            alt="After iteration: shorter opening, timeline reachable sooner via the Guide menu shortcut"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <figcaption className="px-1.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#2d4a3e] text-center">
                          After
                        </figcaption>
                      </figure>
                    </div>
                  </div>

                  <div className="bg-[#f4f1ea] p-3 rounded felt-stitch">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-1">Issue 3</p>
                    <p className="text-xs font-black mb-2">Onboarding hint</p>
                    <p className="text-[11px] text-gray-700 leading-snug mb-3">
                      As soon as the page is ready, the pet now waves and pops a comic bubble that says &quot;tap me to
                      chat&quot; and points to the dock button in the corner. The hint dismisses on the first scroll so
                      it never gets in the way.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <figure className="rounded felt-stitch overflow-hidden bg-white">
                        <div className="aspect-[9/16] overflow-hidden">
                          <img
                            src="images/portfolio/iter-pet-before.png"
                            alt="Before iteration: pet stands on the hero card with no hint, users don't know it is interactive"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <figcaption className="px-1.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-gray-500 text-center">
                          Before
                        </figcaption>
                      </figure>
                      <figure className="rounded felt-stitch overflow-hidden bg-white ring-2 ring-[#2d4a3e]/40">
                        <div className="aspect-[9/16] overflow-hidden">
                          <img
                            src="images/portfolio/iter-pet-after.png"
                            alt="After iteration: pet waves and shows a comic bubble inviting the user to tap and chat"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <figcaption className="px-1.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#2d4a3e] text-center">
                          After
                        </figcaption>
                      </figure>
                    </div>
                  </div>
                </div>
              </div>
            </FeltCard>

            <FeltCard color="cream" rotate={-0.3} className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#2d4a3e] opacity-5 -mr-16 -mt-16 rounded-full" />
              <h3 className="text-xl font-bold mb-4">AI Tools &amp; Skill Usage</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                In this project, I used Cursor and Gemini as my main development tools, especially for UI/UX design
                and frontend interaction details. I also introduced Cursor Skill to help check whether the page had a
                clear visual hierarchy, whether the interaction hints were obvious enough, and whether the experience
                across different modules felt coherent. However, the suggestions from Skill were not copied directly.
                Instead, they were used as references during the design and implementation process, and I made the
                final decisions based on the project theme, user testing feedback, and the actual rendered result of
                the website.
              </p>
            </FeltCard>

            <FeltCard color="orange" rotate={0.4} className="relative overflow-hidden">
              <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-[#2563eb] opacity-15" />
              <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-[#2d4a3e] opacity-15" />
              <div className="relative z-10">
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-white/80 mb-2">
                  Example Prompt
                </p>
                <h3 className="text-2xl md:text-3xl font-black uppercase leading-none mb-3 text-white">
                  Example Prompt
                </h3>
                <p className="text-xs leading-relaxed text-white/90 mb-4 max-w-2xl">
                  This is one of the detailed prompts used to guide AI-assisted UI/UX exploration. The original prompt
                  was written in Chinese and translated into English for this portfolio.
                </p>
                <div className="max-h-72 overflow-y-auto rounded-3xl bg-white/95 p-4 felt-stitch text-[#1a1a1a]">
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
{`[Role Setting]
You are now a senior frontend engineer and motion designer who specializes in modern UI/UX design and advanced frontend animation interactions, especially GSAP.

[Task Goal]
Please help me refactor the current webpage code and completely transform its visual style and interaction experience into "Playful Geometric Scrollytelling." Please strictly follow the visual and technical specifications below.

[Visual Guidelines]

Flat Vector Aesthetic: Completely remove any code properties that create a three-dimensional or textured feeling. All graphics and color blocks must use solid color fills.

High-Contrast Playful Palette: Use bright, high-saturation, high-contrast color combinations.

Keep the colors of existing components unchanged.

Accent and graphic colors: pure red, ultramarine blue, grass green, and bright orange.

Organic & Rounded Geometry: Avoid sharp right angles in decorative elements, card containers, buttons, and other page components. Use many rectangles with large border-radius values, pure circles, or SVG shapes with irregular smooth curves that feel like clouds or gummies.

Chunky Typography: Use very bold and visually impactful sans-serif typefaces for headings, similar to Futura, Montserrat, or extremely heavy display fonts. Treat large text as part of the composition itself, and even allow text to be partially cropped at the screen edges.

Organic Image Masking: If the code contains real-life photos (<img>), do not display them in traditional rectangles. Use CSS clip-path or SVG masks to crop images into organic shapes such as arches or rounded irregular polygons.

[Animation & Interaction Guidelines]

Use GSAP with the ScrollTrigger plugin and native CSS animations to implement the following core motion mechanisms:

Multi-layer Parallax: Apply different scroll speeds to background SVG geometric shapes and foreground elements using yPercent or y with ScrollTrigger scrub, creating a sense of depth along the Z axis.

Sticky Card Stacking: Modify the content display area so that when users scroll down, the current card is pinned in the center of the screen using ScrollTrigger's pin: true property, while subsequent cards slide in from below and cover the previous card one by one, creating a card-dealing stacking effect.

Wipe Transitions: During major section changes, use a huge absolutely positioned solid-color SVG geometric shape that slides up from the bottom of the screen as a natural scene transition mask.

Looping Micro-animations: Add CSS @keyframes animations to small decorative elements on the page, such as stars, dots, and flowers, to create continuous gentle floating, slow rotation, or pulsing scale effects, so the page still feels alive even when the user is not scrolling.`}
                  </pre>
                </div>
              </div>
            </FeltCard>

            <FeltCard color="cream" rotate={0.2} className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d15a24] opacity-5 -mr-16 -mt-16 rounded-full" />
              <h3 className="text-xl font-bold mb-4">Final Reflection</h3>
              <div className="space-y-5 text-sm leading-relaxed text-gray-600">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#2d4a3e] mb-2">
                    Ethical Reflection
                  </p>
                  <p>
                    In this project, we tried to transform the cultural history of Chang Gate from a static display
                    into a more immersive and participatory digital experience. Through timeline storytelling, the
                    river scene, route recommendations, and the &quot;Lin Daiyu&quot; AI guide, the design helps younger
                    visitors understand local history more actively and shows that cultural heritage communication
                    does not have to rely only on written explanation. However, this approach also brings social and
                    ethical responsibilities: historical content must avoid excessive entertainment or misleading
                    interpretation, and AI-generated responses cannot be treated directly as authoritative historical
                    sources. Therefore, we used Generative AI mainly as a content-support and interaction tool, while
                    controlling accuracy and privacy risks through human review, source comparison, and a server-side
                    proxy. Overall, the project taught us that technology can make cultural experiences more engaging,
                    but designers still need to remain responsible for historical authenticity, user understanding,
                    and data security.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d15a24] mb-2">
                    AI-Assisted Technical Reflection
                  </p>
                  <p>
                    After spending a lot of time &quot;vibecoding,&quot; I realized that relying purely on AI-assisted
                    workflows for frontend development still creates significant struggles. Tools such as Gemini and
                    Cursor helped me start the project very quickly and build a structurally decent static interface,
                    but they also gave me false expectations about what AI could actually handle. When my requirements
                    became more specific, especially for complex micro-interactions and continuous transitions such as
                    the city-wall transition before the historical timeline, the AI was often trapped by the rigid
                    framework it had created earlier. Instead of performing a proper global refactor, it tended to add
                    patches on top of existing code, which made animations stiff or sometimes broke the intended effect.
                  </p>
                  <p className="mt-3">
                    Another major limitation is that AI can read the code but cannot truly see the rendered visual
                    result. It may consider a task complete because the syntax is correct, while the real page still
                    contains visual problems such as overflowing text, incorrect z-index layering, or broken responsive
                    breakpoints. Since my frontend foundation is still developing, building complex interactive pages
                    such as map-based experiences and dynamic guide systems forced me to write very dense prompts to
                    control component lifecycles, animation timing, and CSS behavior precisely.
                  </p>
                  <p className="mt-3">
                    I also found that AI does not naturally plan long-term architecture as my ideas evolve. To implement
                    features quickly, it sometimes passes data through the wrong layers or hardcodes logic, which makes
                    later changes fragile. A small fix for an overlapping component could unexpectedly damage the global
                    flex layout. Ultimately, AI is excellent at compressing the first 0 to 80% of setup time and creating
                    the feeling that &quot;development is easy.&quot; However, to finish the final 20% of highly stylized
                    customization and fine-tuning, I learned that I still need a solid technical foundation. Otherwise,
                    I may spend several times longer repairing the architectural and logical gaps created by AI than I
                    would have spent writing the code manually from the beginning.
                  </p>
                </div>
              </div>
            </FeltCard>
          </div>
        </section>

        <section id="references" className="pb-24">
          <div className="max-w-4xl mx-auto">
            <FeltCard color="cream" rotate={-0.2} className="relative overflow-hidden">
              <div className="absolute -top-12 -right-10 h-32 w-32 rounded-full bg-[#d15a24] opacity-10" />
              <h2 className="text-2xl font-black uppercase mb-4">References</h2>
              <p className="text-xs leading-relaxed text-gray-600 mb-5">
                The following AI tools and models were used as development, writing, and interaction references during
                the project. Their outputs were reviewed and adapted by the team rather than copied directly.
              </p>
              <h3 className="text-sm font-black uppercase mb-3 text-[#d15a24]">AI Tools &amp; Models</h3>
              <ul className="space-y-3 text-xs leading-relaxed text-gray-700">
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  Google. (2026). <i>Gemini 3 Pro</i>. Used for frontend implementation suggestions and UI/UX
                  exploration.
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  Anysphere. (2026). <i>Cursor IDE</i>. Used as the main AI-assisted development environment for code
                  editing, debugging, and project navigation.
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  OpenAI. (2026). <i>GPT-5.5</i>. Used for technical reflection drafting, English translation, and
                  portfolio content refinement.
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  Anthropic. (2026). <i>Claude Opus 4.7</i>. Used for alternative reasoning, code review suggestions,
                  and frontend interaction planning.
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  Zhipu AI. (2026). <i>GLM-4-Flash</i>. Used as the large language model behind the in-app &quot;Lin
                  Daiyu&quot; AI guide interaction.
                </li>
              </ul>
              <h3 className="text-sm font-black uppercase mt-6 mb-3 text-[#2d4a3e]">Papers &amp; Websites</h3>
              <ol className="space-y-3 text-xs leading-relaxed text-gray-700 list-decimal list-outside pl-4">
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  王心言. 历史文化遗产的媒介记忆重构与数字传播创新研究——以河南殷商文化遗产为例[J]. 商丘师范学院学报, 2025, 41(8): 102–108.
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  徐海军. 历史文化遗产的当代叙事：保护、传承与创新——基于中国文化报宣传报道实践的思考[J]. 中国记者, 2025(7): 37–40.
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  苏州古城墙系列工程[J]. 风景园林, 2022(S1): 147–149.
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  张胜美. 城市触媒理论引导下阊门历史文化街区保护与更新[J]. 山西建筑, 2024(2): 79–81.
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  Suzhou Museum Website. Retrieved from{" "}
                  <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://www.szmuseum.com/" target="_blank" rel="noreferrer">
                    https://www.szmuseum.com/
                  </a>
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  Suzhou Gardens · Humble Administrator&apos;s Garden. Retrieved from{" "}
                  <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://web.lotsmall.cn/index?m_id=1939" target="_blank" rel="noreferrer">
                    https://web.lotsmall.cn/index?m_id=1939
                  </a>
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  Ten Views of the Grand Canal · Night Mooring at Maple Bridge. Retrieved from{" "}
                  <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://yhsj.jssvc.edu.cn/fengqiaoyebo/fengqiaoyebojianjie/" target="_blank" rel="noreferrer">
                    https://yhsj.jssvc.edu.cn/fengqiaoyebo/fengqiaoyebojianjie/
                  </a>
                </li>
                <li className="p-3 bg-white/70 rounded felt-stitch">
                  Shantang Street Introduction. Retrieved from{" "}
                  <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://www.gerenjianli.com/area/suzhou/014rcplc.htm" target="_blank" rel="noreferrer">
                    https://www.gerenjianli.com/area/suzhou/014rcplc.htm
                  </a>{" "}
                  and{" "}
                  <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://www.sds-vr.com/show/358" target="_blank" rel="noreferrer">
                    https://www.sds-vr.com/show/358
                  </a>
                </li>
              </ol>
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
