const BUDGET = 25000;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const VIBES = ["Beach","Hills","Heritage","Nature","Wildlife","Backwaters","Spiritual","Food"];
const MULT = {budget:{travel:1,stay:1,food:1,local:1,act:1}, comfort:{travel:1.4,stay:1.8,food:1.3,local:1.2,act:1}};
const LABEL = {travel:"Return travel",stay:"Stay",food:"Food",local:"Local transport",act:"Sights & activities"};
const COLORS = {travel:"var(--teal)",stay:"var(--accent)",food:"var(--good)",local:"var(--warn)",act:"var(--muted)",buffer:"var(--line)"};
const STORE_KEY = "trip-shuffler:filters";

const state = {vibes:new Set(), days:5, mode:"any", style:"budget", people:4, season:"now", current:null, history:[]};
const nowMonth = new Date().getMonth()+1;

const $ = id => document.getElementById(id);
const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
const round100 = n => Math.round(n/100)*100;
const clampPeople = n => Math.min(30, Math.max(1, (n|0) || 1));

function costsFor(t){
  const m = MULT[state.style]; const rows = {};
  let sum = 0;
  for (const k of Object.keys(t.costs)){ const v = round100(t.costs[k][0]*m[k]); rows[k] = v; sum += v; }
  const buffer = Math.max(0, Math.min(round100(sum*0.08), BUDGET - sum));
  return {rows, sum, buffer, total: sum + buffer};
}

function pool(){
  return TRIPS.filter(t=>{
    if (state.vibes.size && !t.vibe.some(v=>state.vibes.has(v))) return false;
    if (state.days < 5 && t.days > state.days) return false;
    if (state.mode !== "any" && t.mode !== state.mode) return false;
    if (state.season === "now" && !t.best.includes(nowMonth)) return false;
    return costsFor(t).sum <= BUDGET;
  });
}

/* ---------- persistence: filters in localStorage, shareable state in the URL hash ---------- */

function filtersObj(){
  return {vibes:[...state.vibes], days:state.days, mode:state.mode, style:state.style, people:state.people, season:state.season};
}
function applyFilters(f){
  if (!f) return;
  if (Array.isArray(f.vibes)) state.vibes = new Set(f.vibes.filter(v=>VIBES.includes(v)));
  if ([2,3,4,5].includes(+f.days)) state.days = +f.days;
  if (["any","bus","train","flight"].includes(f.mode)) state.mode = f.mode;
  if (MULT[f.style]) state.style = f.style;
  if (f.people != null) state.people = clampPeople(+f.people);
  if (["any","now"].includes(f.season)) state.season = f.season;
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
  return {filters:f, trip:h.get("trip")};
}
function shareUrl(){
  const h = new URLSearchParams();
  if (state.current) h.set("trip", state.current.id);
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
  if (!t){ el.innerHTML = `<div class="empty" style="grid-column:1/-1">No trip fits these filters inside ₹25,000. Try another vibe, more days, or Backpacker style.</div>`; return; }
  const c = costsFor(t);
  const inSeason = t.best.includes(nowMonth);
  const seasonTxt = t.best.map(m=>MONTHS[m-1]).join(", ");
  const left = BUDGET - c.total;
  const people = state.people;
  const overCap = c.sum > BUDGET;
  const scale = Math.max(BUDGET, c.total);
  const segs = Object.entries(c.rows).map(([k,v])=>`<i style="width:${v/scale*100}%;background:${COLORS[k]}" title="${LABEL[k]} ${inr(v)}"></i>`).join("")
    + `<i style="width:${c.buffer/scale*100}%;background:${COLORS.buffer}" title="Buffer ${inr(c.buffer)}"></i>`;
  const modeName = {bus:"Bus",train:"Train",flight:"Flight"}[t.mode];

  el.innerHTML = `
  <div class="stub">
    <div class="route">BLR → ${t.code}<small>Bengaluru to ${t.name}</small></div>
    <div><div class="k">Duration</div><div class="v">${t.days}D / ${t.nights}N</div></div>
    <div><div class="k">Mode</div><div class="v">${modeName}</div></div>
    <div><div class="k">Distance</div><div class="v">~${t.km.toLocaleString("en-IN")} km</div></div>
    <div><div class="k">Per head</div><div class="v">${inr(c.total)}</div></div>
  </div>
  <div class="body">
    <div class="dest-head">
      <div>
        <div class="dest-name ${animate?"landed":""}" id="destName">${t.name}</div>
        <div class="dest-sub">${t.region} · ${t.out}</div>
      </div>
      <div class="badges">
        ${t.vibe.map(v=>`<span class="badge">${v}</span>`).join("")}
        <span class="badge ${inSeason?"season":"off"}" title="Best: ${seasonTxt}">${inSeason?"In season":"Off season now"}</span>
        ${overCap ? `<span class="badge off">Over ₹25k in this style</span>` : c.sum > 20000 ? `<span class="badge tight">Tight on budget</span>`:""}
      </div>
    </div>
    <p class="pitch">${t.pitch}</p>

    <div class="grid2">
      <div class="panel">
        <h3>Cost per person</h3>
        <table class="ledger">
          ${Object.entries(c.rows).map(([k,v])=>`<tr><td>${LABEL[k]}<span class="note">${t.costs[k][1]}</span></td><td>${inr(v)}</td></tr>`).join("")}
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
        <ul class="tips">${t.tips.map(x=>`<li>${x}</li>`).join("")}<li>Best months: ${seasonTxt}.</li></ul>
      </div>
    </div>

    <div class="actions">
      <button class="btn" type="button" id="copyBtn">Copy plan</button>
      <button class="btn" type="button" id="shareBtn">Copy share link</button>
      <button class="btn" type="button" id="againBtn">Shuffle again</button>
      <span class="toast" id="toast" role="status"></span>
    </div>
  </div>`;
  $("copyBtn").onclick = ()=>copyText(planText(t,c), "Plan copied");
  $("shareBtn").onclick = ()=>copyText(shareUrl(), "Link copied");
  $("againBtn").onclick = shuffle;
}

