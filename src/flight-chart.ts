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

    const status = seatData[seatKey].status as SeatStatus | undefined;
    const rect = seatG.querySelector("rect");
    if (!rect) return;

    // If no status (Status slot not mapped), keep all seats grey
    rect.style.fill = status ? colorForStatus(status) : colorForStatus("Empty");
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

    const statusText = info.status === "Frequent Traveller"
      ? "Repeated Customer"
      : info.status;

    const statusColor =
      info.status === "Frequent Traveller" ? "#ff9933" :
      info.status === "Occupied" ? "#4da6ff" :
      "#cccccc";

    const nameLine = info.name ? `
      <div class="tooltip-row">
        <span class="tooltip-label">Passenger:</span>
        <span class="tooltip-value">${info.name}</span>
      </div>` : "";

    const pnrLine = info.travellerId ? `
      <div class="tooltip-row">
        <span class="tooltip-label">PNR:</span>
        <span class="tooltip-value">${info.travellerId}</span>
      </div>` : "";

    const tripsLine = typeof info.trips === "number" ? `
      <div class="tooltip-row">
        <span class="tooltip-label">Trips (last 12 months):</span>
        <span class="tooltip-value">${info.trips}</span>
      </div>` : "";

    const spendLine = typeof info.spend === "number" ? `
      <div class="tooltip-row">
        <span class="tooltip-label">Total spend:</span>
        <span class="tooltip-value">$${Number(info.spend).toFixed(2)}</span>
      </div>` : "";

    const fareLine = info.item ? `
      <div class="tooltip-row">
        <span class="tooltip-label">Fare type:</span>
        <span class="tooltip-value">${info.item}</span>
      </div>` : "";

    const statusLine = info.status ? `
      <div class="tooltip-row">
        <span class="tooltip-label">Status:</span>
        <span class="tooltip-value" style="color:${statusColor};font-weight:600;">
          ${statusText}
        </span>
      </div>` : "";

    showTooltip(
      `
      <strong>Seat: ${seatKey}</strong>
      ${nameLine}
      ${pnrLine}
      ${tripsLine}
      ${spendLine}
      ${fareLine}
      ${statusLine}
      `,
      x,
      y
    );
  });
}

