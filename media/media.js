const $ = (id) => document.getElementById(id);

const state = {
  songs: [],
  filtered: [],
  lyrics: {},
  currentIndex: 0,
  selectedIndex: 0,
  isWheelView: true,
  loop: false,
  autoScroll: false,
  fontSize: 14,
  recent: []
};

const STORAGE_RECENT = "VS_MEDIA_RECENT_V1";
const STORAGE_LAST = "VS_MEDIA_LAST_V1";

function ytEmbedUrl(youtubeId) {
  // autoplay=1 to start when selecting
  return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
}

function ytWatchUrl(youtubeId) {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load: " + path);
  return res.json();
}

function clampIndex(i, len) {
  if (len <= 0) return 0;
  return (i % len + len) % len;
}

function saveRecent() {
  localStorage.setItem(STORAGE_RECENT, JSON.stringify(state.recent));
}
function loadRecent() {
  try {
    const raw = localStorage.getItem(STORAGE_RECENT);
    state.recent = raw ? JSON.parse(raw) : [];
  } catch {
    state.recent = [];
  }
}
function saveLast() {
  const song = state.filtered[state.currentIndex];
  if (!song) return;
  localStorage.setItem(STORAGE_LAST, JSON.stringify({ id: song.id }));
}
function loadLastId() {
  try {
    const raw = localStorage.getItem(STORAGE_LAST);
    const obj = raw ? JSON.parse(raw) : null;
    return obj?.id || null;
  } catch {
    return null;
  }
}

function setNowPlaying(song) {
  $("nowTitle").textContent = song?.title || "—";
  $("nowArtist").textContent = song?.artist || "—";
  $("centerTitle").textContent = song?.title || "—";
  $("centerArtist").textContent = song?.artist || "—";
}

function pushRecent(song) {
  if (!song) return;
  // unique by id, keep max 10
  state.recent = [song.id, ...state.recent.filter(id => id !== song.id)].slice(0, 10);
  saveRecent();
  renderRecent();
}

function renderRecent() {
  const wrap = $("recentList");
  wrap.innerHTML = "";
  const map = new Map(state.songs.map(s => [s.id, s]));
  state.recent.forEach(id => {
    const s = map.get(id);
    if (!s) return;
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = `${s.title} • ${s.artist}`;
    chip.title = "Click to play";
    chip.onclick = () => {
      const idx = state.filtered.findIndex(x => x.id === s.id);
      if (idx >= 0) playAt(idx);
      else {
        // if filtered hides it, clear search
        $("searchInput").value = "";
        applyFilter("");
        const idx2 = state.filtered.findIndex(x => x.id === s.id);
        if (idx2 >= 0) playAt(idx2);
      }
    };
    wrap.appendChild(chip);
  });
}

function renderLyrics(song) {
  const panel = $("lyricsPanel");
  panel.style.fontSize = state.fontSize + "px";
  panel.innerHTML = "";

  if (!song) {
    $("lyricsInfo").textContent = "Chọn bài để xem lyrics";
    return;
  }

  const lines = state.lyrics[song.id] || [];
  $("lyricsInfo").textContent = lines.length ? `${song.title} • ${lines.length} lines` : `${song.title} • (No lyrics)`;

  if (!lines.length) {
    const p = document.createElement("div");
    p.className = "lyrics-line";
    p.textContent = "Chưa có lyrics cho bài này. Anh có thể thêm trong lyrics.json";
    panel.appendChild(p);
    return;
  }

  lines.forEach((t, i) => {
    const p = document.createElement("div");
    p.className = "lyrics-line";
    p.dataset.idx = String(i);
    p.textContent = t;
    panel.appendChild(p);
  });

  // highlight first line
  setLyricsActive(0);
}

function setLyricsActive(lineIndex) {
  const panel = $("lyricsPanel");
  const items = [...panel.querySelectorAll(".lyrics-line")];
  items.forEach(el => el.classList.remove("active"));
  const active = items[lineIndex];
  if (active) {
    active.classList.add("active");
    if (state.autoScroll) {
      active.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";

  state.filtered.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.onclick = () => playAt(i);

    const left = document.createElement("div");
    left.className = "list-left";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = s.title;

    const a = document.createElement("div");
    a.className = "list-artist";
    a.textContent = s.artist;

    left.appendChild(t);
    left.appendChild(a);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = s.tag || "—";

    row.appendChild(left);
    row.appendChild(badge);
    list.appendChild(row);
  });

  $("plCount").textContent = `${state.filtered.length} songs`;
}

