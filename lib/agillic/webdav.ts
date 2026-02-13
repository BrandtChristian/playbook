/**
 * Agillic WebDAV client — fetch email templates from Agillic's template store.
 * Ported from Bifrost's webdav.ts / webdav API route, adapted for server-side use.
 */

const DEFAULT_WEBDAV_PATH =
  "/bcmportlet/webdav/bcm/media/templates/email/Bifrost/";

export interface WebDAVFile {
  name: string;
  lastModified?: string;
  size?: number;
}

export interface ParsedVariable {
  /** Raw variable string: "editable:headline" or "hero::hero-image|IMAGE|" */
  raw: string;
  /** Type: "editable" (rich text) or "blockparam" */
  type: "editable" | "blockparam";
  /** Field name for the Message API */
  fieldName: string;
  /** For blockparam: the data type (STRING, LINK, IMAGE) */
  dataType?: string;
  /** For blockparam: the default value */
  defaultValue?: string;
  /** For blockparam: the namespace (e.g., "hero", "header") */
  namespace?: string;
}

/**
 * List HTML template files from Agillic WebDAV.
 */
export async function listWebDAVTemplates(
  stagingUrl: string,
  username: string,
  password: string,
  webdavPath: string = DEFAULT_WEBDAV_PATH
): Promise<WebDAVFile[]> {
  const baseUrl = stagingUrl.replace(/\/$/, "");
  const url = `${baseUrl}${webdavPath}`;
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const response = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Authorization: `Basic ${auth}`,
      Depth: "1",
      "Content-Type": "application/xml",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
      <D:propfind xmlns:D="DAV:">
        <D:prop>
          <D:getlastmodified/>
          <D:getcontentlength/>
          <D:resourcetype/>
        </D:prop>
      </D:propfind>`,
  });

  if (!response.ok) {
    throw new Error(`WebDAV PROPFIND failed: ${response.status}`);
  }

  const xml = await response.text();

  // Simple XML parsing for WebDAV responses
  const files: WebDAVFile[] = [];
  const responseRegex = /<D:response>([\s\S]*?)<\/D:response>/g;
  let match;

  while ((match = responseRegex.exec(xml)) !== null) {
    const block = match[1];

    // Skip directories
    if (block.includes("<D:collection/>")) continue;

    const hrefMatch = block.match(/<D:href>([^<]+)<\/D:href>/);
    if (!hrefMatch) continue;

    const href = decodeURIComponent(hrefMatch[1]);
    const name = href.split("/").filter(Boolean).pop() || "";

    // Only HTML files
    if (!name.endsWith(".html")) continue;

    const lastModMatch = block.match(
      /<D:getlastmodified>([^<]+)<\/D:getlastmodified>/
    );
    const sizeMatch = block.match(
      /<D:getcontentlength>([^<]+)<\/D:getcontentlength>/
    );

    files.push({
      name,
      lastModified: lastModMatch?.[1] || undefined,
      size: sizeMatch ? parseInt(sizeMatch[1], 10) : undefined,
    });
  }

  return files;
}

/**
 * Fetch a single template's HTML content from WebDAV.
 */
export async function fetchWebDAVTemplate(
  stagingUrl: string,
  username: string,
  password: string,
  filename: string,
  webdavPath: string = DEFAULT_WEBDAV_PATH
): Promise<string> {
  const baseUrl = stagingUrl.replace(/\/$/, "");
  const url = `${baseUrl}${webdavPath}${encodeURIComponent(filename)}`;
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error(`WebDAV GET failed for ${filename}: ${response.status}`);
  }

  return response.text();
}

/**
 * Extract editable variables from Agillic template HTML.
 * Returns them in document order.
 *
 * Two types:
 * - blockparam: ${blockparam:namespace::id|TYPE|defaultValue}
 * - ageditable: <div ageditable="..." agid="fieldName">
 */
export function extractVariables(htmlContent: string): ParsedVariable[] {
  const results: { variable: ParsedVariable; position: number }[] = [];

  // blockparam variables
  const blockParamMatches = [
    ...htmlContent.matchAll(/\$\{blockparam:[^}]*\}/g),
  ];
  for (const match of blockParamMatches) {
    const inner = match[0].replace("${blockparam:", "").replace("}", "");
    const parts = inner.split("|");
    if (parts.length < 3) continue;

    const namespacePart = parts[0];
    const dataType = parts[1];
    const defaultValue = parts[2];

    if (!namespacePart.includes("::")) continue;
    const [namespace, id] = namespacePart.split("::");

    // Filter documentation examples and footer
    if (
      namespace === "namespace" ||
      id === "id" ||
      dataType === "TYPE" ||
      namespace === "Footer"
    )
      continue;

    results.push({
      variable: {
        raw: `${namespace}::${id}|${dataType}|${defaultValue}`,
        type: "blockparam",
        fieldName: id,
        dataType,
        defaultValue,
        namespace,
      },
      position: match.index || 0,
    });
  }

  // ageditable variables
  const editableMatches = [
    ...htmlContent.matchAll(
      /ageditable=["'][^"']*["'][^>]*agid=["']([^"']+)["']/g
    ),
  ];
  for (const match of editableMatches) {
    const agid = match[1];
    if (agid === "telephone") continue; // Filter footer

    results.push({
      variable: {
        raw: `editable:${agid}`,
        type: "editable",
        fieldName: agid,
      },
      position: match.index || 0,
    });
  }

  // Sort by position in document
  return results
    .sort((a, b) => a.position - b.position)
    .map((r) => r.variable);
}

/**
 * Block group structure extracted from the template HTML.
 * Used to construct the correct Message API payload.
 */
export interface TemplateBlockGroup {
  blockGroupId: string;  // e.g. "blockgroup-preheader"
  blockId: string;       // e.g. "block-preheader"
  messageTemplate?: string;  // e.g. "forge-preheader" - optional, can be derived from blockGroupId
}

/**
 * Extract block group and block IDs from Agillic template HTML.
 * These are defined by agblockgroup="true" agid="..." and agblock elements.
 */
export function extractBlockGroups(htmlContent: string): TemplateBlockGroup[] {
  const blockGroupIds: string[] = [];
  const blockIds: string[] = [];

  // Find blockgroup IDs: agblockgroup="true" ... agid="blockgroup-preheader"
  const bgMatches = [
    ...htmlContent.matchAll(/agblockgroup=["']true["'][^>]*agid=["']([^"']+)["']/g),
  ];
  for (const m of bgMatches) {
    blockGroupIds.push(m[1]);
  }

  // Find block IDs: agid="block-..." (block IDs start with "block-")
  const blockMatches = [
    ...htmlContent.matchAll(/agid=["'](block-[^"']+)["']/g),
  ];
  for (const m of blockMatches) {
    // Exclude blockgroup IDs (they also start with "block" via "blockgroup-")
    if (!m[1].startsWith("blockgroup-")) {
      blockIds.push(m[1]);
    }
  }

  // Pair them up (they appear in order in the HTML)
  return blockGroupIds.map((bgId, i) => ({
    blockGroupId: bgId,
    blockId: blockIds[i] || bgId.replace("blockgroup-", "block-"),
  }));
}
