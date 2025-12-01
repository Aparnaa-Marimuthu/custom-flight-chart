import {
  type ChartConfig,
  type ChartModel,
  ChartToTSEvent,
  type CustomChartContext,
  getChartContext,
  type Query,
} from "@thoughtspot/ts-chart-sdk";

import flightSeatsSvg from "./assets/A320N_repeated_multiline_tooltip.svg?raw";

// -------------------------------------------------------
// INJECT YOUR CSS GLOBALLY (inside the TS iframe)
// -------------------------------------------------------
const STYLE = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, html {
  width: 100%;
  height: 100%;
}

/* --------------------------- */
/* Your Provided CSS           */
/* --------------------------- */

.flight-seat-map-container {
  font-family: sans-serif;
  text-align: center;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}

.svg-container {
  width: 80%;
  max-width: 1000px;
  padding: 20px;
  border-radius: 8px;
}

.flight-svg {
  width: 100%;
  height: auto;
}

.seat-default {
  fill: #f0f0f0;
  stroke: #aaa;
  stroke-width: 1px;
}

.seat-occupied {
  fill: #4da6ff;
  stroke: #336699;
  stroke-width: 1px;
  cursor: pointer;
}

.seat-frequent-traveller {
  fill: #ff9933;
  stroke: #cc6600;
  stroke-width: 1px;
  cursor: pointer;
}

.seat-occupied:hover,
.seat-frequent-traveller:hover {
  opacity: 0.7;
}

/* Tooltip */
.tooltip {  
  position: absolute;  
  background: rgba(50, 50, 50, 0.85);  
  color: white;  
  padding: 12px 16px;  
  border-radius: 8px;  
  font-size: 13px;  
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;  
  pointer-events: none;  
  z-index: 1000;  
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);  
  border: 1px solid rgb(17, 120, 238);  
  backdrop-filter: blur(10px);  
  max-width: 250px;  
  white-space: normal;  
  line-height: 1.4;  
}

.tooltip strong {  
  display: block;  
  font-size: 14px;  
  margin-bottom: 8px;  
  padding-bottom: 6px;  
  border-bottom: 1px solid rgba(255,255,255,0.3);  
}

.tooltip-row {  
  display: flex;  
  justify-content: space-between;  
  margin: 4px 0;  
}

.tooltip-label {  
  font-weight: 600;  
  opacity: 0.9;  
}

.tooltip-value {  
  text-align: right;  
}

.zoom-controls {  
  position: absolute;  
  top: 5px;  
  right: 5px;  
  z-index: 100;  
  display: flex;  
  gap: 10px;  
}  
  
.zoom-btn {  
  background: rgba(175, 175, 175, 0.7);  
  color: black;  
  border: none;  
  width: 36px;  
  height: 36px;  
  border-radius: 25%;  
  cursor: pointer;  
  font-size: 18px;  
  display: flex;  
  align-items: center;  
  justify-content: center;  
  transition: background 0.2s;  
}  
  
.zoom-btn:hover {  
  background: rgba(204, 204, 204, 0.9);  
}  
  
.svg-wrapper {  
  overflow: auto;  
  width: 100%;  
  height: calc(100vh - 60px);  
  display: flex;  
  justify-content: center;  
  align-items: flex-start;  
  padding-top: 60px;
}  
  
