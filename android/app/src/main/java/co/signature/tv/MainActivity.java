package co.signature.tv;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import co.signature.tv.exoplayer.ExoPlayerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExoPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
