import React, { useRef, useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { usePriceSelector } from '../store/useEngineStore';

interface PriceTickerProps {
  symbol: string;
  decimals?: number;
  style?: object;
  prefix?: string;
}

export const PriceTicker: React.FC<PriceTickerProps> = ({
  symbol,
  decimals = 7,
  style = {},
  prefix = '$',
}) => {
  const price = usePriceSelector(symbol);
  const prevPrice = useRef<number | undefined>(undefined);
  const [color, setColor] = useState('#ffffff');

  useEffect(() => {
    if (price == null) return;
    
    if (prevPrice.current !== undefined) {
      if (price > prevPrice.current) {
        setColor('#00ff88'); // Green for up
      } else if (price < prevPrice.current) {
        setColor('#ff3366'); // Red for down
      }
    }
    
    prevPrice.current = price;
    
    // Optional: revert to white after a short delay to create a pulse effect
    const timer = setTimeout(() => {
      setColor('#ffffff');
    }, 500);
    
    return () => clearTimeout(timer);
  }, [price]);

  if (price == null) {
    return (
      <Text style={[styles.text, { color: 'rgba(255, 255, 255, 0.4)' }, style]}>
        —
      </Text>
    );
  }

  return (
    <Text style={[styles.text, { color }, style]}>
      {prefix}{price.toFixed(decimals)}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: 'monospace', // Tabular nums equivalent in RN
    fontSize: 16,
    fontWeight: 'bold',
  },
});
