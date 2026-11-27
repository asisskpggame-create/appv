package com.asisvpn.client.vpn;

import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.system.OsConstants;
import android.util.Log;
import io.nekohasekai.libbox.InterfaceUpdateListener;
import io.nekohasekai.libbox.NetworkInterfaceIterator;
import io.nekohasekai.libbox.Notification;
import io.nekohasekai.libbox.PlatformInterface;
import io.nekohasekai.libbox.RoutePrefix;
import io.nekohasekai.libbox.RoutePrefixIterator;
import io.nekohasekai.libbox.StringIterator;
import io.nekohasekai.libbox.TunOptions;
import io.nekohasekai.libbox.WIFIState;
import java.lang.reflect.Method;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * What sing-box needs from Android: the TUN device, socket protection, the default network and
 * the interface list. Methods are intentionally declared without @Override so that a slightly
 * different libbox version still compiles when it only has a subset of them.
 */
final class LibboxPlatform implements PlatformInterface {
    private static final String TAG = "AsisLibbox";

    private final VpnService service;
    private final ConnectivityManager cm;
    private final PackageManager pm;
    private ConnectivityManager.NetworkCallback callback;
    private InterfaceUpdateListener listener;

    LibboxPlatform(VpnService service) {
        this.service = service;
        this.cm = (ConnectivityManager) service.getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
        this.pm = service.getPackageManager();
    }

    void close() {
        closeDefaultInterfaceMonitor(listener);
    }

    // ---- TUN -------------------------------------------------------------------------------

    public int openTun(TunOptions options) throws Exception {
        VpnService.Builder b = service.new Builder().setSession("ASiS VPN");
        b.setMtu(options.getMTU());

        RoutePrefixIterator a4 = options.getInet4Address();
        while (a4.hasNext()) {
            RoutePrefix p = a4.next();
            b.addAddress(p.address(), p.prefix());
        }
        RoutePrefixIterator a6 = options.getInet6Address();
        boolean hasV6 = false;
        while (a6.hasNext()) {
            RoutePrefix p = a6.next();
            b.addAddress(p.address(), p.prefix());
            hasV6 = true;
        }

        boolean allowListUsed = false;
        if (options.getAutoRoute()) {
            b.addDnsServer(options.getDNSServerAddress());

            RoutePrefixIterator r4 = options.getInet4RouteAddress();
            if (r4.hasNext()) {
                while (r4.hasNext()) {
                    RoutePrefix p = r4.next();
                    b.addRoute(p.address(), p.prefix());
                }
            } else {
                b.addRoute("0.0.0.0", 0);
            }
            RoutePrefixIterator r6 = options.getInet6RouteAddress();
            if (r6.hasNext()) {
                while (r6.hasNext()) {
                    RoutePrefix p = r6.next();
                    b.addRoute(p.address(), p.prefix());
                }
            } else if (hasV6) {
                b.addRoute("::", 0);
            }

            StringIterator include = options.getIncludePackage();
            while (include.hasNext()) {
                b.addAllowedApplication(include.next());
                allowListUsed = true;
            }
            StringIterator exclude = options.getExcludePackage();
            while (exclude.hasNext()) {
                try {
                    b.addDisallowedApplication(exclude.next());
                } catch (PackageManager.NameNotFoundException ignored) {
                    // App no longer installed.
                }
            }
        }

        // Keep this app's own traffic (gateway calls, sing-box sockets) outside the tunnel.
        // Android does not allow an allow-list and a deny-list at the same time.
        if (!allowListUsed) {
            try {
                b.addDisallowedApplication(service.getPackageName());
            } catch (PackageManager.NameNotFoundException ignored) {
                // Cannot happen for our own package.
            }
        }

        ParcelFileDescriptor pfd = b.establish();
        if (pfd == null) {
            throw new Exception("android: the app is not prepared for VPN or the permission was revoked");
        }
        return pfd.detachFd();
    }

    public boolean usePlatformAutoDetectInterfaceControl() { return true; }

    public void autoDetectInterfaceControl(int fd) {
        service.protect(fd);
    }

    // ---- Default network / interfaces --------------------------------------------------------

    public boolean usePlatformDefaultInterfaceMonitor() { return true; }

    public void startDefaultInterfaceMonitor(InterfaceUpdateListener l) {
        listener = l;
        NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
                .build();
        callback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                publish(network);
            }

