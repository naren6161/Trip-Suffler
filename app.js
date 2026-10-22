const BUDGET = 25000;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const VIBES = ["Beach","Hills","Heritage","Nature","Wildlife","Backwaters","Spiritual","Food"];
const MODES = ["bus","train","flight","car","bike"];
const MODE_NAME = {bus:"Bus",train:"Train",flight:"Flight",car:"Car",bike:"Bike"};
const MULT = {budget:{travel:1,stay:1,food:1,local:1,act:1}, comfort:{travel:1.4,stay:1.8,food:1.3,local:1.2,act:1}};
const LABEL = {travel:"Return travel",stay:"Stay",food:"Food",local:"Local transport",act:"Sights & activities"};
const COLORS = {travel:"var(--teal)",stay:"var(--accent)",food:"var(--good)",local:"var(--warn)",act:"var(--muted)",buffer:"var(--line)"};
const HOME = {name:"Bengaluru", lat:12.9716, lng:77.5946};
const STORE_KEY = "trip-shuffler:filters";
const VISITED_KEY = "trip-shuffler:visited";

// Road-trip assumptions (₹ per km, return distance): car = fuel + tolls, up to 5 per car;
// bike = fuel + upkeep, 2 per bike, no tolls for two-wheelers.
const ROAD = {
  car:{perKm:8.5, seats:5, kmph:55, note:(n,p)=>`Self-drive, fuel + tolls, ${n} car${n>1?"s":""}${p>1?` for ${p}`:""}`},
  bike:{perKm:3.5, seats:2, kmph:45, note:(n,p)=>`Riding, fuel + upkeep, ${p>1?`${n} bike${n>1?"s":""}, 2 up`:"solo"}`},
};

const state = {vibes:new Set(), days:5, mode:"any", style:"budget", people:4, season:"now", visitedFilter:"show",
               current:null, travel:null, history:[]};
const nowMonth = new Date().getMonth()+1;

const $ = id => document.getElementById(id);
const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
const round100 = n => Math.round(n/100)*100;
const clampPeople = n => Math.min(30, Math.max(1, (n|0) || 1));
const esc = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- travel modes ---------- */

function modesFor(t){
  return t.road === false ? [t.mode] : [t.mode, "car", "bike"];
}
// The mode used for a trip: the ticket's own pick, else the filter, else the trip's default.
function modeFor(t){
  const m = modesFor(t);
  if (state.current && t.id === state.current.id && m.includes(state.travel)) return state.travel;
  if (m.includes(state.mode)) return state.mode;
  return t.mode;
}
function travelFor(t, mode){
  if (!ROAD[mode]) return {cost:t.costs.travel[0], note:t.costs.travel[1], out:t.out};
  const r = ROAD[mode], people = state.people;
  const vehicles = Math.ceil(people / r.seats);
  const cost = vehicles * t.km * 2 * r.perKm / people;
  const hrs = Math.round(t.km / r.kmph * 2) / 2;
  const out = mode === "car"
    ? `Self-drive ~${t.km} km, ~${hrs} hrs each way`
    : `Ride ~${t.km} km, ~${hrs} hrs each way, start at dawn`;
  return {cost, note:r.note(vehicles, people), out};
}
function roadTips(t, mode){
  if (mode === "car") return ["Costs assume one car per 5 people with FASTag tolls; parking at sights is extra.",
    t.km > 400 ? "That's a long drive; swap drivers every 2–3 hours." : "Leave before 6 am to clear the city traffic."];
  if (mode === "bike") return ["Costs assume two riders per bike. Carry riding gear, a puncture kit and rain covers.",
    t.km > 350 ? "Long ride: split it with a halt or start before 5 am, and avoid night riding on ghat roads." : "Ride in a group and keep to daylight on ghat sections."];
  return [];
}

