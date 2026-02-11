import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Link,
  Img,
  Preview,
  Font,
} from "@react-email/components";

export type BrandConfig = {
  primary_color?: string;
  secondary_color?: string;
  header_bg_color?: string;
  text_color?: string;
  logo_url?: string;
  footer_text?: string;
};

interface BaseLayoutProps {
  previewText?: string;
  bodyHtml: string;
  fromName?: string;
  unsubscribeUrl?: string;
  brandConfig?: BrandConfig;
}

export function BaseEmailLayout({
  previewText,
  bodyHtml,
  fromName = "Your Company",
  unsubscribeUrl = "{{{ UNSUBSCRIBE_URL }}}",
  brandConfig,
}: BaseLayoutProps) {
  const bc = brandConfig || {};
  const headerBg = bc.header_bg_color || "#ffffff";
  const headerTextColor = isLightColor(headerBg) ? "#1a1a1a" : "#ffffff";
  const primaryColor = bc.primary_color || "#1a1a1a";

  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="DM Sans"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/dmsans/v15/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkJxhTmHn.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={{ ...header, backgroundColor: headerBg, borderBottom: headerBg === "#ffffff" ? "1px solid #e5e5e5" : "none" }}>
            {bc.logo_url ? (
              <table cellPadding="0" cellSpacing="0" border={0}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: "12px", verticalAlign: "middle" }}>
                      <Img src={bc.logo_url} alt={fromName} width="32" height="32" style={{ borderRadius: "4px" }} />
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      <Text style={{ ...headerTextStyle, color: headerTextColor }}>{fromName}</Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <Text style={{ ...headerTextStyle, color: headerTextColor }}>{fromName}</Text>
            )}
          </Section>

          {/* Body Content */}
          <Section style={content}>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footerSection}>
            {bc.footer_text && (
              <Text style={footerText}>{bc.footer_text}</Text>
            )}
            <Text style={footerText}>
              Sent by {fromName}
            </Text>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={{ ...unsubscribeLink, color: primaryColor }}>
                Unsubscribe
              </Link>
              {" · "}
              <Link href={unsubscribeUrl} style={{ ...unsubscribeLink, color: primaryColor }}>
                Manage preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

const main: React.CSSProperties = {
  backgroundColor: "#f6f6f6",
  fontFamily: "'DM Sans', Helvetica, Arial, sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
};

const header: React.CSSProperties = {
  padding: "24px 32px 16px",
};

const headerTextStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  margin: 0,
};

const content: React.CSSProperties = {
  padding: "24px 32px",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e5e5",
  margin: "0 32px",
};

const footerSection: React.CSSProperties = {
  padding: "16px 32px 24px",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  margin: "4px 0",
  lineHeight: "20px",
};

const unsubscribeLink: React.CSSProperties = {
  textDecoration: "underline",
};
