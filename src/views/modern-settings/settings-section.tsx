import { type ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { modernStyles } from '../../components/modern-layout';
import styles from './modern-settings.module.css';

interface SettingsSectionProps {
  /** Links such as /settings#displayName point at a section by this id. */
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

/** A card of related settings; the one a link points at is highlighted and scrolled into view. */
export const SettingsSection = ({ id, title, description, children }: SettingsSectionProps) => {
  const { hash } = useLocation();
  const isHighlighted = Boolean(id && hash === `#${id}`);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isHighlighted) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [isHighlighted]);

  return (
    <section ref={sectionRef} id={id} className={`${styles.section} ${isHighlighted ? styles.highlighted : ''}`} aria-labelledby={id ? `${id}-title` : undefined}>
      <h2 id={id ? `${id}-title` : undefined} className={styles.sectionTitle}>
        <span className={modernStyles.sentenceCase}>{title}</span>
      </h2>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </section>
  );
};

/** One labelled setting in a section, with its controls beside the label on wide screens. */
export const SettingsRow = ({ label, hint, htmlFor, children }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode }) => {
  const Label = htmlFor ? 'label' : 'span';
  return (
    <div className={styles.row}>
      <Label className={styles.rowLabel} htmlFor={htmlFor}>
        <span className={modernStyles.sentenceCase}>{label}</span>
        {hint && <span className={styles.rowHint}>{hint}</span>}
      </Label>
      <div className={styles.controls}>{children}</div>
    </div>
  );
};

/** A checkbox drawn as a switch, labelled by its row. */
export const SettingsSwitch = ({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <SettingsRow label={label} hint={hint} htmlFor={id}>
    <input id={id} type='checkbox' role='switch' className={styles.switch} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
  </SettingsRow>
);
