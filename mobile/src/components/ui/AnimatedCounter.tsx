import React, { useEffect, useState, useRef } from 'react';
import { Text } from 'react-native';

export type TextComponentProps = React.ComponentProps<typeof Text>;

export interface AnimatedCounterProps extends TextComponentProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  formatter?: (n: number) => string;
}

/**
 * Smooth easeOutExpo curve for premium fintech-style counting up animations
 */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Hook to count up a numeric value from 0 to target value smoothly
 */
export function useCountUp(
  targetValue: number,
  options?: { duration?: number; initialStart?: number }
): number {
  const duration = options?.duration ?? 1100;
  const initialStart = options?.initialStart ?? 0;
  const [currentValue, setCurrentValue] = useState<number>(initialStart);

  const startValueRef = useRef<number>(initialStart);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const endVal = Number(targetValue) || 0;
    const fromVal = startValueRef.current;

    // If already at endVal, no need to animate
    if (fromVal === endVal && fromVal !== 0) {
      setCurrentValue(endVal);
      return;
    }

    startTimeRef.current = Date.now();

    const step = () => {
      const now = Date.now();
      const elapsed = now - (startTimeRef.current || now);
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const nextVal = Math.round(fromVal + (endVal - fromVal) * easedProgress);
      setCurrentValue(nextVal);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        startValueRef.current = endVal;
        setCurrentValue(endVal);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [targetValue, duration]);

  return currentValue;
}

/**
 * AnimatedCounter Component: Grows numbers from 0 to the initial amount with smooth 60fps easing
 */
export function AnimatedCounter({
  value,
  duration = 1100,
  prefix = '₦',
  suffix = '',
  formatter,
  style,
  ...textProps
}: AnimatedCounterProps) {
  const animatedNumber = useCountUp(value, { duration, initialStart: 0 });

  const formattedText = formatter
    ? formatter(animatedNumber)
    : `${prefix}${animatedNumber.toLocaleString('en-NG')}${suffix}`;

  return (
    <Text style={style} {...textProps}>
      {formattedText}
    </Text>
  );
}