.svg-container {  
   transform-origin: center top; 
  transition: transform 0.3s ease;  
  min-height: 100%; 
  width: auto;  
  max-width: none; 
}
`;

(function injectCSS() {
  const tag = document.createElement("style");
  tag.innerHTML = STYLE;
  document.head.appendChild(tag);
})();

// -------------------------------------------------------
// Your existing code continues
// -------------------------------------------------------

type SeatStatus = "Frequent Traveller" | "Occupied" | "Empty";

let currentZoom = 1.7;  
const MIN_ZOOM = 1;  
const MAX_ZOOM = 5;  
const ZOOM_STEP = 0.25;  
  
function updateZoom(container: HTMLElement, delta: number) {  
  currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));  
  const svgContainer = container.querySelector('.svg-container') as HTMLElement;  
  if (svgContainer) {  
    svgContainer.style.transform = `scale(${currentZoom})`;  
  }  
    
  // Update button states  
  const zoomInBtn = document.getElementById('zoom-in') as HTMLButtonElement;  
  const zoomOutBtn = document.getElementById('zoom-out') as HTMLButtonElement;  
  if (zoomInBtn) zoomInBtn.disabled = currentZoom >= MAX_ZOOM;  
  if (zoomOutBtn) zoomOutBtn.disabled = currentZoom <= MIN_ZOOM;  
}  
  
function createZoomControls(container: HTMLElement) {  
  const controls = document.createElement('div');  
  controls.className = 'zoom-controls';  
    
  const zoomInBtn = document.createElement('button');  
  zoomInBtn.id = 'zoom-in';  
  zoomInBtn.className = 'zoom-btn';  
  zoomInBtn.innerHTML = '+';  
  zoomInBtn.onclick = () => updateZoom(container, ZOOM_STEP);  
    
  const zoomOutBtn = document.createElement('button');  
  zoomOutBtn.id = 'zoom-out';  
  zoomOutBtn.className = 'zoom-btn';  
  zoomOutBtn.innerHTML = '−';  
  zoomOutBtn.onclick = () => updateZoom(container, -ZOOM_STEP);  
    
  const resetBtn = document.createElement('button');  
  resetBtn.className = 'zoom-btn';  
  resetBtn.innerHTML = '⟲';  
  resetBtn.onclick = () => {  
    currentZoom = 1;  
    updateZoom(container, 0);  
  };  
    
  controls.appendChild(zoomInBtn);  
  controls.appendChild(zoomOutBtn);  
  controls.appendChild(resetBtn);  
    
  return controls;  
}

function colorForStatus(status?: SeatStatus): string {
  switch (status) {
    case "Frequent Traveller":
      return "#ff9933"; // orange
    case "Occupied":
      return "#4da6ff"; // blue
    case "Empty":
      return "#cccccc"; // grey
    default:
      return "#cccccc";
  }
}

function findSeatDom(container: HTMLElement, seatKey: string): Element | null {
  const selectors = [
    `[id='seat_${seatKey}']`,
    `[id='${seatKey}']`,
    `g[id='seat_${seatKey}']`,
    `g[id='${seatKey}']`,
  ];
  for (const sel of selectors) {
    const el = container.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function resolveSeatKey(el: Element | null, seatData: Record<string, any>): string | null {
  if (!el) return null;

  let curr: Element | null = el;
  while (curr) {
    if (curr.id) {
      const clean = curr.id.replace(/^seat_/, "");
      if (seatData[clean]) return clean;
    }
    curr = curr.parentElement;
  }
  return null;
}

/* ---------------------------------------------
   TOOLTIP
---------------------------------------------- */
function ensureTooltip(): HTMLDivElement {
  let tt = document.getElementById("seat-tooltip") as HTMLDivElement | null;

  if (!tt) {
    tt = document.createElement("div");
    tt.id = "seat-tooltip";
    tt.className = "tooltip";
    tt.style.display = "none";
    document.body.appendChild(tt);
  }

  return tt;
}

function showTooltip(html: string, x: number, y: number) {  
  const tt = ensureTooltip();  
  tt.innerHTML = html;  
  tt.style.left = x + 12 + "px";  
  tt.style.top = y + 12 + "px";  
  tt.style.display = "block";  
}  

function hideTooltip() {
  const tt = ensureTooltip();
  tt.style.display = "none";
}

/* ---------- SVG PREP + HELPERS (CLEAN) ---------- */
function safeGetAttr(el: Element | null, name: string) {
  if (!el) return null;
  return (
    el.getAttribute(name) ??
    el.getAttributeNS("http://www.w3.org/1999/xlink", name) ??
    el.getAttributeNS("http://www.w3.org/2000/svg", name)
  );
}

function safeSetXLink(el: Element, href: string) {
  el.setAttribute("href", href);
  el.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
}

function prepareSvgMarkup(rawSvg: string) {
  try {
    const rootNormalized = rawSvg
      .replace(/<\s*ns\d+:svg\b/gi, "<svg")
      .replace(/<\/\s*ns\d+:svg\s*>/gi, "</svg>");

    const parser = new DOMParser();
    const doc = parser.parseFromString(rootNormalized, "image/svg+xml");
    const svg = doc.documentElement;

    if (!svg || svg.nodeName.toLowerCase() !== "svg") {
      return rawSvg;
    }

    const defs = svg.querySelector("defs");
    if (defs && svg.firstElementChild !== defs) {
      svg.removeChild(defs);
      svg.insertBefore(defs, svg.firstElementChild || null);
    }

    const images = svg.querySelectorAll("image");
    images.forEach((img) => {
      const href = safeGetAttr(img, "href") ?? "";
      if (!href) return;
      const cleaned = href.replace(/[\r\n]+/g, "");
      safeSetXLink(img, cleaned);
      if (!img.getAttribute("preserveAspectRatio")) {
        img.setAttribute("preserveAspectRatio", "none");
      }
    });

    const patterns = svg.querySelectorAll("pattern");
    const svgEl = svg as unknown as SVGSVGElement;
    const vb = svgEl.viewBox?.baseVal;

    const svgWidth =
      parseFloat(svgEl.getAttribute("width") || "") || (vb ? vb.width : 0);

    const svgHeight =
      parseFloat(svgEl.getAttribute("height") || "") || (vb ? vb.height : 0);

    patterns.forEach((p) => {
      p.setAttribute("patternUnits", "userSpaceOnUse");
      p.removeAttribute("patternContentUnits");
      if (svgWidth && svgHeight) {
        p.setAttribute("width", String(svgWidth));
        p.setAttribute("height", String(svgHeight));
      }

      const use = p.querySelector("use");
      if (use) {
        const useHref =
          use.getAttribute("href") ??
          use.getAttributeNS("http://www.w3.org/1999/xlink", "href") ??
          use.getAttribute("ns1:href");

        if (useHref) {
          safeSetXLink(use, useHref);
        }

        const tr = use.getAttribute("transform");
        if (tr && /scale\(\s*0\.00/.test(tr)) {
          use.removeAttribute("transform");
        }
      }
    });

    const clipPaths = svg.querySelectorAll("clipPath");
    let mainClipId: string | null = null;
    if (clipPaths.length) {
      mainClipId = clipPaths[0].id || clipPaths[0].getAttribute("id");
    }

    const bgRects = Array.from(svg.querySelectorAll("rect")).filter((r) => {
      const f = r.getAttribute("fill") || "";
      return /url\(#pattern/i.test(f);
    });

    bgRects.forEach((r) => {
      if (r.closest("defs")) {
        r.parentElement?.removeChild(r);
      }
    });

    let targetGroup: Element | null = null;
    if (mainClipId) {
      targetGroup = svg.querySelector(
        `g[clip-path="url(#${mainClipId})"], g[clip-path='url(#${mainClipId})']`
      );
    }
    if (!targetGroup) {
      targetGroup = svg.querySelector("g") ?? svg;
    }

    const hasBg = Array.from(targetGroup.children).some((c) => {
      return (
        c.nodeName === "rect" &&
        /url\(#pattern/i.test((c as HTMLElement).getAttribute("fill") || "")
      );
    });

    if (!hasBg) {
      const firstPattern = svg.querySelector("pattern");
      if (firstPattern) {
        const patId = firstPattern.getAttribute("id");
        const bg = doc.createElementNS("http://www.w3.org/2000/svg", "rect");

        bg.setAttribute("width", svg.getAttribute("width") ?? String(svgWidth));
        bg.setAttribute("height", svg.getAttribute("height") ?? String(svgHeight));
        bg.setAttribute("fill", `url(#${patId})`);

        if (mainClipId) {
          targetGroup.setAttribute("clip-path", `url(#${mainClipId})`);
        }

        targetGroup.insertBefore(bg, targetGroup.firstChild);
      }
    }

    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch {
    return rawSvg;
  }
}

