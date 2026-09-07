import { AgentConfig } from "./types";

export type NodeState = "idle" | "active" | "done" | "error";

const NODE_R = 15;
const ROW_GAP = 46;
const COL_GAP = 84;
const MARGIN_X = 46;
const MARGIN_Y = 28;
const LABEL_GAP = 15;

/** How often (ms) active edges re-jitter into a new lightning shape. */
const TICK_MS = 70;
/** Max perpendicular displacement (px) of a lightning bolt from a straight line. */
const MAX_JITTER = 6;
/** Segments per bolt — more segments = jaggier, more "electric" look. */
const BOLT_SEGMENTS = 6;

interface LayerNode {
	id: string; // "topic" | "synthesis" | "r{round}-{agentId}"
	x: number;
	y: number;
	color?: string;
	label?: string;
}

/**
 * A deep-net-style diagram: an input "Topic" node, one hidden layer per debate round
 * (one node per agent, fully connected to the previous layer), and an output
 * "Synthesis" node. Each round gets its own fresh column of nodes instead of reusing
 * a single row, so you can see the debate actually progressing layer by layer.
 *
 * Active layer-transitions render as flickering, jittering "lightning bolt" paths with
 * a soft glow, driven by a small animation loop; idle/done/error edges are plain
 * straight lines so the effect reads as "something is happening here right now"
 * rather than being decorative everywhere.
 *
 * Rendered as plain SVG with explicit pixel dimensions (not responsive) inside a
 * scrollable container, since node/label legibility matters more than fitting a
 * possibly-wide diagram into a narrow sidebar.
 */
export class SwarmNetworkGraph {
	private container: HTMLElement;
	private agents: AgentConfig[] = [];
	private rounds = 1;
	/** How many agents have finished in each round, to know when a whole layer transition is "done". */
	private roundCompletions: number[] = [];
	private tickHandle: number | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	/** (Re)builds the diagram for a fresh debate with the given agent roster and round count. */
	build(agents: AgentConfig[], rounds: number): void {
		this.stopTicking();
		this.agents = agents;
		this.rounds = Math.max(1, rounds);
		this.roundCompletions = new Array(this.rounds).fill(0);

		const n = agents.length;
		const columns = this.rounds + 2; // topic + N round-layers + synthesis
		const width = MARGIN_X * 2 + (columns - 1) * COL_GAP;
		const tallestLayer = n;
		const height = MARGIN_Y * 2 + LABEL_GAP + (tallestLayer - 1) * ROW_GAP;
		const midY = height / 2;

		const colX = (col: number): number => MARGIN_X + col * COL_GAP;
		const layerY = (row: number, layerSize: number): number => {
			if (layerSize <= 1) return midY;
			const layerHeight = (layerSize - 1) * ROW_GAP;
			const top = midY - layerHeight / 2;
			return top + row * ROW_GAP;
		};

		// Column 0: topic. Columns 1..rounds: one per agent. Column rounds+1: synthesis.
		const topicNode: LayerNode = { id: "topic", x: colX(0), y: midY, label: "Topic" };
		const synthNode: LayerNode = { id: "synthesis", x: colX(columns - 1), y: midY, label: "Synthesis" };

		const roundLayers: LayerNode[][] = [];
		for (let r = 1; r <= this.rounds; r++) {
			const layer = agents.map((a, i) => ({
				id: `r${r}-${a.id}`,
				x: colX(r),
				y: layerY(i, n),
				color: a.color,
				label: a.name,
			}));
			roundLayers.push(layer);
		}

		const bundles: string[] = [];
		bundles.push(this.renderBundle(`bundle-topic-1`, [topicNode], roundLayers[0]));
		for (let r = 1; r < this.rounds; r++) {
			bundles.push(this.renderBundle(`bundle-${r}-${r + 1}`, roundLayers[r - 1], roundLayers[r]));
		}
		bundles.push(this.renderBundle(`bundle-${this.rounds}-synth`, roundLayers[this.rounds - 1], [synthNode]));

		const nodesSvg: string[] = [];
		nodesSvg.push(this.renderNode(topicNode, "asg-topic-node", null));
		for (let r = 0; r < roundLayers.length; r++) {
			for (const node of roundLayers[r]) {
				nodesSvg.push(this.renderNode(node, "asg-agent-node", `R${r + 1}`));
			}
		}
		nodesSvg.push(this.renderNode(synthNode, "asg-synth-node", null));

		this.container.innerHTML = `
			<div class="asg-legend">${this.renderLegend(agents)}</div>
			<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="asg-svg" xmlns="http://www.w3.org/2000/svg">
				<defs>
					<filter id="asg-glow" x="-60%" y="-60%" width="220%" height="220%">
						<feGaussianBlur stdDeviation="2.1" result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>
				<g class="asg-edges">${bundles.join("")}</g>
				${nodesSvg.join("")}
			</svg>`;

		this.setNodeState("topic", "done");
		this.startTicking();
	}

