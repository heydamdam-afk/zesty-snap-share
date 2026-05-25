import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text, Hr } from "@react-email/components";

interface RecoveryEmailProps {
  siteName?: string;
  confirmationUrl: string;
  adminPrenom?: string;
}

export const RecoveryEmail = ({ siteName = "Kapsul", confirmationUrl, adminPrenom }: RecoveryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réinitialisation de votre mot de passe {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header rouge Kapsul */}
        <Section style={header}>
          <Text style={logo}>kapsul</Text>
        </Section>

        {/* Contenu principal */}
        <Section style={content}>
          <Heading style={h1}>Réinitialisez votre mot de passe</Heading>

          <Text style={text}>{adminPrenom ? `Bonjour ${adminPrenom},` : "Bonjour,"}</Text>

          <Text style={text}>
            Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte organisateur{" "}
            <strong>{siteName}</strong>.
          </Text>

          <Text style={text}>
            Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable{" "}
            <strong>24 heures</strong>.
          </Text>

          <Section style={buttonWrapper}>
            <Button style={button} href={confirmationUrl}>
              Réinitialiser mon mot de passe →
            </Button>
          </Section>

          <Hr style={divider} />

          <Text style={footer}>
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe restera inchangé.
          </Text>

          <Text style={footer}>
            Pour toute question, contactez-nous à{" "}
            <a href="mailto:hello@kapsul.app" style={link}>
              hello@kapsul.app
            </a>
          </Text>
        </Section>

        {/* Footer */}
        <Section style={footerSection}>
          <Text style={footerText}>© {new Date().getFullYear()} Kapsul — Partagez vos moments</Text>
          <Text style={footerText}>
            <a href="https://kapsul.app/privacy" style={footerLink}>
              Politique de confidentialité
            </a>
            {" · "}
            <a href="https://kapsul.app/terms" style={footerLink}>
              Conditions d'utilisation
            </a>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default RecoveryEmail;

// ─── Styles ───────────────────────────────────────────────────────────────────

const main = {
  backgroundColor: "#F4F6F8",
  fontFamily: "'Public Sans', Arial, sans-serif",
};

const container = {
  maxWidth: "560px",
  margin: "40px auto",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden" as const,
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
};

const header = {
  backgroundColor: "#FF4842",
  padding: "28px 40px",
  textAlign: "center" as const,
};

const logo = {
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: "700",
  letterSpacing: "-0.5px",
  margin: "0",
};

const content = {
  padding: "40px 40px 32px",
};

const h1 = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#1C1C1E",
  margin: "0 0 24px",
  letterSpacing: "-0.3px",
};

const text = {
  fontSize: "15px",
  color: "#454F5B",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const buttonWrapper = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#FF4842",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  borderRadius: "100px",
  padding: "14px 32px",
  textDecoration: "none",
  display: "inline-block",
};

const divider = {
  borderColor: "#F4F6F8",
  margin: "32px 0 24px",
};

const footer = {
  fontSize: "13px",
  color: "#919EAB",
  lineHeight: "1.5",
  margin: "0 0 12px",
};

const link = {
  color: "#FF4842",
  textDecoration: "none",
};

const footerSection = {
  backgroundColor: "#F4F6F8",
  padding: "20px 40px",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "12px",
  color: "#919EAB",
  margin: "0 0 6px",
};

const footerLink = {
  color: "#919EAB",
  textDecoration: "none",
};
