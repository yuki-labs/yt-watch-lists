import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { Animated } from 'react-native';

// 0 = M3 Expressive (default), 1 = Neumorphic
const ThemeTransitionContext = createContext({
    progress: new Animated.Value(0),
    isNeu: false,
});

export function useThemeTransition() {
    return useContext(ThemeTransitionContext);
}

/**
 * Interpolation helpers — produce Animated values that blend
 * between M3 and neumorphic style tokens.
 */
export function useThemeInterpolation(m3Value, neuValue) {
    const { progress } = useThemeTransition();

    if (typeof m3Value === 'string' && typeof neuValue === 'string') {
        // Color interpolation
        return progress.interpolate({
            inputRange: [0, 1],
            outputRange: [m3Value, neuValue],
        });
    }

    if (typeof m3Value === 'number' && typeof neuValue === 'number') {
        // Numeric interpolation (borderRadius, padding, etc.)
        return progress.interpolate({
            inputRange: [0, 1],
            outputRange: [m3Value, neuValue],
        });
    }

    return m3Value;
}

/**
 * Provider that wraps the app and drives the theme transition animation.
 */
export function ThemeTransitionProvider({ children, theme, onThemeChange }) {
    const progress = useRef(new Animated.Value(theme === 'neumorphic' ? 1 : 0)).current;
    const currentTheme = useRef(theme);

    const animateToTheme = useCallback((newTheme) => {
        const toValue = newTheme === 'neumorphic' ? 1 : 0;
        currentTheme.current = newTheme;

        // Start the animation, then commit the state change
        Animated.timing(progress, {
            toValue,
            duration: 450,
            useNativeDriver: false, // Required for color/layout interpolation
        }).start();

        // Commit theme change immediately so the state is in sync
        onThemeChange(newTheme);
    }, [progress, onThemeChange]);

    // Sync progress when theme prop changes externally (e.g., loaded from storage)
    useEffect(() => {
        const expected = theme === 'neumorphic' ? 1 : 0;
        if (currentTheme.current !== theme) {
            currentTheme.current = theme;
            progress.setValue(expected);
        }
    }, [theme, progress]);

    return (
        <ThemeTransitionContext.Provider
            value={{
                progress,
                isNeu: theme === 'neumorphic',
                animateToTheme,
            }}
        >
            {children}
        </ThemeTransitionContext.Provider>
    );
}
