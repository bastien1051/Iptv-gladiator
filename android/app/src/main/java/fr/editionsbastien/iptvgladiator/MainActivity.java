package fr.editionsbastien.iptvgladiator;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GladiatorScreenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
