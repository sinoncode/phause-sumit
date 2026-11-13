import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHead } from "../../components/shell/PageHead";
import {
  listTemplates,
  createTemplate as createTemplateApi,
  updateTemplate as updateTemplateApi,
  deleteTemplate as deleteTemplateApi,
} from "../../api/templates/templates.api";
import { useApiErrorHandler } from "../../hooks/useApiErrorHandler";
import { useCustomizer } from "../../context/CustomizerContext";

export type TemplateLureType = "urgency" | "authority" | "curiosity" | "reward";
export type TemplateCategory =
  | "credential-harvest"
  | "attachment"
  | "link-click"
  | "awareness"
  | "data-entry";
export type TemplateDifficulty = "easy" | "medium" | "hard";

export interface PhishingTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  lureType: TemplateLureType;
  category: TemplateCategory;
  difficulty: TemplateDifficulty;
  disclaimerEnabled: boolean;
  isPremium: boolean;
  isLocked: boolean;
}

type TemplateFormValues = Omit<PhishingTemplate, "id">;
type ModalState =
  | "create"
  | "choose-create"
  | { edit: PhishingTemplate }
  | { preview: PhishingTemplate }
  | { detail: PhishingTemplate }
  | null;

const LURE_TYPES: Array<{ value: TemplateLureType; label: string }> = [
  { value: "urgency", label: "Urgency" },
  { value: "authority", label: "Authority" },
  { value: "curiosity", label: "Curiosity" },
  { value: "reward", label: "Reward" },
];
const CATEGORIES: Array<{ value: TemplateCategory; label: string }> = [
  { value: "credential-harvest", label: "Credential harvest" },
  { value: "attachment", label: "Malicious attachment" },
  { value: "link-click", label: "Link click" },
  { value: "awareness", label: "Security awareness" },
  { value: "data-entry", label: "Data entry" },
];
const DIFFICULTIES: TemplateDifficulty[] = ["easy", "medium", "hard"];