function renderWheel() {
  const wheel = $("wheel");
  wheel.innerHTML = "";

  const n = state.filtered.length;
  if (!n) return;

  // Use at most 12 items on wheel for clarity (pick surrounding)
  const maxItems = Math.min(12, n);
  const step = 360 / maxItems;

  // Build a "window" around selectedIndex
  const start = state.selectedIndex - Math.floor(maxItems / 2);
  for (let k = 0; k < maxItems; k++) {
    const idx = clampIndex(start + k, n);
    const s = state.filtered[idx];

    const item = document.createElement("div");
    item.className = "wheel-item" + (idx === state.selectedIndex ? " active" : "");
    item.style.setProperty("--ang", `${k * step}deg`);
    item.textContent = `${s.title} • ${s.artist}`;
    item.title = "Click to select";
    item.onclick = () => {
      state.selectedIndex = idx;
      updateCenter();
      renderWheel();
    };
    wheel.appendChild(item);
  }

  $("plCount").textContent = `${state.filtered.length} songs`;
}

function updateCenter() {
  const s = state.filtered[state.selectedIndex];
  $("centerTitle").textContent = s?.title || "—";
  $("centerArtist").textContent = s?.artist || "—";
}

function setView(isWheel) {
  state.isWheelView = isWheel;
  $("wheelView").classList.toggle("hidden", !isWheel);
  $("listView").classList.toggle("hidden", isWheel);
  $("btnToggleView").textContent = isWheel ? "Wheel" : "List";
}

function applyFilter(keyword) {
  const k = keyword.trim().toLowerCase();
  if (!k) state.filtered = [...state.songs];
  else {
    state.filtered = state.songs.filter(s => {
      const hay = `${s.title} ${s.artist} ${s.tag}`.toLowerCase();
      return hay.includes(k);
    });
  }

  // reset indices safely
  state.currentIndex = clampIndex(state.currentIndex, state.filtered.length || 1);
  state.selectedIndex = clampIndex(state.selectedIndex, state.filtered.length || 1);

  renderList();
  renderWheel();
  updateCenter();

  // if nothing
  if (!state.filtered.length) {
    $("nowTitle").textContent = "No results";
    $("nowArtist").textContent = "Try another keyword";
    $("ytFrame").src = "";
    $("lyricsPanel").innerHTML = "";
    $("lyricsInfo").textContent = "Không có bài phù hợp";
  }
}

function playAt(i) {
  if (!state.filtered.length) return;
  state.currentIndex = clampIndex(i, state.filtered.length);
  state.selectedIndex = state.currentIndex;

  const song = state.filtered[state.currentIndex];
  setNowPlaying(song);

  // load youtube
  $("ytFrame").src = ytEmbedUrl(song.youtubeId);

  // lyrics
  renderLyrics(song);

  // highlight + simulate auto highlight lines (demo)
  // (Không sync time vì cần YouTube API; demo đổi line mỗi 4s)
  startDemoLyricsHighlight(song);

  // recent
  pushRecent(song);

  // wheel/list refresh
  renderWheel();
  saveLast();
}

let demoTimer = null;
function startDemoLyricsHighlight(song) {
  if (demoTimer) clearInterval(demoTimer);
  const lines = state.lyrics[song.id] || [];
  if (!lines.length) return;

  let idx = 0;
  setLyricsActive(0);
  demoTimer = setInterval(() => {
    idx = (idx + 1) % lines.length;
    setLyricsActive(idx);
  }, 4000);
}

function nextSong() {
  if (!state.filtered.length) return;
  const next = state.currentIndex + 1;
  playAt(next);
}
function prevSong() {
  if (!state.filtered.length) return;
  const prev = state.currentIndex - 1;
  playAt(prev);
}

function shuffle() {
  // Fisher-Yates on full songs, then re-apply filter
  const arr = [...state.songs];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  state.songs = arr;
  applyFilter($("searchInput").value);
  playAt(0);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied ✅");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("Copied ✅");
  }
}

/* =========================
   WHEEL DRAG / TOUCH ROTATE
   ========================= */