/* ---------- LOAD + STYLE SVG (CLEAN) ---------- */
async function loadAndStyleSVG(container: HTMLElement, seatData: any) {
  const mapWrapper = document.createElement("div");
  mapWrapper.className = "flight-seat-map-container";
  mapWrapper.style.position = "relative";

  mapWrapper.appendChild(createZoomControls(container));

  const svgWrapper = document.createElement("div");
  svgWrapper.className = "svg-wrapper";

  const svgBox = document.createElement("div");
  svgBox.className = "svg-container";

  const prepared = prepareSvgMarkup(flightSeatsSvg as string);

  svgBox.innerHTML = prepared;
  svgWrapper.appendChild(svgBox);
  mapWrapper.appendChild(svgWrapper);
  container.appendChild(mapWrapper);
  updateZoom(container, 0);

  const svgElement = svgBox.querySelector("svg") as SVGElement | null;
  if (svgElement) {
    svgElement.style.width = "100%";
    svgElement.style.height = "auto";
    svgElement.style.maxWidth = "150";
  }

  const svgRoot = svgBox;
  /* COLOR EACH SEAT CORRECTLY */  
svgRoot.querySelectorAll("g[id]:not(#legend) rect").forEach((rect: any) => {
  rect.style.fill = colorForStatus("Empty");
});
Object.keys(seatData).forEach((seatKey) => {
  const seatG = findSeatDom(svgRoot, seatKey);
  if (!seatG) return;

  const status = seatData[seatKey].status;
  const rect = seatG.querySelector("rect");
  if (!rect) return;

  // Apply dynamic fill color
  rect.style.fill = colorForStatus(status);
});


}

