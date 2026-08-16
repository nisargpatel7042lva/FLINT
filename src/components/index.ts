/**
 * Kasrat component library.
 *
 * Screens should build exclusively from these primitives. If a screen needs a
 * one-off style, that is a signal the primitive needs a new variant — add it
 * here rather than styling inline at the call site.
 */

// Phase 1
export * from './Text';
export * from './Avatar';
export * from './Card';
export * from './Chip';
export * from './Button';
export * from './IconButton';
export * from './StatPill';
export * from './ProgressRing';
export * from './SectionHeader';
export * from './Input';
export * from './Screen';

// Phase 2 — see each file's header for why the pattern was needed.
export * from './PageDots';
export * from './MeterBar';
export * from './Divider';
export * from './AvatarGroup';
export * from './OptionCard';
export * from './ListRow';
