/*
 * Placeholder revision history for demoing the heatmap without a real
 * Google Doc connected yet. Nothing here is real content — just enough
 * variation (some sentences rewritten repeatedly, some untouched) to see
 * the heat gradient work.
 */
const MOCK_REVISIONS = [
	"The garden was quiet in the early morning. Birds moved between the trees.\nA gate stood at the far end of the path.",
	"The garden was quiet in the early morning light. Birds moved between the trees, calling to each other.\nA gate stood at the far end of the path.",
	"The garden sat quiet under the early morning light. Birds moved between the trees, calling to each other.\nA gate stood rusted at the far end of the path.",
	"The garden sat quiet under a pale morning light. Birds darted between the trees, calling to each other.\nA rusted gate marked the far end of the path.",
	"The garden sat still under a pale morning light. Birds darted between the trees, calling to each other.\nA rusted gate marked the far end of the path, half open.",
	"The garden sat still under a pale morning light, dew still clinging to the grass. Birds darted between the trees, calling to each other.\nA rusted gate marked the far end of the path, half open.",
	"The garden sat still under a pale morning light, dew clinging to the grass. Birds darted between the trees, calling to one another in the cold air.\nA rusted gate marked the far end of the path, half open, waiting."
];

// Splits on line breaks (one or more), so paragraph structure from the
// source document is preserved rather than flattened into one run of text.
function splitParagraphs(text) {
	return text
		.split(/\n+/)
		.map((p) => p.trim())
		.filter(Boolean);
}

// Sentence splitting is paragraph-aware: a paragraph is split into
// sentences on its own, so a heading or short line with no ending
// punctuation still becomes its own sentence instead of bleeding into
// the next paragraph's text.
function splitSentences(text) {
	const sentences = [];
	splitParagraphs(text).forEach((paragraph) => {
		const matches = paragraph.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
		if (matches) {
			matches.forEach((s) => {
				const trimmed = s.trim();
				if (trimmed) sentences.push(trimmed);
			});
		}
	});
	return sentences;
}

function splitWords(text) {
	const trimmed = text.trim();
	if (!trimmed) return [];
	return trimmed.split(/\s+/).filter(Boolean);
}

/*
 * Walks the revision history and builds a running "ledger" of tokens
 * (sentences or words, depending on `tokenize`). Each entry carries an
 * edit count and a `history` array of every distinct text value the
 * token has had, in chronological order, ending with its current text.
 * When a token is replaced by a similar one in the next revision, the
 * new token inherits and extends the old one's count/history; brand-new
 * tokens start fresh; untouched tokens carry their count/history forward
 * unchanged.
 */
function computeLedger(revisions, tokenize) {
	let ledger = tokenize(revisions[0]).map((text) => ({ text, count: 1, history: [text] }));

	for (let i = 1; i < revisions.length; i++) {
		const prevTokens = ledger.map((entry) => entry.text);
		const currTokens = tokenize(revisions[i]);
		const diffParts = Diff.diffArrays(prevTokens, currTokens);

		const nextLedger = [];
		let pendingRemoved = [];

		function flushPendingRemoved() {
			pendingRemoved = [];
		}

		for (const part of diffParts) {
			if (!part.added && !part.removed) {
				for (const text of part.value) {
					const entry = ledgerEntryFor(ledger, text);
					nextLedger.push({ text, count: entry.count, history: entry.history });
				}
				flushPendingRemoved();
			} else if (part.removed) {
				pendingRemoved = part.value.map((text) => ledgerEntryFor(ledger, text));
			} else if (part.added) {
				part.value.forEach((text, idx) => {
					const priorEntry = pendingRemoved[idx] ?? pendingRemoved[pendingRemoved.length - 1];
					if (priorEntry) {
						nextLedger.push({
							text,
							count: priorEntry.count + 1,
							history: [...priorEntry.history, text]
						});
					} else {
						nextLedger.push({ text, count: 1, history: [text] });
					}
				});
				flushPendingRemoved();
			}
		}

		ledger = nextLedger;
	}

	return ledger;
}