/* ---------------------------------------------
   INTERACTIVITY
---------------------------------------------- */
// function attachInteractivity(container: HTMLElement, seatData: any) {  
//   container.addEventListener("mouseover", (ev: MouseEvent) => {  
//     const seatKey = resolveSeatKey(ev.target as Element, seatData);  
//     if (!seatKey) return;  
  
//     const info = seatData[seatKey];  
      
//     // Status-based tooltip styling  
//     const statusColor = 
//       info.status === "Frequent Traveller" ? "#ff9933" :   
//       info.status === "Occupied" ? "#4da6ff" : 
//       "#ffffff";

//     showTooltip(
//       `
//       <strong>Seat No: ${seatKey}</strong>
//       <div class="tooltip-row">
//         <span class="tooltip-label">Status:</span>
//         <span class="tooltip-value" style="color:${statusColor}; font-weight:600;">
//           ${info.status}
//         </span>
//       </div>
//       <div class="tooltip-row">
//         <span class="tooltip-label">Passenger Name:</span>
//         <span class="tooltip-value">${info.name}</span>
//       </div>
//       <div class="tooltip-row">
//         <span class="tooltip-label">Frequent Traveller ID:</span>
//         <span class="tooltip-value">${info.travellerId}</span>
//       </div>
//       <div class="tooltip-row">
//         <span class="tooltip-label">Most Purchased Item:</span>
//         <span class="tooltip-value">${info.item}</span>
//       </div>
//       `,
//       ev.clientX,
//       ev.clientY
//     );
//   });  

//   container.addEventListener("mousemove", (ev) => {
//     const tt = document.getElementById("seat-tooltip");
//     if (tt?.style.display === "block") {
//       tt.style.left = ev.clientX + 12 + "px";
//       tt.style.top = ev.clientY + 12 + "px";
//     }
//   });

//   container.addEventListener("mouseout", () => {
//     hideTooltip();
//   });
// }

function attachInteractivity(container: HTMLElement, seatData: any) {

  container.addEventListener("click", (ev: MouseEvent) => {
  const seatKey = resolveSeatKey(ev.target as Element, seatData);

  // Click outside
  if (!seatKey) {
    hideTooltip();
    return;
  }

  const seatEl = findSeatDom(container, seatKey);
  if (!seatEl) return;

  const info = seatData[seatKey];

  // Seat bounding box coordinates
  const bbox = (seatEl as any).getBoundingClientRect();
  const x = bbox.left + bbox.width / 2;
  const y = bbox.top - 10; // slightly above the seat
  const statusColor =
    info.status === "Frequent Traveller" ? "#ff9933" :
    info.status === "Occupied" ? "#4da6ff" :
    "#cccccc";

  showTooltip(
    `
    <strong>Seat: ${seatKey}</strong>
    <div class="tooltip-row">
      <span class="tooltip-label">Passenger:</span>
      <span class="tooltip-value">${info.name}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">Purchased:</span>
      <span class="tooltip-value">${info.item}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">Status:</span>
      <span class="tooltip-value" style="color:${statusColor};font-weight:600;">
        ${info.status}
      </span>
    </div>
    `,
    x,
    y
  );
});
}


