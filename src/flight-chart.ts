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

/* ---------------------------------------------
   SEAT DATA
---------------------------------------------- */
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
  if (status === "Frequent Traveller") return "#d15d99";
  if (status === "Occupied") return "#d15d99";
  return "#ffffff";
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

  const all = container.querySelectorAll("[id]");
  for (const n of Array.from(all)) {
    if (n.id === seatKey || n.id === `seat_${seatKey}`) return n;
    if (n.id.endsWith(seatKey)) return n;
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
   CUSTOM TOOLTIP (HTML)
---------------------------------------------- */
function ensureTooltip(): HTMLDivElement {
  let tt = document.getElementById("seat-tooltip") as HTMLDivElement | null;

  if (!tt) {
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
   SVG LOADING + COLORING
---------------------------------------------- */
function loadAndStyleSVG(container: HTMLElement) {
  container.innerHTML = flightSeatsSvg;

  Object.keys(SEAT_DATA).forEach((seatKey) => {
    const dom = findSeatDom(container, seatKey);
    if (!dom) return;

    const fill = colorForStatus(SEAT_DATA[seatKey].status);

    const parts = dom.querySelectorAll("path, rect, circle, polygon, ellipse");
    if (parts.length > 0) {
      parts.forEach((p) => p.setAttribute("fill", fill));
    } else {
      (dom as SVGElement).setAttribute("fill", fill);
    }

    (dom as HTMLElement).style.cursor = "pointer";
  });
}

/* ---------------------------------------------
   INTERACTIVITY
---------------------------------------------- */
function attachInteractivity(container: HTMLElement) {
  const onMouseOver = (ev: MouseEvent) => {
    const target = ev.target as Element | null;
    const seatKey = resolveSeatKey(target);
    if (!seatKey) return;

    const seatInfo = SEAT_DATA[seatKey];
    if (!seatInfo) return;

    const seatDom = findSeatDom(container, seatKey);
    if (!seatDom) return;

    seatDom
      .querySelectorAll("path, rect, circle, polygon, ellipse")
      .forEach((p) => {
        p.setAttribute("stroke", "#222");
        p.setAttribute("stroke-width", "0");
      });

    showTooltip(
      `
        <strong>Seat No: ${seatKey}</strong><br/>
        Frequent Traveller ID: ${seatInfo.travellerId}<br/>
        Passenger: ${seatInfo.name}<br/>
        Most Purchased Items: ${seatInfo.item}
      `,
      ev.clientX,
      ev.clientY
    );
  };

  const onMouseMove = (ev: MouseEvent) => {
    const tt = document.getElementById("seat-tooltip");
    if (!tt || tt.style.display === "none") return;

    tt.style.left = ev.clientX + 12 + "px";
    tt.style.top = ev.clientY + 12 + "px";
  };

  const onMouseOut = () => {
    hideTooltip();
    container
      .querySelectorAll("[stroke]")
      .forEach((p) => p.removeAttribute("stroke"));
  };

  container.addEventListener("mouseover", onMouseOver);
  container.addEventListener("mousemove", onMouseMove);
  container.addEventListener("mouseout", onMouseOut);
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
   THOUGHTSPOT CONFIG FIX (THE IMPORTANT PART)
---------------------------------------------- */
const getFixedChartConfig = (chartModel: ChartModel): ChartConfig[] => {
  const cols = chartModel.columns || [];

  const attributes = cols.filter(c => c.type === ColumnType.ATTRIBUTE);
  const measures = cols.filter(c => c.type === ColumnType.MEASURE);

  return [
    {
      key: "main",
      dimensions: [
        {
          key: "seat",
          // Cast to ANY so TS accepts "elements"
          ...( { elements: attributes.slice(0, 1) } as any )
        },
        {
          key: "value",
          ...( { elements: measures.slice(0, 1) } as any )
        }
      ]
    }
  ];
};

const getFixedQueries = (configs: ChartConfig[]): Query[] => {
  return configs.map(cfg => ({
    queryColumns: cfg.dimensions.flatMap(d => (d as any).elements || [])
  }));
};

/* ---------------------------------------------
   INIT
---------------------------------------------- */
(async () => {
  const ctx = await getChartContext({
    getDefaultChartConfig: getFixedChartConfig,
    getQueriesFromChartConfig: getFixedQueries,
    renderChart,
  });

  renderChart(ctx);
})();
