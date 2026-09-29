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
		image: "Images/lurie_two_dancers.jpeg",
		imageTitle: "Two Dancers. Antiques. Some suitcases. A parrot. And a blue mess.",
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
		image: "Images/sargent_lady_helen_vincent_viscountess_dabernon.jpg",
		imageTitle: "Lady Helen Vincent, Viscountess D'Abernon",
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
		image: "Images/davis_pueblo_del_rio-_arabesque.jpg",
		imageTitle: "Pueblo del Rio: Arabesque",
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
		image: "Images/hockney_american_collectors.jpg",
		imageTitle: "American Collectors",
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
		image: "Images/sage_i_saw_three_cities.jpg",
		imageTitle: "I Saw Three Cities",
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
		image: "Images/lichtenstein_masterpiece.jpg",
		imageTitle: "Masterpiece",
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
		image: "Images/matisse_the_red_studio.jpg",
		imageTitle: "The Red Studio",
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
		image: "Images/rembrandt_the_anatomy_lesson_of_dr_nicolaes_tulp.jpg",
		imageTitle: "The Anatomy Lesson of Dr. Nicolaes Tulp",
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
		image: "Images/okeeffe_ladder_to_the_moon.jpg",
		imageTitle: "Ladder to the Moon",
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
		image: "Images/vangogh_sunflowers.jpg",
		imageTitle: "Sunflowers",
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