function buildSeatData(queryResult: any) {
  if (!queryResult?.data || queryResult.data.length === 0) {
  console.warn("No data returned — using preview dataset");

  queryResult = {
    columns: [
      { name: "Seat" },
      { name: "Passenger name" },
      { name: "Passengerid" },
      { name: "Product detail" },
    ],
    data: [
      ["12A", "John", "EJ01", "Water"],
      ["14B", "Mia", "EJ02", "Snacks"],
    ],
  };
}
  const seatMap: Record<string, any> = {};

  const columns = queryResult.columns.map((c: any) => c.name.toLowerCase());

  const seatIdx = columns.indexOf("seat");
  const passengerIdx = columns.indexOf("passenger name");
  const passengerIdIdx = columns.indexOf("passengerid");
  const productIdx = columns.indexOf("product detail");

  if (seatIdx === -1) return {};

  // Count occurrences of PassengerID → FT logic
  const passengerCount: Record<string, number> = {};
  queryResult.data.forEach((row: any[]) => {
    const pid = row[passengerIdIdx];
    if (pid) passengerCount[pid] = (passengerCount[pid] || 0) + 1;
  });

  queryResult.data.forEach((row: any[]) => {
    const seat = row[seatIdx];
    if (!seat) return;

    const name = row[passengerIdx];
    const pid = row[passengerIdIdx];
    const item = row[productIdx];

    const appearsMoreThanOnce = pid && passengerCount[pid] > 1;

    let status: SeatStatus;

    if (!name && !pid) {
      status = "Empty";
    } else if (appearsMoreThanOnce) {
      status = "Frequent Traveller";
    } else {
      status = "Occupied";
    }

    seatMap[seat] = {
      name: name || "-",
      travellerId: pid || "-",
      item: item || "-",
      status,
    };
  });

  return seatMap;
}





/* ---------------------------------------------
   RENDER
---------------------------------------------- */
async function renderChart(ctx: CustomChartContext) {
  ctx.emitEvent(ChartToTSEvent.RenderStart);
  const queryResult = (ctx as any).data;

  if (!queryResult || !queryResult.columns || !queryResult.data) {
  console.warn("BYOC has no real data. Using dummy dataset for preview.");

  // queryResult = {
  //   columns: [
  //     { name: "Seat" },
  //     { name: "Passenger Name" },
  //     { name: "PassengerID" },
  //     { name: "Product Detail" },
  //   ],
  //   data: [
  //     ["17E", "John Doe", "EJ001", "Water"],
  //     ["14C", "Jane Smith", "EJ002", "Snacks"],
  //     ["17E", "John Doe", "EJ001", "Coffee"], 
  //     ["18B", "Peter", "EJ003", "Tea"],
  //     ["18B", "Peter", "EJ003", "Beer"],   
  //   ]
  // };
}
  const dynamicSeatData = buildSeatData(queryResult);

  const root =
    document.getElementById("flight-chart") ||
    (() => {
      const div = document.createElement("div");
      div.id = "flight-chart";
      document.body.appendChild(div);
      return div;
    })();

  root.innerHTML = "";

  loadAndStyleSVG(root, dynamicSeatData);
  attachInteractivity(root, dynamicSeatData);

  ctx.emitEvent(ChartToTSEvent.RenderComplete);
}

/* ---------------------------------------------
   FIXED CONFIG (DIMENSIONS USED FOR DRAGGABLE FIELDS)
---------------------------------------------- */
const getFixedChartConfig = (chartModel: ChartModel): ChartConfig[] => {
  console.log("[ChartModel received]", chartModel);

  return [
    {
      key: "main",
      dimensions: [
        { key: "seat",            columns: [] },
        { key: "passenger_name",  columns: [] },
        { key: "passenger_id",    columns: [] },
        { key: "product_detail",  columns: [] },
      ],
    },
  ];
};

/* ---------------------------------------------
   FIXED QUERIES (TS FILLS COLUMNS AFTER USER DRAGS)
---------------------------------------------- */
const getFixedQueries = (configs: ChartConfig[]): Query[] => {
  return configs.map(cfg => {
    const cols = cfg.dimensions.flatMap(d => d.columns);

    console.log("[Query columns generated]", cols);

    return {
      queryColumns: cols,  // MUST be exactly what TS gives
    };
  });
};



/* ---------------------------------------------
   INIT
---------------------------------------------- */
(async () => {
  try {
    await getChartContext({
      getDefaultChartConfig: getFixedChartConfig,
      getQueriesFromChartConfig: getFixedQueries,
      renderChart,
      visualPropEditorDefinition: { 
        elements: [
            {
            type: "text",
            key: "info",
            label: "Seat Map",
            defaultValue: "Custom Seat Map",
            }
      ] },
    });

  } catch (err) {
    console.error(err);
  }
})();
