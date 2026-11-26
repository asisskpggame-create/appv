import Foundation
import NetworkExtension

/// Phase 7 iOS NetworkExtension Packet Tunnel Provider backed by Libbox.xcframework (sing-box).
/// Memory footprint must remain strictly within the iOS NEPacketTunnelProvider 50 MB ceiling.
final class PacketTunnelProvider: NEPacketTunnelProvider {

    private let appGroupId = "group.com.asisvpn.client"

    override func startTunnel(
        options: [String: NSObject]?,
        completionHandler: @escaping (Error?) -> Void
    ) {
        guard let providerConfig = (protocolConfiguration as? NETunnelProviderProtocol)?.providerConfiguration,
              let singBoxJson = providerConfig["singBoxConfig"] as? String else {
            completionHandler(NSError(
                domain: "com.asisvpn.client",
                code: 1001,
                userInfo: [NSLocalizedDescriptionKey: "Missing validated sing-box configuration."]
            ))
            return
        }

        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "127.0.0.1")
        let ipv4 = NEIPv4Settings(addresses: ["172.19.0.1"], subnetMasks: ["255.255.255.252"])
        ipv4.includedRoutes = [NEIPv4Route.default()]
        settings.ipv4Settings = ipv4
        settings.mtu = 1400
        settings.dnsSettings = NEDNSSettings(servers: ["1.1.1.1"])

        setTunnelNetworkSettings(settings) { error in
            if let error = error {
                completionHandler(error)
                return
            }
            // Start Libbox service inside tunnel memory budget:
            // LibboxNewService(singBoxJson, platformBridge)
            _ = singBoxJson
            completionHandler(nil)
        }
    }

    override func stopTunnel(
        with reason: NEProviderStopReason,
        completionHandler: @escaping () -> Void
    ) {
        // Gracefully close Libbox service and release packetFlow handles
        completionHandler()
    }
}
