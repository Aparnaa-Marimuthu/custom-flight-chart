import {
  type ChartConfig,
  type ChartModel,
  ChartToTSEvent,
  ColumnType,
  CustomChartContext,
  getChartContext,
  type Query,
} from '@thoughtspot/ts-chart-sdk';
import _ from 'lodash';
import flightSeatsSvg from './assets/corrected_seats_hitbox.svg?raw';

/**
 * Flight seat chart (plain TypeScript)
 *
 * - Incorporates the hover/tooltip and seat-color logic from your FlightSeatMap.tsx
 * - Works inside the ThoughtSpot custom chart lifecycle via getChartContext(...)
 *
 * Notes:
 * - The SVG is injected into the chart container via innerHTML.
 * - Seat element lookup supports both plain ids like "1A" and grouped ids like "seat_1A"
 * - Tooltips use the SDK events (ShowToolTip / HideToolTip)
 */

/* -------------------------
   Types & static seat data
   ------------------------- */
type SeatStatus = 'Frequent Traveller' | 'Occupied' | 'Empty';

const SEAT_DATA: Record<string, { name: string; travellerId: string; item: string; status: SeatStatus }> = {
  // Example hard-coded mapping — replace / extend with real mapping as needed.
  // Keys are seat labels (we will match either "1A" or "seat_1A" in the DOM).
  '2A': { name: 'Oliver Bennett', travellerId: 'EZ9081123', item: 'sandwich and coffee', status: 'Frequent Traveller' },
  '2B': { name: 'Charlotte Hayes', travellerId: 'EZ9081124', item: 'sandwich', status: 'Occupied' },
  '4C': { name: 'James Whitmore', travellerId: 'EZ9081125', item: 'coffee', status: 'Occupied' },
};

/* -------------------------
   Utilities
   ------------------------- */
function colorForStatus(status?: SeatStatus): string {
  if (status === 'Frequent Traveller') return '#d15d99'; // pink-like (keep parity with your React CSS)
  if (status === 'Occupied') return '#d15d99'; // same as above (you can customize)
  return '#ffffff';
}

/**
 * Attempt to find seat DOM element for a given seat key (e.g. '1A').
 * We support multiple id naming patterns:
 *   - exact id '1A'
 *   - prefixed group 'seat_1A'
 *   - group with g element: "g[id='seat_1A']" etc.
 */
function findSeatDomForKey(container: HTMLElement, seatKey: string): Element | null {
  // try common variants
  const tries = [
    `[id='seat_${seatKey}']`,
    `[id='${seatKey}']`,
    `g[id='seat_${seatKey}']`,
    `g[id='${seatKey}']`,
    `#[seat_${seatKey}]`, // fallback (rare)
  ];

  for (const sel of tries) {
    try {
      const el = container.querySelector(sel);
      if (el) return el;
    } catch {
      // ignore bad selectors
    }
  }

  // last resort: query all nodes with an id and match by endsWith
  const all = container.querySelectorAll<HTMLElement>('[id]');
  for (const n of Array.from(all)) {
    if (n.id === `seat_${seatKey}` || n.id === seatKey) return n;
    // also accept id that ends with the seat key (some svgs use prefixes)
    if (n.id.endsWith(seatKey)) return n;
  }

  return null;
}

/**
 * Resolve an event target to the seat key in SEAT_DATA.
 * Walks up the DOM until an element with an id that maps to SEAT_DATA is found.
 * Supports ids with or without a "seat_" prefix.
 */
function resolveSeatKeyFromElement(el: Element | null): string | null {
  if (!el) return null;

  let cur: Element | null = el;
  while (cur) {
    if (cur.id) {
      // check direct id
      if (SEAT_DATA[cur.id]) return cur.id;
      // check trimmed / without prefix
      const trimmed = cur.id.replace(/^seat_/, '');
      if (SEAT_DATA[trimmed]) return trimmed;
    }
    cur = cur.parentElement;
  }
  return null;
}

/* -------------------------
   DOM / SVG manipulation
   ------------------------- */

/** Inject the SVG into the provided container and style seat elements. */
function loadAndStyleSVG(container: HTMLElement) {
  // Inject SVG markup
  container.innerHTML = flightSeatsSvg;

  // Make sure svg is present
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  // Apply seat colors for all entries in SEAT_DATA
  Object.keys(SEAT_DATA).forEach((seatKey) => {
    const dom = findSeatDomForKey(container, seatKey);
    if (!dom) return;

    // If the seat is a group <g>, color children paths/shapes; otherwise try to set fill on element
    const data = SEAT_DATA[seatKey];
    const fill = colorForStatus(data.status);

    // apply fill to common primitives in the node
    const pathChildren = dom.querySelectorAll<SVGElement>('path, rect, circle, polygon, ellipse');
    if (pathChildren.length) {
      pathChildren.forEach((c) => c.setAttribute('fill', fill));
    } else if ((dom as SVGElement).setAttribute) {
      try {
        (dom as SVGElement).setAttribute('fill', fill);
      } catch {}
    }

    // Add a class and pointer cursor for interactivity
    try {
      (dom as HTMLElement).classList?.add?.('interactive-seat');
      (dom as HTMLElement).style.cursor = 'pointer';
    } catch {}
  });
}

/* -------------------------
   Interactivity: hover + tooltip
   ------------------------- */

function createTooltipElement() {
    let tooltip = document.getElementById("seat-tooltip") as HTMLDivElement | null;

    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "seat-tooltip";
        tooltip.style.position = "fixed";
        tooltip.style.pointerEvents = "none";
        tooltip.style.zIndex = "99999";
        tooltip.style.background = "rgba(0,0,0,0.75)";
        tooltip.style.color = "#fff";
        tooltip.style.padding = "6px 10px";
        tooltip.style.borderRadius = "4px";
        tooltip.style.fontSize = "12px";
        tooltip.style.display = "none";

        document.body.appendChild(tooltip);
    }

    return tooltip;
}