// -------------------------------------------------------
// ✅ FIXED: NAME-BASED DATA EXTRACTION (like reference code)
// -------------------------------------------------------
function buildSeatDataFromContext(ctx: CustomChartContext): Record<string, any> {
  const seatMap: Record<string, any> = {};
  log("📊 buildSeatDataFromContext called");

  try {
    const chartModel = ctx.getChartModel();
    log("🔍 Chart model:", chartModel);
    
    if (!chartModel) {
      log("❌ No chart model available");
      return seatMap;
    }

    log("📦 Chart model data:", chartModel.data);
    log("⚙️ Chart model config:", chartModel.config);
    
    if (!chartModel?.data?.[0]) {
      log("❌ No chart data available at chartModel.data[0]");
      return seatMap;
    }

    const queryData = chartModel.data[0] as any;
    log("📊 Query data:", queryData);
    
    const dataPoints = queryData.data;
    const columns = dataPoints?.columns || queryData.columns || [];

    log("📌 Columns from queryData:", columns);
    log("📊 Data points:", dataPoints);

    if (!dataPoints) {
      log("❌ No data points in queryData");
      return seatMap;
    }

    const actualData = dataPoints.dataValue || dataPoints;
    log("📦 Actual data type:", Array.isArray(actualData) ? "Array" : typeof actualData);
    log("📊 Actual data length:", Array.isArray(actualData) ? actualData.length : "N/A");
    
    if (!Array.isArray(actualData)) {
      log("❌ Data is not an array, cannot process");
      return seatMap;
    }

    log(`✅ Processing ${actualData.length} rows`);

    // ✅ BUILD SLOT → COLUMN NAME MAPPING
    const slotToColumnName: Record<string, string> = {};
    
    try {
      const modelAny = chartModel as any;
      const configAny = modelAny.config;
      log("🔍 Config from model:", configAny);
      
      // ✅ FIX #1: Handle both config structures
      let cfg;
      if (configAny?.chartConfig && Array.isArray(configAny.chartConfig)) {
        cfg = configAny.chartConfig[0];
        log("🔍 Using config.chartConfig[0]");
      } else if (Array.isArray(configAny)) {
        cfg = configAny[0];
        log("🔍 Using config[0]");
      }
      
      log("🔍 First config object:", cfg);

      if (cfg?.dimensions) {
        log("📋 Dimensions found:", cfg.dimensions);
        
        // ✅ FIX #2: Match column IDs correctly
        cfg.dimensions.forEach((dim: any) => {
          log(`🔍 Processing dimension: ${dim.key}`, dim);
          
          if (!dim.key || !dim.columns || !dim.columns.length) {
            log(`⚠️ Dimension "${dim.key}" has no columns assigned`);
            return;
          }
          
          const columnId = dim.columns[0].id;
          log(`🔍 Looking for column with id: ${columnId}`);
          
          // ✅ columns array contains ID strings, match directly
          const matchedId = columns.find((c: any) => c === columnId);
          
          if (matchedId) {
            // Find the actual column info from chartModel
            const columnInfo = chartModel.columns.find((col: any) => col.id === matchedId);
            
            if (columnInfo) {
              slotToColumnName[dim.key] = columnInfo.name;
              log(`✅ Slot "${dim.key}" → column "${columnInfo.name}"`);
            } else {
              log(`❌ Could not find column info for id ${matchedId}`);
            }
          } else {
            log(`❌ Column id ${columnId} not in data columns array`);
          }
        });
      } else {
        log("⚠️ No dimensions in config");
      }
    } catch (e) {
      log("❌ Error building slot mapping:", e);
      console.error("Stack trace:", e);
    }

    log("🗺️ Final slot → column mapping:", slotToColumnName);

    // ✅ CHECK IF SEAT SLOT IS MAPPED
    if (!slotToColumnName["seat"]) {
      log("❌ CRITICAL: Seat slot not configured! User must drag a column to the Seat slot.");
      return seatMap;
    }

    log("✅ Seat slot is mapped to:", slotToColumnName["seat"]);

    // ✅ FIX #3: HELPER - GET DATA BY COLUMN NAME
    const getDataForColumn = (row: any, slotKey: string): any => {
  const columnName = slotToColumnName[slotKey];
  if (!columnName) {
    return undefined;
  }

  // Handle both array and object row formats
      if (Array.isArray(row)) {
        // ✅ FIX: Find the column ID first, then its position in the data columns array
        const columnInfo = chartModel.columns.find((c: any) => c.name === columnName);
        if (!columnInfo) {
          log(`❌ Column "${columnName}" not found in chartModel.columns`);
          return undefined;
        }
        
        // Find the index of this column ID in the data's column array
        const colIndex = columns.findIndex((c: any) => c === columnInfo.id);
        
        if (colIndex < 0) {
          log(`❌ Column ID "${columnInfo.id}" not found in data columns array`);
          return undefined;
        }
        
        const value = row[colIndex];
        
        // Debug log for first row only
        if (row === actualData[0]) {
          log(`🔍 Column "${columnName}" (id: ${columnInfo.id}) → index ${colIndex} → value: ${value}`);
        }
        
        return value;
      } else if (typeof row === "object") {
        return row[columnName];
      }
      return undefined;
    };

    // ✅ PROCESS ROWS
    log("🔄 Starting row processing...");
    
    for (let i = 0; i < actualData.length; i++) {
      try {
        const row = actualData[i];
        if (!row) {
          if (i < 3) log(`⚠️ Row ${i}: Empty row`);
          continue;
        }

        // Log first 3 rows for debugging
        if (i < 3) {
          log(`📊 Row ${i} sample:`, row);
        }

        const seatKey = getDataForColumn(row, "seat")?.toString().trim();
        if (!seatKey) {
          if (i < 3) log(`⚠️ Row ${i}: No seat value`);
          continue;
        }

        const passengerName = getDataForColumn(row, "passenger_name")?.toString();
        const pnr = getDataForColumn(row, "pnr")?.toString();
        const statusStr = getDataForColumn(row, "status")?.toString();
        const fareType = getDataForColumn(row, "fare_type")?.toString();
        
        const tripsRaw = getDataForColumn(row, "trips");
        const trips = tripsRaw !== undefined ? parseInt(String(tripsRaw), 10) || 0 : undefined;
        
        const spendRaw = getDataForColumn(row, "spend");
        const spend = spendRaw !== undefined ? parseFloat(String(spendRaw)) || 0 : undefined;

        // Map status values
        let status: SeatStatus | undefined;
        if (statusStr === "Empty") {
          status = "Empty";
        } else if (statusStr === "Repeated Customer") {
          status = "Frequent Traveller";
        } else if (statusStr === "Occupied") {
          status = "Occupied";
        }

        seatMap[seatKey] = {
          name: passengerName,
          travellerId: pnr,
          trips,
          spend,
          item: fareType,
          status,
        };

        if (i < 3) {
          log(`✅ Row ${i} → Seat ${seatKey}: ${passengerName || "-"}, ${statusStr || "-"}`);
        }

      } catch (rowError) {
        log(`❌ Error processing row ${i}:`, rowError);
      }
    }

    log(`✅ Processed ${Object.keys(seatMap).length} seats total`);

    if (Object.keys(seatMap).length > 0) {
      const samples = Object.keys(seatMap).slice(0, 5);
      log("📌 Sample seats:", samples.map(k => `${k}: ${seatMap[k].name} (${seatMap[k].status})`));
    } else {
      log("⚠️ WARNING: No seats were processed!");
    }

    return seatMap;
  } catch (error) {
    log("❌ FATAL ERROR in buildSeatDataFromContext:", error);
    console.error("Stack trace:", error);
    return seatMap;
  }
}

