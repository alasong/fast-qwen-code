/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { formatDuration } from '../utils/formatters.js';
import type { ModelMetrics } from '../contexts/SessionContext.js';
import { useSessionStats } from '../contexts/SessionContext.js';
import {
  getStatusColor,
  TOOL_SUCCESS_RATE_HIGH,
  TOOL_SUCCESS_RATE_MEDIUM,
  USER_AGREEMENT_RATE_HIGH,
  USER_AGREEMENT_RATE_MEDIUM,
} from '../utils/displayUtils.js';
import { computeSessionStats } from '../utils/computeStats.js';
import { t } from '../../i18n/index.js';

// Simplified stat row for compact display
interface StatRowProps {
  title: string;
  children: React.ReactNode;
}

const StatRow: React.FC<StatRowProps> = ({ title, children }) => (
  <Box>
    <Text color={theme.text.link}>{title}</Text>
    <Text color={theme.text.primary}> {children}</Text>
  </Box>
);

// Compact model usage display
const ModelUsageCompact: React.FC<{
  models: Record<string, ModelMetrics>;
  totalCachedTokens: number;
  cacheEfficiency: number;
}> = ({ models, totalCachedTokens, cacheEfficiency }) => (
    <Box flexDirection="column">
      {/* Compact model usage */}
      {Object.entries(models).map(([name, modelMetrics]) => (
        <StatRow key={name} title={`${name.replace('-001', '')}:`}>
          <Text>
            {modelMetrics.api.totalRequests} reqs,{' '}
            <Text color={theme.status.warning}>
              {modelMetrics.tokens.prompt.toLocaleString()} in
            </Text>
            ,{' '}
            <Text color={theme.status.warning}>
              {modelMetrics.tokens.candidates.toLocaleString()} out
            </Text>
          </Text>
        </StatRow>
      ))}

      {/* Show cache efficiency if significant */}
      {cacheEfficiency > 5 && (
        <StatRow title={t('Savings:')}>
          <Text color={theme.status.success}>
            {totalCachedTokens.toLocaleString()} tokens (
            {cacheEfficiency.toFixed(1)}%) from cache
          </Text>
        </StatRow>
      )}
    </Box>
  );

interface StatsDisplayProps {
  duration: string;
  title?: string;
  width?: number;
}

export const StatsDisplay: React.FC<StatsDisplayProps> = ({
  duration,
  title,
  width,
}) => {
  const { stats } = useSessionStats();
  const { metrics } = stats;
  const { models, tools, files } = metrics;
  const computed = computeSessionStats(metrics);

  const successThresholds = {
    green: TOOL_SUCCESS_RATE_HIGH,
    yellow: TOOL_SUCCESS_RATE_MEDIUM,
  };
  const agreementThresholds = {
    green: USER_AGREEMENT_RATE_HIGH,
    yellow: USER_AGREEMENT_RATE_MEDIUM,
  };
  const successColor = getStatusColor(computed.successRate, successThresholds);
  const agreementColor = getStatusColor(
    computed.agreementRate,
    agreementThresholds,
  );

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width={width}
    >
      <Text bold color={theme.text.accent}>
        {title || t('Session Stats')}
      </Text>

      {/* Compact interaction summary */}
      <StatRow title={t('Tools:')}>
        <Text>
          {tools.totalCalls} calls ({' '}
          <Text color={theme.status.success}>✓ {tools.totalSuccess}</Text>{' '}
          <Text color={theme.status.error}>x {tools.totalFail}</Text> ),{' '}
          <Text color={successColor}>
            {computed.successRate.toFixed(1)}% SR
          </Text>
        </Text>
      </StatRow>

      {computed.totalDecisions > 0 && (
        <StatRow title={t('Agreement:')}>
          <Text color={agreementColor}>
            {computed.agreementRate.toFixed(1)}%
          </Text>
        </StatRow>
      )}

      {files && (files.totalLinesAdded > 0 || files.totalLinesRemoved > 0) && (
        <StatRow title={t('Changes:')}>
          <Text>
            <Text color={theme.status.success}>+{files.totalLinesAdded}</Text>{' '}
            <Text color={theme.status.error}>-{files.totalLinesRemoved}</Text>
          </Text>
        </StatRow>
      )}

      {/* Performance summary */}
      <StatRow title={t('Time:')}>
        <Text>
          {duration} ({formatDuration(computed.agentActiveTime)} active)
        </Text>
      </StatRow>

      {/* Model usage summary */}
      {Object.keys(models).length > 0 && (
        <Box marginTop={1}>
          <ModelUsageCompact
            models={models}
            totalCachedTokens={computed.totalCachedTokens}
            cacheEfficiency={computed.cacheEfficiency}
          />
        </Box>
      )}
    </Box>
  );
};