// Straight-line RGB distance — a rough but cheap stand-in for "how
// visually different are these two colors," used to pick the more
// noticeable of two hover-shift candidates.
function colorDistance(hexA, hexB) {
	const [r1, g1, b1] = hexToRgb(hexA);
	const [r2, g2, b2] = hexToRgb(hexB);
	return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

// Mixes a hex color toward white by `amount` (0-1). Used to derive lighter
// "elevated" surface/text shades from a palette's base background color.
function lightenHex(hex, amount) {
	const [r, g, b] = hexToRgb(hex);
	const mix = (c) => c + (255 - c) * amount;
	return rgbToHex(mix(r), mix(g), mix(b));
}

// Mixes a hex color toward black by `amount` (0-1) — the mirror of
// lightenHex, used for light-background palettes.
function darkenHex(hex, amount) {
	const [r, g, b] = hexToRgb(hex);
	const mix = (c) => c * (1 - amount);
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
 *
 * Derived colors mirror around the background's own brightness: dark
 * backgrounds get progressively lighter panels/controls/borders/text
 * (the original scheme), while light backgrounds get progressively
 * darker ones instead, so text and surfaces stay high-contrast either
 * way rather than always lightening toward white.
 */
function applyPaletteTheme(palette) {
	const background = palette.background || "#0A2243";
	const highlight = palette.highlight || "#FA935C";

	// Decide lighten-vs-darken TEXT color by which direction actually
	// reads better, not by an arbitrary luminance cutoff — a mid-brightness
	// saturated color (teal, gold, taupe) can easily sit on the "dark" side
	// of 0.5 while still being too bright to lighten further and stay
	// readable. Checking contrast at the text-level intensity (the most
	// extreme, most contrast-critical derived shade) is what actually
	// matters.
	const backgroundLuminance = relativeLuminance(background);
	const lightenedContrast = contrastRatio(backgroundLuminance, relativeLuminance(lightenHex(background, 0.86)));
	const darkenedContrast = contrastRatio(backgroundLuminance, relativeLuminance(darkenHex(background, 0.86)));
	const textAdjust = darkenedContrast > lightenedContrast ? darkenHex : lightenHex;

	// A bigger shift than the old 0.15 so hovering the primary button
	// reads as a clear, deliberate change rather than a subtle tint. The
	// shift direction is chosen per-highlight (not reusing textAdjust,
	// which is tuned for the unrelated background color): prefer whichever
	// of lighten/darken is the more visually distinct shift, but only
	// between options that stay readable — a highlight near white or
	// black has little room to move in one direction (e.g. lightening an
	// already-near-white highlight barely changes it), and a mid-
	// brightness highlight can have one direction land in an unreadable
	// middle-gray zone for both candidate text colors while the other
	// doesn't. Also gets its own contrast-checked text color (the "third
	// color" a palette can define via highlightHoverText, same pattern
	// as the rest).
	const AA_CONTRAST = 4.5;
	const bestTextContrast = (hex) => {
		const lum = relativeLuminance(hex);
		return Math.max(
			contrastRatio(lum, relativeLuminance("#17223D")),
			contrastRatio(lum, relativeLuminance("#F4F5F7"))
		);
	};
	const lightenedHover = lightenHex(highlight, 0.3);
	const darkenedHover = darkenHex(highlight, 0.3);
	const lightenedReadable = bestTextContrast(lightenedHover) >= AA_CONTRAST;
	const darkenedReadable = bestTextContrast(darkenedHover) >= AA_CONTRAST;

	let highlightHover;
	if (palette.highlightHover) {
		highlightHover = palette.highlightHover;
	} else if (lightenedReadable && darkenedReadable) {
		highlightHover =
			colorDistance(highlight, lightenedHover) >= colorDistance(highlight, darkenedHover)
				? lightenedHover
				: darkenedHover;
	} else if (lightenedReadable) {
		highlightHover = lightenedHover;
	} else if (darkenedReadable) {
		highlightHover = darkenedHover;
	} else {
		highlightHover =
			bestTextContrast(lightenedHover) >= bestTextContrast(darkenedHover) ? lightenedHover : darkenedHover;
	}

	const theme = {
		"--color-background": background,
		// Cards/surfaces always lighten from the page background — they
		// need to read as a distinct "elevated" layer regardless of which
		// direction the text picks. A palette whose text reads better
		// darkened (a bright/saturated background) would otherwise get
		// panels *darker* than the page itself, which barely registers
		// as a separate surface at all.
		"--color-panel-bg": palette.panelBackground || lightenHex(background, 0.06),
		"--color-control-bg": palette.controlBackground || lightenHex(background, 0.12),
		"--color-border": palette.border || lightenHex(background, 0.22),
		"--color-text": palette.textPrimary || textAdjust(background, 0.86),
		"--color-text-muted": palette.textMuted || textAdjust(background, 0.62),
		"--color-text-faint": palette.textFaint || textAdjust(background, 0.42),
		"--color-highlight": highlight,
		"--color-highlight-text": palette.highlightText || pickContrastText(highlight),
		"--color-highlight-hover": highlightHover,
		"--color-highlight-hover-text": palette.highlightHoverText || pickContrastText(highlightHover)
	};

	const root = document.documentElement.style;
	Object.entries(theme).forEach(([prop, value]) => root.setProperty(prop, value));

	updatePaintingReference(palette);
}

function updatePaintingReference(palette) {
	const img = document.getElementById("painting-image");
	const caption = document.getElementById("painting-caption");
	if (!palette.image) {
		img.style.display = "none";
		caption.textContent = "";
		return;
	}
	const captionText = palette.imageTitle ? `${palette.imageTitle}, ${palette.label}` : palette.label;
	img.style.display = "block";
	img.src = palette.image;
	img.alt = captionText;
	caption.textContent = captionText;
}

function heatColorComponents(t, palette, alphaScale) {
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

	return { rgb, alpha };
}

function heatColor(t, palette, alphaScale) {
	const { rgb, alpha } = heatColorComponents(t, palette, alphaScale);
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

// Keeps the popout on-screen horizontally, and flips it above the
// hovered word instead of below when that word sits in the bottom
// half of the viewport (mirrors the palette rail's preview clamping).
const WORD_FOOTNOTE_PREVIEW_WIDTH = 320;
const WORD_FOOTNOTE_PREVIEW_EDGE_MARGIN = 16;
const WORD_FOOTNOTE_PREVIEW_GAP = 10;

function positionWordFootnotePreview(targetRect) {
	const preview = document.getElementById("word-footnote-preview");

	let left = Math.min(
		targetRect.left,
		window.innerWidth - WORD_FOOTNOTE_PREVIEW_WIDTH - WORD_FOOTNOTE_PREVIEW_EDGE_MARGIN
	);
	left = Math.max(left, WORD_FOOTNOTE_PREVIEW_EDGE_MARGIN);
	preview.style.left = `${left}px`;

	const showAbove = targetRect.top > window.innerHeight / 2;
	if (showAbove) {
		preview.style.bottom = `${window.innerHeight - targetRect.top + WORD_FOOTNOTE_PREVIEW_GAP}px`;
		preview.style.top = "auto";
	} else {
		preview.style.top = `${targetRect.bottom + WORD_FOOTNOTE_PREVIEW_GAP}px`;
		preview.style.bottom = "auto";
	}
}

function showWordFootnotePreview(entry, kind, targetEl) {
	const preview = document.getElementById("word-footnote-preview");
	const label = document.getElementById("word-footnote-preview-label");
	const content = document.getElementById("word-footnote-preview-content");
	const priorVersions = entry.history.slice(0, -1);

	label.textContent = kind === "word" ? `Earlier drafts of "${entry.text}"` : "Earlier drafts of this sentence";

	content.innerHTML = "";
	if (priorVersions.length === 0) {
		const placeholder = document.createElement("p");
		placeholder.className = "footnote-placeholder";
		placeholder.textContent =
			kind === "word"
				? "This word hasn't changed since it first appeared."
				: "This sentence hasn't changed since it first appeared.";
		content.appendChild(placeholder);
	} else {
		const list = document.createElement("ol");
		list.className = "footnote-list";
		priorVersions.forEach((text) => {
			const li = document.createElement("li");
			li.textContent = text;
			list.appendChild(li);
		});
		content.appendChild(list);
	}

	positionWordFootnotePreview(targetEl.getBoundingClientRect());
	preview.classList.add("visible");
}

function hideWordFootnotePreview() {
	document.getElementById("word-footnote-preview").classList.remove("visible");
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
				wordSpan.addEventListener("mouseenter", () => showWordFootnotePreview(wordEntry, "word", wordSpan));
				wordSpan.addEventListener("mouseleave", hideWordFootnotePreview);
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
			sentenceSpan.addEventListener("mouseenter", () => showWordFootnotePreview(sentenceEntry, "sentence", sentenceSpan));
			sentenceSpan.addEventListener("mouseleave", hideWordFootnotePreview);
			output.appendChild(sentenceSpan);
			if (sentenceIdx < paragraphSentences.length - 1) output.appendChild(document.createTextNode(" "));
		});

		if (paragraphIdx < paragraphGroups.length - 1) output.appendChild(document.createTextNode("\n\n"));
	});
}

