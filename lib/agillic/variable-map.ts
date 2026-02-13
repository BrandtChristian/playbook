/**
 * Convert Forge Liquid template variables to Agillic personalization syntax.
 *
 * Forge uses: {{ first_name }}, {{ last_name }}, {{ email }}, etc.
 * Agillic uses: <persondata>FIRSTNAME</persondata>
 *
 * The mapping is configurable per-org since Agillic field names vary by instance.
 */

/**
 * Default Liquid → Agillic field name mapping.
 * Covers the most common person data fields.
 */
export const DEFAULT_FIELD_MAP: Record<string, string> = {
  first_name: "FIRSTNAME",
  last_name: "LASTNAME",
  email: "EMAIL",
  phone: "PHONE",
  company: "COMPANY",
  job_title: "JOBTITLE",
  city: "CITY",
  country: "COUNTRY",
};

/**
 * Convert Liquid variables in HTML to Agillic personalization tags.
 *
 * Transforms {{ variable_name }} → <persondata>AGILLIC_FIELD</persondata>
 * Unknown variables are left as-is (won't break, just won't personalize).
 */
export function convertLiquidToAgillic(
  html: string,
  fieldMap: Record<string, string> = DEFAULT_FIELD_MAP
): string {
  // Match {{ variable_name }} with optional whitespace
  return html.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g,
    (_match, variableName: string) => {
      // Handle data.custom_field syntax
      const cleanName = variableName.startsWith("data.")
        ? variableName.slice(5)
        : variableName;

      const agillicField = fieldMap[cleanName];
      if (agillicField) {
        return `<persondata>${agillicField}</persondata>`;
      }

      // Try uppercase as a fallback (Agillic fields are often uppercase)
      return `<persondata>${cleanName.toUpperCase()}</persondata>`;
    }
  );
}

/**
 * Convert Agillic personalization tags back to Liquid (for preview/editing).
 */
export function convertAgillicToLiquid(
  html: string,
  fieldMap: Record<string, string> = DEFAULT_FIELD_MAP
): string {
  // Invert the map: FIRSTNAME → first_name
  const reverseMap: Record<string, string> = {};
  for (const [liquid, agillic] of Object.entries(fieldMap)) {
    reverseMap[agillic] = liquid;
  }

  return html.replace(
    /<persondata>([A-Z_]+)<\/persondata>/g,
    (_match, agillicField: string) => {
      const liquidName = reverseMap[agillicField];
      return liquidName ? `{{ ${liquidName} }}` : `{{ ${agillicField.toLowerCase()} }}`;
    }
  );
}

/**
 * Get the list of available Agillic personalization variables
 * for use in the AI system prompt and template editor hints.
 */
export function getAgillicVariableHints(
  fieldMap: Record<string, string> = DEFAULT_FIELD_MAP
): string[] {
  return Object.entries(fieldMap).map(
    ([liquid, agillic]) => `<persondata>${agillic}</persondata> ({{ ${liquid} }})`
  );
}
