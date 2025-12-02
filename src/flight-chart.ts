import {
  type ChartConfig,
  type ChartModel,
  ChartToTSEvent,
  ColumnType,
  type CustomChartContext,
  getChartContext,
  type Query,
} from "@thoughtspot/ts-chart-sdk";

import flightSeatsSvg from "./assets/A320N_repeated_multiline_tooltip.svg?raw";

const log = (...msg: any[]) => console.log("[FLIGHT-CHART]", ...msg);

// -------------------------------------------------------
// INJECT YOUR CSS GLOBALLY
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
  position: fixed !important;  
  background: rgba(50, 50, 50, 0.95) !important;  
  color: white !important;  
  padding: 12px 16px;  
  border-radius: 8px;  
  font-size: 13px;  
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;  
  pointer-events: none;  
  z-index: 999999 !important;  
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
// TYPES
// -------------------------------------------------------
type SeatStatus = "Frequent Traveller" | "Occupied" | "Empty";

// -------------------------------------------------------
// ZOOM CONTROLS
// -------------------------------------------------------
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
    currentZoom = 1.7;  
    updateZoom(container, 0);  
  };  
    
  controls.appendChild(zoomInBtn);  
  controls.appendChild(zoomOutBtn);  
  controls.appendChild(resetBtn);  
    
  return controls;  
}

// -------------------------------------------------------
// UTILS
// -------------------------------------------------------
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

// -------------------------------------------------------
// TOOLTIP
// -------------------------------------------------------
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

// -------------------------------------------------------
// SVG PREP
// -------------------------------------------------------
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

// -------------------------------------------------------
// LOAD + STYLE SVG
// -------------------------------------------------------
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
    svgElement.style.pointerEvents = "auto";
  }

  const svgRoot = svgBox;
  
  // Color all seats default grey first
  svgRoot.querySelectorAll("g[id]:not(#legend) rect").forEach((rect: any) => {
    rect.style.fill = colorForStatus("Empty");
  });
  
  // Color seats based on data
  Object.keys(seatData).forEach((seatKey) => {
    const seatG = findSeatDom(svgRoot, seatKey);
    if (!seatG) return;

    const status = seatData[seatKey].status;
    const rect = seatG.querySelector("rect");
    if (!rect) return;

    rect.style.fill = colorForStatus(status);
  });
}

