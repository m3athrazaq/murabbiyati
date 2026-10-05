package com.m3athrazaq.murabbiyati;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.core.content.IntentCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must run before super.onCreate: the Bridge takes getIntent().getData() as the launch URL
        // (App.getLaunchUrl) and BridgeActivity hands getIntent() to the plugins (App's appUrlOpen).
        setIntent(sharedFileAsView(getIntent()));
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(sharedFileAsView(intent));
    }

    /**
     * Capacitor's App plugin only reports ACTION_VIEW intents, so a CSV shared to the app with
     * ACTION_SEND is turned into ACTION_VIEW of the same URI. The read grant that came with the share
     * belongs to this activity and stays valid; the read flag is kept on the new intent as well.
     */
    private static Intent sharedFileAsView(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return intent;
        }
        Uri stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
        if (stream == null) {
            ClipData clip = intent.getClipData();
            if (clip != null && clip.getItemCount() > 0) {
                stream = clip.getItemAt(0).getUri();
            }
        }
        if (stream == null) {
            return intent; // shared text, not a file: just open the app
        }
        Intent view = new Intent(intent);
        view.setAction(Intent.ACTION_VIEW);
        view.setDataAndType(stream, intent.getType());
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return view;
    }
}
