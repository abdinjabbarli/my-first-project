(() => {
  "use strict";
  const BOCA = { name: "Boca Raton", admin1: "Florida", country: "United States", latitude: 26.3683, longitude: -80.1289 };
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;

  // ---------- Theme (light / dark / system) ----------
  function currentPref() {
    try { const t = localStorage.getItem("theme"); if (t === "light" || t === "dark") return t; } catch (e) {}
    return "system";
  }
  function applyTheme(pref) {
    if (pref === "system") delete root.dataset.theme; else root.dataset.theme = pref;
    try { pref === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", pref); } catch (e) {}
    document.querySelectorAll("[data-theme-btn]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.themeBtn === pref)));
  }
  document.querySelectorAll("[data-theme-btn]").forEach((b) =>
    b.addEventListener("click", () => applyTheme(b.dataset.themeBtn)));
  applyTheme(currentPref());

  // ---------- Greeting ----------
  function greet() {
    const h = new Date().getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    $("greeting").textContent = `${part}, Dr. Lee 👋`;
  }
  greet();

  // ---------- Weather codes ----------
  const CODES = {
    0: ["Clear sky", "☀️", "🌙"], 1: ["Mainly clear", "🌤️", "🌙"], 2: ["Partly cloudy", "⛅", "☁️"], 3: ["Overcast", "☁️", "☁️"],
    45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
    56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
    61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
    66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
    71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
    80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Violent showers", "⛈️"],
    85: ["Snow showers", "🌨️"], 86: ["Snow showers", "❄️"],
    95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm, hail", "⛈️"], 99: ["Thunderstorm, hail", "⛈️"],
  };
  const info = (code, night) => {
    const c = CODES[code] || ["Unknown", "❓"];
    return { text: c[0], emoji: night && c[2] ? c[2] : c[1] };
  };

  // ---------- Data ----------
  const deg = (n) => `${Math.round(n)}°`;
  let place = BOCA;

  async function load(p) {
    place = p;
    $("place").textContent = [p.name, p.admin1, p.country].filter(Boolean).join(", ");
    $("status").textContent = "Loading live weather…";
    const params = new URLSearchParams({
      latitude: p.latitude, longitude: p.longitude, timezone: "auto",
      temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch", forecast_days: 7,
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day",
      hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    });
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error(res.status);
      render(await res.json());
      $("status").textContent = "";
    } catch (e) {
      $("status").textContent = "Couldn't load weather. Check your connection and try again.";
    }
  }

  function render(d) {
    const c = d.current, w = info(c.weather_code, !c.is_day);
    $("icon").textContent = w.emoji;
    $("temp").textContent = deg(c.temperature_2m) + "F";
    $("desc").textContent = w.text;
    $("feels").textContent = deg(c.apparent_temperature) + "F";
    $("hum").textContent = `${c.relative_humidity_2m}%`;
    $("wind").textContent = `${Math.round(c.wind_speed_10m)} mph`;
    $("rain").textContent = `${c.precipitation} in`;
    $("now").hidden = false;

    // Hourly: start at the current hour (times are in the location's timezone).
    const start = Math.max(0, d.hourly.time.findIndex((t) => t >= c.time.slice(0, 13) + ":00"));
    $("hourly").replaceChildren(...d.hourly.time.slice(start, start + 24).map((t, k) => {
      const i = start + k, el = document.createElement("div");
      el.className = "hour";
      const hr = new Date(t).toLocaleTimeString([], { hour: "numeric" });
      el.innerHTML = `<small>${k === 0 ? "Now" : hr}</small><div class="e">${info(d.hourly.weather_code[i], !d.hourly.is_day[i]).emoji}</div><strong>${deg(d.hourly.temperature_2m[i])}</strong><small>${d.hourly.precipitation_probability[i] ?? 0}%</small>`;
      return el;
    }));
    $("hourlyCard").hidden = false;

    $("daily").replaceChildren(...d.daily.time.map((t, i) => {
      const li = document.createElement("li");
      const day = i === 0 ? "Today" : new Date(t + "T12:00").toLocaleDateString([], { weekday: "long" });
      const x = info(d.daily.weather_code[i]);
      li.innerHTML = `<div>${day}<small>${x.text}</small></div><div class="e">${x.emoji}</div><div class="r"><strong>${deg(d.daily.temperature_2m_max[i])}</strong> <span class="lo">${deg(d.daily.temperature_2m_min[i])}</span><small>${d.daily.precipitation_probability_max[i] ?? 0}% rain</small></div>`;
      return li;
    }));
    $("dailyCard").hidden = false;
    $("updated").textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // ---------- City search (Open-Meteo geocoding) ----------
  const results = $("results");
  $("search").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (!q) return;
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
      const list = (await res.json()).results || [];
      if (!list.length) { $("status").textContent = `No places found for "${q}".`; results.hidden = true; return; }
      $("status").textContent = "";
      results.replaceChildren(...list.map((p) => {
        const li = document.createElement("li"), b = document.createElement("button");
        b.type = "button";
        b.textContent = [p.name, p.admin1, p.country].filter(Boolean).join(", ");
        b.addEventListener("click", () => { results.hidden = true; $("q").value = ""; load(p); });
        li.append(b);
        return li;
      }));
      results.hidden = false;
    } catch (err) {
      $("status").textContent = "Search failed. Please try again.";
    }
  });
  $("reset").addEventListener("click", () => { results.hidden = true; $("q").value = ""; load(BOCA); });

  load(BOCA);
  setInterval(() => { greet(); load(place); }, 10 * 60 * 1000); // refresh every 10 min
})();
