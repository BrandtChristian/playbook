// Block types for the visual email builder
// Blocks are the editing format — they serialize to body_html for storage/send.

export type HeadingBlock = {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
  align: "left" | "center" | "right";
};

export type TextBlock = {
  id: string;
  type: "text";
  html: string;
  align: "left" | "center" | "right";
};

export type ButtonBlock = {
  id: string;
  type: "button";
  text: string;
  url: string;
  align: "left" | "center" | "right";
  bgColor?: string;
  textColor?: string;
};

export type ImageBlock = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  width?: number;
  maxWidth?: number;
  align: "left" | "center" | "right";
};

export type DividerBlock = {
  id: string;
  type: "divider";
};

export type SpacerBlock = {
  id: string;
  type: "spacer";
  height: number;
};

export type EmailBlock =
  | HeadingBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock;

export type BlockType = EmailBlock["type"];

// --- Palette config ---

export type PaletteItem = {
  type: BlockType;
  label: string;
  icon: string; // Phosphor icon name
  factory: () => EmailBlock;
};

export const BLOCK_PALETTE: PaletteItem[] = [
  {
    type: "heading",
    label: "Heading",
    icon: "TextH",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "heading",
      level: 1,
      text: "Heading text",
      align: "left",
    }),
  },
  {
    type: "text",
    label: "Text",
    icon: "TextAa",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "text",
      html: "<p>Write your content here...</p>",
      align: "left",
    }),
  },
  {
    type: "button",
    label: "Button",
    icon: "CursorClick",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "button",
      text: "Click here",
      url: "https://example.com",
      align: "center",
    }),
  },
  {
    type: "image",
    label: "Image",
    icon: "Image",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "image",
      src: "",
      alt: "Image",
      width: 100,
      maxWidth: 600,
      align: "center",
    }),
  },
  {
    type: "divider",
    label: "Divider",
    icon: "Minus",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "divider",
    }),
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: "ArrowsVertical",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "spacer",
      height: 24,
    }),
  },
];

// --- Serialization: blocks → HTML ---

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializeBlock(block: EmailBlock): string {
  switch (block.type) {
    case "heading": {
      const tag = `h${block.level}`;
      return `<${tag} style="text-align: ${block.align}; margin: 0 0 16px 0;">${block.text}</${tag}>`;
    }
    case "text": {
      return `<div style="text-align: ${block.align}; line-height: 1.6; margin: 0 0 16px 0;">${block.html}</div>`;
    }
    case "button": {
      const bg = block.bgColor || "#ea580c";
      const fg = block.textColor || "#ffffff";
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px 0;"><tr><td align="${block.align}"><a href="${escapeHtml(block.url)}" style="background-color: ${bg}; color: ${fg}; padding: 12px 32px; text-decoration: none; font-weight: 600; display: inline-block;">${escapeHtml(block.text)}</a></td></tr></table>`;
    }
    case "image": {
      const w = block.width ? `${block.width}%` : "100%";
      const maxW = block.maxWidth ? `${block.maxWidth}px` : "100%";
      const img = `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" width="${w}" style="max-width: ${maxW}; height: auto; display: block;" />`;
      return `<div style="text-align: ${block.align}; margin: 0 0 16px 0;">${img}</div>`;
    }
    case "divider":
      return `<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 16px 0;" />`;
    case "spacer":
      return `<div style="height: ${block.height}px;"></div>`;
  }
}

export function serializeBlocks(blocks: EmailBlock[]): string {
  return blocks.map(serializeBlock).join("\n");
}

// --- Parsing: HTML → blocks ---

function extractAlign(el: HTMLElement): "left" | "center" | "right" {
  const ta = el.style?.textAlign;
  if (ta === "center" || ta === "right") return ta;
  const align = el.getAttribute("align");
  if (align === "center" || align === "right") return align;
  return "left";
}

function makeHeadingBlock(
  el: HTMLElement,
  level: 1 | 2 | 3
): HeadingBlock {
  return {
    id: crypto.randomUUID(),
    type: "heading",
    level,
    text: el.innerHTML.trim(),
    align: extractAlign(el),
  };
}

function makeTextBlock(html: string, el?: HTMLElement): TextBlock {
  return {
    id: crypto.randomUUID(),
    type: "text",
    html: html.trim(),
    align: el ? extractAlign(el) : "left",
  };
}

function makeButtonBlock(el: HTMLElement): ButtonBlock {
  const anchor = el.querySelector("a");
  return {
    id: crypto.randomUUID(),
    type: "button",
    text: anchor?.textContent?.trim() || "Button",
    url: anchor?.getAttribute("href") || "#",
    align: extractAlignFromTable(el),
    bgColor: anchor?.style?.backgroundColor || undefined,
    textColor: anchor?.style?.color || undefined,
  };
}

function extractAlignFromTable(
  el: HTMLElement
): "left" | "center" | "right" {
  const td = el.querySelector("td");
  const align = td?.getAttribute("align");
  if (align === "center" || align === "right") return align;
  return "center";
}

function makeImageBlock(el: HTMLElement): ImageBlock {
  const img =
    el.tagName === "IMG" ? el : el.querySelector("img");
  return {
    id: crypto.randomUUID(),
    type: "image",
    src: img?.getAttribute("src") || "",
    alt: img?.getAttribute("alt") || "",
    width: 100,
    align: extractAlign(el),
  };
}

function makeSpacerBlock(el: HTMLElement): SpacerBlock {
  const h = parseInt(el.style?.height || "24", 10);
  return {
    id: crypto.randomUUID(),
    type: "spacer",
    height: isNaN(h) ? 24 : h,
  };
}

export function parseHtmlToBlocks(html: string): EmailBlock[] {
  if (!html.trim()) return [];

  // Need DOMParser — only works in browser
  if (typeof window === "undefined") {
    return [
      { id: crypto.randomUUID(), type: "text", html, align: "left" },
    ];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild;
  if (!container) {
    return [
      { id: crypto.randomUUID(), type: "text", html, align: "left" },
    ];
  }

  const blocks: EmailBlock[] = [];

  for (const node of Array.from(container.childNodes)) {
    // Skip whitespace-only text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) blocks.push(makeTextBlock(`<p>${text}</p>`));
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "h1") {
      blocks.push(makeHeadingBlock(el, 1));
    } else if (tag === "h2") {
      blocks.push(makeHeadingBlock(el, 2));
    } else if (tag === "h3") {
      blocks.push(makeHeadingBlock(el, 3));
    } else if (tag === "hr") {
      blocks.push({ id: crypto.randomUUID(), type: "divider" });
    } else if (tag === "table" && el.querySelector("a")) {
      blocks.push(makeButtonBlock(el));
    } else if (
      tag === "img" ||
      (tag === "div" && el.querySelector("img") && !el.textContent?.trim())
    ) {
      blocks.push(makeImageBlock(el));
    } else if (
      tag === "div" &&
      !el.textContent?.trim() &&
      el.style?.height
    ) {
      blocks.push(makeSpacerBlock(el));
    } else if (tag === "p" || tag === "div" || tag === "ul" || tag === "ol") {
      blocks.push(makeTextBlock(el.outerHTML, el));
    } else {
      // Catch-all: wrap in text block
      blocks.push(makeTextBlock(el.outerHTML, el));
    }
  }

  return blocks.length > 0
    ? blocks
    : [{ id: crypto.randomUUID(), type: "text", html, align: "left" }];
}