// updateFrame is false during progressive loading (see loadGoogleDoc)
// -- the frame graphic shows the single most-edited 250-word block,
// which shifts as more revisions come in, so it only gets (re)drawn
// once the full revision set has loaded, not on every partial update.
function renderHeatmap(sentenceLedger, wordLedger, finalText, { updateFrame = true } = {}) {
	currentSentenceLedger = sentenceLedger;
	currentWordLedger = wordLedger;
	if (finalText !== undefined) currentFinalText = finalText;
	const palette = PALETTES[currentPaletteKey];
	const output = document.getElementById("doc-output");
	output.innerHTML = "";
	hideWordFootnotePreview();

	if (currentAnalysisMode === "sentence") {
		renderSentenceLevelHeatmap(sentenceLedger, palette, output, currentFinalText);
	} else {
		renderWordLevelHeatmap(sentenceLedger, wordLedger, palette, output, currentFinalText);
	}

	document.getElementById("legend-gradient").style.background = paletteToCssGradient(palette);
	document.getElementById("legend").hidden = false;

	if (updateFrame) renderFrameGraphic(wordLedger, palette);
}

const SVG_NS = "http://www.w3.org/2000/svg";

// The graphic shows a fixed-size block of words — roughly enough to
// fill the whole 8.5x11 canvas at a readable pixel size — rather than a
// realistic full page, so cells stay big regardless of document length.
const WORD_WINDOW_SIZE = 250;
const CHARS_PER_LINE = 90;
const PAGE_WIDTH = 850;
const PAGE_HEIGHT = 1100;
const CHAR_WIDTH = PAGE_WIDTH / CHARS_PER_LINE;

