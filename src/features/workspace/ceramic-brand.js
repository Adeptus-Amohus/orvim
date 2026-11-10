// Shared ceramic B geometry for the desktop sidebar, mobile header and SVG exports.
// Gradients describe glaze; no raster textures, filters or vertex knobs.
const palettes = {
  sun: {
    light: [
      "#fff0c7",
      "#ecd18b",
      "#fff2ca",
      "#c9a754",
      "#af8d46",
      "#ae985a",
      "#342d1d",
      "#fff9e8",
    ],
    dark: [
      "#fff0c7",
      "#ebd197",
      "#fff4d6",
      "#cbaa63",
      "#b59c6b",
      "#ae9760",
      "#27231d",
      "#fffbea",
    ],
  },
  pine: {
    light: [
      "#e1f0d5",
      "#a9d1bb",
      "#def1dc",
      "#669988",
      "#5f8e7c",
      "#72a18e",
      "#19322a",
      "#f3fff1",
    ],
    dark: [
      "#e4f4e1",
      "#aed9c1",
      "#def4e3",
      "#75aa96",
      "#6d9d8b",
      "#79ae96",
      "#172e25",
      "#f5fff6",
    ],
  },
  scarlet: {
    light: [
      "#fbd9d2",
      "#e6aca9",
      "#fce2d8",
      "#c87475",
      "#b26569",
      "#b97976",
      "#431e23",
      "#fff3ee",
    ],
    dark: [
      "#ffded8",
      "#eab2ae",
      "#ffe5de",
      "#cc8080",
      "#ba7275",
      "#c48580",
      "#3e1d22",
      "#fff6f2",
    ],
  },
  winter: {
    light: [
      "#dff0f8",
      "#acd2e3",
      "#e4f4fb",
      "#6ca0ba",
      "#5b8aa3",
      "#6b9fb5",
      "#17323f",
      "#f4fdff",
    ],
    dark: [
      "#e1f3fc",
      "#b0d8eb",
      "#e7f8ff",
      "#79acc6",
      "#699cb5",
      "#76abc2",
      "#152f3c",
      "#f7feff",
    ],
  },
};
const names = [
  "top",
  "front",
  "left",
  "right",
  "bottom",
  "rim",
  "hole",
  "glaze",
];

