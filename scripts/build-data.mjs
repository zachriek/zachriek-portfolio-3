// Generates static JSON, theme SVGs, and syncs HTML/JS identity from portfolio.config.json into public/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "portfolio.config.json"), "utf8"));

const ID = CONFIG.identity;
const now = new Date();
const iso = now.toISOString();
const TODAY = iso.slice(0, 10);

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const writeRoot = (file, value) => {
  const payload = typeof value === "string" ? value : JSON.stringify(value, null, 1);
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, file), payload);
  console.log("wrote", file);
};
const writePublic = (file, value) => writeRoot(path.join("public", file), value);
const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");

// 1. Sync HTML / SVG / terminal identity
function syncIdentity() {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const domain = esc(ID.domain);
  const tagline = esc(ID.tagline);

  const favSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 80"><title>${domain}</title><rect width="88" height="80" rx="14" fill="#0b0b0a"/><path fill="#ebe6db" d="M12 20L38 40L12 60L20 68L52 40L20 12Z"/><path fill="#e7c58a" d="M50 58H78V68H50Z"/></svg>\n`;
  writePublic("favicon.svg", favSvg);

  let idx = read("index.html");
  idx = idx
    .replace(/<title>[^<]*<\/title>/, `<title>${domain}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${domain} — ${tagline}">`);
  writeRoot("index.html", idx);

  let sIdx = read("site/index.html");
  sIdx = sIdx
    .replace(/<title>[^<]*<\/title>/, `<title>${domain}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${domain} — experience, education, achievements, security tools and themes.">`);
  writeRoot("site/index.html", sIdx);

  const termPath = "src/engines/terminal.js";
  if (fs.existsSync(path.join(ROOT, termPath))) {
    let term = read(termPath);
    term = term.replace(
      /return \[\["[^"]*", "t-user"\], \["@dev", "t-host"\]/,
      `return [[${JSON.stringify(ID.terminalUser || "dev")}, "t-user"], ["@dev", "t-host"]`,
    );
    writeRoot(termPath, term);
  }
}

syncIdentity();

// 2. Built-in Themes
const mixHex = (a, b, t) =>
  "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const T = (name, description, light, bg, fg, accent, kw, str, num, fn, type, comment) => ({
  name,
  description,
  light,
  bg,
  fg,
  accent,
  kinds: { keyword: kw, string: str, number: num, function: fn, type, comment, text: fg, ident: mixHex(fg, kw, 0.3), member: fn, punct: mixHex(fg, bg, 0.45) },
});
const THEME_DEFS = [
  T("Blackmoney", "Warm paper on near-black", false, "#0b0b0a", "#ebe6db", "#e7c58a", "#7fd1a0", "#e6c37a", "#f0885b", "#8fd0ee", "#c9a0e8", "#7a766a"),
  T("Paper", "Light, ink on cream", true, "#f6f2e9", "#1d1c1a", "#b4532a", "#2f6f4f", "#8a5a1a", "#b4532a", "#2c5d8a", "#5a4a8a", "#8c887c"),
  T("Sora", "Cool steel and teal", false, "#0b1015", "#d9e4ee", "#4cc9f0", "#4cc9f0", "#a9d6e5", "#ffa94d", "#9fb4ff", "#6ee7b7", "#56687a"),
  T("Circuit", "Board green, phosphor on black", false, "#07110c", "#d3f0dd", "#3ddc84", "#3ddc84", "#ffd166", "#ff8f70", "#59c3f0", "#c792ea", "#4d6b5a"),
  T("Amber", "Warm amber on ink", false, "#0e0c08", "#f1e6cc", "#f7931a", "#f7931a", "#e8d9a0", "#ff7a59", "#ffcf6b", "#9ad1d4", "#7a6a4a"),
  T("Indigo", "Violet on deep indigo", false, "#0d0b14", "#e2dcf2", "#a97bff", "#a97bff", "#c7b8f0", "#ff9ecb", "#8fb2ff", "#7ad9d0", "#665f80"),
  T("Crimson", "Warm terracotta and charcoal", false, "#140a0a", "#f4e3d0", "#ff8f1f", "#ff8f1f", "#e8c39e", "#ffd27a", "#7fd1c8", "#e08a96", "#7a5a52"),
  T("Slate", "Neutral graphite", false, "#111214", "#d6d8dc", "#9aa5b1", "#9ab0c4", "#b9c4b0", "#d3a37a", "#c4b8d6", "#a3c4c0", "#666b73"),
];
const shade = (hex, f) =>
  "#" + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, "0")).join("");
