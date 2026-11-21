package local.lifeos.client

import android.os.Bundle
import android.os.Build
import android.webkit.WebView
import android.view.View
import android.view.ActionMode
import android.view.MotionEvent
import android.view.ViewConfiguration
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

class MainActivity : TauriActivity() {
  private var lifeWebView: WebView? = null
  private var floatingSelection: ActionMode? = null
  private var tappedSelection: ActionMode? = null
  private var tapX = 0f
  private var tapY = 0f

  override fun onActionModeStarted(mode: ActionMode) {
    super.onActionModeStarted(mode)
    if (mode.type == ActionMode.TYPE_FLOATING && lifeWebView != null) floatingSelection = mode
  }

  override fun onActionModeFinished(mode: ActionMode) {
    if (floatingSelection === mode) floatingSelection = null
    if (tappedSelection === mode) tappedSelection = null
    super.onActionModeFinished(mode)
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        tappedSelection = floatingSelection
        tapX = event.x
        tapY = event.y
      }
      MotionEvent.ACTION_MOVE -> {
        val slop = ViewConfiguration.get(this).scaledTouchSlop
        if (kotlin.math.abs(event.x - tapX) > slop || kotlin.math.abs(event.y - tapY) > slop) {
          tappedSelection = null
        }
      }
      MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_POINTER_DOWN -> tappedSelection = null
    }
    val handled = super.dispatchTouchEvent(event)
    if (event.actionMasked == MotionEvent.ACTION_UP) {
      val selection = tappedSelection
      tappedSelection = null
      if (selection != null && selection === floatingSelection &&
        event.eventTime - event.downTime < ViewConfiguration.getLongPressTimeout()) selection.finish()
    }
    return handled
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Own insets here so older Android WebViews also resize above the IME.
    // Consuming them prevents CSS safe-area padding from being applied twice.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val safe = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or
          WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
      )
      view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
      WindowInsetsCompat.CONSUMED
    }
    ViewCompat.requestApplyInsets(content)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    lifeWebView = webView
    webView.post { preferSmoothRendering() }
    if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
      WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false)
    }
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        floatingSelection?.let { it.finish(); return }
        // Dismiss the IME before navigating; the form and its scroll remain intact.
        val content = findViewById<View>(android.R.id.content)
        if (ViewCompat.getRootWindowInsets(content)?.isVisible(WindowInsetsCompat.Type.ime()) == true) {
          WindowInsetsControllerCompat(window, content).hide(WindowInsetsCompat.Type.ime())
          return
        }
        webView.evaluateJavascript(
          "window.dispatchEvent(new Event('life-os:back', {cancelable: true}))"
        ) { unhandled ->
          if (unhandled == "true") moveTaskToBack(true)
        }
      }
    })
  }

  private fun preferSmoothRendering() {
    val webView = lifeWebView ?: return
    if (Build.VERSION.SDK_INT >= 35) {
      // ARR boosts drawing/scrolling without a timer that continuously redraws.
      webView.requestedFrameRate = View.REQUESTED_FRAME_RATE_CATEGORY_HIGH
    } else {
      val display = webView.display ?: return
      val current = display.mode
      val rate = display.supportedModes
        .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight }
        .maxOfOrNull { it.refreshRate } ?: return
      val attributes = window.attributes
      if (attributes.preferredRefreshRate != rate) {
        attributes.preferredRefreshRate = rate
        window.attributes = attributes
      }
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) preferSmoothRendering()
  }

  override fun onPause() {
    floatingSelection?.finish()
    LifeAlarms.leaveForeground()
    OrvimDictation.stopAll()
    lifeWebView?.evaluateJavascript(
      "window.dispatchEvent(new Event('life-os:pause'))", null
    )
    super.onPause()
  }
  override fun onResume() {
    super.onResume()
    LifeAlarms.enterForeground(this)
    lifeWebView?.evaluateJavascript("window.dispatchEvent(new Event('life-os:resume'))", null)
  }
}