function planText(t,c){
  const people = state.people;
  return [`${t.name} trip from Bengaluru (${t.days}D/${t.nights}N, ${state.style==="comfort"?"Comfort":"Backpacker"})`,
    `Getting there: ${t.out}`, "",
    ...Object.entries(c.rows).map(([k,v])=>`${LABEL[k]}: ${inr(v)} (${t.costs[k][1]})`),
    `Buffer: ${inr(c.buffer)}`, `Total per person: ${inr(c.total)} | Group of ${people}: ${inr(c.total*people)}`, "",
    ...t.plan.map((d,i)=>`Day ${i+1}: ${d}`), "",
    ...t.tips.map(x=>`Tip: ${x}`)].join("\n");
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
function land(t){
  spinToken++;
  state.current = t;
  state.history = [t.id, ...state.history.filter(x=>x!==t.id)].slice(0,6);
  renderTicket(t, true); renderHistory(); renderControls(); syncHash();
}

function renderHistory(){
  const w = $("historyWrap");
  w.hidden = state.history.length < 2;
  $("history").innerHTML = state.history.map(id=>{
    const t = TRIPS.find(x=>x.id===id);
    return `<button type="button" class="chip" data-id="${id}" aria-pressed="${!!state.current&&state.current.id===id}">${t.name} · ${inr(costsFor(t).total)}</button>`;
  }).join("");
}

function refresh(){
  spinToken++;                                  // cancel any in-flight spin
  renderControls();
  const p = pool();
  if (!state.current || !p.find(t=>t.id===state.current.id)){
    state.current = p.length ? p[Math.floor(Math.random()*p.length)] : null;
    if (state.current) state.history = [state.current.id, ...state.history.filter(x=>x!==state.current.id)].slice(0,6);
  }
  renderTicket(state.current, false); renderHistory();
  saveFilters(); syncHash();
}

/* ---------- events ---------- */

$("vibes").addEventListener("click", e=>{
  const b = e.target.closest(".chip"); if (!b) return;
  const v = b.dataset.v; state.vibes.has(v) ? state.vibes.delete(v) : state.vibes.add(v); refresh();
});
$("days").onchange = e=>{ state.days = +e.target.value; refresh(); };
$("mode").onchange = e=>{ state.mode = e.target.value; refresh(); };
$("season").onchange = e=>{ state.season = e.target.value; refresh(); };
$("people").oninput = e=>{
  if (e.target.value === "") return;            // let the user clear the box while typing
  state.people = clampPeople(+e.target.value);
  renderTicket(state.current,false); saveFilters(); syncHash();
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
  const t = TRIPS.find(x=>x.id===b.dataset.id); state.current = t;
  renderTicket(t,true); renderHistory(); renderControls(); syncHash();
});
document.addEventListener("keydown", e=>{
  // Space / "s" shuffles when focus isn't in a form control
  if (e.target.closest("input,select,textarea,button")) return;
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
  state.current = shared || (p.length ? p[Math.floor(Math.random()*p.length)] : null);
  if (state.current) state.history = [state.current.id];
  renderTicket(state.current,false); renderHistory(); saveFilters(); syncHash();
})();
