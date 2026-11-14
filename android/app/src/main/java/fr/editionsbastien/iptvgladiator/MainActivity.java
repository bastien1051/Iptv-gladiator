package fr.editionsbastien.iptvgladiator;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GladiatorScreenPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView == null) {
                    finish();
                    return;
                }
                webView.evaluateJavascript(
                    "(function(){if(window.__iptvBack){return window.__iptvBack()?'1':'0'}return '0'})()",
                    value -> runOnUiThread(() -> {
                        if (value != null && value.contains("1")) return;
                        if (webView.canGoBack()) webView.goBack();
                        else finish();
                    })
                );
            }
        });
    }
}
