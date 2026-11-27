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
  NativeProbeResult,
  NativeProbeTarget,
  ProtocolSupportEntry,
  SanitizedOutboundConfig,
  SplitTunnelingRuleMode,
  TunnelStatus,
  TargetPlatform,
  VpnEngineAdapter,
} from './types.ts';
export { clearEndpointLinks, getEndpointLink, registerEndpointLinks } from './endpointLinks.ts';
export {
  buildSingBoxConfig,
  ConfigBuildError,
  DEFAULT_TEST_URL,
  GROUP_TAG_PREFIX,
  MAX_GROUP_SIZE,
} from './singBoxConfig.ts';
export { installNativeBridge } from './nativeBridge.ts';