function computeSentenceLedger(revisions) {
	return computeLedger(revisions, splitSentences);
}

function computeWordLedger(revisions) {
	return computeLedger(revisions, splitWords);
}

function ledgerEntryFor(ledger, text) {
	const match = ledger.find((entry) => entry.text === text);
	return match || { text, count: 1, history: [text] };
}

/*
 * Color palettes drive two independent things:
 *
 *   1. `stops` — the heat gradient used to color edited words/sentences.
 *      Each stop is a hex color + alpha (opacity) at a point t from 0
 *      (least-edited) to 1 (most-edited); colors interpolate between them.
 *
 *   2. Site-wide theme colors — `background` and `highlight` are required;
 *      everything else (panel/control backgrounds, borders, body text,
 *      muted text, and the text color used on top of `highlight`) is
 *      auto-derived from those two so you don't have to hand-pick a full
 *      theme. Add any of the optional keys below to override a specific
 *      derived color for a palette without affecting the others:
 *        panelBackground, controlBackground, border,
 *        textPrimary, textMuted, textFaint,
 *        highlightText, highlightHover
 *
 * `background` is deliberately kept separate from `stops` — it's UI
 * chrome, not part of the edit-heat visualization, so it's never used
 * as a gradient color.
 *
 * To add a new palette: copy a block below, give it a new key and a
 * "label" (shown in the picker dropdown), pick a background + highlight
 * hex, and list your own gradient stops. It shows up in the dropdown
 * and re-themes the whole site automatically — no other code changes.
 */