function setupWheelDrag() {
  const wheel = $("wheel");
  let dragging = false;
  let lastX = 0;

  const onDown = (x) => {
    dragging = true;
    lastX = x;
  };
  const onMove = (x) => {
    if (!dragging) return;
    const dx = x - lastX;
    lastX = x;

    // dx -> change selectedIndex
    if (Math.abs(dx) > 3) {
      const dir = dx > 0 ? -1 : 1; // swipe right => previous
      state.selectedIndex = clampIndex(state.selectedIndex + dir, state.filtered.length || 1);
      updateCenter();
      renderWheel();
    }
  };
  const onUp = () => { dragging = false; };

  wheel.addEventListener("mousedown", e => onDown(e.clientX));
  window.addEventListener("mousemove", e => onMove(e.clientX));
  window.addEventListener("mouseup", onUp);

  wheel.addEventListener("touchstart", e => onDown(e.touches[0].clientX), { passive: true });
  wheel.addEventListener("touchmove", e => onMove(e.touches[0].clientX), { passive: true });
  wheel.addEventListener("touchend", onUp);

  // also allow wheel scroll
  wheel.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    state.selectedIndex = clampIndex(state.selectedIndex + dir, state.filtered.length || 1);
    updateCenter();
    renderWheel();
  }, { passive: false });
}

function initUI() {
  $("btnPrev").onclick = prevSong;
  $("btnNext").onclick = nextSong;

  $("btnPlay").onclick = () => {
    // YouTube iframe cannot be controlled without API.
    // We provide "reload" to simulate play.
    const song = state.filtered[state.currentIndex];
    if (!song) return;
    $("ytFrame").src = ytEmbedUrl(song.youtubeId);
  };

  $("btnOpenYT").onclick = () => {
    const song = state.filtered[state.currentIndex];
    if (!song) return;
    window.open(ytWatchUrl(song.youtubeId), "_blank");
  };

  $("btnCopyLink").onclick = async () => {
    const song = state.filtered[state.currentIndex];
    if (!song) return;
    await copyText(ytWatchUrl(song.youtubeId));
  };

  $("btnToggleView").onclick = () => setView(!state.isWheelView);

  $("btnShuffle").onclick = shuffle;

  $("btnLoop").onclick = () => {
    state.loop = !state.loop;
    $("btnLoop").textContent = `Loop: ${state.loop ? "On" : "Off"}`;
  };

  $("btnWheelLeft").onclick = () => {
    state.selectedIndex = clampIndex(state.selectedIndex - 1, state.filtered.length || 1);
    updateCenter();
    renderWheel();
  };
  $("btnWheelRight").onclick = () => {
    state.selectedIndex = clampIndex(state.selectedIndex + 1, state.filtered.length || 1);
    updateCenter();
    renderWheel();
  };
  $("btnWheelPick").onclick = () => playAt(state.selectedIndex);

  $("searchInput").addEventListener("input", (e) => {
    applyFilter(e.target.value);
  });

  $("btnClearRecent").onclick = () => {
    state.recent = [];
    saveRecent();
    renderRecent();
  };

  $("btnLyricsBigger").onclick = () => {
    state.fontSize = Math.min(20, state.fontSize + 1);
    const s = state.filtered[state.currentIndex];
    renderLyrics(s);
  };
  $("btnLyricsSmaller").onclick = () => {
    state.fontSize = Math.max(12, state.fontSize - 1);
    const s = state.filtered[state.currentIndex];
    renderLyrics(s);
  };
  $("btnLyricsAutoScroll").onclick = () => {
    state.autoScroll = !state.autoScroll;
    $("btnLyricsAutoScroll").textContent = `AutoScroll: ${state.autoScroll ? "On" : "Off"}`;
  };

  // if loop on, when user clicks next beyond end, it wraps anyway in clampIndex.
  // Note: true "end of youtube video" event needs YouTube Iframe API; bản này chưa dùng API.
  setupWheelDrag();
}

async function main() {
  initUI();
  loadRecent();
  renderRecent();

  // Load playlist + lyrics
  state.songs = await loadJSON("./playlist.json");
  state.lyrics = await loadJSON("./lyrics.json");

  state.filtered = [...state.songs];

  // Restore last song if exists
  const lastId = loadLastId();
  if (lastId) {
    const idx = state.filtered.findIndex(s => s.id === lastId);
    state.currentIndex = idx >= 0 ? idx : 0;
    state.selectedIndex = state.currentIndex;
  } else {
    state.currentIndex = 0;
    state.selectedIndex = 0;
  }

  renderList();
  renderWheel();
  updateCenter();

  // autoplay first/last
  if (state.filtered.length) {
    playAt(state.currentIndex);
  }
}

main().catch(err => {
  console.error(err);
  alert("Media load error. Check console + file paths.");
});
