import React, { useEffect } from "react";

export function HomePage() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 复用现有场景脚本：它们会把 init 挂到 window 上
      await import("../../js/team.js");
      await import("../../js/persona.js");
      if (cancelled) return;

      const homeScreen = document.getElementById("home-screen");
      const navItems = document.querySelectorAll(".nav-item");

      const btnTeam = document.getElementById("btn-team");
      const btnPersona = document.getElementById("btn-persona");
      const btnBackTeam = document.getElementById("btn-back-team");
      const btnBackPersona = document.getElementById("btn-back-persona");

      const teamScreen = document.getElementById("team-screen");
      const tearTop = document.getElementById("tear-top");
      const tearBottom = document.getElementById("tear-bottom");
      const typewriters = document.querySelectorAll(".typewriter");

      const personaScreen = document.getElementById("persona-screen");
      const waterLayer = document.getElementById("water-layer");
      const dotPattern = document.querySelector(".p3-dot-pattern");
      const slantedBgWrapper = document.querySelector(".slanted-bg-wrapper");

      window.TeamScene?.init?.({
        btnTeam,
        btnBackTeam,
        homeScreen,
        teamScreen,
        tearTop,
        tearBottom,
        typewriters,
      });

      window.PersonaScene?.init?.({
        btnPersona,
        btnBackPersona,
        homeScreen,
        personaScreen,
        tearTop,
        tearBottom,
        navItems,
        waterLayer,
        dotPattern,
        slantedBgWrapper,
      });
    })();

    return () => {
      cancelled = true;
      // 主页是 MPA，不会在页内卸载；这里先不做 teardown
    };
  }, []);

  return (
    <>
      <div className="tear-half tear-top" id="tear-top" />
      <div className="tear-half tear-bottom" id="tear-bottom" />

      <nav className="screen" id="home-screen">
        <ul id="home-nav">
          <li>
            <a href="appMain.html" className="nav-item app-go">
              GO
            </a>
          </li>
          <li>
            <a href="#" id="btn-team" className="nav-item">
              [TEAM]
            </a>
          </li>
          <li>
            <a href="#" id="btn-persona" className="nav-item">
              [PERSONA!]
            </a>
          </li>
        </ul>
      </nav>

      <div className="water-transition" id="water-layer" />

      <button className="btn-return" id="btn-back-team">
        ◄ RETURN
      </button>
      <button className="btn-return" id="btn-back-persona">
        ◄ BACK
      </button>

      <main className="screen" id="team-screen">
        <div className="speed-lines" />
        <div className="roster-container">
          <div className="team-card">
            <div
              className="portrait has-photo"
              style={{ backgroundImage: "url('images/pjy-profilepicture.jpg')" }}
            />
            <div className="info">
              <div className="name">Pang Jiayang</div>
              <div className="student-id">2360711</div>
              <div className="intro">
                <span className="typewriter" data-text="Sephiroth." />
              </div>
            </div>
          </div>

          <div className="team-card">
            <div
              className="portrait has-photo"
              style={{ backgroundImage: "url('images/dwb-pp.jpg')" }}
            />
            <div className="info">
              <div className="name">Ding Wenbin</div>
              <div className="student-id">2362270</div>
              <div className="intro">
                <span
                  className="typewriter"
                  data-text="Hello, I am a student majoring in DMT. I'm now working on a user-centered interactive tour project for Chang Gate. I aim to make historical sightseeing clear, approachable, and enjoyable for all kinds of visitors."
                />
              </div>
            </div>
          </div>

          <div className="team-card">
            <div
              className="portrait has-photo"
              style={{ backgroundImage: "url('images/gjm-pp.jpg')" }}
            />
            <div className="info">
              <div className="name">Jiaming Gong</div>
              <div className="student-id">2361315</div>
              <div className="intro">
                <span
                  className="typewriter"
                  data-text="Digital Media Tech undergrad. Hardware enthusiast & visual designer. Into embedded systems, sensor interaction, UI design, and motion graphics. Telling stories through visuals."
                />
              </div>
            </div>
          </div>

          <div className="team-card">
            <div
              className="portrait has-photo"
              style={{ backgroundImage: "url('images/fjq-pp.jpg')" }}
            />
            <div className="info">
              <div className="name">Fu Jiaqi</div>
              <div className="student-id">2360733</div>
              <div className="intro">
                <span
                  className="typewriter"
                  data-text="Digital Media Technology student. Currently studying embedded system development. Feel free to communicate."
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <main className="screen" id="persona-screen">
        <div className="p3-dot-pattern" />
        <div className="slanted-bg-wrapper">
          <div className="slanted-white-wave" />
        </div>

        <div className="persona-container">
          <div className="pendant-wrapper" style={{ opacity: 1 }}>
            <div className="photo-frame-hard" />
          </div>

          <div className="info-card-solid" style={{ opacity: 1 }}>
            <div className="info-content">
              <div className="arcana-tag"> XXX / 00</div>
              <h1 className="persona-name">XXXXXX</h1>

              <div className="tag-group">
                <span>X</span>
                <span>X</span>
                <span>X: ELECTRIC</span>
              </div>

              <div className="quote-box">
                "ASDASDSADAD124S"
                <br />
                "ASDAXXXSDASD."
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

