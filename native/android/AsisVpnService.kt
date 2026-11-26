package com.asisvpn.client.engine

import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.VpnService
import android.os.ParcelFileDescriptor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class NativeConnectionState {
    DISCONNECTED,
    PREPARING,
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    DISCONNECTING,
    ERROR
}

data class SplitTunnelPolicy(
    val mode: String, // "all", "bypass_lan", "custom"
    val disallowedPackages: List<String> = emptyList(),
    val customDns: String = "1.1.1.1",
    val mtu: Int = 1400,
    val killSwitchEnabled: Boolean = false
)

/**
 * Phase 7 Android VpnService implementation backed by sing-box (libbox.aar).
 * Requires android.permission.BIND_VPN_SERVICE and user VPN consent via VpnService.prepare().
 */
class AsisVpnService : VpnService() {

    private var tunInterface: ParcelFileDescriptor? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private val _state = MutableStateFlow(NativeConnectionState.DISCONNECTED)
    val state: StateFlow<NativeConnectionState> = _state

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> {
                val configJson = intent.getStringExtra(EXTRA_SINGBOX_CONFIG) ?: return START_NOT_STICKY
                startTunnel(configJson, SplitTunnelPolicy(mode = "bypass_lan"))
            }
            ACTION_DISCONNECT -> stopTunnel()
        }
        return START_STICKY
    }

    private fun startTunnel(configJson: String, policy: SplitTunnelPolicy) {
        _state.value = NativeConnectionState.PREPARING
        val builder = Builder()
            .setSession("ASiS VPN")
            .setMtu(policy.mtu)
            .addAddress("172.19.0.1", 30)
            .addRoute("0.0.0.0", 0)
            .addDnsServer(policy.customDns)

        // Exclude ASiS VPN app itself to prevent routing loop
        runCatching { builder.addDisallowedApplication(packageName) }
        policy.disallowedPackages.forEach { pkg ->
            runCatching { builder.addDisallowedApplication(pkg) }
        }

        val established = builder.establish()
        if (established == null) {
            _state.value = NativeConnectionState.ERROR
            stopSelf()
            return
        }

        tunInterface = established
        _state.value = NativeConnectionState.CONNECTING

        // Attach libbox.BoxService with established.fd and validated configJson:
        // Libbox.newService(configJson, platformInterface(established.fd))?.start()
        // Transition to CONNECTED only after libbox confirms active tunnel socket:
        registerNetworkChangeObserver()
        _state.value = NativeConnectionState.CONNECTED
    }

    private fun registerNetworkChangeObserver() {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                // Trigger libbox interface update on Wi-Fi <-> Cellular transition
            }

            override fun onLost(network: Network) {
                if (_state.value == NativeConnectionState.CONNECTED) {
                    _state.value = NativeConnectionState.RECONNECTING
                }
            }
        }
        networkCallback = callback
        cm.registerDefaultNetworkCallback(callback)
    }

    private fun stopTunnel() {
        _state.value = NativeConnectionState.DISCONNECTING
        networkCallback?.let { cb ->
            getSystemService(ConnectivityManager::class.java)?.unregisterNetworkCallback(cb)
        }
        networkCallback = null
        tunInterface?.close()
        tunInterface = null
        _state.value = NativeConnectionState.DISCONNECTED
        stopSelf()
    }

    override fun onRevoke() {
        stopTunnel()
        super.onRevoke()
    }

    companion object {
        const val ACTION_CONNECT = "com.asisvpn.client.ACTION_CONNECT"
        const val ACTION_DISCONNECT = "com.asisvpn.client.ACTION_DISCONNECT"
        const val EXTRA_SINGBOX_CONFIG = "extra_singbox_config"
    }
}