function showTooltip(html: string, x: number, y: number) {
    const tooltip = createTooltipElement();
    tooltip.innerHTML = html;
    tooltip.style.left = x + 12 + "px";
    tooltip.style.top = y + 12 + "px";
    tooltip.style.display = "block";
}

function hideTooltip() {
    const tooltip = createTooltipElement();
    tooltip.style.display = "none";
}

/* ------------------------------------
   UPDATED INTERACTIVITY FOR PLAYGROUND
------------------------------------- */

function attachInteractivity(_ctx: CustomChartContext, container: HTMLElement) {
    const onMouseOver = (ev: MouseEvent) => {
        const target = ev.target as Element | null;
        const seatKey = resolveSeatKeyFromElement(target);

        if (!seatKey) return;

        const seatInfo = SEAT_DATA[seatKey];
        if (!seatInfo) return;

        const domSeat = findSeatDomForKey(container, seatKey);
        if (!domSeat) return;

        // highlight
        domSeat.querySelectorAll<SVGElement>("path, rect, circle").forEach((p) => {
            p.setAttribute("stroke", "#222");
            p.setAttribute("stroke-width", "1.3");
        });

        // custom tooltip
        showTooltip(
            `
            <strong> Seat Number:${seatKey}</strong><br/>
            Frequent Traveller ID: ${seatInfo.travellerId}<br/>
            Passenger: ${seatInfo.name}<br/>
            Most Purchased Items: ${seatInfo.item}
            `,
            ev.clientX,
            ev.clientY
        );
    };

    const onMouseMove = (ev: MouseEvent) => {
        const tooltip = document.getElementById("seat-tooltip");
        if (!tooltip || tooltip.style.display === "none") return;
        tooltip.style.left = ev.clientX + 12 + "px";
        tooltip.style.top = ev.clientY + 12 + "px";
    };

    const onMouseOut = () => {
        hideTooltip();

        const all = container.querySelectorAll<SVGElement>("[stroke]");
        all.forEach((p) => {
            p.removeAttribute("stroke");
            p.removeAttribute("stroke-width");
        });
    };

    container.addEventListener("mouseover", onMouseOver);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseout", onMouseOut);
}

/* -------------------------
   Render lifecycle
   ------------------------- */

/**
 * Render into the ThoughtSpot-provided container.
 * We attempt to get a DOM node from ctx.getContainer() if available,
 * otherwise try a fallback element with id 'flight-chart'.
 */
function getRenderContainer(ctx: CustomChartContext): HTMLElement | null {
  // many SDK contexts provide a container accessor; check defensively
  // @ts-ignore - permissive access in case ctx exposes helper
  if (typeof (ctx as any).getContainer === 'function') {
    try {
      const c = (ctx as any).getContainer();
      if (c && c instanceof HTMLElement) return c;
    } catch {}
  }

  // fallback to an element with a known id inside the embed (create one if needed)
  let container = document.getElementById('flight-chart');
  if (!container) {
    container = document.createElement('div');
    container.id = 'flight-chart';
    // attempt to append into the root container if available
    const root = document.body ?? document.documentElement;
    root.appendChild(container);
  }

  return container;
}

/* -------------------------
   Exported render callback(s)
   ------------------------- */

const renderInner = (ctx: CustomChartContext) => {
  const container = getRenderContainer(ctx);
  if (!container) {
    ctx.emitEvent(ChartToTSEvent.RenderError, { hasError: true, error: 'No container found' });
    return;
  }

  // Clear previous contents
  container.innerHTML = '';

  // load svg and apply styles
  loadAndStyleSVG(container);

  // attach interactivity and keep cleanup handle (not used here, but could be returned)
  attachInteractivity(ctx, container);
};

const renderChart = async (ctx: CustomChartContext): Promise<void> => {
  try {
    ctx.emitEvent(ChartToTSEvent.RenderStart);
    renderInner(ctx);
  } catch (err) {
    ctx.emitEvent(ChartToTSEvent.RenderError, { hasError: true, error: err });
  } finally {
    ctx.emitEvent(ChartToTSEvent.RenderComplete);
  }
};

/* -------------------------
   Initialize getChartContext
   ------------------------- */
(async () => {
  const ctx = await getChartContext({
    getDefaultChartConfig: (chartModel: ChartModel): ChartConfig[] => {
      const cols = chartModel.columns ?? [];

      const measureColumns = _.filter(cols, (col) => col.type === ColumnType.MEASURE);
      const attributeColumns = _.filter(cols, (col) => col.type === ColumnType.ATTRIBUTE);

      const axisConfig: ChartConfig = {
        key: 'column',
        dimensions: [
          {
            key: 'x',
            columns: attributeColumns.slice(0, 1),
          },
          {
            key: 'y',
            columns: measureColumns.slice(0, 1),
          },
        ],
      };
      return [axisConfig];
    },

    getQueriesFromChartConfig: (chartConfig: ChartConfig[]): Array<Query> => {
      return chartConfig.map((config: ChartConfig): Query =>
        _.reduce(
          config.dimensions,
          (acc: Query, dimension) => ({
            queryColumns: [...(acc.queryColumns || []), ...(dimension.columns || [])],
          }),
          { queryColumns: [] } as Query,
        ),
      );
    },

    renderChart: (ctx: CustomChartContext) => renderChart(ctx),
  });

  // launch initial render
  renderChart(ctx);
})();
