const ELEMENTS = ["Phys","Elec","Fire","Ice","Force","Light","Dark"];

const EL_COLOR = {
  Fire: "var(--fire)",
  Ice: "var(--ice)",
  Phys: "var(--phys)",
  Elec: "var(--elec)",
  Force:"var(--force)",
  Light:"var(--light)",
  Dark:"var(--dark)"
};

const fmt = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n/1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n/1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n/1e3).toFixed(1) + "K";
  return String(Math.round(n));
};

const pct = (x) => {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return (x*100).toFixed(0) + "%";
};

const sanitizeFilename = (nick) => {
  return nick.trim().replaceAll(" ", "_").replace(/[^A-Za-z0-9_\-]/g, "");
};

async function loadJSON(path){
  const r = await fetch(path, {cache:"no-store"});
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
  return await r.json();
}

function unique(arr){ return Array.from(new Set(arr)).filter(Boolean); }
function byTotalDesc(a,b){ return (b.total_end_2025||0)-(a.total_end_2025||0); }

function applyRoster(players, roster){
  if (!roster) return players;
  const order = Array.isArray(roster.order) ? roster.order : [];
  const includeOnly = roster.include_only === true;
  const overrides = roster.overrides || {};

  const map = new Map(players.map(p => [p.nick, p]));
  let out = [];

  if (order.length){
    for (const nick of order){
      const p = map.get(nick);
      if (p) out.push(p);
    }
    if (!includeOnly){
      for (const p of players){
        if (!order.includes(p.nick)) out.push(p);
      }
    }
  } else {
    out = players.slice().sort(byTotalDesc);
  }

  out = out.map((p, idx) => {
    const o = overrides[p.nick] || {};
    const displayName = o.displayName || p.nick;
    const photoFile = o.photoFile || (sanitizeFilename(p.nick) + ".jpg");
    return {
      ...p,
      displayName,
      photo: `assets/photos/${photoFile}`,
      joinedIndex: idx
    };
  });

  return out;
}

function getType(){
  return document.getElementById("type").value; // abs_end | rel | growth
}

function getBestElement(p, type, relMap){
  let bestEl = null;
  let bestVal = -Infinity;

  for (const el of ELEMENTS){
    let val = null;

    if (type === "rel"){
      const relRow = relMap?.[p.nick] || null;
      val = relRow?.[el];
    } else if (type === "growth") {
      val = p.elements?.[el]?.growth;
    } else { // abs_end
      val = p.elements?.[el]?.end;
    }

    if (val === null || val === undefined || Number.isNaN(val)) continue;
    if (val > bestVal){
      bestVal = val;
      bestEl = el;
    }
  }
  return bestEl;
}

function computePerCardMax(p, type){
  if (type === "rel") return 100; // 0..100 directly
  let m = 0;
  for (const el of ELEMENTS){
    const val = (type === "growth") ? p.elements?.[el]?.growth : p.elements?.[el]?.end;
    if (val === null || val === undefined || Number.isNaN(val)) continue;
    m = Math.max(m, Math.abs(val));
  }
  return m || 0.0000001;
}

function avgEnd2025(p){
  let sum = 0;
  let cnt = 0;

  for (const el of ELEMENTS){
    const v = p.elements?.[el]?.end;
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    sum += v;
    cnt += 1;
  }

  return cnt ? (sum / cnt) : null;
}

