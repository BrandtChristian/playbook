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

export type SocialIconStyle = "color" | "grey" | "black" | "white";

export type SocialLinksBlock = {
  id: string;
  type: "social";
  align: "left" | "center" | "right";
  iconStyle: SocialIconStyle;
  links: { platform: string; url: string }[];
};

export type ColumnsBlock = {
  id: string;
  type: "columns";
  left: EmailBlock[];
  right: EmailBlock[];
};

export type QuoteBlock = {
  id: string;
  type: "quote";
  text: string;
  attribution: string;
  align: "left" | "center" | "right";
};

export type VideoBlock = {
  id: string;
  type: "video";
  thumbnailUrl: string;
  videoUrl: string;
  alt: string;
  align: "left" | "center" | "right";
};

export type HtmlBlock = {
  id: string;
  type: "html";
  code: string;
};

export type EmailBlock =
  | HeadingBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | SocialLinksBlock
  | ColumnsBlock
  | QuoteBlock
  | VideoBlock
  | HtmlBlock;

export type BlockType = EmailBlock["type"];

// --- Social platform defaults ---

const DEFAULT_SOCIALS: { platform: string; url: string }[] = [
  { platform: "twitter", url: "https://twitter.com/yourcompany" },
  { platform: "facebook", url: "https://facebook.com/yourcompany" },
  { platform: "instagram", url: "https://instagram.com/yourcompany" },
  { platform: "linkedin", url: "https://linkedin.com/company/yourcompany" },
];

// --- Palette config ---

export type PaletteItem = {
  type: BlockType;
  label: string;
  icon: string; // Phosphor icon name
  group?: string;
  factory: () => EmailBlock;
};

export const BLOCK_PALETTE: PaletteItem[] = [
  {
    type: "heading",
    label: "Heading",
    icon: "TextH",
    group: "Content",
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
    group: "Content",
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
    group: "Content",
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
    group: "Content",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "image",
      src: "",
      alt: "",
      width: 100,
      maxWidth: 600,
      align: "center",
    }),
  },
  {
    type: "quote",
    label: "Quote",
    icon: "Quotes",
    group: "Content",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "quote",
      text: "This product changed everything for our team.",
      attribution: "Jane Smith, CEO",
      align: "left",
    }),
  },
  {
    type: "video",
    label: "Video",
    icon: "PlayCircle",
    group: "Content",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "video",
      thumbnailUrl: "",
      videoUrl: "https://youtube.com/watch?v=example",
      alt: "Watch video",
      align: "center",
    }),
  },
  {
    type: "columns",
    label: "Columns",
    icon: "Columns",
    group: "Layout",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "columns",
      left: [{ id: crypto.randomUUID(), type: "text" as const, html: "<p>Left column</p>", align: "left" as const }],
      right: [{ id: crypto.randomUUID(), type: "text" as const, html: "<p>Right column</p>", align: "left" as const }],
    }),
  },
  {
    type: "social",
    label: "Social",
    icon: "ShareNetwork",
    group: "Layout",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "social",
      align: "center",
      iconStyle: "color" as const,
      links: [...DEFAULT_SOCIALS],
    }),
  },
  {
    type: "divider",
    label: "Divider",
    icon: "Minus",
    group: "Layout",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "divider",
    }),
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: "ArrowsVertical",
    group: "Layout",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "spacer",
      height: 24,
    }),
  },
  {
    type: "html",
    label: "HTML",
    icon: "Code",
    group: "Layout",
    factory: () => ({
      id: crypto.randomUUID(),
      type: "html",
      code: "<!-- Custom HTML here -->",
    }),
  },
];

// --- Social icon PNGs ---
// CDN-hosted icons for email compatibility (self-hosted icons get blocked by
// ProtonMail, Gmail image proxies, etc. when served from non-standard ports).
// Falls back to app-hosted icons for non-color styles.

function getBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

const SOCIAL_ICON_ALT: Record<string, string> = {
  twitter: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
};

// CDN-hosted color icons (Simple Icons via cdn.simpleicons.org)
const CDN_SOCIAL_ICONS: Record<string, { slug: string; color: string }> = {
  twitter: { slug: "x", color: "000000" },
  facebook: { slug: "facebook", color: "0866FF" },
  instagram: { slug: "instagram", color: "E4405F" },
  linkedin: { slug: "linkedin", color: "0A66C2" },
  youtube: { slug: "youtube", color: "FF0000" },
  tiktok: { slug: "tiktok", color: "000000" },
};

const ICON_STYLE_DIR: Record<SocialIconStyle, string> = {
  color: "social",
  grey: "social-grey",
  black: "social-black",
  white: "social-white",
};