function costsFor(t, mode = modeFor(t)){
  const m = MULT[state.style]; const rows = {}, notes = {};
  const tr = travelFor(t, mode);
  let sum = 0;
  for (const k of Object.keys(t.costs)){
    let base = t.costs[k][0], note = t.costs[k][1];
    if (k === "travel"){ base = tr.cost; note = tr.note; }
    if (k === "local" && ROAD[mode]){ base = base * 0.5; note = "Own vehicle for sightseeing: fuel & parking"; }
    const v = round100(base*m[k]); rows[k] = v; notes[k] = note; sum += v;
  }
  const buffer = Math.max(0, Math.min(round100(sum*0.08), BUDGET - sum));
  return {rows, notes, sum, buffer, total: sum + buffer, mode, out: tr.out};
}

/* ---------- visited places ---------- */

let visited = loadVisited();

function loadVisited(){
  try{ const v = JSON.parse(localStorage.getItem(VISITED_KEY) || "[]"); return Array.isArray(v) ? v : []; }catch(e){ return []; }
}
function saveVisited(){
  try{ localStorage.setItem(VISITED_KEY, JSON.stringify(visited)); }catch(e){}
}
function kmBetween(a, b){
  const R = 6371, rad = x => x*Math.PI/180;
  const dLat = rad(b.lat-a.lat), dLng = rad(b.lng-a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
// A trip counts as visited if it was marked directly or a visited place is within 25 km of it.
function visitFor(t){
  return visited.find(v=>v.tripId===t.id) || visited.find(v=>kmBetween(v,t) < 25);
}
function addVisited(p){
  const dupe = visited.find(v=>(p.tripId && v.tripId===p.tripId) || (v.name===p.name && kmBetween(v,p) < 1));
  if (dupe) return dupe;
  const v = {id:"v"+Date.now().toString(36)+Math.random().toString(36).slice(2,6), name:p.name, lat:+p.lat, lng:+p.lng,
             country:p.country||"", tripId:p.tripId||null, at:new Date().toISOString().slice(0,10)};
  visited.unshift(v); saveVisited(); onVisitedChange();
  return v;
}
function removeVisited(id){
  visited = visited.filter(v=>v.id!==id); saveVisited(); onVisitedChange();
}
function toggleTripVisited(t){
  const v = visitFor(t);
  if (v){ visited = visited.filter(x=>x.tripId!==t.id && kmBetween(x,t) >= 25); saveVisited(); onVisitedChange(); }
  else addVisited({name:t.name, lat:t.lat, lng:t.lng, country:"India", tripId:t.id});
}
function onVisitedChange(){
  renderControls(); renderTicket(state.current, false); renderHistory(); renderVisitedList();
  if (window.TravelMap) TravelMap.refresh();
}
function renderVisitedList(){
  const countries = new Set(visited.map(v=>v.country).filter(Boolean));
  const tripsDone = TRIPS.filter(visitFor).length;
  $("mapStats").innerHTML = `<span><b>${visited.length}</b> place${visited.length===1?"":"s"}</span>`
    + `<span><b>${countries.size}</b> countr${countries.size===1?"y":"ies"}</span>`
    + `<span><b>${tripsDone}/${TRIPS.length}</b> shuffler trips</span>`;
  $("visitedList").innerHTML = visited.length ? visited.map(v=>`
    <li>
      <span class="vname">${esc(v.name)}<small>${esc([v.country, v.at].filter(Boolean).join(" · "))}</small></span>
      <span class="vact">
        <button type="button" class="btn sm" data-act="show" data-id="${v.id}">Show</button>
        <button type="button" class="btn sm" data-act="remove" data-id="${v.id}" aria-label="Remove ${esc(v.name)}">Remove</button>
      </span>
    </li>`).join("") : `<li class="none">Nothing marked yet. Search a place above or tap the map.</li>`;
}

function pool(){
  return TRIPS.filter(t=>{
    if (state.vibes.size && !t.vibe.some(v=>state.vibes.has(v))) return false;
    if (state.days < 5 && t.days > state.days) return false;
    if (state.mode !== "any" && !modesFor(t).includes(state.mode)) return false;
    if (state.season === "now" && !t.best.includes(nowMonth)) return false;
    if (state.visitedFilter === "hide" && visitFor(t)) return false;
    const mode = state.mode !== "any" ? state.mode : t.mode;
    return costsFor(t, mode).sum <= BUDGET;
  });
}

/* ---------- persistence: filters in localStorage, shareable state in the URL hash ---------- */

function filtersObj(){
  return {vibes:[...state.vibes], days:state.days, mode:state.mode, style:state.style, people:state.people,
          season:state.season, visitedFilter:state.visitedFilter};
}
function applyFilters(f){
  if (!f) return;
  if (Array.isArray(f.vibes)) state.vibes = new Set(f.vibes.filter(v=>VIBES.includes(v)));
  if ([2,3,4,5].includes(+f.days)) state.days = +f.days;
  if (f.mode === "any" || MODES.includes(f.mode)) state.mode = f.mode;
  if (MULT[f.style]) state.style = f.style;
  if (f.people != null) state.people = clampPeople(+f.people);
  if (["any","now"].includes(f.season)) state.season = f.season;
  if (["show","hide"].includes(f.visitedFilter)) state.visitedFilter = f.visitedFilter;
}
function saveFilters(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(filtersObj())); }catch(e){}
}
function loadFilters(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); }catch(e){ return null; }
}
function readHash(){
  const h = new URLSearchParams(location.hash.slice(1));
  if (![...h.keys()].length) return null;
  const f = {};
  if (h.has("vibes")) f.vibes = h.get("vibes").split(",").filter(Boolean);
  for (const k of ["days","mode","style","people","season"]) if (h.has(k)) f[k] = h.get(k);
  return {filters:f, trip:h.get("trip"), travel:h.get("by")};
}
function shareUrl(){
  const h = new URLSearchParams();
  if (state.current){ h.set("trip", state.current.id); h.set("by", modeFor(state.current)); }
  h.set("style", state.style); h.set("people", state.people);
  h.set("days", state.days); h.set("mode", state.mode); h.set("season", state.season);
  if (state.vibes.size) h.set("vibes", [...state.vibes].join(","));
  return location.href.split("#")[0] + "#" + h.toString();
}
function syncHash(){
  try{ history.replaceState(null, "", shareUrl()); }catch(e){}
}

