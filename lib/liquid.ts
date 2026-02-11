import { Liquid } from "liquidjs";

export const liquid = new Liquid();

export const sampleData: Record<string, string> = {
  first_name: "Jane",
  last_name: "Smith",
  email: "jane@example.com",
  company: "Acme Inc",
};

export async function renderTemplate(
  template: string,
  data: Record<string, unknown> = sampleData
): Promise<string> {
  return liquid.parseAndRender(template, data);
}

export function liquidToResendVars(template: string): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
    return `{{{${name.toUpperCase()}|}}}`;
  });
}