// -------------------------------------------------------
// INTERACTIVITY
// -------------------------------------------------------
function attachInteractivity(container: HTMLElement, seatData: any) {
  container.addEventListener("click", (ev: MouseEvent) => {
    const seatKey = resolveSeatKey(ev.target as Element, seatData);

    if (!seatKey) {
      hideTooltip();
      return;
    }

    const seatEl = findSeatDom(container, seatKey);
    if (!seatEl) return;

    const info = seatData[seatKey];

    const bbox = (seatEl as any).getBoundingClientRect();
    const x = bbox.left + bbox.width / 2;
    const y = bbox.top - 10;
    
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
        <span class="tooltip-label">PNR:</span>
        <span class="tooltip-value">${info.travellerId}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Trips (last 12 months):</span>
        <span class="tooltip-value">${info.trips}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Total spend:</span>
        <span class="tooltip-value">$${Number(info.spend).toFixed(2)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Fare type:</span>
        <span class="tooltip-value">${info.item}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Status:</span>
        <span class="tooltip-value" style="color:${statusColor};font-weight:600;">
          ${info.status === "Frequent Traveller" ? "Repeated Customer" : info.status}
        </span>
      </div>
      `,
      x,
      y
    );
  });
}

// -------------------------------------------------------
// ✅ TYPESCRIPT-SAFE: BUILD SEAT DATA FROM THOUGHTSPOT
// -------------------------------------------------------
function buildSeatDataFromContext(ctx: CustomChartContext): Record<string, any> {
  const seatMap: Record<string, any> = {};
  
  log("📊 Reading data from ThoughtSpot context");
  
  try {
    const chartModel = ctx.getChartModel();
    
    if (!chartModel) {
      log("⚠️ No chart model");
      return seatMap;
    }
    
    if (!chartModel.data || !chartModel.data[0]) {
      log("⚠️ No data in chart model");
      return seatMap;
    }

    const queryData = chartModel.data[0];
    
    // ✅ Access data as any to bypass TypeScript restrictions
    const dataAny = queryData as any;
    const dataPoints = dataAny.data;
    const columns = dataAny.columns || [];
    
    if (!dataPoints) {
      log("⚠️ No data points");
      return seatMap;
    }

    // ✅ Get length safely
    const dataLength = typeof dataPoints.length !== 'undefined' 
      ? dataPoints.length 
      : Object.keys(dataPoints).length;
    
    log(`📦 Processing ${dataLength} rows from ThoughtSpot`);
    
    if (columns.length > 0) {
      log(`📋 Columns (${columns.length}):`, columns.map((c: any) => c.id || c.name));
    }

    // ✅ Iterate safely
    for (let i = 0; i < dataLength; i++) {
      try {
        const row = dataPoints[i];
        
        if (!row) continue;
        
        // Handle both array and object formats
        let rowData: any[];
        if (Array.isArray(row)) {
          rowData = row;
        } else if (typeof row === 'object') {
          rowData = Object.values(row);
        } else {
          continue;
        }
        
        const seatKey = rowData[0]?.toString().trim() || "";
        if (!seatKey) {
          continue;
        }

        const passengerName = rowData[1]?.toString() || "-";
        const pnr = rowData[2]?.toString() || "-";
        const trips = parseInt(rowData[3]?.toString() || "0", 10);
        const spend = parseFloat(rowData[4]?.toString() || "0");
        const fareType = rowData[5]?.toString() || "N/A";
        const statusStr = rowData[6]?.toString() || "Empty";
        
        let status: SeatStatus;
        if (statusStr === "Empty") {
          status = "Empty";
        } else if (statusStr === "Repeated Customer") {
          status = "Frequent Traveller";
        } else {
          status = "Occupied";
        }

        seatMap[seatKey] = {
          name: passengerName,
          travellerId: pnr,
          trips: trips,
          spend: spend,
          item: fareType,
          status: status,
        };
        
      } catch (rowError) {
        log(`❌ Error processing row ${i}:`, rowError);
      }
    }

    log("✅ Processed seats from ThoughtSpot:", Object.keys(seatMap).length);
    
    // Log sample data
    if (Object.keys(seatMap).length > 0) {
      const sampleSeats = Object.keys(seatMap).slice(0, 3);
      log("📌 Sample seats:", sampleSeats.map(k => `${k}: ${seatMap[k].name} (${seatMap[k].status})`));
    } else {
      log("⚠️ No seats were processed - check column mapping");
    }
    
    return seatMap;
    
  } catch (error) {
    log("❌ Error reading data from context:", error);
    return seatMap;
  }
}



// -------------------------------------------------------
// RENDER - USES THOUGHTSPOT DATA
// -------------------------------------------------------
async function renderChart(ctx: CustomChartContext) {
  log("🎨 renderChart() called - using ThoughtSpot data");
  ctx.emitEvent(ChartToTSEvent.RenderStart);

  // ✅ USE THOUGHTSPOT DATA
  const dynamicSeatData = buildSeatDataFromContext(ctx);

  if (Object.keys(dynamicSeatData).length === 0) {
    log("⚠️ No seat data to render");
    const root = document.getElementById("flight-chart") || document.body;
    root.innerHTML = "<div style='padding:20px;text-align:center;'>No data available. Please configure the chart.</div>";
    ctx.emitEvent(ChartToTSEvent.RenderComplete);
    return;
  }

  const root =
    document.getElementById("flight-chart") ||
    (() => {
      const div = document.createElement("div");
      div.id = "flight-chart";
      document.body.appendChild(div);
      return div;
    })();

  root.innerHTML = "";

  await loadAndStyleSVG(root, dynamicSeatData);
  attachInteractivity(root, dynamicSeatData);

  log("✅ Rendering complete");
  ctx.emitEvent(ChartToTSEvent.RenderComplete);
}

// -------------------------------------------------------
// CHART CONFIG - WITH PROPER COLUMN MAPPING
// -------------------------------------------------------
const getFixedChartConfig = (chartModel: ChartModel): ChartConfig[] => {
  log("📋 Building chart config from model");

  const cols = chartModel.columns || [];
  const attributes = cols.filter((c) => c.type === ColumnType.ATTRIBUTE);
  const measures = cols.filter((c) => c.type === ColumnType.MEASURE);

  log(`Found ${attributes.length} attributes and ${measures.length} measures`);

  return [
    {
      key: "main",
      dimensions: [
        { 
          key: "seat", 
          columns: attributes.length > 0 ? [attributes[0]] : [] 
        },
        { 
          key: "passenger_name", 
          columns: attributes.length > 1 ? [attributes[1]] : [] 
        },
        { 
          key: "pnr", 
          columns: attributes.length > 2 ? [attributes[2]] : [] 
        },
        { 
          key: "trips", 
          columns: measures.length > 0 ? [measures[0]] : [] 
        },
        { 
          key: "spend", 
          columns: measures.length > 1 ? [measures[1]] : [] 
        },
        { 
          key: "fare_type", 
          columns: attributes.length > 3 ? [attributes[3]] : [] 
        },
        { 
          key: "status", 
          columns: attributes.length > 4 ? [attributes[4]] : [] 
        },
      ],
    },
  ];
};

const getFixedQueries = (configs: ChartConfig[]): Query[] => {
  return configs.map((cfg) => ({
    queryColumns: cfg.dimensions.flatMap((d) => d.columns || []),
  }));
};

// -------------------------------------------------------
// INIT - LET THOUGHTSPOT CALL renderChart
// -------------------------------------------------------
(async () => {
  log("🚀 Initializing ThoughtSpot Chart with data model...");

  try {
      await getChartContext({
      getDefaultChartConfig: getFixedChartConfig,
      getQueriesFromChartConfig: getFixedQueries,
      renderChart,  // ✅ ThoughtSpot will call this when data is ready
      visualPropEditorDefinition: {
        elements: [],
      },
      chartConfigEditorDefinition: [
        {
          key: "column",
          label: "Flight Seat Data Configuration",
          descriptionText: "Configure seat map data columns from your worksheet",
          columnSections: [
            { 
              key: "seat", 
              label: "Seat Number", 
              allowAttributeColumns: true, 
              maxColumnCount: 1,
            },
            { 
              key: "passenger_name", 
              label: "Passenger Name", 
              allowAttributeColumns: true, 
              maxColumnCount: 1,
            },
            { 
              key: "pnr", 
              label: "PNR / Booking Reference", 
              allowAttributeColumns: true, 
              maxColumnCount: 1,
            },
            { 
              key: "trips", 
              label: "Number of Trips", 
              allowMeasureColumns: true, 
              maxColumnCount: 1,
            },
            { 
              key: "spend", 
              label: "Total Spend", 
              allowMeasureColumns: true, 
              maxColumnCount: 1,
            },
            { 
              key: "fare_type", 
              label: "Fare Type", 
              allowAttributeColumns: true, 
              maxColumnCount: 1,
            },
            { 
              key: "status", 
              label: "Status (Occupied/Empty/Repeated)", 
              allowAttributeColumns: true, 
              maxColumnCount: 1,
            },
          ]
        }
      ]
    });

    log("✅ Context created successfully");
    log("⏳ Waiting for user to configure columns...");
    // ❌ DON'T CALL renderChart() here
    // ThoughtSpot will call it automatically when:
    // 1. User drags columns into slots
    // 2. Data query completes
    
  } catch (err) {
    log("❌ FATAL ERROR during init:", err);
  }
})();