/* ---------- rendering ---------- */

function syncInputs(){
  $("days").value = state.days;
  $("mode").value = state.mode;
  $("season").value = state.season;
  $("people").value = state.people;
  $("visitedFilter").value = state.visitedFilter;
  document.querySelectorAll("#style button").forEach(x=>x.setAttribute("aria-pressed", x.dataset.v===state.style));
}

function renderControls(){
  $("vibes").innerHTML = VIBES.map(x=>`<button type="button" class="chip" data-v="${x}" aria-pressed="${state.vibes.has(x)}">${x}</button>`).join("");
  const p = pool();
  $("count").textContent = p.length ? `${p.length} trip${p.length>1?"s":""} match your filters` : "No trips match. Loosen a filter.";
  $("shuffleBtn").disabled = !p.length;
}

function renderTicket(t, animate){
  const el = $("ticket");
  if (!t){ el.innerHTML = `<div class="empty" style="grid-column:1/-1">No trip fits these filters inside ₹25,000. Try another vibe, more days, another way of getting there, or Backpacker style.</div>`; return; }
  const c = costsFor(t);
  const inSeason = t.best.includes(nowMonth);
  const seasonTxt = t.best.map(m=>MONTHS[m-1]).join(", ");
  const left = BUDGET - c.total;
  const people = state.people;
  const overCap = c.sum > BUDGET;
  const been = visitFor(t);
  const scale = Math.max(BUDGET, c.total);
  const segs = Object.entries(c.rows).map(([k,v])=>`<i style="width:${v/scale*100}%;background:${COLORS[k]}" title="${LABEL[k]} ${inr(v)}"></i>`).join("")
    + `<i style="width:${c.buffer/scale*100}%;background:${COLORS.buffer}" title="Buffer ${inr(c.buffer)}"></i>`;
  const tips = [...roadTips(t, c.mode), ...t.tips];
  const modeBtns = modesFor(t).map(m=>{
    const mc = costsFor(t, m);
    return `<button type="button" data-m="${m}" aria-pressed="${m===c.mode}" title="${inr(mc.total)} per person">${MODE_NAME[m]}<small>${inr(mc.total)}</small></button>`;
  }).join("");

  el.innerHTML = `
  <div class="stub">
    <div class="route">BLR → ${t.code}<small>Bengaluru to ${t.name}</small></div>
    <div><div class="k">Duration</div><div class="v">${t.days}D / ${t.nights}N</div></div>
    <div><div class="k">Mode</div><div class="v">${MODE_NAME[c.mode]}</div></div>
    <div><div class="k">Distance</div><div class="v">~${t.km.toLocaleString("en-IN")} km</div></div>
    <div><div class="k">Per head</div><div class="v">${inr(c.total)}</div></div>
  </div>
  <div class="body">
    <div class="dest-head">
      <div>
        <div class="dest-name ${animate?"landed":""}" id="destName">${t.name}</div>
        <div class="dest-sub">${t.region} · ${c.out}</div>
        <button class="visit-toggle ${been?"on":""}" type="button" id="visitTop" aria-pressed="${!!been}">${been?`✓ Been to ${t.name}`:`I've been to ${t.name}`}</button>
      </div>
      <div class="badges">
        ${been ? `<span class="badge season">✓ Visited</span>` : ""}
        ${t.vibe.map(v=>`<span class="badge">${v}</span>`).join("")}
        <span class="badge ${inSeason?"season":"off"}" title="Best: ${seasonTxt}">${inSeason?"In season":"Off season now"}</span>
        ${overCap ? `<span class="badge off">Over ₹25k this way</span>` : c.sum > 20000 ? `<span class="badge tight">Tight on budget</span>`:""}
      </div>
    </div>
    <p class="pitch">${t.pitch}</p>

    <div class="field">
      <span class="lbl">Travel by</span>
      <div class="seg travel" id="travelSeg">${modeBtns}</div>
    </div>

    <div class="grid2">
      <div class="panel">
        <h3>Cost per person</h3>
        <table class="ledger">
          ${Object.entries(c.rows).map(([k,v])=>`<tr><td>${LABEL[k]}<span class="note">${c.notes[k]}</span></td><td>${inr(v)}</td></tr>`).join("")}
          <tr><td>Buffer<span class="note">Snacks, tips, surprises</span></td><td>${inr(c.buffer)}</td></tr>
          <tr class="total"><td>Total per person</td><td>${inr(c.total)}</td></tr>
        </table>
        <div class="meter">
          <div class="bar" role="img" aria-label="${inr(c.total)} of ₹25,000 used">${segs}</div>
          <div class="cap"><span>${inr(c.total)} used</span><span>${left>0?inr(left)+" spare":left<0?inr(-left)+" over":"At the cap"}</span></div>
        </div>
        <div class="group"><span>Group of ${people}</span><span>Total <b>${inr(c.total*people)}</b></span><span>Cap <b>${inr(BUDGET*people)}</b></span></div>
      </div>

      <div class="panel">
        <h3>Day by day</h3>
        <ol class="days">
          ${t.plan.map((d,i)=>`<li><span class="d">DAY ${i+1}</span><p>${d}</p></li>`).join("")}
        </ol>
        <h3 style="margin-top:16px">Tips</h3>
        <ul class="tips">${tips.map(x=>`<li>${x}</li>`).join("")}<li>Best months: ${seasonTxt}.</li></ul>
      </div>
    </div>

    <div class="actions">
      <button class="btn ${been?"on":""}" type="button" id="visitBtn" aria-pressed="${!!been}">${been?"✓ Visited":"Mark visited"}</button>
      <button class="btn" type="button" id="mapBtn">Show on map</button>
      <button class="btn" type="button" id="copyBtn">Copy plan</button>
      <button class="btn" type="button" id="shareBtn">Copy share link</button>
      <button class="btn" type="button" id="againBtn">Shuffle again</button>
      <span class="toast" id="toast" role="status"></span>
    </div>
  </div>`;
  $("travelSeg").onclick = e=>{
    const b = e.target.closest("button"); if (!b) return;
    state.travel = b.dataset.m; renderTicket(t,false); renderHistory(); syncHash();
    if (window.TravelMap) TravelMap.refresh();
  };
  $("visitBtn").onclick = $("visitTop").onclick = ()=>toggleTripVisited(t);
  $("mapBtn").onclick = ()=>{ if (window.TravelMap) TravelMap.focusTrip(t); };
  $("copyBtn").onclick = ()=>copyText(planText(t,c), "Plan copied");
  $("shareBtn").onclick = ()=>copyText(shareUrl(), "Link copied");
  $("againBtn").onclick = shuffle;
}

function planText(t,c){
  const people = state.people;
  return [`${t.name} trip from Bengaluru (${t.days}D/${t.nights}N, ${state.style==="comfort"?"Comfort":"Backpacker"}, by ${MODE_NAME[c.mode].toLowerCase()})`,
    `Getting there: ${c.out}`, "",
    ...Object.entries(c.rows).map(([k,v])=>`${LABEL[k]}: ${inr(v)} (${c.notes[k]})`),
    `Buffer: ${inr(c.buffer)}`, `Total per person: ${inr(c.total)} | Group of ${people}: ${inr(c.total*people)}`, "",
    ...t.plan.map((d,i)=>`Day ${i+1}: ${d}`), "",
    ...[...roadTips(t, c.mode), ...t.tips].map(x=>`Tip: ${x}`)].join("\n");
}

function copyText(txt, okMsg){
  const toast = $("toast");
  const done = ()=>{ toast.textContent = okMsg; setTimeout(()=>{ toast.textContent=""; },2000); };
  const fallback = ()=>{
    const ta = document.createElement("textarea"); ta.value = txt; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy") ? done() : (toast.textContent = "Couldn't copy; select it manually"); }
    catch(e){ toast.textContent = "Couldn't copy; select it manually"; }
    ta.remove();
  };
  try{
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done).catch(fallback);
    else fallback();
  }catch(e){ fallback(); }
}

/* ---------- shuffle ---------- */

let spinToken = 0;
function shuffle(){
  const p = pool(); if (!p.length) return;
  let choices = p.filter(t=>!state.current || t.id !== state.current.id);
  if (!choices.length) choices = p;
  const pick = choices[Math.floor(Math.random()*choices.length)];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nameEl = $("destName");
  if (reduce || p.length < 2 || !nameEl){ land(pick); return; }
  const token = ++spinToken;
  $("shuffleBtn").disabled = true;
  let i = 0, delay = 50;
  const tick = ()=>{
    if (token !== spinToken) return;          // a newer shuffle or a filter change took over
    nameEl.textContent = p[Math.floor(Math.random()*p.length)].name;
    i++; delay *= 1.12;
    if (i < 14) setTimeout(tick, delay); else land(pick);
  };
  tick();
}
function setCurrent(t){
  state.current = t; state.travel = null;
}
function land(t){
  spinToken++;
  setCurrent(t);
  state.history = [t.id, ...state.history.filter(x=>x!==t.id)].slice(0,6);
  renderTicket(t, true); renderHistory(); renderControls(); syncHash();
  if (window.TravelMap) TravelMap.refresh();
}

function renderHistory(){
  const w = $("historyWrap");
  w.hidden = state.history.length < 2;
  $("history").innerHTML = state.history.map(id=>{
    const t = TRIPS.find(x=>x.id===id);
    return `<button type="button" class="chip" data-id="${id}" aria-pressed="${!!state.current&&state.current.id===id}">${visitFor(t)?"✓ ":""}${t.name} · ${inr(costsFor(t).total)}</button>`;
  }).join("");
}

function refresh(){
  spinToken++;                                  // cancel any in-flight spin
  renderControls();
  const p = pool();
  if (!state.current || !p.find(t=>t.id===state.current.id)){
    setCurrent(p.length ? p[Math.floor(Math.random()*p.length)] : null);
    if (state.current) state.history = [state.current.id, ...state.history.filter(x=>x!==state.current.id)].slice(0,6);
  }
  renderTicket(state.current, false); renderHistory();
  saveFilters(); syncHash();
  if (window.TravelMap) TravelMap.refresh();
}

/* ---------- events ---------- */

$("vibes").addEventListener("click", e=>{
  const b = e.target.closest(".chip"); if (!b) return;
  const v = b.dataset.v; state.vibes.has(v) ? state.vibes.delete(v) : state.vibes.add(v); refresh();
});
$("days").onchange = e=>{ state.days = +e.target.value; refresh(); };
$("mode").onchange = e=>{ state.mode = e.target.value; state.travel = null; refresh(); };
$("season").onchange = e=>{ state.season = e.target.value; refresh(); };
$("visitedFilter").onchange = e=>{ state.visitedFilter = e.target.value; refresh(); };
$("people").oninput = e=>{
  if (e.target.value === "") return;            // let the user clear the box while typing
  state.people = clampPeople(+e.target.value);
  refresh();                                    // car/bike costs depend on group size
};
$("people").onblur = e=>{ e.target.value = state.people; };
$("style").addEventListener("click", e=>{
  const b = e.target.closest("button"); if (!b) return;
  state.style = b.dataset.v;
  document.querySelectorAll("#style button").forEach(x=>x.setAttribute("aria-pressed", x===b));
  refresh();
});
$("shuffleBtn").onclick = shuffle;
$("history").addEventListener("click", e=>{
  const b = e.target.closest(".chip"); if (!b) return;
  spinToken++;
  const t = TRIPS.find(x=>x.id===b.dataset.id); setCurrent(t);
  renderTicket(t,true); renderHistory(); renderControls(); syncHash();
  if (window.TravelMap) TravelMap.refresh();
});
$("visitedList").addEventListener("click", e=>{
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const v = visited.find(x=>x.id===b.dataset.id); if (!v) return;
  if (b.dataset.act === "remove") removeVisited(v.id);
  else if (window.TravelMap) TravelMap.focusPlace(v);
});
document.addEventListener("keydown", e=>{
  // Space / "s" shuffles when focus isn't in a form control or the map
  if (e.target.closest("input,select,textarea,button,a,.map")) return;
  if (e.key === " " || e.key.toLowerCase() === "s"){ e.preventDefault(); shuffle(); }
});

/* ---------- boot: shared link > saved filters > defaults ---------- */

(function init(){
  const fromHash = readHash();
  applyFilters(fromHash ? fromHash.filters : loadFilters());
  syncInputs(); renderControls();
  const shared = fromHash && TRIPS.find(t=>t.id===fromHash.trip);
  const p = pool();
  // a shared trip is shown even if it falls outside the viewer's current pool
  setCurrent(shared || (p.length ? p[Math.floor(Math.random()*p.length)] : null));
  if (shared && MODES.includes(fromHash.travel)) state.travel = fromHash.travel;
  if (state.current) state.history = [state.current.id];
  renderTicket(state.current,false); renderHistory(); renderVisitedList(); saveFilters(); syncHash();
})();
