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
  Preview,
  Font,
} from "@react-email/components";

interface BaseLayoutProps {
  previewText?: string;
  bodyHtml: string;
  fromName?: string;
  unsubscribeUrl?: string;
}

export function BaseEmailLayout({
  previewText,
  bodyHtml,
  fromName = "Your Company",
  unsubscribeUrl = "{{{ UNSUBSCRIBE_URL }}}",
}: BaseLayoutProps) {
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
          <Section style={header}>
            <Text style={headerText}>{fromName}</Text>
          </Section>

          {/* Body Content (user's HTML+Liquid rendered) */}
          <Section style={content}>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              Sent by {fromName}
            </Text>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={unsubscribeLink}>
                Unsubscribe
              </Link>
              {" · "}
              <Link href="#" style={unsubscribeLink}>
                Manage preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
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
  borderBottom: "1px solid #e5e5e5",
};

const headerText: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: 0,
};

const content: React.CSSProperties = {
  padding: "24px 32px",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e5e5",
  margin: "0 32px",
};

const footer: React.CSSProperties = {
  padding: "16px 32px 24px",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  margin: "4px 0",
  lineHeight: "20px",
};

const unsubscribeLink: React.CSSProperties = {
  color: "#999999",
  textDecoration: "underline",
};
