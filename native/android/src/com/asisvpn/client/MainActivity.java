package com.asisvpn.client;

import android.os.Bundle;
import com.asisvpn.client.vpn.AsisVpnPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins that are not in node_modules must be registered before super.onCreate().
        registerPlugin(AsisVpnPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