function blend(a, b, fraction) {
  return (
    "#" +
    [1, 3, 5]
      .map((offset) =>
        Math.round(
          parseInt(a.slice(offset, offset + 2), 16) * (1 - fraction) +
            parseInt(b.slice(offset, offset + 2), 16) * fraction,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function ceramicColors(
  palette = "sun",
  appearance = "light",
  customColor = "#d99c00",
) {
  const dark = appearance === "dark";
  const values =
    palette === "custom" && /^#[a-f0-9]{6}$/i.test(customColor)
      ? [
          blend(customColor, "#fff7ed", 0.8),
          blend(customColor, "#f2e7d7", 0.6),
          blend(customColor, "#fff9ef", 0.83),
          blend(customColor, "#baa99a", 0.36),
          blend(customColor, "#776759", 0.42),
          blend(customColor, "#8d7a68", 0.48),
          blend(customColor, dark ? "#181c21" : "#20242b", 0.84),
          blend(customColor, "#ffffff", 0.95),
        ]
      : (palettes[palette] || palettes.sun)[dark ? "dark" : "light"];
  return Object.fromEntries(names.map((name, index) => [name, values[index]]));
}

export function ceramicMarkup(colors, prefix = "ceramic") {
  // Namespace IDs because desktop and mobile SVGs share a document.
  const id = prefix.replace(/[^a-z0-9_-]/gi, "");
  const fill = (name) => `url(#${id}-${name})`;
  const gradient = (name, from, to, x1 = 0, y1 = 0, x2 = 1, y2 = 1) =>
    `<linearGradient id="${id}-${name}" x1="${x1 * 100}%" y1="${y1 * 100}%" x2="${x2 * 100}%" y2="${y2 * 100}%"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;
  const envelope =
    "M83 35 160 20Q168 18 175 24L222 67Q228 72 231 80L248 137Q250 144 246 152L216 204Q212 212 202 217L131 241Q121 245 113 239L48 189Q43 185 40 178L23 139Q19 130 23 122L75 43Q78 38 83 35Z";
  return `<defs>
    <clipPath id="${id}-body"><path d="${envelope}"/></clipPath>
    ${gradient("top", blend(colors.top, colors.glaze, 0.14), colors.top)}
    ${gradient("front", blend(colors.front, colors.glaze, 0.1), colors.front)}
    ${gradient("left", colors.left, blend(colors.left, colors.front, 0.16))}
    ${gradient("right", colors.right, blend(colors.right, colors.front, 0.12))}
    ${gradient("wall", colors.rim, colors.hole, 0, 0, 0, 1)}
    ${gradient("inside", colors.hole, blend(colors.hole, colors.rim, 0.12), 0, 0, 0, 1)}
  </defs>
  <g clip-path="url(#${id}-body)">
    <path d="${envelope}" fill="${colors.bottom}"/>
    <path d="M80 36 95 104Q97 111 91 121L46 184 23 139Q19 130 23 122L75 43Q78 38 80 36Z" fill="${fill("left")}"/>
    <path d="M99 112 174 127Q184 129 185 140L194 198Q196 207 187 211L124 242Q117 244 109 238L46 184 88 121Q93 111 99 112Z" fill="${fill("front")}"/>
    <path d="M224 73 248 137Q250 144 246 152L216 204Q212 212 204 215L202 215Q195 210 194 199L186 141Q184 132 191 125Z" fill="${fill("right")}"/>
    <path d="M80 36 160 20Q168 18 175 24L222 67Q229 73 222 80L187 123Q181 130 174 127L103 112Q95 111 92 102Z" fill="${fill("top")}"/>
    <g fill="none" stroke="${colors.glaze}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M81 38 92 101Q95 110 103 112L174 127Q181 130 187 123L222 80" stroke-width="1.8"/>
      <path d="M185 142 194 199Q195 207 200 211" stroke-width="1.1" opacity=".65"/>
      <path d="M88 125 48 181" stroke-width="1" opacity=".55"/>
    </g>
    <ellipse cx="149" cy="65" rx="34" ry="20" fill="${fill("wall")}"/>
    <ellipse cx="149" cy="71" rx="32" ry="15" fill="${fill("inside")}"/>
    <path d="M115 66C114 40 181 38 183 63" fill="none" stroke="${colors.glaze}" stroke-width="1.4" stroke-linecap="round"/>
    <g transform="rotate(17 54 116)">
      <ellipse cx="54" cy="116" rx="14" ry="30" fill="${fill("wall")}"/>
      <ellipse cx="56.5" cy="115" rx="11.5" ry="28.5" fill="${fill("inside")}"/>
      <path d="M51 86C32 91 33 139 50 146" fill="none" stroke="${colors.glaze}" stroke-width="1.3" stroke-linecap="round"/>
    </g>
    <ellipse cx="117" cy="177" rx="29" ry="31" fill="${fill("wall")}"/>
    <ellipse cx="119" cy="175.5" rx="26.5" ry="29.3" fill="${fill("inside")}"/>
    <path d="M89 177C88 216 139 217 146 184" fill="none" stroke="${colors.glaze}" stroke-width="1.5" stroke-linecap="round"/>
    <g transform="rotate(4 213 157)">
      <ellipse cx="213" cy="157" rx="16" ry="31" fill="${fill("wall")}"/>
      <ellipse cx="211" cy="156" rx="14" ry="29.5" fill="${fill("inside")}"/>
      <path d="M216 127C235 136 234 182 215 188" fill="none" stroke="${colors.glaze}" stroke-width="1.4" stroke-linecap="round"/>
    </g>
  </g>`;
}

export function ceramicSvg(palette = "sun", appearance = "light", customColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 272 272" fill="none"><g transform="translate(2 5)">${ceramicMarkup(ceramicColors(palette, appearance, customColor))}</g></svg>`;
}
