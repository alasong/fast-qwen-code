/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ThoughtSummary } from '@qwen-code/qwen-code-core';
import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useStreamingContext } from '../contexts/StreamingContext.js';
import { StreamingState } from '../types.js';
import { GeminiRespondingSpinner } from './GeminiRespondingSpinner.js';
import { formatDuration } from '../utils/formatters.js';

interface LoadingIndicatorProps {
  currentLoadingPhrase?: string;
  elapsedTime: number;
  rightContent?: React.ReactNode;
  thought?: ThoughtSummary | null;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  currentLoadingPhrase,
  elapsedTime,
  rightContent,
  thought,
}) => {
  const streamingState = useStreamingContext();

  if (streamingState === StreamingState.Idle) {
    return null;
  }

  const primaryText = thought?.subject || currentLoadingPhrase;

  // Only show timer, not the full cancel message, to reduce verbosity
  const timerContent =
    streamingState !== StreamingState.WaitingForConfirmation
      ? elapsedTime < 60
        ? `(${elapsedTime}s)`
        : `(${formatDuration(elapsedTime * 1000)})`
      : null;

  return (
    <Box paddingLeft={0} flexDirection="column">
      {/* Main loading line - more compact */}
      <Box width="100%" flexDirection="row" alignItems="center">
        <Box>
          <Box marginRight={1}>
            <GeminiRespondingSpinner
              nonRespondingDisplay={
                streamingState === StreamingState.WaitingForConfirmation
                  ? '⠏'
                  : ''
              }
            />
          </Box>
          {primaryText && (
            <Text color={theme.text.accent} wrap="truncate-end">
              {primaryText}
            </Text>
          )}
          {timerContent && (
            <Text color={theme.text.secondary}> {timerContent}</Text>
          )}
        </Box>
        {rightContent && <Box flexGrow={1}>{rightContent}</Box>}
      </Box>
    </Box>
  );
};