// -------------------------------------------------------
// RENDER - USES THOUGHTSPOT DATA
// -------------------------------------------------------
async function renderChart(ctx: CustomChartContext) {
  log("🎨 ========== renderChart() START ==========");
  log("📅 Timestamp:", new Date().toISOString());
  
  ctx.emitEvent(ChartToTSEvent.RenderStart);
  log("✅ RenderStart event emitted");

  const dynamicSeatData = buildSeatDataFromContext(ctx);
  log("📊 Seat data extracted, count:", Object.keys(dynamicSeatData).length);

  if (Object.keys(dynamicSeatData).length === 0) {
    log("⚠️ No seat data to render - showing configuration message");
    const root = document.getElementById("flight-chart") || document.body;
    root.innerHTML = "<div style='padding:20px;text-align:center;font-family:sans-serif;'><h3>⚙️ Configuration Required</h3><p>Please drag columns to the Configure panel slots:</p><ul style='text-align:left;display:inline-block;'><li><strong>Seat</strong> (required)</li><li>Passenger Name</li><li>PNR</li><li>Status</li><li>Fare Type</li><li>Trips</li><li>Spend</li></ul></div>";
    ctx.emitEvent(ChartToTSEvent.RenderComplete);
    log("✅ RenderComplete event emitted (no data)");
    return;
  }

  log("🎨 Rendering SVG map...");
  const root =
    document.getElementById("flight-chart") ||
    (() => {
      const div = document.createElement("div");
      div.id = "flight-chart";
      document.body.appendChild(div);
      log("📦 Created flight-chart div");
      return div;
    })();

  root.innerHTML = "";
  log("🧹 Cleared existing content");

  await loadAndStyleSVG(root, dynamicSeatData);
  log("✅ SVG loaded and styled");
  
  attachInteractivity(root, dynamicSeatData);
  log("✅ Interactivity attached");

  ctx.emitEvent(ChartToTSEvent.RenderComplete);
  log("✅ RenderComplete event emitted");
  log("🎨 ========== renderChart() END ==========");
}

