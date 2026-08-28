import React, { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '../theme';

export type LogoProps = {
  size?: number;
  /** Overrides the ground the mark is drawn for. Defaults to the theme. */
  on?: 'dark' | 'light';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Two stone palettes, because the mark has to survive both themes.
 *
 * The source artwork is pale stone on near-black. Dropped straight onto the
 * cream page of light mode it all but disappeared — only the spark read, and
 * the stones ghosted into the background.
 *
 * The fix is not a tint or an outline, which would flatten the faceting that
 * makes it read as stone. It is a second ramp with the luminance inverted and
 * warmed: dark faces catching warm light, keeping the same seven steps and the
 * same relative ordering, so every plane stays distinguishable.
 */
const STONE = {
  dark: {
    face: '#EEEEEE',
    top: '#E8DFD6',
    edge: '#D0C7BE',
    mid: '#C1B4AC',
    shadow: '#ACA39B',
    seam: '#A2988B',
    deep: '#92887F',
    gradFrom: '#B8B8B8',
    gradToLeft: '#FFDAC8',
    gradToRight: '#FFD9C8',
  },
  light: {
    face: '#24221F',
    top: '#2E2A25',
    edge: '#38322B',
    mid: '#443C33',
    shadow: '#514639',
    seam: '#5D5142',
    deep: '#6A5C4B',
    gradFrom: '#2A2A2C',
    gradToLeft: '#8A5A3C',
    gradToRight: '#8A5A3C',
  },
} as const;

/**
 * The Flint mark: two struck stones with the spark between them.
 *
 * Traced from the source artwork, with two changes made deliberately:
 *
 *  - The black background rect is dropped. The mark has to sit on whatever
 *    surface it is placed on — a cream page in light mode included — and a
 *    baked-in black square would have shown as a hard tile there.
 *  - The seven identical spark gradients in the source collapse to one. They
 *    shared the same coordinates and stops, so seven definitions were seven
 *    chances for them to drift apart.
 *
 * The viewBox crops to the artwork rather than the source's 1024 square, so
 * `size` is the size of the mark itself instead of the size of its padding.
 */
export function Logo({ size = 72, on, style, testID }: LogoProps) {
  const theme = useTheme();
  const stone = STONE[on ?? (theme.mode === 'light' ? 'light' : 'dark')];
  /*
   * Gradient ids must be unique per instance.
   *
   * SVG resolves `url(#id)` against the whole document, so two Logos on one
   * screen would both paint with whichever definition mounted last — the same
   * bug already fixed once in PhotoCard's scrim.
   */
  const uid = useId().replace(/:/g, '');
  const stoneLeft = `flint-stone-l-${uid}`;
  const stoneRight = `flint-stone-r-${uid}`;
  const spark = `flint-spark-${uid}`;

  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="240 240 544 544"
      style={style}>
      <Defs>
        <LinearGradient
          id={stoneLeft}
          x1="333"
          y1="345.5"
          x2="512"
          y2="555.5"
          gradientUnits="userSpaceOnUse">
          <Stop stopColor={stone.gradFrom} />
          <Stop offset="1" stopColor={stone.gradToLeft} />
        </LinearGradient>
        <LinearGradient
          id={stoneRight}
          x1="706.501"
          y1="391.25"
          x2="529"
          y2="559.5"
          gradientUnits="userSpaceOnUse">
          <Stop stopColor={stone.gradFrom} />
          <Stop offset="1" stopColor={stone.gradToRight} />
        </LinearGradient>
        {/* One definition for every spark shard — see the note above. */}
        <LinearGradient
          id={spark}
          x1="517"
          y1="557.5"
          x2="606.5"
          y2="261"
          gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FF3B00" />
          <Stop offset="1" stopColor="#FF9500" />
        </LinearGradient>
      </Defs>

      {/* Stones */}
      <Path d="M303 408.5L353 255L426 360.5L512 556.5L507 769L303 408.5Z" fill={stone.face} />
      <Path d="M521.5 765.5L526 556.5L707 341.5L720.5 450.5L521.5 765.5Z" fill={stone.face} />
      <Path d="M427 362.5L354.5 261L359 413.5L483.5 642.5L511.5 556L427 362.5Z" fill={`url(#${stoneLeft})`} />
      <Path d="M512 557L485 645L507 766L512 557Z" fill={stone.seam} />
      <Path d="M720 451L672.5 452L556.5 623L523.5 761L720 451Z" fill={stone.deep} />
      <Path d="M554.5 622.5L526 556.5L522.5 761L554.5 622.5Z" fill={stone.mid} />
      <Path d="M358.5 414.5L303.5 409L505.5 766L482.5 645.5L358.5 414.5Z" fill={stone.shadow} />
      <Path
        d="M526.5 556C585.25 485.895 703.862 346.08 706.458 342.567C706.479 342.523 706.493 342.5 706.5 342.5C706.505 342.5 706.491 342.523 706.458 342.567C705.275 345.074 682.298 416.796 671 452L555.5 620L526.5 556Z"
        fill={`url(#${stoneRight})`}
      />
      <Path d="M672.5 451L707 342.5L720 450L672.5 451Z" fill={stone.edge} />
      <Path d="M358 413.5L353 256L303.5 408L358 413.5Z" fill={stone.top} />

      {/* Spark */}
      <Path d="M519 551L483 467.5L519 513.5L581 474.5L519 551Z" fill={`url(#${spark})`} />
      <Path d="M489 398.5L465 393L510 486.5L489 398.5Z" fill={`url(#${spark})`} />
      <Path d="M522.5 340L506.5 350L521 451L522.5 340Z" fill={`url(#${spark})`} />
      <Path d="M628.5 375L619 358.5L586 424.5L628.5 375Z" fill={`url(#${spark})`} />
      <Path d="M575.5 453L566.5 450L554.5 473L575.5 453Z" fill={`url(#${spark})`} />
      <Path d="M587 455L594 443.5L599.5 446L587 455Z" fill={`url(#${spark})`} />
      <Path d="M579 278.5L526.5 503L620 265L579 278.5Z" fill={`url(#${spark})`} />
    </Svg>
  );
}