const PALETTES = {
	johnLurie: {
		label: "John Lurie",
		background: "#A5DB79",
		highlight: "#0D2337",
		stops: [
			{ t: 0, hex: "#0D2337", alpha: 0.80 },
			{ t: 0.25, hex: "#40B8C2", alpha: 0.80 },
			{ t: 0.50, hex: "#B84F20", alpha: 0.80 },
			{ t: 0.75, hex: "#D4BB00", alpha: 0.80 },
			{ t: 1, hex: "#A4DD76", alpha: 0.80 }
		]
	},
	johnSingerSargent: {
		label: "John Singer Sargent",
		background: "#180E0A",
		highlight: "#EFBC51",
		stops: [
			{ t: 0, hex: "#4B1E09", alpha: 0.80},
			{ t: 0.33, hex: "#6C100D", alpha: 0.80},
			{ t: 0.66, hex: "#8C5B17", alpha: 0.80},
			{ t: 1, hex: "#CFC5A7", alpha: 0.80}
		]
	},
	noahDavis: {
		label: "Noah Davis",
		background: "#9A8D90",
		highlight: "#463F39",
		stops: [
			{ t: 0, hex: "#6D5F60", alpha: 0.80},
			{ t: 0.25, hex: "#7B7B7E", alpha: 0.80},
			{ t: 0.50, hex: "#9A8D90", alpha: 0.80},
			{ t: 0.75, hex: "#C6AF95", alpha: 0.80},
			{ t: 1, hex: "#728164", alpha: 0.80}
		]
	},
	davidHockney: {
		label: "David Hockney",
		background: "#AB3153",
		highlight: "#A9F2EB",
		stops: [
			{ t: 0, hex: "#531708", alpha: 0.80},
			{ t: 0.20, hex: "#0F8988", alpha: 0.80},
			{ t: 0.40, hex: "#669D64", alpha: 0.80},
			{ t: 0.60, hex: "#58BDE9", alpha: 0.80},
			{ t: 0.80, hex: "#A9F2EB", alpha: 0.80},
			{ t: 1, hex: "#ECABB1", alpha: 0.80}
		]
	},
	kaySage: {
		label: "Kay Sage",
		background: "#0E1C1B",
		highlight: "#E5DDCF",
		stops: [
			{ t: 0, hex: "#48604A", alpha: 0.80},
			{ t: 0.25, hex: "#99A381", alpha: 0.80},
			{ t: 0.50, hex: "#CDBC92", alpha: 0.80},
			{ t: 0.75, hex: "#E5DDCF", alpha: 0.80},
			{ t: 1, hex: "#E86131", alpha: 0.80}
		]
	},
	royLichtenstein: {
		label: "Roy Lichtenstein",
		background: "#000000",
		highlight: "#F0EFEB",
		stops: [
			{ t: 0, hex: "#BA1325", alpha: 0.80},
			{ t: 0.25, hex: "#ECD1D2", alpha: 0.80},
			{ t: 0.50, hex: "#014784", alpha: 0.80},
			{ t: 0.75, hex: "#F0EFEB", alpha: 0.80},
			{ t: 1, hex: "#FCE013", alpha: 0.80}
		]
	},
	henriMatisse: {
		label: "Henri Matisse",
		background: "#953C26",
		highlight: "#C5C1B5",
		stops: [
			{ t: 0, hex: "#994B35", alpha: 0.80},
			{ t: 0.20, hex: "#B76F27", alpha: 0.80},
			{ t: 0.40, hex: "#7097AB", alpha: 0.80},
			{ t: 0.60, hex: "#A0C1B0", alpha: 0.80},
			{ t: 0.80, hex: "#C2B585", alpha: 0.80},
			{ t: 1, hex: "#E77EA5", alpha: 0.80}
		]
	},
	rembrandt: {
		label: "Rembrandt",
		background: "#0F0909",
		highlight: "#E4D3BC",
		stops: [
			{ t: 0, hex: "#34240D", alpha: 0.80},
			{ t: 0.33, hex: "#6D461D", alpha: 0.80},
			{ t: 0.66, hex: "#B57661", alpha: 0.80},
			{ t: 1, hex: "#DAC6A0", alpha: 0.80}
		]
	},
	okeeffe: {
		label: "Georgia O'Keeffe",
		background: "#00A79F",
		highlight: "#E2B67C",
		stops: [
			{ t: 0, hex: "#042425", alpha: 0.80 },
			{ t: 0.25, hex: "#035847", alpha: 0.80 },
			{ t: 0.50, hex: "#01ABA2", alpha: 0.80 },
			{ t: 0.75, hex: "#75D6CB", alpha: 0.80 },
			{ t: 1, hex: "#E7BB81", alpha: 0.80 }
		]
	},
	vangogh: {
		label: "Vincent van Gogh",
		background: "#C3A21F",
		highlight: "#844210",
		stops: [
			{ t: 0, hex: "#2C3026", alpha: 0.80 },
			{ t: 0.25, hex: "#844210", alpha: 0.80 },
			{ t: 0.50, hex: "#9E6F0C", alpha: 0.80 },
			{ t: 0.75, hex: "#C3A21F", alpha: 0.80 },
			{ t: 1, hex: "#BCBA4B", alpha: 0.80 }
		]
	}
};

const DEFAULT_PALETTE_KEY = "johnLurie";
const DEFAULT_ANALYSIS_MODE = "word";
let currentPaletteKey = DEFAULT_PALETTE_KEY;
let currentAnalysisMode = DEFAULT_ANALYSIS_MODE;
let currentSentenceLedger = null;
let currentWordLedger = null;
let currentFinalText = null;