function render(players, relMap, titlesMap){
  const q = (document.getElementById("q").value || "").trim().toLowerCase();
  const sortBy = document.getElementById("sortBy").value;
  const type = getType();

  let view = players.slice();
  if (q) view = view.filter(p => (p.displayName || p.nick || "").toLowerCase().includes(q));

  if (sortBy==="total_desc") view.sort((a,b)=> (avgEnd2025(b)||0) - (avgEnd2025(a)||0));
  if (sortBy==="total_asc") view.sort((a,b)=> (avgEnd2025(a)||0) - (avgEnd2025(b)||0));
  if (sortBy==="name_asc") view.sort((a,b)=> String(a.displayName||a.nick).localeCompare(String(b.displayName||b.nick)));
  if (sortBy==="name_desc") view.sort((a,b)=> String(b.displayName||b.nick).localeCompare(String(a.displayName||a.nick)));
  if (sortBy==="joined") view.sort((a,b)=>(a.joinedIndex??0)-(b.joinedIndex??0));

  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  for (const p of view){
    const card = document.createElement("div");
    card.className = "card";

    const inner = document.createElement("div");
    inner.className = "cardInner";

    const top = document.createElement("div");
    top.className = "topRow";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    const img = document.createElement("img");
    img.src = p.photo;
    img.alt = p.displayName || p.nick;
    img.loading = "lazy";
    img.onerror = () => {
      avatar.innerHTML = `<div class="fallback">${(p.displayName||p.nick||"?").slice(0,2).toUpperCase()}</div>`;
    };
    avatar.appendChild(img);

    const title = document.createElement("div");
    title.innerHTML = `<div class="name">${p.displayName || p.nick}</div>`;

    const badges = document.createElement("div");
    badges.className = "badges";

    // Renamed badges
    const absBest = getBestElement(p, "abs_end", relMap);
    const relBest = getBestElement(p, "rel", relMap);

    if (absBest){
      const b = document.createElement("div");
      b.className="badge";
      b.textContent = `Absolute best: ${absBest}`;
      badges.appendChild(b);
    }
    if (relBest){
      const b = document.createElement("div");
      b.className="badge";
      b.textContent = `Relative best: ${relBest}`;
      badges.appendChild(b);
    }

    // Titles: hide if 0
    const t = titlesMap?.[p.nick] || {};
    if ((t.differenceMaker||0) > 0){
      const b = document.createElement("div");
      b.className="badge";
      b.textContent = `Difference Maker ×${t.differenceMaker}`;
      badges.appendChild(b);
    }
    if ((t.scoreSurger||0) > 0){
      const b = document.createElement("div");
      b.className="badge";
      b.textContent = `Score Surger ×${t.scoreSurger}`;
      badges.appendChild(b);
    }

    top.appendChild(avatar);
    top.appendChild(title);
    top.appendChild(badges);

    const metrics = document.createElement("div");
    metrics.className="metrics";
    const elCount = Object.values(p.elements || {}).filter(x => x && (x.end!==undefined || x.growth!==undefined)).length;
    const avg = avgEnd2025(p);

    metrics.innerHTML = `
      <div>Average per element: <b>${fmt(avg)}</b></div>
      <div>Elements with data: <b>${elCount}</b></div>
    `;

    const bars = document.createElement("div");
    bars.className="bars";

    const bestElForType = getBestElement(p, type, relMap);
    const maxVal = computePerCardMax(p, type);

    for (const el of ELEMENTS){
      let shown = "—";
      let barW = 0;

      if (type === "rel"){
        const relRow = relMap?.[p.nick] || null;
        const val = relRow?.[el];
        barW = (val === null || val === undefined || Number.isNaN(val)) ? 0 : Math.max(0, Math.min(100, val));
        shown = (val === null || val === undefined || Number.isNaN(val)) ? "—" : `${val}%`;
      } else if (type === "growth") {
        const val = p.elements?.[el]?.growth;
        barW = (val === null || val === undefined || Number.isNaN(val)) ? 0 : Math.min(100, Math.round((Math.abs(val)/maxVal)*100));
        shown = pct(val);
      } else { // abs_end
        const val = p.elements?.[el]?.end;
        barW = (val === null || val === undefined || Number.isNaN(val)) ? 0 : Math.min(100, Math.round((Math.abs(val)/maxVal)*100));
        shown = fmt(val);
      }

      const row = document.createElement("div");
      row.className = "row" + (bestElForType===el ? " best" : "");

      const elDiv = document.createElement("div");
      elDiv.className="el";
      elDiv.textContent = el;

      const bar = document.createElement("div");
      bar.className="bar";

      const fill = document.createElement("div");
      fill.className="fill";
      fill.style.width = barW + "%";
      const c = EL_COLOR[el] || "rgba(255,255,255,.25)";
      fill.style.background = `linear-gradient(90deg, ${c}, rgba(255,255,255,.18))`;
      bar.appendChild(fill);

      const valDiv = document.createElement("div");
      valDiv.className="val";
      valDiv.textContent = shown;

      row.appendChild(elDiv);
      row.appendChild(bar);
      row.appendChild(valDiv);

      bars.appendChild(row);
    }

    const footer = document.createElement("div");
    footer.className="footer";



    inner.appendChild(top);
    inner.appendChild(metrics);
    inner.appendChild(bars);
    inner.appendChild(footer);

    card.appendChild(inner);
    grid.appendChild(card);
  }

  const stats = document.getElementById("stats");
  stats.textContent = `Showing: ${view.length} / ${players.length} players.`;
}

async function init(){
  const [dataRes, rosterRes, relRes, titlesRes] = await Promise.allSettled([
    loadJSON("data/players_2025.json"),
    loadJSON("data/roster.json"),
    loadJSON("data/relative_2025.json"),
    loadJSON("data/titles.json")
  ]);

  const playersRaw = (dataRes.status==="fulfilled") ? dataRes.value.players : [];
  const rosterObj = (rosterRes.status==="fulfilled") ? rosterRes.value : null;
  const relMap = (relRes.status==="fulfilled") ? (relRes.value.relative_percent || {}) : {};
  const titlesMap = (titlesRes.status==="fulfilled") ? titlesRes.value : {};

  const players = applyRoster(playersRaw, rosterObj);

  // Default sort = joined
  const sortSel = document.getElementById("sortBy");
  if (sortSel) sortSel.value = "joined";

  const rerender = () => {
    const type = getType();
    render(players, relMap, titlesMap);
  };

  ["q","sortBy","type"].forEach(id=>{
    document.getElementById(id).addEventListener("input", rerender);
    document.getElementById(id).addEventListener("change", rerender);
  });

  rerender();
}

init().catch(err=>{
  console.error(err);
  const s = document.getElementById("stats");
  if (s) s.textContent = "Failed to load data. Make sure the repo contains the data/ folder with JSON files.";
});
