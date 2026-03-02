// ============================================================
// EMONI LoRaWAN Dashboard → Figma Plugin
// Generates: Design Tokens · Components · Overview · Detail
// Run once inside Figma: Plugins > Development > Run Plugin
// ============================================================

async function main() {
  // ── 1. Load fonts ─────────────────────────────────────────
  await Promise.all([
    figma.loadFontAsync({ family: "Inter", style: "Regular" }),
    figma.loadFontAsync({ family: "Inter", style: "Medium" }),
    figma.loadFontAsync({ family: "Inter", style: "Semi Bold" }),
    figma.loadFontAsync({ family: "Inter", style: "Bold" }),
  ]);

  // ── 2. Helpers ────────────────────────────────────────────
  function rgb(h) {
    const v = h.replace("#", "");
    return {
      r: parseInt(v.slice(0, 2), 16) / 255,
      g: parseInt(v.slice(2, 4), 16) / 255,
      b: parseInt(v.slice(4, 6), 16) / 255,
    };
  }

  function solid(h, opacity) {
    if (opacity === undefined) opacity = 1;
    return [{ type: "SOLID", color: rgb(h), opacity: opacity }];
  }

  function makeFrame(name, w, h, bg, radius) {
    if (radius === undefined) radius = 0;
    const f = figma.createFrame();
    f.name = name;
    f.resize(w, h);
    f.fills = bg ? solid(bg) : [];
    if (radius) f.cornerRadius = radius;
    f.clipsContent = false;
    return f;
  }

  function addBorder(node, colorHex, weight, opacity) {
    if (weight === undefined) weight = 1;
    if (opacity === undefined) opacity = 1;
    node.strokes = [{ type: "SOLID", color: rgb(colorHex), opacity: opacity }];
    node.strokeWeight = weight;
    node.strokeAlign = "INSIDE";
  }

  function makeText(chars, size, weight, colorHex) {
    const t = figma.createText();
    t.fontName = { family: "Inter", style: weight };
    t.fontSize = size;
    t.fills = solid(colorHex);
    t.characters = chars;
    return t;
  }

  function add(parent, child, x, y) {
    if (x === undefined) x = 0;
    if (y === undefined) y = 0;
    parent.appendChild(child);
    child.x = x;
    child.y = y;
  }

  function makeEllipse(name, size, colorHex, opacity) {
    if (opacity === undefined) opacity = 1;
    const e = figma.createEllipse();
    e.name = name;
    e.resize(size, size);
    e.fills = solid(colorHex, opacity);
    return e;
  }

  function makeRect(name, w, h, colorHex, radius, opacity) {
    if (radius === undefined) radius = 0;
    if (opacity === undefined) opacity = 1;
    const r = figma.createRectangle();
    r.name = name;
    r.resize(w, h);
    r.fills = solid(colorHex, opacity);
    if (radius) r.cornerRadius = radius;
    return r;
  }

  // ── 3. Color tokens ───────────────────────────────────────
  const C = {
    bg:        "#0D1117",
    sidebar:   "#161B22",
    card:      "#161B22",
    cardHover: "#1C2333",
    blue:      "#1F2D3D",
    border:    "#30363D",
    accent:    "#4361EE",
    green:     "#2DD55B",
    yellow:    "#F5A623",
    orange:    "#FF6B35",
    red:       "#E53E3E",
    gray:      "#8B949E",
    grayLight: "#C9D1D9",
    text:      "#E6EDF3",
    white:     "#FFFFFF",
    water:     "#39A0FF",
  };

  // ============================================================
  // PAGE 1 – DESIGN TOKENS
  // ============================================================
  const tokensPage = figma.currentPage;
  tokensPage.name = "🎨 Design Tokens";
  figma.currentPage = tokensPage;

  // Section title
  add(tokensPage, makeText("Color Tokens", 22, "Bold", C.text), 40, 40);

  // Color swatches
  const colorDefs = [
    ["Background",   C.bg],
    ["Sidebar/Card", C.sidebar],
    ["Card Hover",   C.cardHover],
    ["Blue",         C.blue],
    ["Border",       C.border],
    ["Accent",       C.accent],
    ["Green",        C.green],
    ["Yellow",       C.yellow],
    ["Orange",       C.orange],
    ["Red",          C.red],
    ["Gray",         C.gray],
    ["Gray Light",   C.grayLight],
    ["Text",         C.text],
    ["Water Blue",   C.water],
  ];

  colorDefs.forEach(function(def, i) {
    const name = def[0];
    const hex  = def[1];
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = 40 + col * 140;
    const y = 80 + row * 120;

    const swatch = makeRect(name, 108, 64, hex, 8);
    addBorder(swatch, C.border);
    add(tokensPage, swatch, x, y);
    add(tokensPage, makeText(name, 11, "Medium", C.grayLight), x, y + 70);
    add(tokensPage, makeText(hex.toUpperCase(), 10, "Regular", C.gray),  x, y + 84);
  });

  // Typography section
  const tyY = 340;
  add(tokensPage, makeText("Typography", 22, "Bold", C.text), 40, tyY);

  const typoRows = [
    { label: "Heading 1",        size: 22, weight: "Bold",      sample: "Geräteübersicht" },
    { label: "Heading 2",        size: 20, weight: "Bold",      sample: "Device Name" },
    { label: "Card Title",       size: 15, weight: "Semi Bold", sample: "Gas Meter A1B2" },
    { label: "Body Regular",     size: 13, weight: "Regular",   sample: "Default body text for UI labels" },
    { label: "KPI Value",        size: 24, weight: "Bold",      sample: "1 234.567 m³" },
    { label: "Label / Caption",  size: 12, weight: "Semi Bold", sample: "LETZTER UPLINK" },
    { label: "Micro / EUI",      size: 11, weight: "Regular",   sample: "0011aabbccddeeff" },
  ];

  let ty = tyY + 40;
  typoRows.forEach(function(r) {
    add(tokensPage, makeText(r.label, 11, "Regular", C.gray), 40, ty + (r.size - 11) / 2);
    add(tokensPage, makeText(r.sample, r.size, r.weight, C.text), 260, ty);
    ty += r.size + 24;
  });

  // Spacing tokens
  add(tokensPage, makeText("Spacing & Radius", 22, "Bold", C.text), 40, ty + 30);
  const spacingDefs = [
    { name: "radius-sm",  value: 8,  note: "Buttons, inputs, badges" },
    { name: "radius",     value: 12, note: "Cards, hero, panels" },
    { name: "gap-sm",     value: 8,  note: "Inner element gap" },
    { name: "gap",        value: 12, note: "Card grid gap" },
    { name: "gap-lg",     value: 20, note: "Section spacing" },
    { name: "padding",    value: 16, note: "Card padding" },
    { name: "padding-lg", value: 24, note: "Page padding" },
  ];

  let sy = ty + 70;
  spacingDefs.forEach(function(s) {
    const bar = makeRect(s.name, s.value * 4, 20, C.accent, 4, 0.4);
    add(tokensPage, bar, 40, sy);
    add(tokensPage, makeText(s.name, 12, "Semi Bold", C.grayLight), 200, sy + 2);
    add(tokensPage, makeText(s.value + "px  ·  " + s.note, 11, "Regular", C.gray), 370, sy + 3);
    sy += 32;
  });

  // ============================================================
  // PAGE 2 – COMPONENTS
  // ============================================================
  const compPage = figma.createPage();
  compPage.name = "🧩 Components";
  figma.currentPage = compPage;

  let cx = 40, cy = 40;

  // ── Topbar ──
  add(compPage, makeText("Topbar", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const topbar = makeFrame("Topbar", 1200, 56, C.sidebar);
  addBorder(topbar, C.border);
  add(compPage, topbar, cx, cy);
  add(topbar, makeRect("Logo", 32, 32, C.accent, 6, 0.3), 24, 12);
  add(topbar, makeText("LoRaWAN Dashboard", 16, "Semi Bold", C.text), 64, 18);
  const navActiveComp = makeFrame("Nav/Active", 120, 36, C.accent, 8);
  navActiveComp.fills = solid(C.accent, 0.15);
  add(topbar, navActiveComp, 520, 10);
  add(navActiveComp, makeText("Devices  12", 13, "Medium", C.text), 14, 10);
  const navInactiveComp = makeFrame("Nav/Inactive", 80, 36, undefined, 8);
  navInactiveComp.fills = [];
  add(topbar, navInactiveComp, 650, 10);
  add(navInactiveComp, makeText("Detail", 13, "Medium", C.gray), 14, 10);
  add(topbar, makeEllipse("Live Dot", 8, C.green), 1152, 24);
  add(topbar, makeText("Live", 12, "Regular", C.gray), 1166, 22);
  cy += 80;

  // ── Status Badges ──
  add(compPage, makeText("Status Badges", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const statusDefs = [
    { name: "Active",   bg: C.green,  textColor: C.green },
    { name: "Warning",  bg: C.yellow, textColor: C.yellow },
    { name: "Offline",  bg: C.red,    textColor: C.red },
    { name: "Inactive", bg: C.gray,   textColor: C.grayLight },
  ];
  let bx = 0;
  statusDefs.forEach(function(s) {
    const badge = makeFrame("Badge/" + s.name, 86, 22, undefined, 4);
    badge.fills = solid(s.bg, 0.12);
    add(compPage, badge, cx + bx, cy);
    add(badge, makeEllipse("dot", 6, s.bg), 8, 8);
    add(badge, makeText(s.name.toUpperCase(), 9, "Semi Bold", s.textColor), 20, 5);
    bx += 100;
  });
  cy += 50;

  // ── Buttons ──
  add(compPage, makeText("Buttons", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const btnDefs = [
    { name: "Primary", bg: C.accent, bgOp: 1,   bdr: C.accent, bdrOp: 1,   color: C.white,     label: "Setzen" },
    { name: "Ghost",   bg: C.gray,   bgOp: 0,   bdr: C.border, bdrOp: 1,   color: C.grayLight,  label: "Abbrechen" },
    { name: "Danger",  bg: C.red,    bgOp: 0.1, bdr: C.red,    bdrOp: 0.3, color: C.red,        label: "Löschen" },
    { name: "Success", bg: C.green,  bgOp: 0.1, bdr: C.green,  bdrOp: 0.3, color: C.green,      label: "JSON Export" },
  ];
  let btnX = 0;
  btnDefs.forEach(function(b) {
    const btn = makeFrame("Button/" + b.name, 116, 34, undefined, 8);
    btn.fills = b.bgOp > 0 ? solid(b.bg, b.bgOp) : [];
    btn.strokes = [{ type: "SOLID", color: rgb(b.bdr), opacity: b.bdrOp }];
    btn.strokeWeight = 1;
    btn.strokeAlign = "INSIDE";
    add(compPage, btn, cx + btnX, cy);
    add(btn, makeText(b.label, 13, "Semi Bold", b.color), 14, 9);
    btnX += 130;
  });
  cy += 60;

  // ── Stat Pills ──
  add(compPage, makeText("Stat Pills", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const pillDefs = [
    { label: "Geräte",  num: "12", numColor: C.text },
    { label: "Aktiv",   num: "8",  numColor: C.green },
    { label: "Warnung", num: "2",  numColor: C.yellow },
    { label: "Inaktiv", num: "2",  numColor: C.red },
  ];
  let px = 0;
  pillDefs.forEach(function(p) {
    const pill = makeFrame("Pill/" + p.label, 120, 34, C.card, 20);
    addBorder(pill, C.border);
    add(compPage, pill, cx + px, cy);
    add(pill, makeText(p.label, 13, "Regular", C.grayLight), 14, 9);
    add(pill, makeText(p.num, 15, "Bold", p.numColor), 88, 8);
    px += 134;
  });
  cy += 60;

  // ── KPI Card ──
  add(compPage, makeText("KPI Card", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const kpiCardComp = makeFrame("KPI Card", 210, 90, C.card, 12);
  addBorder(kpiCardComp, C.border);
  add(compPage, kpiCardComp, cx, cy);
  add(kpiCardComp, makeText("LETZTER UPLINK", 11, "Semi Bold", C.gray),  16, 14);
  add(kpiCardComp, makeText("vor 2 Min",      22, "Bold",     C.text),  16, 32);
  add(kpiCardComp, makeText("12:34:00 UTC",   12, "Regular",  C.gray),  16, 66);
  cy += 120;

  // ── Device Card ──
  add(compPage, makeText("Device Card", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const devCard = makeFrame("Device Card", 340, 100, C.card, 12);
  addBorder(devCard, C.border);
  add(compPage, devCard, cx, cy);
  const dcIcon = makeFrame("Icon Area", 68, 68, C.blue, 8);
  add(devCard, dcIcon, 16, 16);
  add(dcIcon, makeEllipse("Gas Icon", 36, C.green, 0.8), 16, 16);
  const dcBody = makeFrame("Body", 224, 68, undefined);
  dcBody.fills = [];
  add(devCard, dcBody, 92, 16);
  add(dcBody, makeText("Gas Meter A1B2",       15, "Semi Bold", C.text),  0, 0);
  add(dcBody, makeText("0011aabbccddeeff",      11, "Regular",  C.gray),  0, 20);
  const dcBadge = makeFrame("Badge/Active", 56, 18, undefined, 4);
  dcBadge.fills = solid(C.green, 0.12);
  add(dcBody, dcBadge, 160, 1);
  add(dcBadge, makeText("AKTIV", 9, "Semi Bold", C.green), 8, 4);
  add(dcBody, makeText("1 234.567", 19, "Bold", C.white), 0, 40);
  add(dcBody, makeText("m³",        11, "Medium", C.gray),  88, 44);
  cy += 130;

  // ── Chart Card ──
  add(compPage, makeText("Chart Card", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const chartCardComp = makeFrame("Chart Card", 500, 240, C.card, 12);
  addBorder(chartCardComp, C.border);
  add(compPage, chartCardComp, cx, cy);
  add(chartCardComp, makeText("Tagesverbrauch", 15, "Semi Bold", C.text), 20, 18);
  const chartAreaComp = makeFrame("Chart Area", 460, 168, C.bg, 6);
  add(chartCardComp, chartAreaComp, 20, 46);
  [40,70,55,90,45,80,60,75,50,95,65,85].forEach(function(h, i) {
    const bar = makeRect("Bar " + (i+1), 28, h, C.accent, 3, 0.7);
    add(chartAreaComp, bar, 10 + i * 37, 168 - h - 10);
  });
  add(chartCardComp, makeText("Balken = Tagesverbrauch · Linie = Zählerstand (Tagesschluss)", 11, "Regular", C.gray), 20, 222);
  cy += 270;

  // ── Controls Bar ──
  add(compPage, makeText("Controls Bar", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const ctrlBar = makeFrame("Controls Bar", 760, 52, C.card, 12);
  addBorder(ctrlBar, C.border);
  add(compPage, ctrlBar, cx, cy);
  add(ctrlBar, makeText("TAGE", 12, "Semi Bold", C.gray), 18, 8);
  const ctrlIn1 = makeFrame("Input/Days", 70, 30, C.bg, 8);
  addBorder(ctrlIn1, C.border);
  add(ctrlBar, ctrlIn1, 18, 20);
  add(ctrlIn1, makeText("30", 13, "Regular", C.text), 10, 7);
  add(ctrlBar, makeText("UPLOAD-INTERVALL (min)", 12, "Semi Bold", C.gray), 106, 8);
  const ctrlIn2 = makeFrame("Input/Interval", 90, 30, C.bg, 8);
  addBorder(ctrlIn2, C.border);
  add(ctrlBar, ctrlIn2, 106, 20);
  add(ctrlIn2, makeText("15", 13, "Regular", C.text), 10, 7);
  const ctrlApply = makeFrame("Btn/Apply", 130, 30, C.accent, 8);
  add(ctrlBar, ctrlApply, 220, 11);
  add(ctrlApply, makeText("Intervall setzen", 13, "Semi Bold", C.white), 12, 7);
  cy += 70;

  // ── Toast Notifications ──
  add(compPage, makeText("Toast Notifications", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const toastDefs = [
    { name: "Toast/Success", accent: C.green,  msg: "Einstellung gespeichert" },
    { name: "Toast/Error",   accent: C.red,    msg: "Verbindungsfehler" },
    { name: "Toast/Info",    accent: C.accent, msg: "Gerät aktualisiert" },
  ];
  let tx = 0;
  toastDefs.forEach(function(t) {
    const toast = makeFrame(t.name, 280, 44, C.card, 8);
    addBorder(toast, C.border);
    add(compPage, toast, cx + tx, cy);
    add(toast, makeRect("Accent Bar", 3, 44, t.accent), 0, 0);
    add(toast, makeText(t.msg, 13, "Regular", C.text), 16, 14);
    tx += 296;
  });

  // ── Device Type Icons ──
  cy += 70;
  add(compPage, makeText("Device Type Icons", 14, "Semi Bold", C.gray), cx, cy); cy += 24;
  const iconDefs = [
    { name: "Gas",             color: C.green,  bg: "#15261B" },
    { name: "Strom (Ferraris)",color: C.yellow, bg: "#2B240E" },
    { name: "Strom (SML)",     color: C.yellow, bg: "#2B240E" },
    { name: "Wasser",          color: C.water,  bg: "#162236" },
    { name: "Unbekannt",       color: C.gray,   bg: "#232a33" },
  ];
  let ix = 0;
  iconDefs.forEach(function(ic) {
    const iconFrame = makeFrame("Icon/" + ic.name, 74, 74, ic.bg, 37);
    const iconCirc = makeEllipse("icon", 40, ic.color, 0.9);
    add(iconFrame, iconCirc, 17, 17);
    addBorder(iconFrame, ic.color, 1.5);
    add(compPage, iconFrame, cx + ix, cy);
    add(compPage, makeText(ic.name, 11, "Regular", C.grayLight), cx + ix, cy + 82);
    ix += 100;
  });

  // ============================================================
  // PAGE 3 – OVERVIEW PAGE
  // ============================================================
  const ovPage = figma.createPage();
  ovPage.name = "📱 Overview Page";
  figma.currentPage = ovPage;

  const ovFrame = makeFrame("Overview – 1440px", 1440, 980, C.bg);
  add(ovPage, ovFrame, 0, 0);

  // Topbar
  const ovTopbar = makeFrame("Topbar", 1440, 56, C.sidebar);
  addBorder(ovTopbar, C.border);
  add(ovFrame, ovTopbar, 0, 0);
  add(ovTopbar, makeRect("Logo", 32, 32, C.accent, 6, 0.3), 24, 12);
  add(ovTopbar, makeText("LoRaWAN Dashboard", 16, "Semi Bold", C.text), 64, 18);
  const ovNavA = makeFrame("Nav/Devices Active", 130, 36, undefined, 8);
  ovNavA.fills = solid(C.accent, 0.15);
  add(ovTopbar, ovNavA, 630, 10);
  add(ovNavA, makeText("Devices  12", 13, "Medium", C.text), 14, 10);
  const ovNavI = makeFrame("Nav/Detail Inactive", 80, 36, undefined, 8);
  ovNavI.fills = [];
  add(ovTopbar, ovNavI, 770, 10);
  add(ovNavI, makeText("Detail", 13, "Medium", C.gray), 14, 10);
  add(ovTopbar, makeEllipse("Live Dot", 8, C.green), 1394, 24);
  add(ovTopbar, makeText("Live", 12, "Regular", C.gray), 1408, 22);

  // Page header row
  add(ovFrame, makeText("Geräteübersicht", 22, "Bold", C.text), 24, 76);
  let ovPillX = 248;
  pillDefs.forEach(function(p) {
    const pill = makeFrame("Pill/" + p.label, 120, 34, C.card, 20);
    addBorder(pill, C.border);
    add(ovFrame, pill, ovPillX, 76);
    add(pill, makeText(p.label, 13, "Regular", C.grayLight), 14, 9);
    add(pill, makeText(p.num, 15, "Bold", p.numColor), 88, 8);
    ovPillX += 134;
  });

  // Device type groups – 4 columns
  const groupDefs = [
    { type: "Gas",              color: C.green,  unit: "m³",  count: 3 },
    { type: "Strom (Ferraris)", color: C.yellow, unit: "kWh", count: 4 },
    { type: "Strom (SML)",      color: C.yellow, unit: "kWh", count: 2 },
    { type: "Wasser",           color: C.water,  unit: "m³",  count: 3 },
  ];

  groupDefs.forEach(function(group, gi) {
    const colH = 40 + group.count * 108;
    const gf = makeFrame("Group/" + group.type, 342, colH, undefined);
    gf.fills = [];
    add(ovFrame, gf, 24 + gi * 358, 134);

    // Group header
    add(gf, makeText(group.type, 16, "Bold", C.grayLight), 0, 4);
    const gcBadge = makeFrame("Count Badge", 36, 24, C.card, 999);
    addBorder(gcBadge, C.border);
    add(gf, gcBadge, 303, 2);
    add(gcBadge, makeText(String(group.count), 12, "Semi Bold", C.gray), 10, 4);

    // Device cards
    for (let ci = 0; ci < group.count; ci++) {
      const card = makeFrame("Card/" + (ci+1), 342, 96, C.card, 12);
      addBorder(card, C.border);
      add(gf, card, 0, 34 + ci * 108);

      const iconArea = makeFrame("Icon", 68, 64, "#1a2332", 8);
      add(card, iconArea, 16, 16);
      add(iconArea, makeEllipse("icon", 36, group.color, 0.8), 16, 14);

      const body = makeFrame("Body", 224, 64, undefined);
      body.fills = [];
      add(card, body, 92, 16);
      add(body, makeText("Gerät " + (gi+1) + "." + (ci+1),          15, "Semi Bold", C.text), 0, 0);
      add(body, makeText("00" + gi + "1aa" + ci + "bbccddeeff",       11, "Regular",  C.gray), 0, 19);
      add(body, makeText(String((1000 + gi*100 + ci*111).toFixed(3)), 18, "Bold",     C.white), 0, 38);
      add(body, makeText(group.unit, 11, "Medium", C.gray), 86, 42);
    }
  });

  // ============================================================
  // PAGE 4 – DETAIL PAGE
  // ============================================================
  const dtPage = figma.createPage();
  dtPage.name = "📊 Detail Page";
  figma.currentPage = dtPage;

  const dtFrame = makeFrame("Detail – 1440px", 1440, 1320, C.bg);
  add(dtPage, dtFrame, 0, 0);

  // Topbar
  const dtTopbar = makeFrame("Topbar", 1440, 56, C.sidebar);
  addBorder(dtTopbar, C.border);
  add(dtFrame, dtTopbar, 0, 0);
  add(dtTopbar, makeRect("Logo", 32, 32, C.accent, 6, 0.3), 24, 12);
  add(dtTopbar, makeText("LoRaWAN Dashboard", 16, "Semi Bold", C.text), 64, 18);
  const dtNavI = makeFrame("Nav/Devices", 130, 36, undefined, 8);
  dtNavI.fills = [];
  add(dtTopbar, dtNavI, 630, 10);
  add(dtNavI, makeText("Devices  12", 13, "Medium", C.gray), 14, 10);
  const dtNavA = makeFrame("Nav/Detail Active", 80, 36, undefined, 8);
  dtNavA.fills = solid(C.accent, 0.15);
  add(dtTopbar, dtNavA, 770, 10);
  add(dtNavA, makeText("Detail", 13, "Medium", C.text), 14, 10);
  add(dtTopbar, makeEllipse("Live Dot", 8, C.green), 1394, 24);
  add(dtTopbar, makeText("Live", 12, "Regular", C.gray), 1408, 22);

  // Back button
  const backBtn = makeFrame("Back Button", 196, 34, C.card, 8);
  addBorder(backBtn, C.border);
  add(dtFrame, backBtn, 24, 76);
  add(backBtn, makeText("← Zurück zur Übersicht", 13, "Medium", C.grayLight), 14, 9);

  // Hero
  const hero = makeFrame("Hero", 1392, 100, C.card, 12);
  addBorder(hero, C.border);
  add(dtFrame, hero, 24, 126);
  const heroImg = makeFrame("Hero Image", 72, 72, "#1a2332", 8);
  add(hero, heroImg, 20, 14);
  add(heroImg, makeEllipse("icon", 44, C.accent, 0.5), 14, 14);
  add(hero, makeText("Gas Zähler – Küche EG",  20, "Bold",    C.text), 108, 22);
  add(hero, makeText("0011aabbccddeeff",        13, "Regular", C.gray), 108, 50);

  // Hero action buttons
  const heroActionDefs = [
    { label: "JSON",          w: 60,  bg: C.green, color: C.green },
    { label: "CSV",           w: 60,  bg: C.green, color: C.green },
    { label: "Gerät löschen", w: 130, bg: C.red,   color: C.red },
  ];
  let haX = 1088;
  heroActionDefs.forEach(function(ha) {
    const btn = makeFrame("Btn/" + ha.label, ha.w, 32, undefined, 8);
    btn.fills = solid(ha.bg, 0.1);
    btn.strokes = [{ type: "SOLID", color: rgb(ha.bg), opacity: 0.3 }];
    btn.strokeWeight = 1;
    btn.strokeAlign = "INSIDE";
    add(hero, btn, haX, 34);
    add(btn, makeText(ha.label, 13, "Semi Bold", ha.color), 10, 8);
    haX += ha.w + 8;
  });

  // KPI Row
  const kpiDefs = [
    { label: "LETZTER UPLINK",   value: "vor 2 Min",    sub: "12:34:00 UTC" },
    { label: "BATTERIE",         value: "3.6 V",         sub: "80% – Normal" },
    { label: "RSSI",             value: "-87 dBm",        sub: "SNR: 8.2 dB" },
    { label: "ZÄHLERSTAND",      value: "1 234.567 m³",  sub: "Gas" },
    { label: "UPLOAD-INTERVALL", value: "15 min",         sub: "Normal" },
    { label: "GESAMTE UPLINKS",  value: "2 341",          sub: "Alle Zeit" },
  ];
  kpiDefs.forEach(function(kpi, i) {
    const kc = makeFrame("KPI/" + kpi.label, 228, 90, C.card, 12);
    addBorder(kc, C.border);
    add(dtFrame, kc, 24 + i * 238, 246);
    add(kc, makeText(kpi.label, 11, "Semi Bold", C.gray),  16, 14);
    add(kc, makeText(kpi.value, 20, "Bold",     C.text),  16, 32);
    add(kc, makeText(kpi.sub,   12, "Regular",  C.gray),  16, 66);
  });

  // Payload card
  const payloadCard = makeFrame("Payload Card", 1392, 108, C.card, 12);
  addBorder(payloadCard, C.border);
  add(dtFrame, payloadCard, 24, 356);
  add(payloadCard, makeText("Letzter Uplink-Payload", 15, "Semi Bold", C.text), 20, 16);
  const payloadPre = makeFrame("Payload Pre", 1352, 62, C.bg, 6);
  addBorder(payloadPre, C.border);
  add(payloadCard, payloadPre, 20, 40);
  add(payloadPre, makeText('{ "meterValue": 1234.567, "battery_mv": 3580, "rssi": -87, "snr": 8.2 }', 12, "Regular", C.grayLight), 12, 20);

  // Controls bar
  const ctrlBarDt = makeFrame("Controls Bar", 1392, 52, C.card, 12);
  addBorder(ctrlBarDt, C.border);
  add(dtFrame, ctrlBarDt, 24, 484);
  add(ctrlBarDt, makeText("TAGE", 12, "Semi Bold", C.gray), 18, 8);
  const dtIn1 = makeFrame("Input/Days", 70, 30, C.bg, 8);
  addBorder(dtIn1, C.border);
  add(ctrlBarDt, dtIn1, 18, 20);
  add(dtIn1, makeText("30", 13, "Regular", C.text), 10, 7);
  add(ctrlBarDt, makeText("UPLOAD-INTERVALL (min)", 12, "Semi Bold", C.gray), 106, 8);
  const dtIn2 = makeFrame("Input/Interval", 90, 30, C.bg, 8);
  addBorder(dtIn2, C.border);
  add(ctrlBarDt, dtIn2, 106, 20);
  add(dtIn2, makeText("15", 13, "Regular", C.text), 10, 7);
  const dtApply = makeFrame("Btn/Apply", 130, 30, C.accent, 8);
  add(ctrlBarDt, dtApply, 214, 11);
  add(dtApply, makeText("Intervall setzen", 13, "Semi Bold", C.white), 12, 7);
  const dtRefresh = makeFrame("Btn/Refresh", 110, 30, C.accent, 8);
  add(ctrlBarDt, dtRefresh, 356, 11);
  add(dtRefresh, makeText("Aktualisieren", 13, "Semi Bold", C.white), 10, 7);

  // Chart grid – 2 columns
  const chartDefs = [
    { title: "Tagesverbrauch",             sub: "Balken = Tagesverbrauch · Linie = Zählerstand (Tagesschluss)" },
    { title: "Stündlicher Verbrauch",       sub: "Verbrauch pro Stunde (interpoliert aus Zählerstand)" },
    { title: "Batteriespannung (mV)",       sub: "Zoom: Bereich markieren · Tooltip zeigt Batterie + Zähler" },
    { title: "RSSI über Zeit",              sub: "Signal-Stärke (dBm) · Tooltip zeigt RSSI, SNR und Zähler" },
    { title: "IMU Position (ax/ay/az)",     sub: "Beschleunigungssensor-Daten (imu_ax, imu_ay, imu_az)" },
    { title: "Payload Explorer",            sub: "Wähle ein Feld aus dem Uplink-Payload zur Visualisierung" },
  ];

  chartDefs.forEach(function(chart, i) {
    const isLast = i === chartDefs.length - 1;
    const cw  = isLast ? 1392 : 686;
    const col = i % 2;
    const row = Math.floor(i / 2);
    const chartX = isLast ? 24 : 24 + col * 706;
    const chartY = 556 + row * 206;

    const cc = makeFrame("Chart/" + chart.title, cw, 192, C.card, 12);
    addBorder(cc, C.border);
    add(dtFrame, cc, chartX, chartY);
    add(cc, makeText(chart.title, 15, "Semi Bold", C.text), 20, 16);

    // Chart placeholder with mock bars
    const ca = makeFrame("Chart Area", cw - 40, 130, C.bg, 6);
    add(cc, ca, 20, 44);
    const barCount = Math.floor((cw - 60) / 34);
    for (let b = 0; b < barCount; b++) {
      const bh = 20 + ((b * 7 + i * 17) % 80);
      const bar = makeRect("bar", 24, bh, C.accent, 2, 0.5 + (b % 3) * 0.15);
      add(ca, bar, 8 + b * 30, 130 - bh - 8);
    }
    add(cc, makeText(chart.sub, 11, "Regular", C.gray), 20, 174);
  });

  // ── Switch to Overview page when done ──
  figma.currentPage = ovPage;
  figma.viewport.scrollAndZoomIntoView([ovFrame]);
}

main()
  .then(function() {
    figma.closePlugin("✅ EMONI Dashboard imported! 4 pages created: Design Tokens · Components · Overview · Detail");
  })
  .catch(function(err) {
    figma.closePlugin("❌ Error: " + String(err && err.message ? err.message : err));
  });
