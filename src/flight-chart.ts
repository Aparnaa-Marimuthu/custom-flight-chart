import {
  type ChartConfig,
  type ChartModel,
  ChartToTSEvent,
  ColumnType,
  CustomChartContext,
  getChartContext,
  type Query,
} from "@thoughtspot/ts-chart-sdk";

import flightSeatsSvg from "./assets/corrected_seats_hitbox.svg?raw";

const log = (...msg: any[]) => console.log("[FLIGHT-CHART]", ...msg);

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

/* ---------------------------------------------
   UTILS
---------------------------------------------- */
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
    log("Creating tooltip div...");
    tt = document.createElement("div");
    tt.id = "seat-tooltip";
    tt.style.position = "fixed";
    tt.style.pointerEvents = "none";
    tt.style.zIndex = "99999";
    tt.style.background = "rgba(0,0,0,0.75)";
    tt.style.color = "#fff";
    tt.style.padding = "6px 10px";
    tt.style.borderRadius = "4px";
    tt.style.fontSize = "12px";
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
  log("Injecting SVG into container...", container);

  try {
    container.innerHTML = flightSeatsSvg;
  } catch (err) {
    log("FAILED to insert SVG:", err);
  }

  log("SVG injected. Now coloring seats...");

  Object.keys(SEAT_DATA).forEach((seatKey) => {
    const dom = findSeatDom(container, seatKey);

    if (!dom) {
      log(`Seat NOT found in SVG: ${seatKey}`);
      return;
    }

    log(`Coloring seat`, seatKey);

    const fill = colorForStatus(SEAT_DATA[seatKey].status);

    const parts = dom.querySelectorAll("path, rect, circle, polygon, ellipse");

    parts.forEach((p) => p.setAttribute("fill", fill));

    (dom as HTMLElement).style.cursor = "pointer";
  });
}

/* ---------------------------------------------
   INTERACTIVITY
---------------------------------------------- */
function attachInteractivity(container: HTMLElement) {
  log("Attaching interactivity...");

  container.addEventListener("mouseover", (ev: MouseEvent) => {
    const seatKey = resolveSeatKey(ev.target as Element);
    if (!seatKey) return;

    log("Hovering over seat:", seatKey);

    const seatDom = findSeatDom(container, seatKey);
    if (!seatDom) return;

    seatDom.querySelectorAll("path, rect, circle").forEach((p) => {
      p.setAttribute("stroke", "#222");
      p.setAttribute("stroke-width", "0");
    });

    const info = SEAT_DATA[seatKey];
    showTooltip(
      `
      <strong>Seat No: ${seatKey}</strong><br/>
      Frequent Traveller ID: ${info.travellerId}<br/>
      Passenger: ${info.name}<br/>
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
  log("renderChart() called");
  ctx.emitEvent(ChartToTSEvent.RenderStart);

  const root =
    document.getElementById("flight-chart") ||
    (() => {
      log("flight-chart div not found; creating one.");
      const div = document.createElement("div");
      div.id = "flight-chart";
      document.body.appendChild(div);
      return div;
    })();

  log("Root container found:", root);

  root.innerHTML = "";

  loadAndStyleSVG(root);
  attachInteractivity(root);

  log("Rendering complete. Emitting RenderComplete...");
  ctx.emitEvent(ChartToTSEvent.RenderComplete);
}

/* ---------------------------------------------
   FIXED CONFIG (with logs)
---------------------------------------------- */
const getFixedChartConfig = (chartModel: ChartModel): ChartConfig[] => {
  log("Building chart config. Columns:", chartModel.columns);

  const cols = chartModel.columns || [];
  const attributes = cols.filter((c) => c.type === ColumnType.ATTRIBUTE);
  const measures = cols.filter((c) => c.type === ColumnType.MEASURE);

  log("Attributes:", attributes);
  log("Measures:", measures);

  return [
    {
      key: "main",
      dimensions: [  
        { key: "seat", columns: attributes.slice(0, 1) },  
        { key: "value", columns: measures.slice(0, 1) },  
     ],
    },
  ];
};

const getFixedQueries = (configs: ChartConfig[]): Query[] => {
  log("Extracting queries from config:", configs);

    return configs.map((cfg) => ({  
    queryColumns: cfg.dimensions.flatMap((d) => d.columns || []),  
    }));
};

/* ---------------------------------------------
   INIT
---------------------------------------------- */
(async () => {
  log("Initializing ThoughtSpot Chart...");

  try {
    const ctx = await getChartContext({
      getDefaultChartConfig: getFixedChartConfig,
      getQueriesFromChartConfig: getFixedQueries,
      renderChart,
    });

    log("Context received:", ctx);

    await renderChart(ctx);
  } catch (err) {
    log("FATAL ERROR during init:", err);
  }
})();