	/** Marks an agent's node + the incoming layer bundle active (its API call is in flight). */
	setAgentActive(agentId: string, round: number): void {
		this.setNodeState(`r${round}-${agentId}`, "active");
		const bundleId = round === 1 ? "bundle-topic-1" : `bundle-${round - 1}-${round}`;
		this.setBundleState(bundleId, "active");
	}

	/** Marks an agent's node done; if it's the last agent in that round, marks the layer bundle done. */
	setAgentDone(agentId: string, round: number): void {
		this.setNodeState(`r${round}-${agentId}`, "done");

		const idx = round - 1;
		this.roundCompletions[idx] = (this.roundCompletions[idx] ?? 0) + 1;
		if (this.roundCompletions[idx] >= this.agents.length) {
			const bundleId = round === 1 ? "bundle-topic-1" : `bundle-${round - 1}-${round}`;
			this.setBundleState(bundleId, "done");
		}
	}

	setAgentError(agentId: string, round: number): void {
		this.setNodeState(`r${round}-${agentId}`, "error");
		const bundleId = round === 1 ? "bundle-topic-1" : `bundle-${round - 1}-${round}`;
		this.setBundleState(bundleId, "error");
	}

	/** Lights up the final round->synthesis bundle and the synthesis node while synthesizing. */
	setSynthesisActive(): void {
		this.setNodeState("synthesis", "active");
		this.setBundleState(`bundle-${this.rounds}-synth`, "active");
	}

	setSynthesisDone(): void {
		this.setNodeState("synthesis", "done");
		this.setBundleState(`bundle-${this.rounds}-synth`, "done");
	}

	setSynthesisError(): void {
		this.setNodeState("synthesis", "error");
		this.setBundleState(`bundle-${this.rounds}-synth`, "error");
	}

	clear(): void {
		this.stopTicking();
		this.container.empty();
		this.agents = [];
	}

	// --- Lightning animation loop ---

	private startTicking(): void {
		this.tickHandle = window.setInterval(() => this.tick(), TICK_MS);
	}

	private stopTicking(): void {
		if (this.tickHandle !== null) {
			window.clearInterval(this.tickHandle);
			this.tickHandle = null;
		}
	}

	private tick(): void {
		const activePaths = this.container.querySelectorAll<SVGPathElement>(
			'.asg-edge-bundle[data-state="active"] path'
		);
		activePaths.forEach((path) => {
			const x1 = parseFloat(path.dataset.x1 ?? "0");
			const y1 = parseFloat(path.dataset.y1 ?? "0");
			const x2 = parseFloat(path.dataset.x2 ?? "0");
			const y2 = parseFloat(path.dataset.y2 ?? "0");
			path.setAttribute("d", boltPath(x1, y1, x2, y2));
			// Slight flicker in width/opacity sells the "electric" feel beyond just the jitter.
			path.style.opacity = (0.7 + Math.random() * 0.3).toFixed(2);
			path.style.strokeWidth = (1.3 + Math.random() * 0.9).toFixed(2);
		});
	}