function getSocialIcon(platform: string, style: SocialIconStyle = "color"): string {
  const alt = SOCIAL_ICON_ALT[platform];
  if (!alt) return "";

  const cdn = CDN_SOCIAL_ICONS[platform];
  if (cdn) {
    let iconColor: string;
    switch (style) {
      case "color": iconColor = cdn.color; break;
      case "grey": iconColor = "9CA3AF"; break;
      case "black": iconColor = "1C1917"; break;
      case "white": iconColor = "FFFFFF"; break;
    }
    const src = `https://cdn.simpleicons.org/${cdn.slug}/${iconColor}`;
    return `<img src="${src}" alt="${alt}" width="20" height="20" style="display:inline-block;" />`;
  }

  // Fallback to self-hosted
  const base = getBaseUrl();
  const dir = ICON_STYLE_DIR[style];
  return `<img src="${base}/icons/${dir}/${platform}.png" alt="${alt}" width="20" height="20" style="display:inline-block;" />`;
}

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
      const bg = block.bgColor || "#6366f1";
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
    case "social": {
      const icons = block.links
        .map((l) => {
          const icon = getSocialIcon(l.platform, block.iconStyle) || escapeHtml(l.platform);
          return `<a href="${escapeHtml(l.url)}" style="display: inline-block; margin: 0 6px; text-decoration: none;">${icon}</a>`;
        })
        .join("");
      return `<div style="text-align: ${block.align}; margin: 0 0 16px 0; padding: 8px 0;">${icons}</div>`;
    }
    case "columns": {
      const leftHtml = block.left.map(serializeBlock).join("\n");
      const rightHtml = block.right.map(serializeBlock).join("\n");
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px 0;"><tr><td width="50%" valign="top" style="padding-right: 12px; line-height: 1.6;">${leftHtml}</td><td width="50%" valign="top" style="padding-left: 12px; line-height: 1.6;">${rightHtml}</td></tr></table>`;
    }
    case "quote": {
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px 0;"><tr><td style="border-left: 3px solid #6366f1; padding: 12px 20px; font-style: italic; color: #57534e; text-align: ${block.align};">"${block.text}"<br/><span style="font-style: normal; font-size: 13px; color: #a8a29e; margin-top: 8px; display: inline-block;">— ${escapeHtml(block.attribution)}</span></td></tr></table>`;
    }
    case "video": {
      const thumb = block.thumbnailUrl || "https://placehold.co/600x338/1c1917/f5f5f4?text=%E2%96%B6+Play+Video";
      return `<div style="text-align: ${block.align}; margin: 0 0 16px 0;"><a href="${escapeHtml(block.videoUrl)}" style="display: inline-block; position: relative;"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(block.alt)}" width="100%" style="max-width: 600px; height: auto; display: block;" /></a></div>`;
    }
    case "html": {
      return block.code;
    }
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

function makeHeadingBlock(el: HTMLElement, level: 1 | 2 | 3): HeadingBlock {
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

function extractAlignFromTable(el: HTMLElement): "left" | "center" | "right" {
  const td = el.querySelector("td");
  const align = td?.getAttribute("align");
  if (align === "center" || align === "right") return align;
  return "center";
}

function makeImageBlock(el: HTMLElement): ImageBlock {
  const img = el.tagName === "IMG" ? el : el.querySelector("img");
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

// Detect social block: <div> with multiple <a> children containing social icon images
function isSocialBlock(el: HTMLElement): boolean {
  const links = el.querySelectorAll(":scope > a");
  if (links.length < 2) return false;
  return Array.from(links).every(
    (a) => a.querySelector("img[src*='/icons/social']")
  );
}

const ICON_DIR_TO_STYLE: Record<string, SocialIconStyle> = {
  social: "color",
  "social-grey": "grey",
  "social-black": "black",
  "social-white": "white",
};

function parseSocialBlock(el: HTMLElement): SocialLinksBlock {
  const links: { platform: string; url: string }[] = [];
  let iconStyle: SocialIconStyle = "color";

  for (const a of Array.from(el.querySelectorAll(":scope > a"))) {
    const url = a.getAttribute("href") || "";
    const img = a.querySelector("img") as HTMLImageElement | null;
    if (img?.src) {
      // Extract platform from src like ".../icons/social/twitter.png"
      const match = img.src.match(/\/icons\/(social(?:-\w+)?)\/(\w+)\.png/);
      if (match) {
        iconStyle = ICON_DIR_TO_STYLE[match[1]] || "color";
        links.push({ platform: match[2], url });
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    type: "social",
    align: extractAlign(el),
    iconStyle,
    links: links.length > 0 ? links : [...DEFAULT_SOCIALS],
  };
}

export function parseHtmlToBlocks(html: string): EmailBlock[] {
  if (!html.trim()) return [];

  if (typeof window === "undefined") {
    return [{ id: crypto.randomUUID(), type: "text", html, align: "left" }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild;
  if (!container) {
    return [{ id: crypto.randomUUID(), type: "text", html, align: "left" }];
  }

  const blocks: EmailBlock[] = [];

  for (const node of Array.from(container.childNodes)) {
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
    } else if (tag === "blockquote") {
      blocks.push({
        id: crypto.randomUUID(),
        type: "quote",
        text: el.textContent?.trim() || "",
        attribution: "",
        align: extractAlign(el),
      });
    } else if (tag === "table") {
      const tds = el.querySelectorAll(":scope > tbody > tr > td, :scope > tr > td");
      const hasButtonLink = !!el.querySelector("a[style*='background']");

      if (tds.length === 2 && !hasButtonLink) {
        // 2-column layout
        blocks.push({
          id: crypto.randomUUID(),
          type: "columns",
          left: parseHtmlToBlocks(tds[0].innerHTML.trim()),
          right: parseHtmlToBlocks(tds[1].innerHTML.trim()),
        });
      } else if (el.querySelector("a")) {
        blocks.push(makeButtonBlock(el));
      } else {
        blocks.push(makeTextBlock(el.outerHTML, el));
      }
    } else if (tag === "div" && isSocialBlock(el)) {
      blocks.push(parseSocialBlock(el));
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
      blocks.push(makeTextBlock(el.outerHTML, el));
    }
  }

  return blocks.length > 0
    ? blocks
    : [{ id: crypto.randomUUID(), type: "text", html, align: "left" }];
}
