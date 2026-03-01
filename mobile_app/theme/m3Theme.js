import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// ── M3 Light Colors ──
const m3Colors = {
    primary: '#6750A4',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',

    secondary: '#625B71',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E8DEF8',
    onSecondaryContainer: '#1D192B',

    tertiary: '#7D5260',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFD8E4',
    onTertiaryContainer: '#31111D',

    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    background: '#FEF7FF',
    onBackground: '#1D1B20',
    surface: '#FEF7FF',
    onSurface: '#1D1B20',
    surfaceVariant: '#E7E0EC',
    onSurfaceVariant: '#49454F',
    surfaceDisabled: 'rgba(29, 27, 32, 0.12)',
    onSurfaceDisabled: 'rgba(29, 27, 32, 0.38)',

    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#F7F2FA',
    surfaceContainer: '#F3EDF7',
    surfaceContainerHigh: '#ECE6F0',
    surfaceContainerHighest: '#E6E0E9',

    outline: '#79747E',
    outlineVariant: '#CAC4D0',

    inverseSurface: '#322F35',
    inverseOnSurface: '#F5EFF7',
    inversePrimary: '#D0BCFF',

    shadow: '#000000',
    scrim: '#000000',

    elevation: {
        level0: 'transparent',
        level1: '#F7F2FA',
        level2: '#F3EDF7',
        level3: '#EFE9F4',
        level4: '#EDE7F2',
        level5: '#EBE4F0',
    },
};

// ── M3 Dark Colors ──
const m3DarkColors = {
    primary: '#D0BCFF',
    onPrimary: '#381E72',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',

    secondary: '#CCC2DC',
    onSecondary: '#332D41',
    secondaryContainer: '#4A4458',
    onSecondaryContainer: '#E8DEF8',

    tertiary: '#EFB8C8',
    onTertiary: '#492532',
    tertiaryContainer: '#633B48',
    onTertiaryContainer: '#FFD8E4',

    error: '#F2B8B5',
    onError: '#601410',
    errorContainer: '#8C1D18',
    onErrorContainer: '#F9DEDC',

    background: '#141218',
    onBackground: '#E6E0E9',
    surface: '#141218',
    onSurface: '#E6E0E9',
    surfaceVariant: '#49454F',
    onSurfaceVariant: '#CAC4D0',
    surfaceDisabled: 'rgba(230, 224, 233, 0.12)',
    onSurfaceDisabled: 'rgba(230, 224, 233, 0.38)',

    surfaceContainerLowest: '#0F0D13',
    surfaceContainerLow: '#1D1B20',
    surfaceContainer: '#211F26',
    surfaceContainerHigh: '#2B2930',
    surfaceContainerHighest: '#36343B',

    outline: '#938F99',
    outlineVariant: '#49454F',

    inverseSurface: '#E6E0E9',
    inverseOnSurface: '#322F35',
    inversePrimary: '#6750A4',

    shadow: '#000000',
    scrim: '#000000',

    elevation: {
        level0: 'transparent',
        level1: '#1D1B20',
        level2: '#211F26',
        level3: '#262429',
        level4: '#27252B',
        level5: '#2B292F',
    },
};

// ── Neumorphic Light Colors ──
const neuLightColors = {
    base: '#e0e5ec',
    surface: '#dbe1e8',
    text: '#4a4a4a',
    textSecondary: '#8a8a8a',
    accent: '#007bff',
    danger: '#dc3545',
    warning: '#c67b00',
    searchBg: '#e0e5ec',
    placeholderText: '#999',
    // Shadows
    shadowDark: 'rgba(155,174,200,',
    shadowLight: 'rgba(255,255,255,',
};

// ── Neumorphic Dark Colors ──
const neuDarkColors = {
    base: '#2a2d32',
    surface: '#252830',
    text: '#d0d0d0',
    textSecondary: '#888888',
    accent: '#5ba3ff',
    danger: '#ff6b7a',
    warning: '#e6a040',
    searchBg: '#2a2d32',
    placeholderText: '#666',
    // Shadows
    shadowDark: 'rgba(0,0,0,',
    shadowLight: 'rgba(60,65,75,',
};

/** Get M3 color palette for given scheme */
function getColors(colorScheme) {
    return colorScheme === 'dark' ? m3DarkColors : m3Colors;
}

/** Get neumorphic color palette for given scheme */
function getNeuColors(colorScheme) {
    return colorScheme === 'dark' ? neuDarkColors : neuLightColors;
}

/** Generate neumorphic boxShadow arrays using current palette */
function getNeuShadows(colorScheme) {
    const nc = getNeuColors(colorScheme);
    return {
        cardShadow: [
            { offsetX: 9, offsetY: 9, blurRadius: 16, spreadDistance: 0, color: `${nc.shadowDark}0.6)` },
            { offsetX: -9, offsetY: -9, blurRadius: 16, spreadDistance: 0, color: `${nc.shadowLight}0.8)` },
        ],
        btnShadow: [
            { offsetX: 4, offsetY: 4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowDark}0.5)` },
            { offsetX: -4, offsetY: -4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowLight}0.7)` },
        ],
        insetShadow: [
            { offsetX: 6, offsetY: 6, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowDark}0.5)`, inset: true },
            { offsetX: -6, offsetY: -6, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowLight}0.7)`, inset: true },
        ],
        fabShadow: [
            { offsetX: 6, offsetY: 6, blurRadius: 12, spreadDistance: 0, color: `${nc.shadowDark}0.55)` },
            { offsetX: -6, offsetY: -6, blurRadius: 12, spreadDistance: 0, color: `${nc.shadowLight}0.75)` },
        ],
    };
}

// M3 Expressive theme with extra-round corners
const m3Theme = {
    ...MD3LightTheme,
    roundness: 28,
    colors: {
        ...MD3LightTheme.colors,
        ...m3Colors,
    },
};

const m3DarkTheme = {
    ...MD3DarkTheme,
    roundness: 28,
    colors: {
        ...MD3DarkTheme.colors,
        ...m3DarkColors,
    },
};

export {
    m3Theme,
    m3DarkTheme,
    m3Colors,
    m3DarkColors,
    neuLightColors,
    neuDarkColors,
    getColors,
    getNeuColors,
    getNeuShadows,
};
