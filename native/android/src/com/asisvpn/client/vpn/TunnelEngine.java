package com.asisvpn.client.vpn;

import android.net.VpnService;

/** One running tunnel. Implemented by the sing-box (libbox) engine or by the stub. */
public interface TunnelEngine {
    /** Blocks until the tunnel is really up; throws if it is not. */
    void start(VpnService service, String configJson) throws EngineException;

    void stop();
}