function hexToRgb(hex) {
	const clean = hex.replace("#", "");
	const bigint = parseInt(clean, 16);
	return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r, g, b) {
	const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Mixes a hex color toward white by `amount` (0-1). Used to derive lighter
// "elevated" surface/text shades from a palette's base background color.
function lightenHex(hex, amount) {
	const [r, g, b] = hexToRgb(hex);
	const mix = (c) => c + (255 - c) * amount;
	return rgbToHex(mix(r), mix(g), mix(b));
}

// WCAG relative luminance, used to auto-pick a readable text color for
// whatever sits on top of a palette's highlight color.
function relativeLuminance(hex) {
	const [r, g, b] = hexToRgb(hex).map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(luminanceA, luminanceB) {
	const lighter = Math.max(luminanceA, luminanceB);
	const darker = Math.min(luminanceA, luminanceB);
	return (lighter + 0.05) / (darker + 0.05);
}

function pickContrastText(hex) {
	const luminance = relativeLuminance(hex);
	const contrastWithDark = contrastRatio(luminance, relativeLuminance("#17223D"));
	const contrastWithLight = contrastRatio(luminance, relativeLuminance("#F4F5F7"));
	return contrastWithDark >= contrastWithLight ? "#17223D" : "#F4F5F7";
}

/*
 * Applies a palette's site-wide theme by setting CSS custom properties on
 * the root element. `background`/`highlight` come straight from the
 * palette; everything else is auto-derived unless the palette explicitly
 * overrides it. This is intentionally separate from `palette.stops`
 * (the heat gradient) — the background color is UI chrome and never
 * feeds into the edit-heat visualization.
 */
function applyPaletteTheme(palette) {
	const background = palette.background || "#0A2243";
	const highlight = palette.highlight || "#FA935C";

	const theme = {
		"--color-background": background,
		"--color-panel-bg": palette.panelBackground || lightenHex(background, 0.06),
		"--color-control-bg": palette.controlBackground || lightenHex(background, 0.12),
		"--color-border": palette.border || lightenHex(background, 0.22),
		"--color-text": palette.textPrimary || lightenHex(background, 0.86),
		"--color-text-muted": palette.textMuted || lightenHex(background, 0.62),
		"--color-text-faint": palette.textFaint || lightenHex(background, 0.42),
		"--color-highlight": highlight,
		"--color-highlight-text": palette.highlightText || pickContrastText(highlight),
		"--color-highlight-hover": palette.highlightHover || lightenHex(highlight, 0.15)
	};

	const root = document.documentElement.style;
	Object.entries(theme).forEach(([prop, value]) => root.setProperty(prop, value));

	// Re-tint the dropdown caret to match the new muted-text color.
	const caretSvg =
		`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6">` +
		`<path d="M1 1l4 4 4-4" fill="none" stroke="${encodeURIComponent(theme["--color-text-muted"])}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
	root.setProperty("--select-caret", `url('${caretSvg}')`);
}

function heatColor(t, palette, alphaScale) {
	const stops = palette.stops;
	let lower = stops[0];
	let upper = stops[stops.length - 1];
	for (let i = 0; i < stops.length - 1; i++) {
		if (t >= stops[i].t && t <= stops[i + 1].t) {
			lower = stops[i];
			upper = stops[i + 1];
			break;
		}
	}

	const span = upper.t - lower.t || 1;
	const localT = (t - lower.t) / span;
	const lowerRgb = hexToRgb(lower.hex);
	const upperRgb = hexToRgb(upper.hex);
	const rgb = lowerRgb.map((c, idx) => Math.round(c + (upperRgb[idx] - c) * localT));
	// A stop with no alpha specified is treated as fully opaque (1).
	const lowerAlpha = lower.alpha ?? 1;
	const upperAlpha = upper.alpha ?? 1;
	let alpha = lowerAlpha + (upperAlpha - lowerAlpha) * localT;
	if (alphaScale) alpha *= alphaScale;

	return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(2)})`;
}

function paletteToCssGradient(palette) {
	const stops = palette.stops
		.map((stop) => {
			const rgb = hexToRgb(stop.hex);
			const alpha = stop.alpha ?? 1;
			return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha}) ${stop.t * 100}%`;
		})
		.join(", ");
	return `linear-gradient(90deg, ${stops})`;
}

function showFootnote(entry, kind) {
	const label = document.getElementById("footnote-label");
	const content = document.getElementById("footnote-content");
	const priorVersions = entry.history.slice(0, -1);

	label.textContent = kind === "word" ? `Earlier drafts of "${entry.text}"` : "Earlier drafts of this sentence";

	if (priorVersions.length === 0) {
		content.innerHTML = "";
		const placeholder = document.createElement("p");
		placeholder.className = "footnote-placeholder";
		placeholder.textContent =
			kind === "word"
				? "This word hasn't changed since it first appeared."
				: "This sentence hasn't changed since it first appeared.";
		content.appendChild(placeholder);
		return;
	}

	content.innerHTML = "";
	const list = document.createElement("ol");
	list.className = "footnote-list";
	priorVersions.forEach((text) => {
		const li = document.createElement("li");
		li.textContent = text;
		list.appendChild(li);
	});
	content.appendChild(list);
}

function resetFootnote() {
	const label = document.getElementById("footnote-label");
	const content = document.getElementById("footnote-content");
	label.textContent = "Footnote";
	content.innerHTML = "";
	const placeholder = document.createElement("p");
	placeholder.className = "footnote-placeholder";
	placeholder.textContent = "Hover a word or sentence to see how it read in earlier drafts.";
	content.appendChild(placeholder);
}

// Groups a flat sentence ledger back into per-paragraph chunks, using the
// current (final) revision's text to know where the paragraph breaks are.
// Falls back to one big paragraph if no final text is available.
function groupSentencesByParagraph(sentenceLedger, finalText) {
	if (!finalText) return [sentenceLedger];
	let cursor = 0;
	const groups = splitParagraphs(finalText)
		.map((paragraph) => {
			const count = splitSentences(paragraph).length;
			const group = sentenceLedger.slice(cursor, cursor + count);
			cursor += count;
			return group;
		})
		.filter((group) => group.length > 0);
	return groups.length ? groups : [sentenceLedger];
}

function renderWordLevelHeatmap(sentenceLedger, wordLedger, palette, output, finalText) {
	const maxWordCount = Math.max(...wordLedger.map((entry) => entry.count), 1);
	const topStop = palette.stops[palette.stops.length - 1];
	const topRgb = hexToRgb(topStop.hex);

	// Normalized (0-1) heat for every word, in document order.
	const wordNormalized = wordLedger.map((entry) =>
		maxWordCount > 1 ? (entry.count - 1) / (maxWordCount - 1) : 0
	);

	let wordCursor = 0;
	const paragraphGroups = groupSentencesByParagraph(sentenceLedger, finalText);

	paragraphGroups.forEach((paragraphSentences, paragraphIdx) => {
		paragraphSentences.forEach((sentenceEntry, sentenceIdx) => {
			const sentenceSpan = document.createElement("span");
			sentenceSpan.className = "sentence";
			sentenceSpan.title = `Sentence edited ${sentenceEntry.count} time${sentenceEntry.count === 1 ? "" : "s"}`;

			const wordsInSentence = splitWords(sentenceEntry.text).length;
			const wordEntries = wordLedger.slice(wordCursor, wordCursor + wordsInSentence);

			// One continuous gradient across the whole sentence — a color stop
			// per word, positioned at that word's fraction across the sentence.
			// CSS interpolates smoothly between stops, so the heat flows across
			// word boundaries instead of jumping in discrete blocks.
			const stops = wordEntries.map((_, wordIdx) => {
				const globalIdx = wordCursor + wordIdx;
				const pos = wordEntries.length > 1 ? (wordIdx / (wordEntries.length - 1)) * 100 : 50;
				return `${heatColor(wordNormalized[globalIdx], palette)} ${pos}%`;
			});
			sentenceSpan.style.backgroundImage = `linear-gradient(to right, ${stops.join(", ")})`;

			wordEntries.forEach((wordEntry, wordIdx) => {
				const globalIdx = wordCursor + wordIdx;
				const own = wordNormalized[globalIdx];

				const wordSpan = document.createElement("span");
				wordSpan.className = "word";
				if (own > 0.75) {
					wordSpan.classList.add("heat-high");
					wordSpan.style.setProperty(
						"--heat-glow-color",
						`rgba(${topRgb[0]}, ${topRgb[1]}, ${topRgb[2]}, 0.6)`
					);
				}
				wordSpan.title = `"${wordEntry.text}" edited ${wordEntry.count} time${wordEntry.count === 1 ? "" : "s"}`;
				wordSpan.textContent = wordEntry.text;
				wordSpan.addEventListener("mouseenter", () => showFootnote(wordEntry, "word"));
				wordSpan.addEventListener("mouseleave", resetFootnote);
				sentenceSpan.appendChild(wordSpan);
				if (wordIdx < wordEntries.length - 1) sentenceSpan.appendChild(document.createTextNode(" "));
			});

			wordCursor += wordsInSentence;

			output.appendChild(sentenceSpan);
			if (sentenceIdx < paragraphSentences.length - 1) output.appendChild(document.createTextNode(" "));
		});

		if (paragraphIdx < paragraphGroups.length - 1) output.appendChild(document.createTextNode("\n\n"));
	});
}

function renderSentenceLevelHeatmap(sentenceLedger, palette, output, finalText) {
	const maxSentenceCount = Math.max(...sentenceLedger.map((entry) => entry.count), 1);
	const paragraphGroups = groupSentencesByParagraph(sentenceLedger, finalText);

	paragraphGroups.forEach((paragraphSentences, paragraphIdx) => {
		paragraphSentences.forEach((sentenceEntry, sentenceIdx) => {
			const sentenceSpan = document.createElement("span");
			sentenceSpan.className = "sentence";
			const normalized =
				maxSentenceCount > 1 ? (sentenceEntry.count - 1) / (maxSentenceCount - 1) : 0;
			sentenceSpan.style.backgroundColor = heatColor(normalized, palette);
			sentenceSpan.title = `Edited ${sentenceEntry.count} time${sentenceEntry.count === 1 ? "" : "s"}`;
			sentenceSpan.textContent = sentenceEntry.text;
			sentenceSpan.addEventListener("mouseenter", () => showFootnote(sentenceEntry, "sentence"));
			sentenceSpan.addEventListener("mouseleave", resetFootnote);
			output.appendChild(sentenceSpan);
			if (sentenceIdx < paragraphSentences.length - 1) output.appendChild(document.createTextNode(" "));
		});

		if (paragraphIdx < paragraphGroups.length - 1) output.appendChild(document.createTextNode("\n\n"));
	});
}

function renderHeatmap(sentenceLedger, wordLedger, finalText) {
	currentSentenceLedger = sentenceLedger;
	currentWordLedger = wordLedger;
	if (finalText !== undefined) currentFinalText = finalText;
	const palette = PALETTES[currentPaletteKey];
	const output = document.getElementById("doc-output");
	output.innerHTML = "";
	resetFootnote();

	if (currentAnalysisMode === "sentence") {
		renderSentenceLevelHeatmap(sentenceLedger, palette, output, currentFinalText);
	} else {
		renderWordLevelHeatmap(sentenceLedger, wordLedger, palette, output, currentFinalText);
	}

	document.getElementById("legend-gradient").style.background = paletteToCssGradient(palette);
	document.getElementById("legend").hidden = false;
}

function populatePaletteSelect() {
	const select = document.getElementById("palette-select");
	Object.entries(PALETTES).forEach(([key, palette]) => {
		const option = document.createElement("option");
		option.value = key;
		option.textContent = palette.label;
		select.appendChild(option);
	});
	select.value = currentPaletteKey;

	select.addEventListener("change", () => {
		currentPaletteKey = select.value;
		applyPaletteTheme(PALETTES[currentPaletteKey]);
		if (currentSentenceLedger && currentWordLedger) {
			renderHeatmap(currentSentenceLedger, currentWordLedger);
		}
	});
}

function initAnalysisToggle() {
	const toggle = document.getElementById("analysis-toggle");
	const options = Array.from(toggle.querySelectorAll(".segmented-option"));

	function setActive(mode) {
		options.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
	}

	setActive(currentAnalysisMode);

	options.forEach((btn) => {
		btn.addEventListener("click", () => {
			currentAnalysisMode = btn.dataset.mode;
			setActive(currentAnalysisMode);
			if (currentSentenceLedger && currentWordLedger) {
				renderHeatmap(currentSentenceLedger, currentWordLedger);
			}
		});
	});
}

applyPaletteTheme(PALETTES[currentPaletteKey]);
populatePaletteSelect();
initAnalysisToggle();

function setSourceStatus(text) {
	document.getElementById("mode-label").textContent = text;
}

document.getElementById("load-demo-btn").addEventListener("click", () => {
	const sentenceLedger = computeSentenceLedger(MOCK_REVISIONS);
	const wordLedger = computeWordLedger(MOCK_REVISIONS);
	renderHeatmap(sentenceLedger, wordLedger, MOCK_REVISIONS[MOCK_REVISIONS.length - 1]);
	setSourceStatus(`Demo document — ${MOCK_REVISIONS.length} revisions`);
});

/*
 * Google Doc integration.
 *
 * Everything below runs entirely in this browser tab: it exchanges an
 * OAuth token directly with Google, then calls the Drive API directly
 * from here to list a document's revision history and read the
 * plain-text content of each revision. There is no server of ours in
 * this path, nothing is logged, and no AI ever sees this text — it goes
 * straight from Google's API into the same diffing pipeline used for
 * the demo data above (computeSentenceLedger / computeWordLedger).
 */
const GOOGLE_CLIENT_ID = "239184223664-fptfs2hebu60crv5tkk60mjmcjmci416.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyAwUFUxB0Cu3lLQQ74fa-cGqWS9yEzLRcw";

// drive.file is deliberately narrow: it only grants access to files the
// user explicitly selects through the Google Picker below, not to
// everything in their Drive. Selecting a doc via Picker is what actually
// grants this app permission to read that one file — there's no way to
// grant access to an arbitrary file just by pasting its URL under this
// scope, which is the point.
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Google Docs can accumulate hundreds of autosave revisions. Rather than
// fetching (and diffing) every single one, sample down to this many,
// evenly spaced across the full history, so the heatmap still reflects
// the whole arc of the document without hammering the API.
const MAX_REVISIONS_TO_FETCH = 40;

let googleTokenClient = null;
let googleAccessToken = null;
let pickerLoaded = false;

// Evenly samples down to `max` items, always keeping the first and last
// so the earliest and most recent drafts are included either way.
function sampleEvenly(items, max) {
	if (items.length <= max) return items;
	const lastIndex = items.length - 1;
	const picked = [];
	for (let i = 0; i < max; i++) {
		picked.push(items[Math.round((i * lastIndex) / (max - 1))]);
	}
	return [...new Set(picked)];
}

async function driveApiFetch(url) {
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${googleAccessToken}` }
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Drive API error ${response.status}: ${body}`);
	}
	return response;
}

async function fetchDocTitle(fileId) {
	const response = await driveApiFetch(
		`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`
	);
	const data = await response.json();
	return data.name;
}

async function fetchRevisionIds(fileId) {
	let ids = [];
	let pageToken = "";
	do {
		const url =
			`https://www.googleapis.com/drive/v3/files/${fileId}/revisions` +
			`?fields=nextPageToken,revisions(id)&pageSize=1000` +
			(pageToken ? `&pageToken=${pageToken}` : "");
		const response = await driveApiFetch(url);
		const data = await response.json();
		ids = ids.concat((data.revisions || []).map((r) => r.id));
		pageToken = data.nextPageToken || "";
	} while (pageToken);
	return ids;
}