const ICON_PLUS = (
  <svg
    className="ax-btn__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ICON_EYE = (
  <svg
    className="ax-btn__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
const ICON_EDIT = (
  <svg
    className="ax-btn__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m4 16 0 4 4 0 11-11a2.8 2.8 0 0 0-4-4L4 16Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);
const ICON_DELETE = (
  <svg
    className="ax-btn__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12h12l1-12M9 7V4h6v3" />
  </svg>
);
const ICON_CLOSE = (
  <svg
    className="ax-btn__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

const labelFor = <T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T,
) => options.find((option) => option.value === value)?.label ?? value;

const getTemplatePreviewHtml = (html: string) =>
  html
    .replaceAll("{{tracking_link}}", "#preview-link")
    .replaceAll(
      "{{tracking_pixel}}",
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
    );

const getTemplatePreviewDocument = (
  html: string,
  theme: "light" | "dark",
  padding: number,
) => {
  const isDark = theme === "dark";
  const background = isDark ? "#0A0C11" : "#FFFFFF";
  const color = isDark ? "#D4DAE4" : "#3A4456";

  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:${theme}}body{box-sizing:border-box;margin:0;padding:${padding}px;font:14px/1.5 Arial,sans-serif;color:${color};background:${background};overflow-wrap:anywhere}img{max-width:100%;height:auto}</style></head><body>${getTemplatePreviewHtml(html)}</body></html>`;
};

function TemplateForm({
  initial,
  mode,
  theme,
  onCancel,
  onSubmit,
}: {
  initial?: PhishingTemplate;
  mode: "create" | "edit";
  theme: "light" | "dark";
  onCancel: () => void;
  onSubmit: (values: TemplateFormValues) => void;
}) {
  const [form, setForm] = useState<TemplateFormValues>(
    initial ?? {
      name: "",
      subject: "",
      htmlBody: "",
      textBody: "",
      lureType: "urgency",
      category: "credential-harvest",
      difficulty: "medium",
      disclaimerEnabled: false,
      isPremium: false,
      isLocked: false,
    },
  );
  const set = <K extends keyof TemplateFormValues>(
    key: K,
    value: TemplateFormValues[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(form);
  };
  return (
    <div
      className="tpl-modal-overlay"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onCancel()
      }
    >
      <div
        className="ax-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-form-title"
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title" id="template-form-title">
              {mode === "create"
                ? "Create phishing template"
                : "Edit phishing template"}
            </h2>
            <p className="ax-card__subtitle">
              Define the message and simulation metadata.
            </p>
          </div>
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
            aria-label="Close"
            onClick={onCancel}
          >
            {ICON_CLOSE}
          </button>
        </div>
        <form onSubmit={submit}>
          <div
            className="ax-card__body"
            style={{ display: "grid", gap: "var(--ax-space-4)" }}
          >
            <div className="ax-field">
              <label className="ax-label" htmlFor="template-name">
                Name
              </label>
              <input
                id="template-name"
                className="ax-input"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Urgent IT Password Reset"
                required
              />
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="template-subject">
                Subject
              </label>
              <input
                id="template-subject"
                className="ax-input"
                value={form.subject}
                onChange={(event) => set("subject", event.target.value)}
                placeholder="[ACTION REQUIRED] Your password will expire"
                required
              />
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="template-html">
                HTML body
              </label>
              <textarea
                id="template-html"
                className="ax-textarea"
                rows={8}
                value={form.htmlBody}
                onChange={(event) => set("htmlBody", event.target.value)}
                required
              />
              <div style={{ marginBlockStart: "var(--ax-space-3)" }}>
                <span className="ax-label">Live preview</span>
                <iframe
                  title="Live phishing template preview"
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={getTemplatePreviewDocument(form.htmlBody, theme, 20)}
                  style={{
                    display: "block",
                    width: "100%",
                    minHeight: 220,
                    marginBlockStart: "var(--ax-space-2)",
                    border: "1px solid var(--ax-border)",
                    borderRadius: "var(--ax-radius-md)",
                    background: "var(--ax-surface-solid)",
                  }}
                />
              </div>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="template-text">
                Text body
              </label>
              <textarea
                id="template-text"
                className="ax-textarea"
                rows={4}
                value={form.textBody}
                onChange={(event) => set("textBody", event.target.value)}
                required
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "var(--ax-space-3)",
              }}
            >
              <div className="ax-field">
                <label className="ax-label" htmlFor="template-lure">
                  Lure type
                </label>
                <select
                  id="template-lure"
                  className="ax-select"
                  value={form.lureType}
                  onChange={(event) =>
                    set("lureType", event.target.value as TemplateLureType)
                  }
                >
                  {LURE_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="template-category">
                  Category
                </label>
                <select
                  id="template-category"
                  className="ax-select"
                  value={form.category}
                  onChange={(event) =>
                    set("category", event.target.value as TemplateCategory)
                  }
                >
                  {CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="template-difficulty">
                  Difficulty
                </label>
                <select
                  id="template-difficulty"
                  className="ax-select"
                  value={form.difficulty}
                  onChange={(event) =>
                    set("difficulty", event.target.value as TemplateDifficulty)
                  }
                >
                  {DIFFICULTIES.map((value) => (
                    <option key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <section className="tpl-form-settings" aria-label="Template access settings">
              <div className="tpl-form-settings__header">
                <div>
                  <h3>Access settings</h3>
                  <p>Control whether this template is premium or locked.</p>
                </div>
              </div>
              <div className="tpl-form-settings__grid">
                <div className={`tpl-setting${form.isPremium ? " is-active" : ""}`}>
                  <div className="tpl-setting__copy">
                    <span className="tpl-setting__title">Premium template</span>
                    <span className="tpl-setting__description">
                      Mark this template as part of a premium offering.
                    </span>
                    <span className="tpl-setting__state">
                      {form.isPremium ? "Premium enabled" : "Standard access"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="tpl-switch"
                    role="switch"
                    aria-checked={form.isPremium}
                    aria-label="Premium template"
                    onClick={() => set("isPremium", !form.isPremium)}
                  >
                    <span className="tpl-switch__thumb" />
                  </button>
                </div>
                <div className={`tpl-setting${form.isLocked ? " is-active is-locked" : ""}`}>
                  <div className="tpl-setting__copy">
                    <span className="tpl-setting__title">Lock template</span>
                    <span className="tpl-setting__description">
                      Prevent this template from being selected until unlocked.
                    </span>
                    <span className="tpl-setting__state tpl-setting__state--locked">
                      {form.isLocked ? "Locked" : "Available"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="tpl-switch"
                    role="switch"
                    aria-checked={form.isLocked}
                    aria-label="Lock template"
                    onClick={() => set("isLocked", !form.isLocked)}
                  >
                    <span className="tpl-switch__thumb" />
                  </button>
                </div>
              </div>
            </section>
            <label className="ax-check">
              <input
                type="checkbox"
                className="ax-checkbox"
                checked={form.disclaimerEnabled}
                onChange={(event) =>
                  set("disclaimerEnabled", event.target.checked)
                }
              />
              <span>Include organisation disclaimer</span>
            </label>
          </div>
          <div
            className="ax-card__footer ax-cluster"
            style={{ justifyContent: "flex-end", gap: "var(--ax-space-3)" }}
          >
            <button
              type="button"
              className="ax-btn ax-btn--secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button type="submit" className="ax-btn ax-btn--primary">
              {mode === "create" ? "Create template" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemplatePreview({
  template,
  theme,
  onClose,
}: {
  template: PhishingTemplate;
  theme: "light" | "dark";
  onClose: () => void;
}) {
  const renderedHtml = template.htmlBody
    .replaceAll("{{tracking_link}}", "#preview-link")
    .replaceAll(
      "{{tracking_pixel}}",
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
    );

  const emailBackground = theme === "dark" ? "#0A0C11" : "#FFFFFF";
  const emailText = theme === "dark" ? "#D4DAE4" : "#3A4456";

  const emailDocument = `
    <!DOCTYPE html>
    <html lang="en" style="color-scheme: ${theme}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            background: ${emailBackground};
            color: ${emailText};
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.5;
            overflow-wrap: anywhere;
          }
          img { max-width: 100%; height: auto; }
          table { max-width: 100%; }
          a { cursor: pointer; }
          @media(max-width:600px) {
            body { padding: 12px; }
          }
        </style>
      </head>
      <body>
        ${renderedHtml}
      </body>
    </html>
  `;

  const [activeFolder, setActiveFolder] = useState("Inbox");
  const [showIdentityEditor, setShowIdentityEditor] = useState(false);

  const folders = [
    { icon: "▣", label: "Inbox", count: "6" },
    { icon: "☆", label: "Starred" },
    { icon: "▤", label: "Draft", count: "3" },
    { icon: "➤", label: "Sent Mail" },
    { icon: "ⓘ", label: "Spam" },
    { icon: "▱", label: "Trash" },
  ];

  const labels = [
    { label: "Work", color: "#ea5535" },
    { label: "Business", color: "#25a8e8" },
    { label: "Family", color: "#ffb841" },
    { label: "Friends", color: "#315bb0" },
  ];

  return (
    <div className="mail-preview-overlay" data-ax-theme={theme}>

    <style>{`
  /* =========================================
     PH AUSE EMAIL PREVIEW — THEME SYSTEM
  ========================================= */

  .mail-preview-overlay {
    --mp-bg: var(--ax-canvas);
    --mp-surface: var(--ax-surface-overlay);
    --mp-surface-secondary: var(--ax-surface-subtle);
    --mp-surface-hover: var(--ax-fill-hover);
    --mp-text: var(--ax-text);
    --mp-text-strong: var(--ax-text-strong);
    --mp-text-muted: var(--ax-text-muted);
    --mp-border: var(--ax-border);
    --mp-border-strong: var(--ax-border-strong);
    --mp-primary: var(--ax-accent);
    --mp-primary-soft: var(--ax-accent-wash);
    --mp-button-bg: var(--ax-surface);
    --mp-button-text: var(--ax-text);
    --mp-shadow: var(--ax-shadow-lg);

    color-scheme: light;

    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--ax-backdrop);
    backdrop-filter: blur(9px);
    animation: mailFade .2s ease;
  }

  .mail-preview-overlay[data-ax-theme="dark"] {
    color-scheme: dark;
  }

  /* =========================================
     MAIN MODAL
  ========================================= */

  .mail-preview {
    width: 100%;
    max-width: 1240px;
    height: min(900px, 94vh);

    display: flex;
    flex-direction: column;

    background: var(--mp-bg);
    color: var(--mp-text);

    border: 1px solid var(--mp-border);
    border-radius: 15px;

    overflow: hidden;
    box-shadow: var(--mp-shadow);

    animation: mailSlide .25s ease;

    transition:
      background .25s ease,
      border-color .25s ease,
      color .25s ease;
  }

  /* =========================================
     HEADER
  ========================================= */

  .mail-preview-header {
    min-height: 66px;
    padding: 12px 24px;

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    background: var(--mp-surface);
    border-bottom: 1px solid var(--mp-border);
  }

  .mail-preview-title {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .mail-preview-icon {
    width: 40px;
    height: 40px;

    display: grid;
    place-items: center;

    background: var(--mp-primary-soft);
    color: var(--mp-primary);

    border: 1px solid var(--mp-border);
    border-radius: 12px;

    font-size: 21px;
    flex-shrink: 0;
  }

  .mail-preview-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .7px;
    color: var(--mp-primary);
    text-transform: uppercase;
    margin-bottom: 3px;
  }

  .mail-preview-name {
    font-size: 17px;
    font-weight: 650;
    color: var(--mp-text-strong);

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mail-preview-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .mail-preview-badge {
    padding: 5px 11px;
    border-radius: 20px;

    background: var(--mp-surface-secondary);
    color: var(--mp-text-muted);

    border: 1px solid var(--mp-border);

    font-size: 11px;
    white-space: nowrap;
  }

  .mail-preview-badge--difficulty-easy {
    background: var(--ax-success-50);
    color: var(--ax-success-500);
    border-color: var(--ax-success-200);
  }

  .mail-preview-badge--difficulty-medium {
    background: var(--ax-warning-50);
    color: var(--ax-warning-500);
    border-color: var(--ax-warning-200);
  }

  .mail-preview-badge--difficulty-hard {
    background: var(--ax-danger-50);
    color: var(--ax-danger-500);
    border-color: var(--ax-danger-200);
  }

  .mail-preview-badge--premium {
    background: var(--ax-accent-wash);
    color: var(--ax-accent);
    border-color: var(--ax-accent);
  }

  .mail-preview-badge--locked {
    background: var(--ax-danger-50);
    color: var(--ax-danger-500);
    border-color: var(--ax-danger-200);
  }

  .mail-preview-close {
    border: none;
    background: transparent;
    color: var(--mp-text-muted);

    font-size: 25px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;

    transition: color .2s ease;
  }

  .mail-preview-close:hover {
    color: var(--ax-danger-500);
  }

  /* =========================================
     EMPLOYEE IDENTITY BAR
  ========================================= */

  .mail-preview-identity {
    min-height: 50px;
    padding: 10px 25px;

    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    background: var(--mp-surface-secondary);
    border-bottom: 1px solid var(--mp-border);

    color: var(--mp-text-muted);
    font-size: 13px;
  }

  .mail-preview-identity strong {
    color: var(--mp-text-strong) !important;
  }

  .mail-preview-identity button {
    border: none;
    background: transparent;
    color: var(--mp-primary);

    font-weight: 600;
    cursor: pointer;
    margin-left: 8px;
  }

  .mail-preview-identity button:hover {
    text-decoration: underline;
  }

  /* =========================================
     IDENTITY EDITOR
  ========================================= */

  .mail-preview-overlay .mail-preview-identity + div {
    background: var(--mp-surface-secondary) !important;
    border-bottom: 1px solid var(--mp-border) !important;
    color: var(--mp-text) !important;
  }

  /* =========================================
     MAIN WORKSPACE
  ========================================= */

  .mail-preview-workspace {
    flex: 1;
    min-height: 0;

    display: grid;
    grid-template-columns: 216px minmax(0, 1fr);

    padding: 0 24px;
    overflow: hidden;

    background: var(--mp-bg);
  }

  /* =========================================
     SIDEBAR
  ========================================= */

  .mail-preview-sidebar {
    padding: 16px 12px;

    background: var(--mp-surface-secondary);

    border-left: 1px solid var(--mp-border);
    border-right: 1px solid var(--mp-border);

    overflow-y: auto;
  }

  .mail-send-button {
    width: 100%;
    height: 44px;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;

    background: var(--mp-primary);
    color: var(--ax-on-accent);

    border: none;
    border-radius: 11px;

    font-size: 13px;
    font-weight: 600;

    cursor: pointer;

    box-shadow: var(--ax-glow-accent);

    transition: .2s ease;
  }

  .mail-send-button:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .mail-sidebar-heading {
    margin: 22px 10px 10px;

    color: var(--mp-text-muted);

    font-size: 10px;
    font-weight: 700;
    letter-spacing: .8px;
    text-transform: uppercase;
  }

  .mail-folder {
    width: 100%;
    height: 36px;

    display: flex;
    align-items: center;
    gap: 12px;

    padding: 0 10px;

    border: none;
    border-radius: 9px;

    background: transparent;
    color: var(--mp-text);

    font-size: 13px;
    text-align: left;

    cursor: pointer;
    transition: .2s ease;
  }

  .mail-folder:hover {
    background: var(--mp-surface-hover);
  }

  .mail-folder.active {
    background: var(--mp-primary-soft);
    color: var(--mp-primary);
    font-weight: 650;
  }

  .mail-folder-icon {
    width: 16px;
    font-size: 17px;
    color: var(--mp-text-muted);
  }

  .mail-folder-count {
    margin-left: auto;

    background: var(--mp-primary);
    color: var(--ax-on-accent);

    padding: 2px 8px;
    border-radius: 20px;

    font-size: 10px;
  }

  .mail-label {
    height: 36px;

    display: flex;
    align-items: center;
    gap: 13px;

    padding: 0 12px;

    font-size: 13px;
    color: var(--mp-text);
  }

  .mail-label-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  /* =========================================
     EMAIL CONTENT AREA
  ========================================= */

  .mail-content {
    min-width: 0;
    min-height: 0;

    display: flex;
    flex-direction: column;

    padding: 20px 24px 0;

    overflow-y: auto;

    background: var(--mp-bg);
    color: var(--mp-text);
  }

  .mail-subject {
    font-size: 19px;
    font-weight: 650;

    color: var(--mp-text-strong);

    margin: 0 0 14px;
  }

  .mail-sender {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 15px;
  }

  .mail-sender-avatar {
    width: 40px;
    height: 40px;

    border-radius: 50%;

    background: var(--ax-accent);
    display: grid;
    place-items: center;

    color: white;
    font-size: 20px;
    flex-shrink: 0;
  }

  .mail-sender-name {
    font-size: 14px;
    font-weight: 650;
    color: var(--mp-text-strong);
  }

  .mail-sender-address {
    font-size: 12px;
    color: var(--mp-text-muted);
    margin-top: 3px;
  }

  /* The message canvas follows the selected theme; author-provided email
     colors remain intact so branded templates still preview faithfully. */

  .mail-body-container {
    flex: 1;
    min-height: 360px;

    border: 1px solid var(--mp-border);
    border-radius: 11px 11px 0 0;

    overflow: hidden;

    background: var(--ax-surface-solid);
  }

  .mail-body-container iframe {
    width: 100%;
    height: 100%;
    min-height: 520px;

    display: block;

    border: none;
    background: var(--ax-surface-solid);
    color-scheme: inherit;
  }

  /* =========================================
     FOOTER
  ========================================= */

  .mail-preview-footer {
    min-height: 69px;
    padding: 10px 24px;

    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    border-top: 1px solid var(--mp-border);

    background: var(--mp-surface);
  }

  .mail-footer-hint {
    font-size: 13px;
    color: var(--mp-text-muted);
  }

  .mail-footer-actions {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .mail-nav-button {
    width: 40px;
    height: 40px;

    border: 1px solid var(--mp-border-strong);
    border-radius: 9px;

    background: var(--mp-button-bg);
    color: var(--mp-button-text);

    font-size: 22px;
    cursor: pointer;

    transition: .2s ease;
  }

  .mail-nav-button:hover:not(:disabled) {
    background: var(--mp-surface-hover);
    border-color: var(--mp-primary);
    color: var(--mp-primary);
  }

  .mail-nav-button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .mail-page-count {
    font-size: 12px;
    color: var(--mp-text-muted);
    padding: 0 5px;
    white-space: nowrap;
  }

  .mail-close-button {
    height: 40px;
    padding: 0 20px;

    background: var(--mp-button-bg);

    border: 1px solid var(--mp-border-strong);
    border-radius: 9px;

    color: var(--mp-button-text);

    font-size: 13px;
    cursor: pointer;

    transition: .2s ease;
  }

  .mail-close-button:hover {
    background: var(--mp-surface-hover);
    border-color: var(--mp-primary);
    color: var(--mp-primary);
  }

  /* =========================================
     SCROLLBARS
  ========================================= */

  .mail-preview-sidebar::-webkit-scrollbar,
  .mail-content::-webkit-scrollbar {
    width: 6px;
  }

  .mail-preview-sidebar::-webkit-scrollbar-thumb,
  .mail-content::-webkit-scrollbar-thumb {
    background: var(--mp-border-strong);
    border-radius: 20px;
  }

  .mail-preview-sidebar::-webkit-scrollbar-thumb:hover,
  .mail-content::-webkit-scrollbar-thumb:hover {
    background: var(--mp-text-muted);
  }

  /* =========================================
     ANIMATIONS
  ========================================= */

  @keyframes mailFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes mailSlide {
    from {
      opacity: 0;
      transform: translateY(12px) scale(.99);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* =========================================
     TABLET RESPONSIVENESS
  ========================================= */

  @media(max-width: 850px) {
    .mail-preview-overlay {
      padding: 10px;
    }

    .mail-preview {
      height: 96vh;
    }

    .mail-preview-workspace {
      grid-template-columns: 165px minmax(0,1fr);
      padding: 0 12px;
    }

    .mail-preview-content {
      padding: 16px 12px 0;
    }

    .mail-preview-identity {
      flex-wrap: wrap;
    }

    .mail-preview-meta {
      gap: 4px;
    }
  }

  /* =========================================
     MOBILE RESPONSIVENESS
  ========================================= */

  @media(max-width: 600px) {
    .mail-preview-overlay {
      padding: 6px;
    }

    .mail-preview {
      height: 98vh;
      border-radius: 12px;
    }

    .mail-preview-header {
      padding: 12px;
    }

    .mail-preview-icon {
      width: 34px;
      height: 34px;
    }

    .mail-preview-name {
      font-size: 14px;
    }

    .mail-preview-meta .mail-preview-badge:nth-child(n+2) {
      display: none;
    }

    .mail-preview-workspace {
      display: flex;
      padding: 0;
    }

    .mail-preview-sidebar {
      display: none;
    }

    .mail-content {
      padding: 16px 12px 0;
    }

    .mail-subject {
      font-size: 16px;
    }

    .mail-preview-footer {
      padding: 10px 12px;
    }

    .mail-footer-hint {
      display: none;
    }

    .mail-page-count {
      font-size: 11px;
    }
  }

  /* =========================================
     REDUCED MOTION ACCESSIBILITY
  ========================================= */

  @media(prefers-reduced-motion: reduce) {
    .mail-preview-overlay,
    .mail-preview,
    .mail-folder,
    .mail-nav-button,
    .mail-close-button {
      animation: none !important;
      transition: none !important;
    }
  }
`}</style>

      {/* HEADER */}
      <div
        className="mail-preview"
        role="dialog"
        aria-modal="true"
        aria-label="Email inbox simulator"
      >
        <div className="mail-preview-header">

          <div className="mail-preview-title">
            <div className="mail-preview-icon">✉</div>

            <div style={{ minWidth: 0 }}>
              <div className="mail-preview-eyebrow">
                Email Inbox Simulator
              </div>

              <div className="mail-preview-name">
                {template.name}
              </div>
            </div>
          </div>

          <div className="mail-preview-meta">
            <span className={`mail-preview-badge mail-preview-badge--difficulty-${template.difficulty}`}>
              {template.difficulty.toUpperCase()} ·{" "}
              {template.difficulty === "hard"
                ? "31%"
                : template.difficulty === "medium"
                  ? "22%"
                  : "13%"}
            </span>
            {template.isPremium && (
              <span className="mail-preview-badge mail-preview-badge--premium">Premium</span>
            )}
            {template.isLocked && (
              <span className="mail-preview-badge mail-preview-badge--locked">Locked</span>
            )}

            <span className="mail-preview-badge">🌐 Website link</span>
            <span className="mail-preview-badge">🌍 Global</span>

            <button
              className="mail-preview-close"
              onClick={onClose}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </div>

        {/* EMPLOYEE IDENTITY */}
        <div className="mail-preview-identity">
          <div>
            ◉ &nbsp; Previewing as{" "}
            <strong>John Doe</strong>,
            {" "}Developer at Contoso Corp

            <button
              onClick={() => setShowIdentityEditor(!showIdentityEditor)}
            >
              Edit
            </button>
          </div>

          <span>
            ✳ &nbsp; Click the links and attachments to see what an employee
            would see.
          </span>
        </div>

        {showIdentityEditor && (
          <div
            style={{
              padding: 14,
              background: "var(--mp-surface-secondary)",
              borderBottom: "1px solid var(--mp-border)",
              fontSize: 13,
              color: "var(--mp-text)",
            }}
          >
            Preview identity customization is coming soon.
            <button
              onClick={() => setShowIdentityEditor(false)}
              style={{
                marginLeft: 12,
                border: "none",
                background: "transparent",
                color: "var(--mp-primary)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* MAIN WORKSPACE */}
        <div className="mail-preview-workspace">

          {/* SIDEBAR */}
          <aside className="mail-preview-sidebar">

            <button
              className="mail-send-button"
              type="button"
              onClick={() => window.alert("Test email functionality can be connected to your API.")}
            >
              ➤ &nbsp; Send test email
            </button>

            <div className="mail-sidebar-heading">
              Folders
            </div>

            {folders.map((folder) => (
              <button
                key={folder.label}
                className={`mail-folder ${
                  activeFolder === folder.label ? "active" : ""
                }`}
                onClick={() => setActiveFolder(folder.label)}
                type="button"
              >
                <span className="mail-folder-icon">
                  {folder.icon}
                </span>

                <span>{folder.label}</span>

                {folder.count && (
                  <span className="mail-folder-count">
                    {folder.count}
                  </span>
                )}
              </button>
            ))}

            <div className="mail-sidebar-heading">
              Labels
            </div>

            {labels.map((label) => (
              <div className="mail-label" key={label.label}>
                <span
                  className="mail-label-dot"
                  style={{ background: label.color }}
                />
                {label.label}
              </div>
            ))}
          </aside>

          {/* EMAIL CONTENT */}
          <main className="mail-content">

            <h2 className="mail-subject">
              {template.subject}
            </h2>

            <div className="mail-sender">
              <div className="mail-sender-avatar">
                ●
              </div>

              <div>
                <div className="mail-sender-name">
                  {template.lureType === "authority"
                    ? "IT Administration"
                    : template.lureType === "reward"
                      ? "Rewards & Benefits"
                      : template.lureType === "curiosity"
                        ? "Company Notifications"
                        : "Google Notifications"}

                  <span
                    style={{
                      color: "var(--mp-text-muted)",
                      fontWeight: 400,
                      marginLeft: 5,
                    }}
                  >
                    ( notifications@example.com )
                  </span>
                </div>

                <div className="mail-sender-address">
                  to john[.]doe@mybusiness[.]com
                </div>
              </div>
            </div>

            <div className="mail-body-container">
              <iframe
                title={`${template.name} email preview`}
                srcDoc={emailDocument}
                sandbox="allow-popups"
                referrerPolicy="no-referrer"
              />
            </div>

          </main>
        </div>

        {/* FOOTER */}
        <div className="mail-preview-footer">

          <div className="mail-footer-hint">
            Use the arrow keys to step through the emails.
          </div>

          <div className="mail-footer-actions">

            <button
              className="mail-nav-button"
              disabled
              aria-label="Previous email"
            >
              ‹
            </button>

            <span className="mail-page-count">
              1 of 1
            </span>

            <button
              className="mail-nav-button"
              disabled
              aria-label="Next email"
            >
              ›
            </button>

            <button
              className="mail-close-button"
              onClick={onClose}
            >
              Close
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
function TemplateDetails({
  template,
  onClose,
}: {
  template: PhishingTemplate;
  onClose: () => void;
}) {
  return (
    <div
      className="tpl-modal-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="ax-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-details-title"
        style={{ width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto" }}
      >
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <span className="ax-card__eyebrow">{template.id}</span>
            <h2 className="ax-card__title" id="template-details-title">{template.name}</h2>
          </div>
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
            aria-label="Close details"
            onClick={onClose}
          >
            {ICON_CLOSE}
          </button>
        </div>
        <dl
          className="ax-card__body"
          style={{ display: "grid", gap: "var(--ax-space-3)", margin: 0 }}
        >
          {[
            ["Subject", template.subject],
            ["Lure type", labelFor(LURE_TYPES, template.lureType)],
            ["Category", labelFor(CATEGORIES, template.category)],
            ["Difficulty", template.difficulty],
            [
              "Disclaimer enabled",
              template.disclaimerEnabled ? "True" : "False",
            ],
            ["Premium", template.isPremium ? "Enabled" : "Disabled"],
            ["Locked", template.isLocked ? "Yes" : "No"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="ax-cluster"
              style={{
                justifyContent: "space-between",
                gap: "var(--ax-space-4)",
              }}
            >
              <dt style={{ color: "var(--ax-text-muted)" }}>{label}</dt>
              <dd style={{ margin: 0, color: "var(--ax-text-strong)" }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function Templates() {
  const navigate = useNavigate();
  const location = useLocation();
  const { themeResolved } = useCustomizer();
  const templateView = location.pathname.endsWith("/custom") ? "custom" : "all";
  const [templates, setTemplates] = useState<PhishingTemplate[]>([]);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const handleApiError = useApiErrorHandler();

  useEffect(() => {
    listTemplates().then(setTemplates).catch((err: unknown) => {
      setLoadError(handleApiError(err, 'Unable to load templates.'));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createTemplate = async (values: TemplateFormValues) => {
    try {
      const created = await createTemplateApi(values);
      setTemplates((current) => [created, ...current]);
      setModal(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to create template.');
    }
  };
  const useTemplateInCampaign = async (template: PhishingTemplate) => {
    setLoadError('');
    try {
      navigate(`/api/campaigns/new?templateId=${encodeURIComponent(template.id)}`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to use this template for a campaign.');
    }
  };
  const updateTemplate = async (values: TemplateFormValues) => {
    if (modal && typeof modal === "object" && "edit" in modal) {
      try {
        const updated = await updateTemplateApi(modal.edit.id, values);
        setTemplates((current) => current.map((t) => t.id === modal.edit.id ? updated : t));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to update template.');
        return;
      }
    }
    setModal(null);
  };
  const deleteTemplate = async (template: PhishingTemplate) => {
    if (window.confirm(`Delete template "${template.name}"?`)) {
      try {
        await deleteTemplateApi(template.id);
        setTemplates((current) => current.filter((t) => t.id !== template.id));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to delete template.');
      }
    }
  };
  const templateRows = templates.map((template) => ({
    template,
    saved: true,
  }));
  const visibleTemplateRows = templateRows.filter(({ saved }) =>
    templateView === "custom" ? saved : true,
  );
  const theme = themeResolved === "dark" ? "dark" : "light";

  return (
    <>
      <style>{`
        .tpl-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--ax-space-4);
          flex-wrap: wrap;
          margin-block-end: var(--ax-space-5);
        }
        .tpl-toolbar__left,
        .tpl-toolbar__right {
          display: flex;
          align-items: center;
          gap: var(--ax-space-3);
          flex-wrap: wrap;
        }
        .tpl-view-toggle {
          display: inline-flex;
          gap: var(--ax-space-1);
          padding: var(--ax-space-1);
          border: 1px solid var(--ax-border);
          border-radius: var(--ax-radius-md);
          background: var(--ax-surface-subtle);
        }
        .tpl-view-toggle button {
          display: inline-flex;
          align-items: center;
          gap: var(--ax-space-2);
          padding: var(--ax-space-2) var(--ax-space-3);
          border: 0;
          border-radius: var(--ax-radius-sm);
          background: transparent;
          color: var(--ax-text-muted);
          cursor: pointer;
          font: inherit;
          font-size: var(--ax-text-sm);
          transition: background var(--ax-motion-fast) var(--ax-ease-standard),
            color var(--ax-motion-fast) var(--ax-ease-standard),
            box-shadow var(--ax-motion-fast) var(--ax-ease-standard);
        }
        .tpl-view-toggle button[aria-pressed="true"] {
          color: var(--ax-text-strong);
          background: var(--ax-surface-overlay);
          box-shadow: var(--ax-shadow-sm);
        }
        .tpl-view-toggle button:focus-visible,
        .tpl-choice__option:focus-visible {
          outline: 2px solid var(--ax-focus-ring);
          outline-offset: 2px;
        }
        .tpl-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: var(--ax-space-4);
        }
        .tpl-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--ax-border);
          border-radius: var(--ax-radius-lg);
          background: var(--ax-surface);
          box-shadow: var(--ax-shadow-card);
          transition: transform var(--ax-motion-base) var(--ax-ease-standard),
            border-color var(--ax-motion-base) var(--ax-ease-standard),
            box-shadow var(--ax-motion-base) var(--ax-ease-standard);
        }
        .tpl-card:hover {
          transform: translateY(-2px);
          border-color: var(--ax-accent);
        }
        .tpl-card__preview {
          position: relative;
          height: 218px;
          overflow: hidden;
          border-block-end: 1px solid var(--ax-border);
          background: var(--ax-surface-subtle);
        }
        .tpl-card__preview iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          background: var(--ax-surface-solid);
          pointer-events: none;
        }
        .tpl-card__preview-empty {
          display: flex;
          height: 100%;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--ax-space-2);
          color: var(--ax-text-muted);
          background: var(--ax-surface-subtle);
        }
        .tpl-card__preview-empty svg { width: 36px; height: 36px; }
        .tpl-card__body { padding: var(--ax-space-4); }
        .tpl-card__title {
          margin: 0;
          color: var(--ax-text-strong);
          font-family: var(--ax-font-display);
          font-size: var(--ax-text-base);
          font-weight: var(--ax-weight-semibold);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .tpl-card__subject {
          min-height: 20px;
          margin: var(--ax-space-1) 0 var(--ax-space-3);
          color: var(--ax-text-muted);
          font-size: var(--ax-text-sm);
          line-height: 1.5;
        }
        .tpl-card__meta {
          display: flex;
          flex-wrap: wrap;
          gap: var(--ax-space-2);
          margin-block-end: var(--ax-space-4);
        }
        .tpl-chip {
          display: inline-flex;
          align-items: center;
          gap: var(--ax-space-1);
          padding: 5px 9px;
          border: 1px solid var(--ax-border);
          border-radius: var(--ax-radius-pill);
          background: var(--ax-surface-subtle);
          color: var(--ax-text-muted);
          font-size: var(--ax-text-2xs);
          line-height: 1.2;
        }
        .tpl-chip--easy {
          border-color: var(--ax-success-200);
          background: var(--ax-success-50);
          color: var(--ax-success-500);
        }
        .tpl-chip--medium {
          border-color: var(--ax-warning-200);
          background: var(--ax-warning-50);
          color: var(--ax-warning-500);
        }
        .tpl-chip--hard {
          border-color: var(--ax-danger-200);
          background: var(--ax-danger-50);
          color: var(--ax-danger-500);
        }
        .tpl-chip--premium {
          border-color: var(--ax-accent);
          background: var(--ax-accent-wash);
          color: var(--ax-accent);
        }
        .tpl-chip--locked {
          border-color: var(--ax-danger-200);
          background: var(--ax-danger-50);
          color: var(--ax-danger-500);
        }
        .tpl-card__actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--ax-space-2);
        }
        .tpl-card__actions .ax-btn {
          justify-content: center;
          min-width: 0;
        }
        .tpl-list { overflow-x: auto; }
        .tpl-empty {
          padding: var(--ax-space-12) var(--ax-space-5);
          color: var(--ax-text-muted);
          text-align: center;
        }
        .tpl-empty strong {
          display: block;
          margin-block-end: var(--ax-space-1);
          color: var(--ax-text-strong);
          font-size: var(--ax-text-base);
        }
        .tpl-form-settings {
          display: grid;
          gap: var(--ax-space-3);
          padding: var(--ax-space-4);
          border: 1px solid var(--ax-border);
          border-radius: var(--ax-radius-lg);
          background: var(--ax-surface-subtle);
        }
        .tpl-form-settings__header h3 {
          color: var(--ax-text-strong);
          font-size: var(--ax-text-sm);
          font-weight: var(--ax-weight-semibold);
        }
        .tpl-form-settings__header p {
          margin-block-start: var(--ax-space-1);
          color: var(--ax-text-muted);
          font-size: var(--ax-text-xs);
        }
        .tpl-form-settings__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--ax-space-3);
        }
        .tpl-setting {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: space-between;
          gap: var(--ax-space-3);
          padding: var(--ax-space-3);
          border: 1px solid var(--ax-border);
          border-radius: var(--ax-radius-md);
          background: var(--ax-surface);
          transition: border-color var(--ax-motion-fast) var(--ax-ease-standard),
            background var(--ax-motion-fast) var(--ax-ease-standard);
        }
        .tpl-setting.is-active {
          border-color: var(--ax-accent);
          background: var(--ax-accent-wash);
        }
        .tpl-setting.is-locked.is-active {
          border-color: var(--ax-danger-200);
          background: var(--ax-danger-50);
        }
        .tpl-setting__copy {
          display: grid;
          min-width: 0;
          gap: var(--ax-space-1);
        }
        .tpl-setting__title {
          color: var(--ax-text-strong);
          font-size: var(--ax-text-sm);
          font-weight: var(--ax-weight-semibold);
        }
        .tpl-setting__description,
        .tpl-setting__state {
          color: var(--ax-text-muted);
          font-size: var(--ax-text-xs);
          line-height: 1.45;
        }
        .tpl-setting__state {
          color: var(--ax-accent);
          font-weight: var(--ax-weight-medium);
        }
        .tpl-setting__state--locked {
          color: var(--ax-text-muted);
        }
        .tpl-setting.is-locked.is-active .tpl-setting__state--locked {
          color: var(--ax-danger-500);
        }
        .tpl-switch {
          position: relative;
          flex: 0 0 auto;
          width: 44px;
          height: 26px;
          padding: 3px;
          border: 1px solid var(--ax-border-strong);
          border-radius: var(--ax-radius-pill);
          background: var(--ax-fill-active);
          cursor: pointer;
          transition: background var(--ax-motion-fast) var(--ax-ease-standard),
            border-color var(--ax-motion-fast) var(--ax-ease-standard),
            box-shadow var(--ax-motion-fast) var(--ax-ease-standard);
        }
        .tpl-switch[aria-checked="true"] {
          border-color: var(--ax-accent);
          background: var(--ax-accent);
        }
        .tpl-switch:focus-visible {
          outline: none;
          box-shadow: var(--ax-focus-shadow);
        }
        .tpl-switch__thumb {
          display: block;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--ax-surface-solid);
          box-shadow: var(--ax-shadow-sm);
          transform: translateX(0);
          transition: transform var(--ax-motion-fast) var(--ax-ease-standard);
        }
        .tpl-switch[aria-checked="true"] .tpl-switch__thumb {
          transform: translateX(18px);
        }
        [dir="rtl"] .tpl-switch[aria-checked="true"] .tpl-switch__thumb {
          transform: translateX(-18px);
        }
        .tpl-modal-overlay,
        .tpl-choice-overlay {
          position: fixed;
          inset: 0;
          z-index: var(--ax-z-modal);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--ax-space-4);
          background: var(--ax-backdrop);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          animation: tpl-fade var(--ax-motion-fast) var(--ax-ease-standard) both;
        }
        .tpl-modal-overlay > .ax-card {
          width: 100%;
          max-width: 760px;
          max-height: 92vh;
          overflow-y: auto;
        }
        .tpl-modal-overlay .ax-input::placeholder,
        .tpl-modal-overlay .ax-textarea::placeholder {
          color: var(--ax-text-muted);
          opacity: 1;
        }
        .tpl-choice {
          width: min(100%, 620px);
          max-height: 92vh;
          overflow-y: auto;
          border: 1px solid var(--ax-border-strong);
          border-radius: var(--ax-radius-xl);
          background: var(--ax-surface-overlay);
          color: var(--ax-text);
          box-shadow: var(--ax-shadow-lg);
          animation: tpl-rise var(--ax-motion-base) var(--ax-ease-emphasized) both;
        }
        .tpl-choice__head {
          display: flex;
          justify-content: space-between;
          gap: var(--ax-space-4);
          padding: var(--ax-space-6) var(--ax-space-6) var(--ax-space-4);
        }
        .tpl-choice__eyebrow {
          display: block;
          margin-block-end: var(--ax-space-2);
          color: var(--ax-accent);
          font-size: var(--ax-text-2xs);
          font-weight: var(--ax-weight-bold);
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .tpl-choice__title {
          margin: 0;
          color: var(--ax-text-strong);
          font-family: var(--ax-font-display);
          font-size: var(--ax-text-xl);
          font-weight: var(--ax-weight-bold);
          letter-spacing: -.025em;
        }
        .tpl-choice__subtitle {
          margin-block-start: var(--ax-space-2);
          color: var(--ax-text-muted);
          font-size: var(--ax-text-sm);
          line-height: 1.55;
        }
        .tpl-choice__options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--ax-space-3);
          padding: var(--ax-space-2) var(--ax-space-6) var(--ax-space-6);
        }
        .tpl-choice__option {
          position: relative;
          display: flex;
          min-height: 180px;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--ax-space-3);
          padding: var(--ax-space-4);
          border: 1px solid var(--ax-border);
          border-radius: var(--ax-radius-lg);
          background: var(--ax-surface);
          color: var(--ax-text-strong);
          text-align: start;
          cursor: pointer;
          transition: transform var(--ax-motion-fast) var(--ax-ease-standard),
            border-color var(--ax-motion-fast) var(--ax-ease-standard),
            box-shadow var(--ax-motion-fast) var(--ax-ease-standard),
            background var(--ax-motion-fast) var(--ax-ease-standard);
        }
        .tpl-choice__option:not(:disabled):hover {
          transform: translateY(-2px);
          border-color: var(--ax-accent);
          background: var(--ax-surface-overlay);
          box-shadow: var(--ax-shadow-md);
        }
        .tpl-choice__option:disabled {
          background: var(--ax-surface-subtle);
          cursor: not-allowed;
          opacity: .7;
        }
        .tpl-choice__icon {
          display: grid;
          width: 40px;
          height: 40px;
          place-items: center;
          border-radius: var(--ax-radius-md);
          background: var(--ax-accent-wash);
          color: var(--ax-accent);
        }
        .tpl-choice__icon svg { width: 21px; height: 21px; }
        .tpl-choice__option strong { font-size: var(--ax-text-sm); }
        .tpl-choice__option small {
          color: var(--ax-text-muted);
          font-size: var(--ax-text-xs);
          line-height: 1.5;
        }
        .tpl-choice__badge {
          position: absolute;
          inset-block-start: var(--ax-space-3);
          inset-inline-end: var(--ax-space-3);
          padding: var(--ax-space-1) var(--ax-space-2);
          border: 1px solid var(--ax-border);
          border-radius: var(--ax-radius-pill);
          background: var(--ax-surface-subtle);
          color: var(--ax-text-muted);
          font-size: var(--ax-text-2xs);
          font-weight: var(--ax-weight-bold);
        }
        .tpl-choice__foot {
          padding: var(--ax-space-3) var(--ax-space-6);
          border-block-start: 1px solid var(--ax-border);
          color: var(--ax-text-muted);
          font-size: var(--ax-text-2xs);
        }
        @keyframes tpl-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tpl-rise {
          from { opacity: 0; transform: translateY(8px) scale(.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 1100px) {
          .tpl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 650px) {
          .tpl-grid { grid-template-columns: 1fr; }
          .tpl-form-settings__grid { grid-template-columns: 1fr; }
          .tpl-choice__options {
            grid-template-columns: 1fr;
            padding: var(--ax-space-2) var(--ax-space-4) var(--ax-space-4);
          }
          .tpl-choice__head { padding: var(--ax-space-5) var(--ax-space-4) var(--ax-space-3); }
          .tpl-choice__option { min-height: 145px; }
          .tpl-choice__title { font-size: var(--ax-text-lg); }
          .tpl-choice__foot { padding-inline: var(--ax-space-4); }
          .tpl-card__preview { height: 200px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tpl-card,
          .tpl-choice__option,
          .tpl-choice-overlay,
          .tpl-modal-overlay,
          .tpl-choice { animation: none !important; transition: none !important; }
          .tpl-card:hover,
          .tpl-choice__option:not(:disabled):hover { transform: none; }
        }
      `}</style>
      <PageHead
        title={templateView === "custom" ? "Custom templates" : "Templates"}
        subtitle="Create, inspect, and preview authorised phishing simulation templates."
      />
      {loadError && <div role="alert" className="ax-alert ax-alert--danger"><p className="ax-alert__message">{loadError}</p></div>}

      <div className="tpl-toolbar">
        <div className="tpl-toolbar__left">
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => setModal("choose-create")}
          >
            {ICON_PLUS}
            <span className="ax-btn__label">Create Template</span>
          </button>
          <span style={{ color: "var(--ax-text-muted)", fontSize: 13 }}>
            {visibleTemplateRows.length} template{visibleTemplateRows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="tpl-toolbar__right">
          <div className="tpl-view-toggle" role="group" aria-label="Template display mode">
            <button type="button" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Grid
            </button>
            <button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>
              List
            </button>
          </div>
        </div>
      </div>

      <section className="ax-card" role="region" aria-label="Phishing templates" style={{ margin: "0 25px" }}>
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title">Phishing templates</h2>
            <p className="ax-card__subtitle">
              Browse your templates, preview their email content, and select one for a campaign.
            </p>
          </div>
        </div>

        <div className="ax-card__body">
          {visibleTemplateRows.length === 0 ? (
            <div className="tpl-empty">
              <strong>No templates yet</strong>
              Create your first template to start building your library.
              <div style={{ marginTop: 16 }}>
                <button type="button" className="ax-btn ax-btn--primary" onClick={() => setModal("choose-create")}>
                  {ICON_PLUS} Create your first template
                </button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="tpl-grid">
              {visibleTemplateRows.map(({ template, saved }) => (
                <article className="tpl-card" key={template.id}>
                  <div className="tpl-card__preview">
                    {template.htmlBody.trim() ? (
                      <iframe
                        title={`${template.name} email thumbnail`}
                        sandbox=""
                        tabIndex={-1}
                        srcDoc={getTemplatePreviewDocument(template.htmlBody, theme, 18)}
                      />
                    ) : (
                      <div className="tpl-card__preview-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="m3 6 9 7 9-7M3 18l6-6m12 6-6-6"/></svg>
                        <span style={{ fontSize: 12 }}>Email preview unavailable</span>
                      </div>
                    )}
                  </div>
                  <div className="tpl-card__body">
                    <h3 className="tpl-card__title">{template.name}</h3>
                    <p className="tpl-card__subject">{template.subject || "No subject provided"}</p>
                    <div className="tpl-card__meta">
                      <span className={`tpl-chip tpl-chip--${template.difficulty}`}>{template.difficulty[0].toUpperCase() + template.difficulty.slice(1)}</span>
                      <span className="tpl-chip">{labelFor(CATEGORIES, template.category)}</span>
                      <span className="tpl-chip">{labelFor(LURE_TYPES, template.lureType)}</span>
                      {template.isPremium && <span className="tpl-chip tpl-chip--premium">Premium</span>}
                      {template.isLocked && <span className="tpl-chip tpl-chip--locked">Locked</span>}
                    </div>
                    <div className="tpl-card__actions">
                      <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setModal({ preview: template })}>
                        {ICON_EYE}<span>Preview</span>
                      </button>
                      {saved ? (
                        <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setModal({ edit: template })}>
                          {ICON_EDIT}<span>Edit</span>
                        </button>
                      ) : (
                        <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setModal({ detail: template })}>Details</button>
                      )}
                      <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" onClick={() => void useTemplateInCampaign(template)}>
                        Use in campaign
                      </button>
                      {saved && (
                        <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => deleteTemplate(template)}>
                          {ICON_DELETE}<span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="tpl-list">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    {["Name", "Subject", "Lure type", "Category", "Difficulty", "Premium", "Locked", "Disclaimer", "Actions"].map((heading) => (
                      <th className="ax-table__th" scope="col" key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTemplateRows.map(({ template, saved }) => (
                    <tr className="ax-table__row" key={template.id}>
                      <td className="ax-table__td" style={{ color: "var(--ax-text-strong)", fontWeight: "var(--ax-weight-medium)", minWidth: 180 }}>{template.name}</td>
                      <td className="ax-table__td" style={{ minWidth: 240 }}>{template.subject}</td>
                      <td className="ax-table__td">{labelFor(LURE_TYPES, template.lureType)}</td>
                      <td className="ax-table__td">{labelFor(CATEGORIES, template.category)}</td>
                      <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--pill">{template.difficulty}</span></td>
                      <td className="ax-table__td">{template.isPremium ? "Yes" : "No"}</td>
                      <td className="ax-table__td">{template.isLocked ? "Yes" : "No"}</td>
                      <td className="ax-table__td">{template.disclaimerEnabled ? "Enabled" : "Disabled"}</td>
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: "var(--ax-space-1)", flexWrap: "nowrap" }}>
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={`Preview ${template.name}`} onClick={() => setModal({ preview: template })}>{ICON_EYE}</button>
                          {saved && <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={`Edit ${template.name}`} onClick={() => setModal({ edit: template })}>{ICON_EDIT}</button>}
                          {saved && <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={`Delete ${template.name}`} onClick={() => deleteTemplate(template)}>{ICON_DELETE}</button>}
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setModal({ detail: template })}>Details</button>
                          <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" onClick={() => void useTemplateInCampaign(template)}>Use</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {modal === "choose-create" && (
        <div className="tpl-choice-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <section className="tpl-choice" role="dialog" aria-modal="true" aria-labelledby="tpl-choice-title">
            <div className="tpl-choice__head">
              <div>
                <span className="tpl-choice__eyebrow">Template builder</span>
                <h2 className="tpl-choice__title" id="tpl-choice-title">How would you like to create?</h2>
                <p className="tpl-choice__subtitle">Choose how you want to start building your phishing simulation template.</p>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close" onClick={() => setModal(null)}>{ICON_CLOSE}</button>
            </div>
            <div className="tpl-choice__options">
              <button type="button" className="tpl-choice__option" onClick={() => setModal("create")}>
                <span className="tpl-choice__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
                </span>
                <strong>Create from Scratch</strong>
                <small>Start with a blank template and add your own email content, subject, and simulation settings.</small>
              </button>
              <button type="button" className="tpl-choice__option" disabled aria-disabled="true" title="AI template generation is coming soon">
                <span className="tpl-choice__badge">Coming soon</span>
                <span className="tpl-choice__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/></svg>
                </span>
                <strong>AI-generated template</strong>
                <small>Generate an email template with AI using a prompt and your campaign requirements.</small>
              </button>
            </div>
            <div className="tpl-choice__foot">AI generation is not available yet. You can create a template manually for now.</div>
          </section>
        </div>
      )}

      {modal === "create" && (
        <TemplateForm
          mode="create"
          theme={theme}
          onCancel={() => setModal(null)}
          onSubmit={createTemplate}
        />
      )}
      {modal && typeof modal === "object" && "edit" in modal && (
        <TemplateForm
          mode="edit"
          initial={modal.edit}
          theme={theme}
          onCancel={() => setModal(null)}
          onSubmit={updateTemplate}
        />
      )}
      {modal && typeof modal === "object" && "preview" in modal && (
        <TemplatePreview
          template={modal.preview}
          theme={theme}
          onClose={() => setModal(null)}
        />
      )}
      {modal && typeof modal === "object" && "detail" in modal && (
        <TemplateDetails
          template={modal.detail}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

export default Templates;
