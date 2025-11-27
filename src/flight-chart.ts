import {
  type ChartConfig,
  type ChartModel,
  ChartToTSEvent,
  ColumnType,
  type CustomChartContext,
  getChartContext,
  type Query,
} from "@thoughtspot/ts-chart-sdk";

import flightSeatsSvg from "./assets/corrected_seats_hitbox.svg?raw";

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

const SEAT_DATA: Record<
  string,
  { name: string; travellerId: string; item: string; status: SeatStatus }
> = {
  "2A": {
    name: "Oliver Bennett",
    travellerId: "EZ9081123",
    item: "sandwich and coffee",
    status: "Frequent Traveller",
  },
  "2B": {
    name: "Charlotte Hayes",
    travellerId: "EZ9081124",
    item: "sandwich",
    status: "Occupied",
  },
  "4C": {
    name: "James Whitmore",
    travellerId: "EZ9081125",
    item: "coffee",
    status: "Occupied",
  },
};

let currentZoom = 1;  
const MIN_ZOOM = 0.5;  
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
  return status === "Frequent Traveller" || status === "Occupied"
    ? "#d15d99"
    : "#ffffff";
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

function resolveSeatKey(el: Element | null): string | null {
  if (!el) return null;

  let curr: Element | null = el;
  while (curr) {
    if (curr.id) {
      const clean = curr.id.replace(/^seat_/, "");
      if (SEAT_DATA[clean]) return clean;
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

/* ---------------------------------------------
   LOAD + STYLE SVG
---------------------------------------------- */
function loadAndStyleSVG(container: HTMLElement) {    
  const mapWrapper = document.createElement("div");    
  mapWrapper.className = "flight-seat-map-container";    
  mapWrapper.style.position = "relative";    
    
  // Add zoom controls    
  mapWrapper.appendChild(createZoomControls(container));    
    
  const svgWrapper = document.createElement("div");    
  svgWrapper.className = "svg-wrapper";    
    
  const svgBox = document.createElement("div");    
  svgBox.className = "svg-container";    
    
  svgBox.innerHTML = flightSeatsSvg;    
  svgWrapper.appendChild(svgBox);    
  mapWrapper.appendChild(svgWrapper);    
    
  container.appendChild(mapWrapper);  
    
  // Ensure SVG is properly sized  
  const svgElement = svgBox.querySelector('svg') as SVGElement;  
  if (svgElement) {  
    svgElement.style.width = '100%';  
    svgElement.style.height = 'auto';  
    svgElement.style.maxWidth = '150px';
  }  
    
  const svgRoot = svgBox;    
    
  Object.keys(SEAT_DATA).forEach((seatKey) => {    
    const dom = findSeatDom(svgRoot, seatKey);    
    if (!dom) return;    
    
    const fill = colorForStatus(SEAT_DATA[seatKey].status);    
    const parts = dom.querySelectorAll("path, rect, circle, polygon, ellipse");    
    parts.forEach((p) => p.setAttribute("fill", fill));    
  });    
}

/* ---------------------------------------------
   INTERACTIVITY
---------------------------------------------- */
function attachInteractivity(container: HTMLElement) {  
  container.addEventListener("mouseover", (ev: MouseEvent) => {  
    const seatKey = resolveSeatKey(ev.target as Element);  
    if (!seatKey) return;  
  
    const info = SEAT_DATA[seatKey];  
      
    // Status-based tooltip styling  
    const statusColor = 
      info.status === "Frequent Traveller" ? "#ff9933" :   
      info.status === "Occupied" ? "#4da6ff" : 
      "#ffffff";

    showTooltip(
      `
      <strong>Seat No: ${seatKey}</strong>
      <div class="tooltip-row">
        <span class="tooltip-label">Status:</span>
        <span class="tooltip-value" style="color:${statusColor}; font-weight:600;">
          ${info.status}
        </span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Passenger Name:</span>
        <span class="tooltip-value">${info.name}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Frequent Traveller ID:</span>
        <span class="tooltip-value">${info.travellerId}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Most Purchased Item:</span>
        <span class="tooltip-value">${info.item}</span>
      </div>
      `,
      ev.clientX,
      ev.clientY
    );
  });  

  container.addEventListener("mousemove", (ev) => {
    const tt = document.getElementById("seat-tooltip");
    if (tt?.style.display === "block") {
      tt.style.left = ev.clientX + 12 + "px";
      tt.style.top = ev.clientY + 12 + "px";
    }
  });

  container.addEventListener("mouseout", () => {
    hideTooltip();
  });
}

/* ---------------------------------------------
   RENDER
---------------------------------------------- */
async function renderChart(ctx: CustomChartContext) {
  ctx.emitEvent(ChartToTSEvent.RenderStart);

  const root =
    document.getElementById("flight-chart") ||
    (() => {
      const div = document.createElement("div");
      div.id = "flight-chart";
      document.body.appendChild(div);
      return div;
    })();

  root.innerHTML = "";

  loadAndStyleSVG(root);
  attachInteractivity(root);

  ctx.emitEvent(ChartToTSEvent.RenderComplete);
}

/* ---------------------------------------------
   FIXED CONFIG
---------------------------------------------- */
const getFixedChartConfig = (chartModel: ChartModel): ChartConfig[] => {
  const cols = chartModel.columns || [];
  const attributes = cols.filter((c) => c.type === ColumnType.ATTRIBUTE);
  const measures = cols.filter((c) => c.type === ColumnType.MEASURE);

  return [
    {
      key: "main",
      dimensions: [
        { key: "seat", columns: attributes.length ? [attributes[0]] : [] },
        { key: "value", columns: measures.length ? [measures[0]] : [] },
      ],
    },
  ];
};

const getFixedQueries = (configs: ChartConfig[]): Query[] => {
  return configs.map((cfg) => ({
    queryColumns: cfg.dimensions.flatMap((d) => d.columns || []),
  }));
};

/* ---------------------------------------------
   INIT
---------------------------------------------- */
(async () => {
  try {
    const ctx = await getChartContext({
      getDefaultChartConfig: getFixedChartConfig,
      getQueriesFromChartConfig: getFixedQueries,
      renderChart,
      visualPropEditorDefinition: { elements: [] },
    });

    await renderChart(ctx);
  } catch (err) {
    console.error(err);
  }
})();