	private straightenBundle(el: Element): void {
		el.querySelectorAll<SVGPathElement>("path").forEach((path) => {
			const x1 = path.dataset.x1 ?? "0";
			const y1 = path.dataset.y1 ?? "0";
			const x2 = path.dataset.x2 ?? "0";
			const y2 = path.dataset.y2 ?? "0";
			path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
			path.style.opacity = "";
			path.style.strokeWidth = "";
		});
	}

	// --- Rendering ---

	private renderLegend(agents: AgentConfig[]): string {
		return agents
			.map(
				(a) =>
					`<span class="asg-legend-item"><span class="asg-legend-swatch" style="background:${a.color}"></span>${escapeXml(
						a.name
					)}</span>`
			)
			.join("");
	}

	private renderBundle(id: string, from: LayerNode[], to: LayerNode[]): string {
		const paths = from
			.flatMap((f) =>
				to.map(
					(t) =>
						`<path data-x1="${f.x}" data-y1="${f.y}" data-x2="${t.x}" data-y2="${t.y}" d="M ${f.x} ${f.y} L ${t.x} ${t.y}" />`
				)
			)
			.join("");
		return `<g id="${cssEscapeAttr(id)}" class="asg-edge-bundle" data-state="idle">${paths}</g>`;
	}

	private renderNode(node: LayerNode, cls: string, badgeText: string | null): string {
		const colorStyle = node.color ? ` style="--asg-color:${node.color}"` : "";
		const label = node.label ?? "";
		const shortLabel = label.length > 9 ? label.slice(0, 8) + "…" : label;
		const badge = badgeText
			? `<text class="asg-round-badge" x="${node.x}" y="${node.y + 3}" text-anchor="middle">${badgeText}</text>`
			: "";
		return `
			<g id="node-${cssEscapeAttr(node.id)}" class="asg-node ${cls}" data-state="idle"${colorStyle}>
				<circle cx="${node.x}" cy="${node.y}" r="${NODE_R}" />
				${badge}
				<text class="asg-node-label" x="${node.x}" y="${node.y + NODE_R + 12}" text-anchor="middle">${escapeXml(
			shortLabel
		)}</text>
			</g>`;
	}

	private setNodeState(id: string, state: NodeState): void {
		const el = this.container.querySelector(`#node-${cssEscape(id)}`);
		if (el) el.setAttribute("data-state", state);
	}

	private setBundleState(id: string, state: NodeState): void {
		const el = this.container.querySelector(`#${cssEscape(id)}`);
		if (!el) return;
		el.setAttribute("data-state", state);
		if (state !== "active") this.straightenBundle(el);
	}
}

/** Builds a jagged SVG path 'd' string between two points, tapering to zero offset at each end. */
function boltPath(x1: number, y1: number, x2: number, y2: number): string {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;

	let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
	for (let i = 1; i < BOLT_SEGMENTS; i++) {
		const t = i / BOLT_SEGMENTS;
		const bx = x1 + dx * t;
		const by = y1 + dy * t;
		// Taper via sin(t*pi) so the bolt stays anchored exactly at both node centers.
		const offset = (Math.random() - 0.5) * 2 * MAX_JITTER * Math.sin(t * Math.PI);
		d += ` L ${(bx + nx * offset).toFixed(1)} ${(by + ny * offset).toFixed(1)}`;
	}
	d += ` L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
	return d;
}

function cssEscape(id: string): string {
	// ids are plugin-generated but can embed user-typed agent ids/names; escape defensively
	// for use inside a querySelector.
	return id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function cssEscapeAttr(id: string): string {
	// safe for use as a literal id="" attribute value (no selector escaping needed here)
	return id.replace(/"/g, "");
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
