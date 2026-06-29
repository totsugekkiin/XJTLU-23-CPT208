import React, { useEffect } from "react";

export function HomePage() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await import("../../js/team.js");
      if (cancelled) return;

      const homeScreen = document.getElementById("home-screen");

      const btnTeam = document.getElementById("btn-team");
      const btnBackTeam = document.getElementById("btn-back-team");

      const teamScreen = document.getElementById("team-screen");
      const tearTop = document.getElementById("tear-top");
      const tearBottom = document.getElementById("tear-bottom");
      const typewriters = document.querySelectorAll(".typewriter");

      window.TeamScene?.init?.({
        btnTeam,
        btnBackTeam,
        homeScreen,
        teamScreen,
        tearTop,
        tearBottom,
        typewriters,
      });

      if (window.location.hash === "#team") {
        history.replaceState(null, "", window.location.pathname + window.location.search);
        setTimeout(() => btnTeam?.click(), 50);
      }
    })();

    return () => {
      cancelled = true;
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
            <a href="loc-ar.html" className="nav-item">
              [AR]
            </a>
          </li>
          <li>
            <a href="portfolio.html" className="nav-item">
              [PORTFOLIO]
            </a>
          </li>
        </ul>
      </nav>

      <button className="btn-return" id="btn-back-team">
        ◄ RETURN
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

        <a href="portfolio.html" className="btn-team-portfolio">
          [ VIEW PROCESS PORTFOLIO &rarr; ]
        </a>
      </main>
    </>
  );
}