            @Override
            public void onLost(Network network) {
                notifyListener("", -1);
            }
        };
        cm.requestNetwork(request, callback);
    }

    public void closeDefaultInterfaceMonitor(InterfaceUpdateListener l) {
        if (callback != null) {
            try {
                cm.unregisterNetworkCallback(callback);
            } catch (RuntimeException ignored) {
                // Already unregistered.
            }
            callback = null;
        }
        listener = null;
    }

    private void publish(Network network) {
        try {
            LinkProperties lp = cm.getLinkProperties(network);
            if (lp == null || lp.getInterfaceName() == null) return;
            String name = lp.getInterfaceName();
            java.net.NetworkInterface ni = java.net.NetworkInterface.getByName(name);
            int index = ni == null ? -1 : ni.getIndex();
            service.setUnderlyingNetworks(new Network[] {network});
            notifyListener(name, index);
        } catch (Exception e) {
            Log.w(TAG, "default interface update failed", e);
        }
    }

    /** updateDefaultInterface has 2 or 4 parameters depending on the libbox version. */
    private void notifyListener(String name, int index) {
        InterfaceUpdateListener l = listener;
        if (l == null) return;
        try {
            for (Method m : l.getClass().getMethods()) {
                if (!m.getName().equals("updateDefaultInterface")) continue;
                int n = m.getParameterTypes().length;
                if (n == 2) m.invoke(l, name, index);
                else if (n == 4) m.invoke(l, name, index, false, false);
                else continue;
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "updateDefaultInterface failed", e);
        }
    }

    public boolean usePlatformInterfaceGetter() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R; }

    @SuppressWarnings("deprecation")
    public NetworkInterfaceIterator getInterfaces() throws Exception {
        final List<io.nekohasekai.libbox.NetworkInterface> out = new ArrayList<>();
        for (Network network : cm.getAllNetworks()) {
            LinkProperties lp = cm.getLinkProperties(network);
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            if (lp == null || caps == null || lp.getInterfaceName() == null) continue;
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue;

            java.net.NetworkInterface ni = java.net.NetworkInterface.getByName(lp.getInterfaceName());
            if (ni == null) continue;

            List<String> addresses = new ArrayList<>();
            for (android.net.LinkAddress la : lp.getLinkAddresses()) {
                String host = la.getAddress().getHostAddress();
                int pct = host.indexOf('%');
                addresses.add((pct >= 0 ? host.substring(0, pct) : host) + "/" + la.getPrefixLength());
            }
            List<String> dns = new ArrayList<>();
            for (InetAddress d : lp.getDnsServers()) {
                String host = d.getHostAddress();
                int pct = host.indexOf('%');
                dns.add(pct >= 0 ? host.substring(0, pct) : host);
            }

            String type = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ? "wifi"
                    : caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ? "cellular"
                    : caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ? "ethernet" : "other";

            io.nekohasekai.libbox.NetworkInterface item = new io.nekohasekai.libbox.NetworkInterface();
            setIfPresent(item, "setIndex", int.class, ni.getIndex());
            setIfPresent(item, "setMTU", int.class, Math.max(ni.getMTU(), 0));
            setIfPresent(item, "setName", String.class, lp.getInterfaceName());
            setIfPresent(item, "setAddresses", StringIterator.class, new StringList(addresses));
            setIfPresent(item, "setDNSServer", StringIterator.class, new StringList(dns));
            setIfPresent(item, "setFlags", int.class, OsConstants.IFF_UP | OsConstants.IFF_RUNNING);
            setIfPresent(item, "setType", String.class, type);
            setIfPresent(item, "setMetered", boolean.class,
                    !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED));
            out.add(item);
        }
        return new NetworkInterfaceIterator() {
            private int i = 0;

            public boolean hasNext() { return i < out.size(); }

            public io.nekohasekai.libbox.NetworkInterface next() { return out.get(i++); }
        };
    }

    private static void setIfPresent(Object target, String method, Class<?> type, Object value) {
        try {
            target.getClass().getMethod(method, type).invoke(target, value);
        } catch (Exception ignored) {
            // Field does not exist in this libbox version.
        }
    }

    // ---- Misc -------------------------------------------------------------------------------

    public boolean useProcFS() { return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q; }

    public int findConnectionOwner(int ipProtocol, String sourceAddress, int sourcePort,
                                   String destinationAddress, int destinationPort) throws Exception {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) throw new Exception("android: unsupported before API 29");
        int uid = cm.getConnectionOwnerUid(
                ipProtocol,
                new InetSocketAddress(InetAddress.getByName(sourceAddress), sourcePort),
                new InetSocketAddress(InetAddress.getByName(destinationAddress), destinationPort));
        if (uid == -1) throw new Exception("android: connection owner not found");
        return uid;
    }

    public String packageNameByUid(int uid) throws Exception {
        String[] packages = pm.getPackagesForUid(uid);
        if (packages == null || packages.length == 0) throw new Exception("android: package not found");
        return packages[0];
    }

    @SuppressWarnings("deprecation")
    public int uidByPackageName(String packageName) throws Exception {
        try {
            return pm.getPackageUid(packageName, 0);
        } catch (PackageManager.NameNotFoundException e) {
            throw new Exception("android: package not found");
        }
    }

    public void writeLog(String message) {
        Log.i(TAG, message);
    }

    public boolean underNetworkExtension() { return false; }

    public boolean includeAllNetworks() { return false; }

    public WIFIState readWIFIState() { return null; }

    public void clearDNSCache() {}

    public void sendNotification(Notification notification) {}

    public StringIterator systemCertificates() { return new StringList(Collections.<String>emptyList()); }

    /** Minimal StringIterator over a list. */
    private static final class StringList implements StringIterator {
        private final List<String> items;
        private int i = 0;

        StringList(List<String> items) { this.items = items; }

        public int len() { return items.size(); }

        public boolean hasNext() { return i < items.size(); }

        public String next() { return items.get(i++); }
    }
}
