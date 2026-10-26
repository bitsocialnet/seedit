package seedit.android;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;
import com.capacitorjs.plugins.statusbar.StatusBarPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom plugins must be registered before super.onCreate, which builds the bridge.
        registerPlugin(FileUploaderPlugin.class);
        super.onCreate(savedInstanceState);
        // Register community plugins after initialization
        registerPlugin(LocalNotificationsPlugin.class);
        registerPlugin(StatusBarPlugin.class);
    }
}