// Finds the WORD_WINDOW_SIZE-word block (by document order) with the
// highest total edit count, via an O(n) sliding-window sum. Shorter
// documents just use every word they have.
function findMostChangedWordBlock(wordLedger) {
	if (wordLedger.length <= WORD_WINDOW_SIZE) return wordLedger;

	let windowSum = 0;
	for (let i = 0; i < WORD_WINDOW_SIZE; i++) windowSum += wordLedger[i].count;

	let bestSum = windowSum;
	let bestStart = 0;

	for (let start = 1; start <= wordLedger.length - WORD_WINDOW_SIZE; start++) {
		windowSum += wordLedger[start + WORD_WINDOW_SIZE - 1].count - wordLedger[start - 1].count;
		if (windowSum > bestSum) {
			bestSum = windowSum;
			bestStart = start;
		}
	}

	return wordLedger.slice(bestStart, bestStart + WORD_WINDOW_SIZE);
}

// Word-wraps a block of words at CHARS_PER_LINE (the same greedy wrap a
// text editor uses) to place each at a (line, column) position, and
// reports how many lines the block took — used to derive a line height
// that makes however many lines this specific block needs fill the
// page exactly, rather than assuming a fixed line count.
function layoutWordBlock(words) {
	let line = 0;
	let col = 0;
	const positioned = words.map((entry) => {
		const wordLen = entry.text.length;
		const withSpace = col > 0 ? wordLen + 1 : wordLen;
		if (col > 0 && col + withSpace > CHARS_PER_LINE) {
			line++;
			col = 0;
		}
		const startCol = col > 0 ? col + 1 : col;
		col = startCol + wordLen;
		return { entry, line, startCol, wordLen };
	});

	return { positioned, lineCount: line + 1 };
}