// -------------------------------------------------------
// ✅ FIXED: LET USER CONFIGURE (don't pre-assign positions)
// -------------------------------------------------------
const getDefaultChartConfig = (chartModel: ChartModel): ChartConfig[] => {
  log("📋 getDefaultChartConfig called");
  log("📊 Available columns:", chartModel.columns);

  const cols = chartModel.columns || [];
  const attributes = cols.filter((c) => c.type === ColumnType.ATTRIBUTE);

  // ✅ Auto-detect ONLY the Seat column (required for chart to work)
  const findColumn = (keys: string[], list: any[]) => {
    return list.find(col => 
      keys.some(key => col.name.toLowerCase().includes(key.toLowerCase()))
    );
  };

  const seatCol = findColumn(["seat", "seatnumber", "seat_number"], attributes);
  
  if (seatCol) {
    log(`✅ Auto-detected Seat column: "${seatCol.name}"`);
  } else {
    log(`⚠️ No Seat column auto-detected - user must configure manually`);
  }

  return [
    {
      key: "main",
      dimensions: [
        { 
          key: "seat", 
          columns: seatCol ? [seatCol] : []  // ✅ Pre-fill Seat (required)
        },
        { 
          key: "passenger_name", 
          columns: []  // Empty - user configures
        },
        { 
          key: "pnr", 
          columns: []  // Empty - user configures
        },
        { 
          key: "trips", 
          columns: []  // Empty - user configures
        },
        { 
          key: "spend", 
          columns: []  // Empty - user configures
        },
        { 
          key: "fare_type", 
          columns: []  // Empty - user configures
        },
        { 
          key: "status", 
          columns: []  // Empty - user configures
        },
      ],
    },
  ];
};


const getQueriesFromChartConfig = (
  configs: ChartConfig[],
  chartModel: ChartModel
): Query[] => {
  log("🔍 getQueriesFromChartConfig called");
  
  const maxRows = (chartModel.visualProps as any)?.['max-rows'] || 1000;
  
  const queries = configs.map((config: ChartConfig): Query => {
    const query = config.dimensions.reduce(
      (acc, dimension) => ({
        queryColumns: [...acc.queryColumns, ...(dimension.columns || [])],
        queryParams: { size: maxRows },
      }),
      { queryColumns: [] } as Query
    );
    
    log(`📊 Query columns count: ${query.queryColumns.length}`);
    return query;
  });
  
  return queries;
};

// -------------------------------------------------------
// INIT
// -------------------------------------------------------
(async () => {
  log("🚀 ========== INITIALIZATION START ==========");
  log("📅 Timestamp:", new Date().toISOString());

  try {
    log("🔧 Calling getChartContext...");
    
    const ctx = await getChartContext({
      getDefaultChartConfig,
      getQueriesFromChartConfig,
      renderChart,
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
    log("🔍 Context object:", ctx);
    
    // Poll for data availability
    const checkAndRender = async () => {
      try {
        log("🔍 Checking for data availability...");
        const chartModel = ctx.getChartModel();
        log("📊 Chart model:", chartModel);
        
        const hasData = chartModel?.data?.[0]?.data;
        log("📦 Has data?", !!hasData);
        
        if (hasData) {
          log("✅ Data is available, calling renderChart...");
          await renderChart(ctx);
          return true;
        } else {
          log("⏳ No data yet, will retry...");
          return false;
        }
      } catch (e) {
        log("⚠️ Error checking for data:", e);
        console.error("Stack trace:", e);
        return false;
      }
    };

    log("🔄 Attempting immediate render...");
    const rendered = await checkAndRender();
    
    if (!rendered) {
      log("⏳ No immediate data, starting polling...");
      
      let attempts = 0;
      const maxAttempts = 15;
      
      const pollInterval = setInterval(async () => {
        attempts++;
        log(`🔄 Poll attempt ${attempts}/${maxAttempts}`);
        
        const success = await checkAndRender();
        
        if (success) {
          log("✅ Render successful, stopping poll");
          clearInterval(pollInterval);
        } else if (attempts >= maxAttempts) {
          log("⏰ Max attempts reached, stopping poll");
          log("⚠️ Please configure columns in the chart panel");
          clearInterval(pollInterval);
        }
      }, 2000);
    } else {
      log("✅ Immediate render successful");
    }
    
    log("🚀 ========== INITIALIZATION COMPLETE ==========");
    
  } catch (err) {
    log("❌ ========== FATAL ERROR DURING INIT ==========");
    log("❌ Error:", err);
    console.error("Full error:", err);
    console.error("Stack trace:", err);
  }
})();