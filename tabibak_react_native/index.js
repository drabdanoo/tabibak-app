/**
 * App entry point
 *
 * CRITICAL — RTL must be enabled BEFORE registerRootComponent so that the
 * native layout engine is in the correct mode on first render.
 * I18nManager.allowRTL(true) tells React Native: "honour the device's
 * locale direction." When the system language is Arabic, start/end props
 * automatically resolve to right/left at the native layer.
 */
import { I18nManager } from 'react-native';
import { registerRootComponent } from 'expo';

// Boot-time RTL permission — must run synchronously before any render
I18nManager.allowRTL(true);

// Initialise i18n engine (side-effect: configures i18next singleton)
import './src/i18n';

import App from './App';

registerRootComponent(App);
