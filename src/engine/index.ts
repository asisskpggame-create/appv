export {
  PROTOCOL_SUPPORT_MATRIX,
  validateAndParseOutbound,
} from './protocolValidator.ts';
export {
  AsisVpnEngineAdapter,
  EngineRuntimeError,
  detectRuntimePlatform,
} from './webEngineAdapter.ts';
export type {
  AdvancedConnectionPolicy,
  ConnectionState,
  EngineDiagnosticReport,
  EngineProtocol,
  EngineValidationResult,
  InstalledAppCategory,
  InstalledAppEntry,
  LocalEngineStatistics,
  ProtocolSupportEntry,
  SanitizedOutboundConfig,
  SplitTunnelingRuleMode,
  TargetPlatform,
  VpnEngineAdapter,
} from './types.ts';
