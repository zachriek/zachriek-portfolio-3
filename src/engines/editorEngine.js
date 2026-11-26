import { createArchive } from "./archive.js";
import { createWatch } from "./watch.js";
import { createBar } from "./bar.js";
import { createWheel } from "./wheel.js";
import { createTerminal } from "./terminal.js";
import { createBlueprint } from "./blueprint.js";
import { createTips } from "./tip.js";
import { createLightbox } from "./lightbox.js";

const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const key = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const fmt = (value) => Math.round(value).toLocaleString("en-US").replace(/,/g, "'");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const narrow = matchMedia("(max-width: 700px)");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hex = (value) => [1, 3, 5].map((k) => parseInt(value.slice(k, k + 2), 16));
const LINK_SLOTS = [3, 4, 5, 8];
const luminance = (value) => {
  const [r, g, b] = hex(value).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const lab = (value) => {
  const [r, g, b] = hex(value).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const distance = (a, b) => {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};
const chroma = (value) => Math.hypot(lab(value)[1], lab(value)[2]);
const mix = (a, b, t) => `#${hex(a).map((v, n) => Math.round(v * (1 - t) + hex(b)[n] * t).toString(16).padStart(2, "0")).join("")}`;

// Deterministic ambient wave for the wheel's organic ink ring (no GitHub repo stats)
function createAmbientInkDays(length = 240) {
  const out = [];
  for (let i = 0; i < length; i++) {
    const wave = Math.sin(i * 0.17) * 0.5 + Math.cos(i * 0.07) * 0.35 + Math.sin(i * 0.43) * 0.25;
    const count = wave < -0.25 ? 0 : Math.max(1, Math.round((wave + 0.4) * 7));
    out.push({ date: "", count, level: Math.min(4, Math.ceil(count / 3)) });
  }
  return out;
}

function loadLocalTelemetry(prefix) {
  const storageKey = `${prefix}.visits`;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.hours) && parsed.hours.length === 56) {
        parsed.hours[parsed.hours.length - 1] = (parsed.hours[parsed.hours.length - 1] || 0) + 1;
        parsed.total = (parsed.total || 0) + 1;
        localStorage.setItem(storageKey, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch {}
  const seed = [1, 2, 1, 3, 2, 4, 2, 1, 3, 5, 4, 2, 3, 6, 4, 3, 2, 5, 7, 4, 3, 2, 4, 6, 5, 3, 2, 4, 8, 6, 4, 3, 5, 7, 5, 3, 4, 6, 8, 5, 4, 3, 6, 7, 5, 4, 6, 9, 7, 5, 6, 8, 6, 7, 5, 4];
  const data = { since: today, total: seed.reduce((a, b) => a + b, 0), hours: seed };
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {}
  return data;
}

export function mountEditor({ root, data, identity, initialWormOn = false, onDrawerChange = () => {} }) {
  const { content, themeData, stack } = data;
  const $ = (selector) => root.querySelector(selector);
  const editor = $(".editor");
  const wheelHost = $(".wheel");
  const buffer = $(".buffer");
  const winbar = $(".winbar");
  const tabFile = $(".tab-file");
  const barHost = $(".bar");
  const cmdNode = $(".bar .cmd");
  const overlayCanvas = document.querySelector(".overlay");

  const themes = themeData.themes;
  const palettes = new Map(content.palettes.map((theme) => [key(theme.name), theme]));
  const ambientDays = createAmbientInkDays();

  const DEFAULT_THEME = "blackmoney";
  const prefix = identity.storagePrefix || "portfolio";
  const THEME_KEY = `${prefix}.scheme`;

  let currentTheme = DEFAULT_THEME;
  let openEntry = null;
  let booted = false;
  let destroyed = false;
  let cleanup = null;
  let typingToken = 0;
  let clearTimer = 0;
  let command = null;
  let watch = null;
  let wheel = null;
  let hero = null;
  let typingBar = false;
  let typingTerm = false;

  function applyTheme(name, remember = false) {
    const theme = palettes.get(key(name));
    if (!theme) return false;
    const fg = theme.fg || theme.kinds.text;
    const vars = {
      "--bg": theme.bg,
      "--ink": fg,
      "--dim": theme.kinds.comment || mix(fg, theme.bg, 0.55),
      "--accent": theme.accent,
      "--line": theme.cursorline || mix(fg, theme.bg, 0.9),
      "--kw": theme.kinds.keyword,
      "--str": theme.kinds.string,
      "--fn": theme.kinds.function,
      "--ty": theme.kinds.type,
      "--num": theme.kinds.number,
      "--chrome": mix(fg, theme.bg, 0.3),
      "--color1": theme.color1,
    };
    (theme.ansi || []).forEach((value, n) => {
      vars[`--color${n}`] = value;
    });
    const links = LINK_SLOTS.map((n) => theme.ansi?.[n]).filter((value) => value && contrast(value, theme.bg) >= 3 && distance(value, fg) >= 15);
    vars["--link"] = links.sort((a, b) => chroma(b) - chroma(a))[0] || fg;
    for (const [k, value] of Object.entries(vars)) if (value) document.body.style.setProperty(k, value);
    document.documentElement.style.colorScheme = theme.light ? "light" : "dark";
    currentTheme = key(name);
    hero?.recolor?.();
    watch?.recolor();
    wheel?.recolor();
    bar?.recolor();
    if (remember) {
      try {
        localStorage.setItem(THEME_KEY, currentTheme);
      } catch {}
    }
    return true;
  }

  const about = (() => {
    const lines = content.about.lines || [];
    const links = lines.map((line) => line.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)).filter(Boolean).map((m) => ({ name: m[1].toLowerCase(), url: m[2] }));
    const text = lines.filter((line) => line.trim() && !/^#|^\[/.test(line));
    return {
      handle: content.owner || identity.terminalUser || "zachriek",
      name: content.about.name || identity.name,
      role: content.about.role || "",
      extra: content.about.extra || "",
      bio: text,
      links,
    };
  })();

  const entries = [
    { id: "about", label: "whoami", kind: "about", tile: "about" },
    { id: "work", label: "work/", kind: "work", tile: "work" },
    { id: "education", label: "education/", kind: "education", tile: "education" },
    { id: "achievements", label: "achievements/", kind: "achievements", tile: "talks" },
    { id: "tools", label: "tools/", kind: "tools", tile: "tools" },
    ...(stack ? [{ id: "stack", label: "stack/", kind: "stack", tile: "stack" }] : []),
    { id: "themes", label: "themes/", kind: "themes", tile: "themes" },
  ];
  const items = entries.map((entry) => ({ entry, label: entry.label, tile: entry.tile }));

  const bar = createBar(barHost);
  bar.setSeen(loadLocalTelemetry(prefix));

  const KEYS = { wide: "↑↓ section · ↩ enter · : cmd", touch: "swipe the wheel · tap to open", closed: "tap ~/Portfolio ↓ to browse" };
  const paintKeys = () => bar.setKeys(narrow.matches ? (editor.classList.contains("is-tree-open") ? KEYS.touch : KEYS.closed) : matchMedia("(pointer: fine)").matches ? KEYS.wide : KEYS.touch);
  paintKeys();

  function paintTyping() {
    bar.setTyping(typingBar || typingTerm);
  }

  const lightbox = createLightbox({ onOpen: () => tips.hide() });
  const terminal = createTerminal(buffer, {
    lightbox,
    get watch() {
      return watch;
    },
    onTyping(on) {
      typingTerm = on;
      paintTyping();
    },
  });

  function clearSoon(ms = 2400) {
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      if (command === null && !typingBar) cmdNode.textContent = "";
    }, ms);
  }

  async function typeCmd(text, pace = 11) {
    const token = ++typingToken;
    clearTimeout(clearTimer);
    typingBar = true;
    barHost.classList.add("is-typing");
    paintTyping();
    try {
      if (reduced.matches) cmdNode.textContent = text;
      else {
        cmdNode.textContent = "";
        for (let n = 1; n <= text.length; n++) {
          if (destroyed || token !== typingToken) return;
          cmdNode.textContent = text.slice(0, n);
          watch?.pressChar(text[n - 1]);
          const rect = cmdNode.getBoundingClientRect();
          if (rect.width) watch?.focus(rect.right + 4, rect.top + rect.height / 2);
          await sleep(pace);
        }
      }
      await sleep(160);
      if (destroyed || token !== typingToken) return;
      watch?.pressKey("Enter");
    } finally {
      if (token === typingToken) {
        typingBar = false;
        barHost.classList.remove("is-typing");
        paintTyping();
        clearSoon();
      }
    }
  }

  function say(text) {
    typingToken++;
    typingBar = false;
    barHost.classList.remove("is-typing");
    paintTyping();
    cmdNode.textContent = text;
    clearSoon(text ? 3200 : 0);
  }

  const GAUGE = 16;
  const filledOf = (share, cells) => (share > 0 ? Math.max(1, Math.min(cells, Math.round(share * cells))) : 0);

  function room(used) {
    const style = getComputedStyle(buffer);
    const cell = parseFloat(style.getPropertyValue("--cell-w")) || 7.2;
    const chars = Math.floor((buffer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 1) / cell) - 3;
    return Math.max(6, Math.min(GAUGE, chars - used));
  }

  function gauge(share, used) {
    const cells = room(used);
    const filled = filledOf(share, cells);
    const on = () => {
      const b = make("span", "t-gauge", "█".repeat(filled));
      b.dataset.share = share;
      b.dataset.used = used;
      return b;
    };
    return [{ node: on }, ["░".repeat(cells - filled), "t-gauge-off"]];
  }

  function refit() {
    for (const b of buffer.querySelectorAll(".t-gauge[data-used]")) {
      const off = b.nextElementSibling;
      const cells = room(Number(b.dataset.used));
      if (!off || b.textContent.length + off.textContent.length === cells) continue;
      const filled = filledOf(Number(b.dataset.share), cells);
      b.textContent = "█".repeat(filled);
      off.textContent = "░".repeat(cells - filled);
    }
  }

  const pad = (label) => label.padEnd(11);
  const num = (value) => fmt(value ?? 0).padStart(4);
  const fact = (label, value, extra = []) => ({ segments: [[pad(label), "t-key"], [num(value), "md-num"], ...extra] });

  function aboutSpec() {
    return {
      cwd: "~",
      branch: null,
      hero: (host) =>
        createBlueprint(host, {
          points: 1800,
          from: "",
          to: "",
          owner: about.handle,
          family: false,
        }),
      blocks: [
        {
          cmd: "whoami",
          out: [
            { segments: [[about.name, "md-h md-h1"]] },
            ...about.bio.map((line) => ({ segments: [line], className: "t-dim" })),
          ],
        },
        {
          cmd: "cat profile.txt",
          out: [
            { segments: [[pad("role"), "t-key"], [about.role || "Web Developer"]] },
            { segments: [[pad("campus"), "t-key"], ["University of Lampung · Informatics Engineering"]] },
            { segments: [[pad("location"), "t-key"], ["Bandar Lampung, Indonesia"]] },
            { segments: [[pad("focus"), "t-key"], ["Web Development · UI Engineering · Cybersecurity"]] },
          ],
        },
        {
          cmd: "ls links/",
          out: [{ segments: about.links.flatMap((link, k) => [...(k ? ["   "] : []), [link.name, "", link.url]]) }],
        },
      ],
    };
  }

  const WHEN_W = 24;
  function workSpec() {
    const jobs = content.work || [];
    const out = jobs.flatMap((item) => [
      {
        segments: [
          [item.when.padEnd(WHEN_W), "t-dim"],
          item.url ? [item.title, "", item.url] : [item.title, "t-key"],
          ...(item.org ? [["  @ " + item.org, "t-dim"]] : []),
          ...(item.where ? [["  · " + item.where, "t-dim"]] : []),
        ],
      },
      { segments: [[" ".repeat(WHEN_W)], [item.desc || ""]], className: "t-hang" },
    ]);
    return {
      cwd: "~/work",
      branch: null,
      blocks: [
        { cmd: "cat work/summary", out: [fact("entries", jobs.length), fact("internships", jobs.filter((item) => /intern/i.test(item.title)).length)] },
        { cmd: "ls -la work/", out },
      ],
    };
  }

  function educationSpec() {
    const list = content.educations || [];
    const out = list.flatMap((item) => [
      {
        segments: [
          [item.when.padEnd(WHEN_W), "t-dim"],
          [item.school, "t-key"],
          ...(item.where ? [["  · " + item.where, "t-dim"]] : []),
        ],
      },
      { segments: [[" ".repeat(WHEN_W)], [item.degree || ""]], className: "t-hang" },
    ]);
    return {
      cwd: "~/education",
      branch: null,
      blocks: [
        { cmd: "cat education/summary", out: [fact("degrees", list.length), { segments: [[pad("current"), "t-key"], ["University of Lampung"]] }] },
        { cmd: "ls -la education/", out },
      ],
    };
  }

  function achievementsSpec() {
    const list = content.achievements || [];
    const out = list.flatMap((item) => [
      {
        segments: [
          [String(item.when || "").padEnd(8), "t-dim"],
          [item.name, "t-key"],
          ...(item.issuer ? [["  · " + item.issuer, "t-dim"]] : []),
        ],
      },
      { segments: [[" ".repeat(8)], [item.desc || ""]], className: "t-hang" },
    ]);
    return {
      cwd: "~/achievements",
      branch: null,
      blocks: [
        { cmd: "cat achievements/summary", out: [fact("honors", list.length), { segments: [[pad("certified"), "t-key"], ["BNSP Junior Web Developer"]] }] },
        { cmd: "ls -la achievements/", out },
      ],
    };
  }

  function toolsSpec() {
    const list = content.securityTools || [];
    const out = list.flatMap((tool) => [
      {
        segments: [
          [tool.name.padEnd(22), "t-key"],
          [`[${tool.badge}]`, "md-code"],
          ["  · " + tool.category, "t-dim"],
        ],
      },
      { segments: [[" ".repeat(22)], [tool.desc || ""]], className: "t-hang" },
    ]);
    return {
      cwd: "~/tools",
      branch: null,
      blocks: [
        { cmd: "cat tools/summary", out: [fact("security", list.length), { segments: [[pad("domain"), "t-key"], ["Web, Network & Wireless Pentesting"]] }] },
        { cmd: "ls -la tools/", out },
      ],
    };
  }

  function stackSpec() {
    const cols = narrow.matches ? 2 : 3;
    const used = Math.max(0, ...(stack.languages || []).map((l) => 3 + Math.max(12, l.name.length) + 12));
    const lang = (stack.languages || []).map((l) => ({
      segments: [
        { icon: l.icon, letter: l.name },
        " ",
        [l.name.padEnd(12), "md-code"],
        ...gauge(l.level ?? 0.8, used),
        ["  " + (l.focus || ""), "t-dim"],
      ],
    }));
    const grid = (list, width) => {
      const rows = [];
      for (let k = 0; k < list.length; k += cols) {
        rows.push({
          segments: list
            .slice(k, k + cols)
            .flatMap((tool, j) => [...(j ? ["  "] : []), { icon: tool.icon, letter: tool.name }, " ", [tool.name.padEnd(width)], [tool.note || "", "t-dim"]]),
        });
      }
      return rows;
    };
    return {
      cwd: "~",
      branch: null,
      blocks: [
        { cmd: "stack --languages", out: lang },
        { cmd: "stack --tools", out: grid(stack.tools || [], 13) },
        { cmd: "stack --site", out: (stack.site || []).map((tool) => ({ segments: [{ icon: tool.icon, letter: tool.name }, " ", [tool.name.padEnd(14)], [tool.via, "t-dim"]] })) },
      ],
    };
  }

  function themesSpec() {
    const out = [{ segments: [[pad("palettes"), "t-key"], [String(themes.length), "md-num"], ["  click one to recolor the editor", "t-dim"]] }];
    return {
      cwd: "~/themes",
      branch: null,
      blocks: [
        { cmd: "ls themes/", out },
        {
          cmd: "preview themes/",
          mount(host) {
            const archive = createArchive(host, themes, {
              stats: content.themeStats || {},
              thumbs: content.themeThumbs || {},
              current: themes.find((theme) => key(theme.slug) === currentTheme)?.slug,
              viewport: buffer,
              lightbox,
              onPick(theme) {
                if (applyTheme(theme.slug, true)) typeCmd(`:colorscheme ${key(theme.slug)}`);
              },
            });
            return archive.destroy;
          },
        },
      ],
    };
  }

  function textOf(entry) {
    if (entry.kind === "work") return (content.work || []).map((item) => `${item.title} ${item.org || ""} ${item.desc || ""}`).join(" ");
    if (entry.kind === "education") return (content.educations || []).map((item) => `${item.school} ${item.degree || ""}`).join(" ");
    if (entry.kind === "achievements") return (content.achievements || []).map((item) => `${item.name} ${item.issuer || ""} ${item.desc || ""}`).join(" ");
    if (entry.kind === "tools") return (content.securityTools || []).map((item) => `${item.name} ${item.category} ${item.desc}`).join(" ");
    if (entry.kind === "about") return (content.about.lines || []).join(" ");
    if (entry.kind === "themes") return themes.map((theme) => `${theme.name} ${theme.description}`).join(" ");
    return [...(stack?.languages || []), ...(stack?.tools || []), ...(stack?.site || [])].map((item) => item.name).join(" ");
  }

  function barView(entry) {
    if (entry.kind === "themes") return [["THEMES", String(themes.length)], ["BUILT-IN", String(themes.filter((theme) => theme.included).length)]];
    if (entry.kind === "work") return [["ROLES", String((content.work || []).length)], ["TYPE", "INTERN"], ["MODE", "REMOTE"]];
    if (entry.kind === "education") return [["SCHOOLS", String((content.educations || []).length)], ["MAJOR", "INFORMATICS"], ["NOW", "UNILA"]];
    if (entry.kind === "achievements") return [["HONORS", String((content.achievements || []).length)], ["CERT", "BNSP"], ["SINCE", "2022"]];
    if (entry.kind === "tools") return [["TOOLS", String((content.securityTools || []).length)], ["FOCUS", "PENTEST"], ["MODE", "SEC"]];
    if (entry.kind === "stack") return [["LANGS", String(stack?.languages?.length ?? 0)], ["TOOLS", String(stack?.tools?.length ?? 0)], ["LIB", "REACT"]];
    return [["ROLE", "WEB DEV"], ["LIB", "REACT"], ["BASE", "LAMPUNG"]];
  }

  function open(entry) {
    if (!entry || entry === openEntry) return;
    if (cleanup) cleanup();
    cleanup = null;
    hero = null;
    openEntry = entry;
    history.replaceState(null, "", `#${entry.id}`);
    buffer.scrollTop = 0;
    buffer.dataset.kind = entry.kind;
    watch?.setText(textOf(entry));
    bar.setView(barView(entry));
    if (entry.kind === "about") {
      winbar.textContent = `fish — ~ · ${about.name}`;
      tabFile.textContent = "/";
      hero = terminal.show(aboutSpec());
      cleanup = () => {
        terminal.destroy();
        hero = null;
      };
    } else if (entry.kind === "work") {
      const orgs = (content.work || []).map((w) => w.org).filter(Boolean).slice(0, 3);
      winbar.textContent = orgs.length ? `work/ — ${orgs.join(" · ")}` : "work/";
      tabFile.textContent = "/work/";
      terminal.show(workSpec());
      cleanup = () => terminal.destroy();
    } else if (entry.kind === "education") {
      winbar.textContent = `education/ — University of Lampung · SMKN 1 Bandar Lampung`;
      tabFile.textContent = "/education/";
      terminal.show(educationSpec());
      cleanup = () => terminal.destroy();
    } else if (entry.kind === "achievements") {
      winbar.textContent = `achievements/ — ${(content.achievements || []).length} honors & certifications`;
      tabFile.textContent = "/achievements/";
      terminal.show(achievementsSpec());
      cleanup = () => terminal.destroy();
    } else if (entry.kind === "tools") {
      winbar.textContent = `tools/ — ${(content.securityTools || []).length} cybersecurity & pentesting tools`;
      tabFile.textContent = "/tools/";
      terminal.show(toolsSpec());
      cleanup = () => terminal.destroy();
    } else if (entry.kind === "stack") {
      winbar.textContent = `fish — ~ · stack`;
      tabFile.textContent = "/stack/";
      terminal.show(stackSpec());
      cleanup = () => terminal.destroy();
    } else if (entry.kind === "themes") {
      const included = themes.filter((theme) => theme.included).length;
      winbar.textContent = `themes/ — ${themes.length} themes · ${included} built-in`;
      tabFile.textContent = "/themes/";
      terminal.show(themesSpec());
      cleanup = () => terminal.destroy();
      typeCmd(":e themes/");
    }
  }

  function closeDrawer() {
    onDrawerChange(false);
    requestAnimationFrame(() => paintKeys());
  }

  function paintFade() {
    const rest = narrow.matches ? buffer.scrollHeight - buffer.clientHeight - buffer.scrollTop - parseFloat(getComputedStyle(buffer).paddingBottom) : 0;
    buffer.classList.toggle("is-cut", rest > 1);
    buffer.style.setProperty("--fade", `${Math.round(Math.min(40, Math.max(0, rest)))}px`);
  }

  let fadeFrame = 0;
  const queueFade = () => {
    if (fadeFrame) return;
    fadeFrame = requestAnimationFrame(() => {
      fadeFrame = 0;
      paintFade();
    });
  };
  const mutObs = new MutationObserver(queueFade);
  mutObs.observe(buffer, { childList: true });
  buffer.addEventListener("scroll", queueFade, { passive: true });
  window.addEventListener("resize", queueFade);

  let fitFrame = 0;
  const queueFit = () => {
    if (fitFrame) return;
    fitFrame = requestAnimationFrame(() => {
      fitFrame = 0;
      refit();
    });
  };
  window.addEventListener("resize", queueFit);

  function findEntry(name) {
    const wanted = key(name.replace(/\/README\.md$/i, "").replace(/^~\/Portfolio\/?/, ""));
    if (!wanted || ["readmemd", "about", "whoami", "home"].includes(wanted)) return entries.find((entry) => entry.kind === "about");
    if (["edu", "educations", "education"].includes(wanted)) return entries.find((entry) => entry.kind === "education");
    if (["talks", "awards", "achievements", "cert"].includes(wanted)) return entries.find((entry) => entry.kind === "achievements");
    if (["pentest", "security", "tools"].includes(wanted)) return entries.find((entry) => entry.kind === "tools");
    return entries.find((entry) => key(entry.id) === wanted || key(entry.label) === wanted);
  }

  function goTo(entry) {
    if (!entry) return;
    const k = items.findIndex((item) => item.entry === entry);
    if (k < 0) return;
    wheel.select(k);
    wheel.commitNow();
    open(entry);
  }

  function schemes(name) {
    const wanted = key(name);
    if (!wanted) return [];
    if (palettes.has(wanted)) return [wanted];
    return [...palettes.keys()].filter((candidate) => candidate.startsWith(wanted));
  }

  function scheme(name) {
    const found = schemes(name);
    if (found.length === 1 && applyTheme(found[0], true)) return say(`:colorscheme ${found[0]}`);
    if (found.length > 1) return say(`E185: ${found.slice(0, 4).join(" · ")}${found.length > 4 ? " …" : ""}`);
    return say(`E185: Cannot find color scheme '${name}'`);
  }

  function run(text) {
    const [name, ...rest] = text.trim().split(/\s+/);
    const arg = rest.join(" ");
    if (!name) return say("");
    if (/^q(a|all)?!?$/.test(name) || name === "wq" || name === "x") {
      location.href = "/";
      return;
    }
    if (name === "colorscheme" || name === "colo" || name === "theme") {
      if (!arg) {
        if (name === "theme") return goTo(entries.find((entry) => entry.kind === "themes"));
        return say(currentTheme);
      }
      return scheme(arg);
    }
    if (name === "e" || name === "edit" || name === "cd") {
      const entry = findEntry(arg);
      if (entry) {
        say("");
        return goTo(entry);
      }
      return say(`E484: Can't open file ${arg}`);
    }
    const entry = !arg && key(name) && findEntry(name);
    if (entry) {
      say("");
      return goTo(entry);
    }
    if (!arg && schemes(name).length) return scheme(name);
    return say(`E492: Not an editor command: ${text.trim()}`);
  }

  function startCommand() {
    typingToken++;
    clearTimeout(clearTimer);
    command = "";
    typingBar = false;
    barHost.classList.add("is-typing");
    cmdNode.textContent = ":";
  }

  function commandKey(event) {
    event.preventDefault();
    if (event.key === "Escape") {
      command = null;
      barHost.classList.remove("is-typing");
      say("");
    } else if (event.key === "Enter") {
      const text = command;
      command = null;
      barHost.classList.remove("is-typing");
      run(text);
    } else if (event.key === "Backspace") {
      if (!command) {
        command = null;
        barHost.classList.remove("is-typing");
        say("");
        return;
      }
      command = command.slice(0, -1);
      cmdNode.textContent = `:${command}`;
    } else if (event.key.length === 1) {
      command += event.key;
      cmdNode.textContent = `:${command}`;
    }
  }

  const onKeyDown = (event) => {
    if (!event.repeat) watch?.pressKey(event.code, event.shiftKey);
    if (event.ctrlKey || event.metaKey || event.altKey || !booted) return;
    if (command !== null) {
      commandKey(event);
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".rack") || (target?.closest(".frame.is-xray") && ["Escape", "Enter", " "].includes(event.key))) return;
    if (event.key === ":") {
      event.preventDefault();
      startCommand();
      return;
    }
    const inBuffer = target && (target === buffer || buffer.contains(target));
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      if (inBuffer) wheel.focus();
      else buffer.focus({ preventScroll: true });
      return;
    }
    if (inBuffer) {
      const scroller = buffer.querySelector(".arc") || buffer;
      const lines = { j: 13, ArrowDown: 13, k: -13, ArrowUp: -13, d: scroller.clientHeight / 2, u: -scroller.clientHeight / 2 };
      if (event.key in lines) {
        event.preventDefault();
        scroller.scrollBy({ top: lines[event.key] });
      } else if (event.key === "g") scroller.scrollTo({ top: 0 });
      else if (event.key === "G") scroller.scrollTo({ top: scroller.scrollHeight });
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        terminal.step(event.key === "ArrowRight" ? 1 : -1);
      } else if (event.key === " " && !target.closest("button, a") && terminal.toggle()) event.preventDefault();
      else if (event.key === "Enter" && !target.closest("button, a") && terminal.zoom()) event.preventDefault();
      else if (event.key === "h" || event.key === "Escape") wheel.focus();
      return;
    }
    if (target?.closest("a, button:not(.wheel-item)") && event.key === "Enter") return;
    if (event.key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      wheel.step(1);
    } else if (event.key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      wheel.step(-1);
    } else if (event.key === "l" || event.key === "ArrowRight") {
      event.preventDefault();
      terminal.step(1);
    } else if (event.key === "h" || event.key === "ArrowLeft") {
      event.preventDefault();
      terminal.step(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      wheel.commitNow();
      if (openEntry?.kind !== "themes") buffer.focus({ preventScroll: true });
      closeDrawer();
    } else if (event.key === "Escape") closeDrawer();
  };
  document.addEventListener("keydown", onKeyDown);

  const onHashChange = () => {
    const entry = entries.find((item) => item.id === decodeURIComponent(location.hash.slice(1)));
    if (entry && entry !== openEntry) goTo(entry);
  };
  window.addEventListener("hashchange", onHashChange);

  const onNarrowChange = () => {
    closeDrawer();
    paintKeys();
  };
  narrow.addEventListener("change", onNarrowChange);

  const tips = createTips();
  const family = { box: () => (openEntry?.kind === "about" && hero?.family?.()) || null, fire: (ms) => hero?.fire?.(ms) };
  const den = $(".den");

  watch = createWatch({
    layer: overlayCanvas,
    deskHost: $(".desk"),
    eyeHost: $(".eye-host"),
    buffer,
    status: barHost,
    onState: (state) => bar.setState(state),
    family,
    den,
    wormOn: initialWormOn,
  });

  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {}
  applyTheme(saved && palettes.has(saved) ? saved : DEFAULT_THEME);

  const initialEntry = entries.find((entry) => entry.id === decodeURIComponent(location.hash.slice(1))) || entries[0];

  wheel = createWheel(wheelHost, {
    items,
    days: ambientDays,
    palettes: content.palettes,
    stack,
    initial: Math.max(0, items.findIndex((item) => item.entry === initialEntry)),
    onChange(item) {
      tabFile.textContent = `/${item.label}`;
    },
    onCommit(item) {
      if (!booted) return;
      open(item.entry);
      const center = wheel.centerOf();
      if (center) watch?.focus(center.x, center.y);
    },
    onPick() {
      if (!narrow.matches) return;
      setTimeout(() => {
        wheel.commitNow();
        closeDrawer();
      }, reduced.matches ? 0 : 170);
    },
  });

  (async () => {
    if (!reduced.matches) await typeCmd(":e ~/Portfolio", 18);
    if (destroyed) return;
    wheelHost.classList.add("is-in");
    wheel.form();
    booted = true;
    wheel.commitNow();
    if (!openEntry) {
      const { item } = wheel.current();
      open(item.entry);
    }
  })();

  return {
    setWorm(on) {
      watch?.setWorm(on);
    },
    syncDrawer(isOpen) {
      paintKeys();
      if (isOpen) requestAnimationFrame(() => wheel?.layout());
    },
    destroy() {
      destroyed = true;
      typingToken++;
      clearTimeout(clearTimer);
      mutObs.disconnect();
      buffer.removeEventListener("scroll", queueFade);
      window.removeEventListener("resize", queueFade);
      window.removeEventListener("resize", queueFit);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("hashchange", onHashChange);
      narrow.removeEventListener("change", onNarrowChange);
      if (cleanup) cleanup();
    },
  };
}
