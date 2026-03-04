/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { useAppContext } from '../contexts/AppContext.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { theme } from '../semantic-colors.js';
import { StreamingState } from '../types.js';

// Define notification priorities
enum NotificationPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
}

interface NotificationItem {
  id: string;
  message: string;
  priority: NotificationPriority;
  type: 'warning' | 'error' | 'info' | 'success';
}

export const SmartNotifications = () => {
  const { startupWarnings } = useAppContext();
  const { initError, streamingState, updateInfo } = useUIState();

  // Convert current notifications to prioritized list
  const notifications: NotificationItem[] = [];

  // Add update notification (HIGH priority)
  if (updateInfo) {
    notifications.push({
      id: 'update',
      message: updateInfo.message,
      priority: NotificationPriority.HIGH,
      type: 'info',
    });
  }

  // Add startup warnings (MEDIUM priority)
  if (startupWarnings.length > 0) {
    startupWarnings.forEach((warning, index) => {
      notifications.push({
        id: `warning-${index}`,
        message: warning,
        priority: NotificationPriority.MEDIUM,
        type: 'warning',
      });
    });
  }

  // Add init error (CRITICAL priority)
  if (initError && streamingState !== StreamingState.Responding) {
    notifications.push({
      id: 'init-error',
      message: `Initialization Error: ${initError}. Please check API key and configuration.`,
      priority: NotificationPriority.CRITICAL,
      type: 'error',
    });
  }

  // Sort notifications by priority (highest first)
  const sortedNotifications = notifications.sort(
    (a, b) => b.priority - a.priority,
  );

  // Only show the highest priority notification to reduce clutter
  const topNotification = sortedNotifications[0];

  if (!topNotification) {
    return null;
  }

  // Determine colors based on notification type
  const borderColor =
    topNotification.type === 'error'
      ? theme.status.error
      : topNotification.type === 'warning'
        ? theme.status.warning
        : topNotification.type === 'success'
          ? theme.status.success
          : theme.border.default;

  const textColor =
    topNotification.type === 'error'
      ? theme.status.error
      : topNotification.type === 'warning'
        ? theme.status.warning
        : topNotification.type === 'success'
          ? theme.status.success
          : theme.text.primary;

  return (
    <Box
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
      marginY={1}
    >
      <Text color={textColor}>{topNotification.message}</Text>
    </Box>
  );
};
