package com.screenroom.autoplay;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onStart() {
    super.onStart();
    if (getBridge() != null) {
      WebView webView = getBridge().getWebView();
      if (webView != null) {
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
      }
    }
  }
}