// A poster-sized (8.5x11in, portrait) pixel mosaic of the most heavily
// edited ~250-word block in the document — one rect per word, colored
// by that word's heat and positioned to match its real (line, column)
// within the block, then blurred (via an SVG filter) so neighboring
// cells blend into each other instead of reading as hard-edged tiles.
function renderFrameGraphic(wordLedger, palette) {
	const pixels = document.getElementById("frame-pixels");
	const bg = document.getElementById("frame-bg");
	const downloadBtn = document.getElementById("download-frame-btn");

	if (!wordLedger || wordLedger.length === 0) {
		pixels.innerHTML = "";
		downloadBtn.disabled = true;
		downloadBtn.title = "Load a document first";
		return;
	}

	bg.setAttribute("fill", palette.background || "#0A2243");

	const block = findMostChangedWordBlock(wordLedger);
	const { positioned, lineCount } = layoutWordBlock(block);
	const lineHeight = PAGE_HEIGHT / lineCount;
	const maxCount = Math.max(...wordLedger.map((entry) => entry.count), 1);

	pixels.innerHTML = "";
	positioned.forEach(({ entry, line, startCol, wordLen }) => {
		const normalized = maxCount > 1 ? (entry.count - 1) / (maxCount - 1) : 0;
		const { rgb, alpha } = heatColorComponents(normalized, palette);

		const rect = document.createElementNS(SVG_NS, "rect");
		rect.setAttribute("x", (startCol * CHAR_WIDTH).toFixed(2));
		rect.setAttribute("y", (line * lineHeight).toFixed(2));
		rect.setAttribute("width", (wordLen * CHAR_WIDTH).toFixed(2));
		rect.setAttribute("height", lineHeight.toFixed(2));
		rect.setAttribute("fill", `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
		rect.setAttribute("fill-opacity", alpha.toFixed(2));
		pixels.appendChild(rect);
	});

	downloadBtn.disabled = false;
	downloadBtn.title = "";
}

// Export pixel dimensions for an 8.5x11in page at 300dpi.
const FRAME_EXPORT_DPI = 300;
const FRAME_EXPORT_WIDTH = 8.5 * FRAME_EXPORT_DPI;
const FRAME_EXPORT_HEIGHT = 11 * FRAME_EXPORT_DPI;

function downloadFrameGraphic() {
	const svg = document.getElementById("frame-graphic");
	const clone = svg.cloneNode(true);
	clone.setAttribute("width", FRAME_EXPORT_WIDTH);
	clone.setAttribute("height", FRAME_EXPORT_HEIGHT);

	const serialized =
		`<?xml version="1.0" encoding="UTF-8"?>\n` + new XMLSerializer().serializeToString(clone);
	const svgBlob = new Blob([serialized], { type: "image/svg+xml" });
	const svgUrl = URL.createObjectURL(svgBlob);

	// Rasterize the SVG (blur filter included) onto a canvas, then export
	// that as a JPEG -- browsers don't offer a direct SVG-to-JPEG path.
	const img = new Image();
	img.onload = () => {
		const canvas = document.createElement("canvas");
		canvas.width = FRAME_EXPORT_WIDTH;
		canvas.height = FRAME_EXPORT_HEIGHT;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		URL.revokeObjectURL(svgUrl);

		canvas.toBlob((jpegBlob) => {
			const jpegUrl = URL.createObjectURL(jpegBlob);
			const link = document.createElement("a");
			link.href = jpegUrl;
			link.download = "brushstrokes-frame.jpg";
			link.click();
			URL.revokeObjectURL(jpegUrl);
		}, "image/jpeg", 0.92);
	};
	img.src = svgUrl;
}

document.getElementById("download-frame-btn").addEventListener("click", downloadFrameGraphic);

// The heatmap's word/sentence spans are rebuilt from scratch on every
// render (not just recolored in place), so a plain CSS transition on
// them can't cross-fade between old and new colors. Instead, fade the
// container out, swap in the freshly-rendered content while invisible,
// then fade back in — paired with the CSS custom property transitions
// in style.css, which handle the rest of the page (toolbar, panels,
// buttons, text) smoothly on their own.
const PALETTE_FADE_MS = 250;

function fadeToRerenderedHeatmap() {
	const output = document.getElementById("doc-output");
	const legendGradient = document.getElementById("legend-gradient");
	const frameGraphic = document.getElementById("frame-graphic");
	output.style.opacity = "0";
	legendGradient.style.opacity = "0";
	frameGraphic.style.opacity = "0";
	setTimeout(() => {
		renderHeatmap(currentSentenceLedger, currentWordLedger);
		output.style.opacity = "1";
		legendGradient.style.opacity = "1";
		frameGraphic.style.opacity = "1";
	}, PALETTE_FADE_MS);
}

function setActivePaletteRailItem(key) {
	const rail = document.getElementById("palette-rail");
	Array.from(rail.children).forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.paletteKey === key);
	});
}

// Keeps the preview fully on-screen even when hovering the topmost or
// bottommost thumbnail, by clamping how close its vertical center can
// get to the viewport edges.
const PALETTE_PREVIEW_EDGE_MARGIN = 140;

function showPalettePreview(palette, thumbBtn) {
	const preview = document.getElementById("palette-preview");
	const previewImg = document.getElementById("palette-preview-image");
	previewImg.src = palette.image;
	previewImg.alt = palette.imageTitle ? `${palette.imageTitle}, ${palette.label}` : palette.label;

	const rect = thumbBtn.getBoundingClientRect();
	const centerY = rect.top + rect.height / 2;
	const clampedY = Math.min(
		Math.max(centerY, PALETTE_PREVIEW_EDGE_MARGIN),
		window.innerHeight - PALETTE_PREVIEW_EDGE_MARGIN
	);
	preview.style.top = `${clampedY}px`;
	preview.classList.add("visible");
}

function hidePalettePreview() {
	document.getElementById("palette-preview").classList.remove("visible");
}

function populatePaletteRail() {
	const rail = document.getElementById("palette-rail");
	Object.entries(PALETTES).forEach(([key, palette]) => {
		const label = palette.imageTitle ? `${palette.imageTitle}, ${palette.label}` : palette.label;

		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "palette-rail-item";
		btn.dataset.paletteKey = key;
		btn.title = label;
		btn.setAttribute("aria-label", label);
		btn.setAttribute("aria-pressed", key === currentPaletteKey ? "true" : "false");

		const img = document.createElement("img");
		img.className = "palette-rail-thumb";
		img.src = palette.image;
		img.alt = "";
		btn.appendChild(img);

		btn.addEventListener("click", () => {
			if (key === currentPaletteKey) return;
			currentPaletteKey = key;
			applyPaletteTheme(PALETTES[currentPaletteKey]);
			setActivePaletteRailItem(key);
			Array.from(rail.children).forEach((otherBtn) => {
				otherBtn.setAttribute("aria-pressed", otherBtn === btn ? "true" : "false");
			});
			if (currentSentenceLedger && currentWordLedger) {
				fadeToRerenderedHeatmap();
			}
		});

		btn.addEventListener("mouseenter", () => showPalettePreview(palette, btn));
		btn.addEventListener("mouseleave", hidePalettePreview);
		btn.addEventListener("focus", () => showPalettePreview(palette, btn));
		btn.addEventListener("blur", hidePalettePreview);

		rail.appendChild(btn);
	});

	setActivePaletteRailItem(currentPaletteKey);
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
populatePaletteRail();
initAnalysisToggle();

// Long status text (e.g. an error body Google sends back) is truncated
// to this many characters, with a "Show more" toggle to read the rest.
const STATUS_TRUNCATE_LENGTH = 120;

function setSourceStatus(text, { loading = false, error = false } = {}) {
	const label = document.getElementById("mode-label");
	label.innerHTML = "";

	if (error && text.length > STATUS_TRUNCATE_LENGTH) {
		const truncated = text.slice(0, STATUS_TRUNCATE_LENGTH).trimEnd();
		const textSpan = document.createElement("span");
		textSpan.textContent = `${truncated}… `;

		const toggleBtn = document.createElement("button");
		toggleBtn.type = "button";
		toggleBtn.className = "status-expand-btn";
		toggleBtn.textContent = "Show more";
		toggleBtn.addEventListener("click", () => {
			const isTruncated = toggleBtn.textContent === "Show more";
			textSpan.textContent = isTruncated ? text : `${truncated}… `;
			toggleBtn.textContent = isTruncated ? "Show less" : "Show more";
		});

		label.appendChild(textSpan);
		label.appendChild(toggleBtn);
		return;
	}

	label.appendChild(document.createTextNode(text));

	if (loading) {
		const dots = document.createElement("span");
		dots.className = "loading-dots";
		dots.setAttribute("aria-hidden", "true");
		dots.innerHTML = "<span></span><span></span><span></span>";
		label.appendChild(dots);
	}
}

function loadDemo() {
	const sentenceLedger = computeSentenceLedger(MOCK_REVISIONS);
	const wordLedger = computeWordLedger(MOCK_REVISIONS);
	renderHeatmap(sentenceLedger, wordLedger, MOCK_REVISIONS[MOCK_REVISIONS.length - 1]);
	document.getElementById("doc-title").textContent = "Demo Document";
	setSourceStatus(`Demo document — ${MOCK_REVISIONS.length} revisions`);
}

loadDemo();

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
const MAX_REVISIONS_TO_FETCH = 25;

// Pause between each revision fetch to avoid bursting Google's export
// endpoints, which rate-limit (HTTP 429) more aggressively than the
// main Drive REST API.
const REVISION_FETCH_PACING_MS = 500;

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

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetching a document's full revision history means many sequential
// requests to Google's export endpoints, which rate-limit more
// aggressively than the main Drive REST API. A 429 here is expected
// occasionally on larger documents, not a hard failure — retry with
// backoff (honoring Retry-After if Google sends one) before giving up.
// A 429 whose body is HTML rather than JSON is Google's general
// automated-traffic block, not a normal per-request quota error — that
// signal means "back off hard," so it gets a much longer minimum wait
// than an ordinary quota 429.
const MAX_RETRY_ATTEMPTS = 6;

// Files shared via a link (rather than added directly to My Drive) can
// require a "resource key" -- Drive API v3 returns a generic 404 "File
// not found" for every request against such a file if this isn't sent,
// with no indication that a resource key is the actual problem. The
// Picker hands one back on the picked file when it applies; set here
// and included on every request below.
let currentFileId = null;
let currentResourceKey = null;

// Which Google account the current access token actually belongs to --
// surfaced in error messages so an account-mismatch (token for account
// A, file picked while looking at account B's Drive) is visible without
// opening devtools.
let currentAccountEmail = null;

async function driveApiFetch(url, attempt = 1) {
	const headers = { Authorization: `Bearer ${googleAccessToken}` };
	if (currentFileId && currentResourceKey) {
		headers["X-Goog-Drive-Resource-Keys"] = `${currentFileId}/${currentResourceKey}`;
	}
	const response = await fetch(url, { headers });

	if (response.status === 429 && attempt < MAX_RETRY_ATTEMPTS) {
		const retryAfterHeader = response.headers.get("Retry-After");
		const contentType = response.headers.get("Content-Type") || "";
		const isAbuseBlock = contentType.includes("text/html");
		const waitMs = retryAfterHeader
			? Number(retryAfterHeader) * 1000
			: Math.min((isAbuseBlock ? 4000 : 800) * 2 ** (attempt - 1), 20000);
		setSourceStatus(`Google is rate-limiting requests — retrying in ${Math.ceil(waitMs / 1000)}s…`, { loading: true });
		await sleep(waitMs);
		return driveApiFetch(url, attempt + 1);
	}

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Drive API error ${response.status}: ${body}`);
	}
	return response;
}

// supportsAllDrives=true is required on every Drive API v3 call below,
// or files that live in a Shared Drive (rather than "My Drive") 404 --
// the API doesn't traverse Shared Drives unless you opt in explicitly,
// even though the Picker happily lets you select from one.
async function fetchDocTitle(fileId) {
	const response = await driveApiFetch(
		`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name&supportsAllDrives=true`
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
			`?fields=nextPageToken,revisions(id)&pageSize=1000&supportsAllDrives=true` +
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
		`https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?fields=exportLinks&supportsAllDrives=true`
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
	setSourceStatus("Fetching revision history…", { loading: true });
	const [title, allRevisionIds] = await Promise.all([
		fetchDocTitle(fileId),
		fetchRevisionIds(fileId)
	]);
	document.getElementById("doc-title").textContent = title;

	if (allRevisionIds.length === 0) {
		setSourceStatus("No revision history found for this document.");
		return;
	}

	// Disabled for the duration of the load -- otherwise, if a document
	// was already loaded, its (now stale) frame graphic would stay
	// downloadable while the heatmap behind it updates to the new doc.
	const downloadBtn = document.getElementById("download-frame-btn");
	downloadBtn.disabled = true;
	downloadBtn.title = "Loading document…";

	const sampledIds = sampleEvenly(allRevisionIds, MAX_REVISIONS_TO_FETCH);
	const texts = [];
	for (let i = 0; i < sampledIds.length; i++) {
		setSourceStatus(`Fetching revision ${i + 1} of ${sampledIds.length}…`, { loading: true });
		texts.push(await fetchRevisionText(fileId, sampledIds[i]));

		// Render as each revision arrives instead of waiting for all of
		// them -- the heatmap is already visible and updating well before
		// a large document finishes fetching. The frame graphic is left
		// alone here (updateFrame: false): it shows the single
		// most-edited 250-word block, which shifts as more revisions
		// come in, so it's only drawn once from the complete set below.
		renderHeatmap(computeSentenceLedger(texts), computeWordLedger(texts), texts[texts.length - 1], {
			updateFrame: false
		});

		// Small pause between revisions — each one is two requests to
		// Google's export endpoints, which rate-limit bursts more
		// aggressively than the main Drive API. Pacing them out avoids
		// tripping that limit in the first place.
		if (i < sampledIds.length - 1) await sleep(REVISION_FETCH_PACING_MS);
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

// The Google Cloud project number, needed by setAppId() below -- it's
// the leading numeric segment of the OAuth client ID, before the first
// hyphen, by Google's client ID format convention.
const GOOGLE_APP_ID = GOOGLE_CLIENT_ID.split("-")[0];

function openDocPicker() {
	const picker = new google.picker.PickerBuilder()
		.setOAuthToken(googleAccessToken)
		.setDeveloperKey(GOOGLE_API_KEY)
		.setAppId(GOOGLE_APP_ID)
		.addView(
			new google.picker.DocsView(google.picker.ViewId.DOCUMENTS).setMimeTypes(
				"application/vnd.google-apps.document"
			)
		)
		.setCallback((data) => {
			// The picker's own "Requesting access…" loading status has to be
			// cleared here on cancel -- otherwise it's left spinning forever
			// with nothing actually happening, which would make the next
			// real attempt's loading indicator look like it never changed.
			if (data.action === google.picker.Action.CANCEL) {
				setSourceStatus("Pick cancelled — click Connect Google Doc to try again.");
				return;
			}
			if (data.action !== google.picker.Action.PICKED) return;
			const doc = data.docs[0];
			const fileId = doc.id;
			currentFileId = fileId;
			currentResourceKey = doc.resourceKey || null;
			loadGoogleDoc(fileId).catch((err) => {
				console.error("Brushstrokes: failed to load Google Doc", err);
				const accountNote = currentAccountEmail ? ` (signed in as ${currentAccountEmail})` : "";
				setSourceStatus(`Couldn't load that document${accountNote}: ${err.message}`, { error: true });
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
				setSourceStatus(`Google sign-in failed: ${response.error}`, { error: true });
				return;
			}
			googleAccessToken = response.access_token;
			currentAccountEmail = null;
			driveApiFetch("https://www.googleapis.com/drive/v3/about?fields=user")
				.then((res) => res.json())
				.then((data) => {
					currentAccountEmail = data.user && data.user.emailAddress;
					console.log("Brushstrokes: signed in as", currentAccountEmail);
				})
				.catch((err) => console.error("Brushstrokes: couldn't identify signed-in account", err));
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
	setSourceStatus("Requesting access…", { loading: true });
	// Forces the account chooser every time, instead of silently reusing
	// whichever account last authorized this app. Without this, picking a
	// different account inside the Picker's own account switcher doesn't
	// change which account the access token belongs to -- so every Drive
	// API call 404s against a file the token's original account can't see.
	googleTokenClient.requestAccessToken({ prompt: "select_account" });
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