async function fetchRevisionText(fileId, revisionId) {
	// Drive API v3 doesn't support alt=media directly on a Google Doc
	// revision (that only works for raw binary files). For Workspace
	// documents you first ask for the revision's exportLinks, then fetch
	// the plain-text URL it hands back — same auth header, second request.
	const metaResponse = await driveApiFetch(
		`https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?fields=exportLinks`
	);
	const meta = await metaResponse.json();
	const exportUrl = meta.exportLinks && meta.exportLinks["text/plain"];
	if (!exportUrl) {
		throw new Error(`Revision ${revisionId} has no plain-text export available`);
	}
	const contentResponse = await driveApiFetch(exportUrl);
	return contentResponse.text();
}

async function loadGoogleDoc(fileId) {
	setSourceStatus("Fetching revision history…");
	const [title, allRevisionIds] = await Promise.all([
		fetchDocTitle(fileId),
		fetchRevisionIds(fileId)
	]);

	if (allRevisionIds.length === 0) {
		setSourceStatus("No revision history found for this document.");
		return;
	}

	const sampledIds = sampleEvenly(allRevisionIds, MAX_REVISIONS_TO_FETCH);
	const texts = [];
	for (let i = 0; i < sampledIds.length; i++) {
		setSourceStatus(`Fetching revision ${i + 1} of ${sampledIds.length}…`);
		texts.push(await fetchRevisionText(fileId, sampledIds[i]));
	}

	const sentenceLedger = computeSentenceLedger(texts);
	const wordLedger = computeWordLedger(texts);
	renderHeatmap(sentenceLedger, wordLedger, texts[texts.length - 1]);
	setSourceStatus(`"${title}" — ${sampledIds.length} of ${allRevisionIds.length} revisions`);
}