const palettes = THEME_DEFS.map((t) => ({
  ...t,
  cursorline: shade(t.bg, t.light ? 0.96 : 1.5),
  ansi: [t.bg, t.kinds.keyword, t.kinds.string, t.kinds.number, t.kinds.function, t.kinds.type, t.accent, t.fg, t.kinds.comment, t.kinds.keyword, t.kinds.string, t.kinds.number, t.kinds.function, t.kinds.type, t.accent, t.fg],
  color1: t.kinds.keyword,
}));
const themes = palettes.map((t) => ({
  slug: slug(t.name),
  name: t.name,
  description: t.description,
  image: `/site/assets/themes/${slug(t.name)}.svg`,
  palette: t.ansi.slice(0, 8),
  included: true,
  source: "built-in palette",
}));
for (const t of palettes) {
  const k = t.kinds;
  const row = (y, w, c) => `<rect x="14" y="${y}" width="${w}" height="5" rx="2" fill="${c}" opacity=".9"/>`;
  writePublic(
    `site/assets/themes/${slug(t.name)}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="${t.bg}"/><rect y="0" width="160" height="9" fill="${t.cursorline}"/>${row(18, 50, k.keyword)}${row(30, 90, k.string)}${row(42, 36, k.function)}${row(54, 70, t.fg)}${row(66, 28, k.number)}${row(78, 100, k.comment)}<rect x="130" y="30" width="16" height="16" rx="3" fill="${t.accent}"/></svg>`,
  );
}

// 3. Icons for Stack (no GitHub repo counts)
const ICON_SLUG = {
  JavaScript: "javascript",
  TypeScript: "typescript",
  PHP: "php",
  HTML5: "html5",
  CSS3: "css3",
  Python: "python",
  React: "react",
  Vue: "vuedotjs",
  Laravel: "laravel",
  "Next.js": "nextdotjs",
  "Node.js": "nodedotjs",
  "Tailwind CSS": "tailwindcss",
  PostgreSQL: "postgresql",
  MySQL: "mysql",
  Linux: "linux",
  Git: "git",
  Vite: "vite",
  Docker: "docker",
  "Canvas 2D": "html5",
};
const iconCache = new Map();
async function icon(name) {
  const s = ICON_SLUG[name] || name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (iconCache.has(s)) return iconCache.get(s);
  let out = null;
  try {
    const r = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/${s}.svg`);
    if (r.ok) {
      const m = (await r.text()).match(/<path d="([^"]+)"/);
      if (m) out = { slug: s, path: m[1] };
    }
  } catch {}
  iconCache.set(s, out);
  return out;
}

const languages = [];
for (const l of CONFIG.skills?.languages || []) {
  languages.push({ ...l, icon: await icon(l.name) });
}
const tools = [];
for (const t of CONFIG.skills?.tools || []) {
  tools.push({ ...t, icon: await icon(t.name) });
}
const site = [];
for (const s of CONFIG.siteStack || []) {
  site.push({ ...s, icon: await icon(s.name) });
}
writePublic("site/stack.json", {
  fetchedAt: iso,
  languages,
  tools,
  site,
  source: "portfolio.config.json",
});

// 4. Code wall (local React source code without GitHub repo links)
const wallThemes = palettes.map((t) => ({
  name: slug(t.name),
  light: t.light,
  source: "built-in palette",
  accent: t.accent,
  bg: t.bg,
  fg: t.fg,
  selection: t.accent,
  selectionText: t.bg,
  kinds: t.kinds,
  cursorline: t.cursorline,
}));
const wallSources = [
  "src/pages/IntroPage.jsx",
  "src/pages/EditorPage.jsx",
  "src/context/PortfolioContext.jsx",
  "src/components/FrameHeader.jsx",
  "src/components/EditorShell.jsx",
  "src/components/StatusBar.jsx",
  "src/components/IntroStage.jsx",
  "src/config/portfolio.js",
];
const wallFiles = [];
for (const rel of wallSources) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const raw = fs.readFileSync(full, "utf8");
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .split("\n")
    .slice(0, 75)
    .map((l) => l.replace(/\s+$/, ""));
  wallFiles.push({
    repo: "portfolio",
    path: rel,
    sha: "local",
    lang: "js",
    firstLine: 1,
    url: "",
    lines,
  });
}
if (wallFiles.length) {
  writePublic("wall.json", { files: wallFiles, themes: wallThemes });
  writePublic("wall.txt", wallFiles.flatMap((f) => f.lines).filter(Boolean).join("\n"));
}

// 5. content.json & themes.json
const aboutLines = [
  `# ${ID.name}`,
  "",
  CONFIG.about.role,
  CONFIG.about.bio,
  ...(CONFIG.about.extra ? ["", CONFIG.about.extra] : []),
  "",
  ...CONFIG.links.map((l) => `[${l.label}](${l.url})`),
];
const themeThumbs = Object.fromEntries(themes.map((t) => [t.slug, `assets/themes/${t.slug}.svg`]));

writePublic("site/content.json", {
  owner: ID.terminalUser || "zachriek",
  fetchedAt: iso,
  about: {
    name: ID.name,
    role: CONFIG.about.role,
    extra: CONFIG.about.extra,
    lines: aboutLines,
  },
  palettes,
  themeStats: {},
  themeThumbs,
  work: CONFIG.work || [],
  educations: CONFIG.educations || [],
  achievements: CONFIG.achievements || [],
  securityTools: CONFIG.securityTools || [],
  links: CONFIG.links || [],
});
writePublic("themes.json", { source: "built-in palettes", snapshot: TODAY, themes });
console.log(`done: ${themes.length} themes, ${(CONFIG.work || []).length} work, ${(CONFIG.educations || []).length} educations, ${(CONFIG.achievements || []).length} achievements, ${(CONFIG.securityTools || []).length} security tools`);
