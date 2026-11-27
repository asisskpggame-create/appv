package com.asisvpn.client.vpn;

import android.content.Context;
import android.net.VpnService;
import io.nekohasekai.libbox.BoxService;
import io.nekohasekai.libbox.Libbox;
import io.nekohasekai.libbox.SetupOptions;
import java.io.File;
import org.json.JSONObject;

/**
 * Runs sing-box through libbox.aar.
 * Written against the libbox API of sing-box 1.11.x (see SING_BOX_REF in the workflow).
 * If you bump that version and this stops compiling, the CI falls back to the stub engine.
 */
final class LibboxTunnelEngine implements TunnelEngine {
    private static boolean setupDone = false;

    private BoxService box;
    private LibboxPlatform platform;

    private static synchronized void setupOnce(Context ctx) throws Exception {
        if (setupDone) return;
        File base = new File(ctx.getFilesDir(), "singbox");
        File work = new File(base, "work");
        File temp = ctx.getCacheDir();
        //noinspection ResultOfMethodCallIgnored
        work.mkdirs();
        SetupOptions options = new SetupOptions();
        options.setBasePath(base.getPath());
        options.setWorkingPath(work.getPath());
        options.setTempPath(temp.getPath());
        options.setLogMaxLines(500);
        options.setDebug(false);
        Libbox.setup(options);
        setupDone = true;
    }

    @Override
    public synchronized void start(VpnService service, String configJson) throws EngineException {
        try {
            setupOnce(service.getApplicationContext());
            platform = new LibboxPlatform(service);
            try {
                box = Libbox.newService(configJson, platform);
                box.start();
            } catch (Exception first) {
                // A libbox built without the clash API refuses configs that ask for it. The tunnel
                // matters more than latency readings, so retry once without the controller.
                String stripped = withoutController(configJson);
                String msg = String.valueOf(first.getMessage()).toLowerCase();
                if (stripped == null || !msg.contains("clash")) throw first;
                closeBox();
                box = Libbox.newService(stripped, platform);
                box.start();
                VpnRuntime.setController(null, null);
            }
        } catch (Exception e) {
            stop();
            throw new EngineException("ENGINE_START_FAILED", String.valueOf(e.getMessage()));
        }
    }

    private static String withoutController(String configJson) {
        try {
            JSONObject root = new JSONObject(configJson);
            if (!root.has("experimental")) return null;
            root.remove("experimental");
            return root.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private void closeBox() {
        if (box != null) {
            try {
                box.close();
            } catch (Exception ignored) {
                // Closing twice or after a failed start is fine.
            }
            box = null;
        }
    }

    @Override
    public synchronized void stop() {
        closeBox();
        if (platform != null) {
            platform.close();
            platform = null;
        }
    }
}
