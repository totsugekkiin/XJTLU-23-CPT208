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
                  href="#"
                  className="flex items-center gap-3 px-4 py-3 rounded bg-white text-[#1a1a1a] felt-shadow felt-stitch text-xs font-bold hover:bg-[#2d4a3e] hover:text-white transition-colors"
                >
                  <Globe size={18} className="shrink-0" />
                  <span className="text-left leading-snug">High-fi / Hosted Website</span>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 px-4 py-3 rounded bg-white text-[#1a1a1a] felt-shadow felt-stitch text-xs font-bold hover:bg-[#2d4a3e] hover:text-white transition-colors"
                >
                  <GitFork size={18} className="shrink-0" />
                  <span className="text-left leading-snug">GitHub / Source Code</span>
                </a>
                <a
                  href="#"
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
                    <li>王心言. 历史文化遗产的媒介记忆重构与数字传播创新研究——以河南殷商文化遗产为例[J]. 商丘师范学院学报, 2025, 41(8): 102–108.</li>
                    <li>徐海军. 历史文化遗产的当代叙事：保护、传承与创新——基于中国文化报宣传报道实践的思考[J]. 中国记者, 2025(7): 37–40.</li>
                    <li>苏州古城墙系列工程[J]. 风景园林, 2022(S1): 147–149.</li>
                    <li>张胜美. 城市触媒理论引导下阊门历史文化街区保护与更新[J]. 山西建筑, 2024(2): 79–81.</li>
                  </ol>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase mb-2 flex items-center gap-2">
                    <Globe size={14} className="text-[#2d4a3e]" /> 4 Commercial Products
                  </h4>
                  <ol className="text-[11px] leading-snug space-y-2 font-mono list-decimal list-outside pl-4">
                    <li>
                      苏州博物馆网页{" "}
                      <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://www.szmuseum.com/" target="_blank" rel="noreferrer">
                        szmuseum.com
                      </a>
                    </li>
                    <li>
                      苏州园林·拙政园{" "}
                      <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://web.lotsmall.cn/index?m_id=1939" target="_blank" rel="noreferrer">
                        web.lotsmall.cn
                      </a>
                    </li>
                    <li>
                      运河十景·枫桥夜泊{" "}
                      <a className="break-all underline decoration-dotted hover:text-[#d15a24]" href="https://yhsj.jssvc.edu.cn/fengqiaoyebo/fengqiaoyebojianjie/" target="_blank" rel="noreferrer">
                        yhsj.jssvc.edu.cn
                      </a>
                    </li>
                    <li>
                      山塘街介绍{" "}
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
                  <div className="grid grid-cols-2 gap-2">
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
                href="https://www.figma.com/site/4gy7f2MvbMXyQow0V27y6R/white?node-id=0-1&t=lVyeH2e06NkvCmu3-1"
                target="_blank"
                rel="noreferrer"
                className="mt-2 block w-full py-2 bg-[#1a1a1a] text-white text-center rounded felt-shadow text-xs font-bold tracking-widest hover:bg-[#d15a24] transition-colors"
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
