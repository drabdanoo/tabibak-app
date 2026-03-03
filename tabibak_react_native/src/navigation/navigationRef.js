/**
 * Shared navigation reference.
 *
 * Exported separately from AppNavigator so that services and contexts
 * (AuthContext, notificationService) can call navigationRef.navigate()
 * without creating a circular dependency with AppNavigator.
 *
 * Usage outside React:
 *   import { navigationRef } from '../navigation/navigationRef';
 *   if (navigationRef.isReady()) {
 *     navigationRef.navigate('ScreenName', params);
 *   }
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