function waitFor(isReady, onReady, onFail, attemptsLeft = 20) {
	if (isReady()) {
		onReady();
		return;
	}
	if (attemptsLeft <= 0) {
		onFail();
		return;
	}
	setTimeout(() => waitFor(isReady, onReady, onFail, attemptsLeft - 1), 150);
}

function disableConnectButton(reason) {
	const connectBtn = document.getElementById("connect-doc-btn");
	connectBtn.disabled = true;
	connectBtn.title = reason;
}

function openDocPicker() {
	const picker = new google.picker.PickerBuilder()
		.setOAuthToken(googleAccessToken)
		.setDeveloperKey(GOOGLE_API_KEY)
		.addView(
			new google.picker.DocsView(google.picker.ViewId.DOCUMENTS).setMimeTypes(
				"application/vnd.google-apps.document"
			)
		)
		.setCallback((data) => {
			if (data.action !== google.picker.Action.PICKED) return;
			const fileId = data.docs[0].id;
			loadGoogleDoc(fileId).catch((err) => {
				console.error("Brushstrokes: failed to load Google Doc", err);
				setSourceStatus(`Couldn't load that document: ${err.message}`);
			});
		})
		.build();
	picker.setVisible(true);
}

function initGoogleAuth() {
	const misconfigured = GOOGLE_CLIENT_ID.startsWith("REPLACE_WITH") || GOOGLE_API_KEY.startsWith("REPLACE_WITH");
	if (misconfigured) {
		disableConnectButton("Google sign-in isn't configured yet");
		return;
	}

	googleTokenClient = google.accounts.oauth2.initTokenClient({
		client_id: GOOGLE_CLIENT_ID,
		scope: GOOGLE_DRIVE_SCOPE,
		callback: (response) => {
			if (response.error) {
				setSourceStatus(`Google sign-in failed: ${response.error}`);
				return;
			}
			googleAccessToken = response.access_token;
			openDocPicker();
		}
	});
}

document.getElementById("connect-doc-btn").addEventListener("click", () => {
	if (!googleTokenClient) {
		setSourceStatus("Google sign-in isn't set up yet.");
		return;
	}
	if (!pickerLoaded) {
		setSourceStatus("Google Picker isn't ready yet — try again in a moment.");
		return;
	}
	setSourceStatus("Requesting access…");
	googleTokenClient.requestAccessToken();
});

waitFor(
	() => window.google && window.google.accounts && window.google.accounts.oauth2,
	initGoogleAuth,
	() => disableConnectButton("Google sign-in failed to load — try refreshing")
);

waitFor(
	() => window.gapi && window.gapi.load,
	() => gapi.load("picker", () => { pickerLoaded = true; }),
	() => disableConnectButton("Google Picker failed to load — try refreshing")
);
