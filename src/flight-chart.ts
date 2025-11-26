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
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  font-size: 14px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 1000;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
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

  const svgBox = document.createElement("div");
  svgBox.className = "svg-container";

  svgBox.innerHTML = flightSeatsSvg;
  mapWrapper.appendChild(svgBox);

  container.appendChild(mapWrapper);

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
    showTooltip(
      `
      <strong>Seat No: ${seatKey}</strong><br>
      Frequent Traveller ID: ${info.travellerId}<br>
      Passenger: ${info.name}<br>
      Most Purchased Items: ${info.item}
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
