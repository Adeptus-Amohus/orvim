package local.lifeos.client

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import org.json.JSONObject

/** Silence ends an engine cycle, never the user session. */
class OrvimDictation(private val activity: Activity) {
  companion object { private var current: OrvimDictation?=null; fun stopAll(){current?.stop()} }
  private val handler=Handler(Looper.getMainLooper())
  private var engine:SpeechRecognizer?=null
  private var generation=0
  private var wanted=false
  private var listening=false
  private var cloud=false
  private var useSystem=false
  private var needsModel=false
  private var failures=0
  private var locale="ru-RU"
  private var text=""
  private var partial=""
  private var error=""
  private var systemEngineLabel=""
  fun snapshot()=JSONObject().put("text",text).put("partial",partial).put("listening",listening).put("active",wanted).put("error",error)
    .put("needsModel",needsModel).put("canDownload",Build.VERSION.SDK_INT>=33 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity))
    .put("mode",if(useSystem)"system" else "local")
    .put("engine",engineName()).put("language",locale)
  private fun engineName():String {
    if(!useSystem)return "Android"
    if(systemEngineLabel.isNotEmpty())return systemEngineLabel
    systemEngineLabel=try {
      val component=ComponentName.unflattenFromString(Settings.Secure.getString(activity.contentResolver,"voice_recognition_service") ?: "")
      if(component==null)"Android" else activity.packageManager.getApplicationLabel(activity.packageManager.getApplicationInfo(component.packageName,0)).toString().take(100)
    }catch(_:Exception){"Android"}
    return systemEngineLabel
  }
  fun start(args:JSONObject):JSONObject {
    check(!wanted){"Диктовка уже включена."}
    check(ContextCompat.checkSelfPermission(activity,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED){"Разрешите микрофон в настройках Android."}
    cloud=args.optBoolean("allowCloud",false);systemEngineLabel=""
    val onDevice=Build.VERSION.SDK_INT>=31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)
    check(onDevice || cloud){"Локальный речевой движок недоступен. Для системного движка явно разрешите облачную диктовку; аудио может передаваться службе Android."}
    check(SpeechRecognizer.isRecognitionAvailable(activity) || onDevice){"На устройстве нет службы распознавания речи."}
    locale=when(args.optString("language")){"en"->"en-US";else->"ru-RU"}
    text="";partial="";error="";needsModel=false;failures=0;useSystem=!onDevice;wanted=true;current=this;cycle();return snapshot()
  }
  fun stop():JSONObject {
    wanted=false;listening=false;generation++;handler.removeCallbacksAndMessages(null)
    if(partial.isNotBlank())text=listOf(text,partial).filter{it.isNotBlank()}.joinToString(" ")
    partial="";engine?.cancel();engine?.destroy();engine=null
    return snapshot()
  }
  private fun again(){if(wanted)handler.postDelayed({if(wanted)cycle()},350)}
  fun downloadModel(args:JSONObject):JSONObject {
    if(Build.VERSION.SDK_INT<33 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)) throw IllegalStateException("Установите речевой пакет в настройках службы распознавания Android.")
    stop()
    locale=when(args.optString("language")){"en"->"en-US";else->"ru-RU"}
    engine=SpeechRecognizer.createOnDeviceSpeechRecognizer(activity)
    engine!!.triggerModelDownload(recognizerIntent())
    return JSONObject().put("message","Запрос на установку речевого пакета отправлен Android. Подтвердите загрузку, если появится окно. После установки снова нажмите микрофон.")
  }
  private fun recognizerIntent()=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
    .putExtra(RecognizerIntent.EXTRA_LANGUAGE,locale).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true)
    .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1).putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,!cloud)
  private fun cycle(){
    if(!wanted)return
    generation++;val cycleId=generation
    engine?.destroy()
    val onDevice=Build.VERSION.SDK_INT>=31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)
    try {
    engine=if(onDevice && !useSystem)SpeechRecognizer.createOnDeviceSpeechRecognizer(activity) else SpeechRecognizer.createSpeechRecognizer(activity)
    engine!!.setRecognitionListener(object:RecognitionListener {
      private var finished=false
      private fun valid()=wanted && generation==cycleId
      override fun onReadyForSpeech(params:Bundle?){if(valid())listening=true}
      override fun onBeginningOfSpeech(){if(valid())listening=true}
      override fun onRmsChanged(rmsdB:Float){}
      override fun onBufferReceived(buffer:ByteArray?){}
      override fun onEndOfSpeech(){if(valid()){listening=false;handler.postDelayed({if(valid()&&!finished){finished=true;if(partial.isNotBlank())text=listOf(text,partial).filter{it.isNotBlank()}.joinToString(" ");partial="";again()}},5000)}}
      override fun onError(code:Int){
        if(!valid() || finished)return
        finished=true
        listening=false
        if(partial.isNotBlank()){text=listOf(text,partial).filter{it.isNotBlank()}.joinToString(" ");partial=""}
        val languageError=code==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || code==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE
        // Local recognition can exist without the requested language installed.
        // System recognition may send audio away; it requires explicit consent.
        if(languageError && cloud && !useSystem && SpeechRecognizer.isRecognitionAvailable(activity)){
          useSystem=true;failures=0;again();return
        }
        if(code==SpeechRecognizer.ERROR_NO_MATCH || code==SpeechRecognizer.ERROR_SPEECH_TIMEOUT){failures=0;again();return}
        failures++
        error=when(code){
          SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE->"Для выбранного языка не установлен речевой пакет. Установите речевой пакет Android или разрешите системное распознавание. Текст сохранён."
          SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED->"Речевой движок не поддерживает выбранный язык. Выберите другой язык или системное распознавание. Текст сохранён."
          SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS->"Разрешите Orvim доступ к микрофону в настройках Android. Текст сохранён."
          SpeechRecognizer.ERROR_AUDIO->"Не удалось получить звук с микрофона. Закройте другое приложение, использующее микрофон, и попробуйте снова. Текст сохранён."
          else->if(failures<3)"" else "Служба распознавания не отвечает. Проверьте подключение и повторите попытку. Текст сохранён."
        }
        if(error.isEmpty())again()else{needsModel=languageError;stop()}
      }
      override fun onResults(results:Bundle?){
        if(!valid() || finished)return
        finished=true
        failures=0
        val phrase=results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
        if(phrase.isNotBlank())text=listOf(text,phrase).filter{it.isNotBlank()}.joinToString(" ")
        partial="";listening=false;again()
      }
      override fun onPartialResults(results:Bundle?){if(valid() && !finished)partial=results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""}
      override fun onEvent(eventType:Int,params:Bundle?){}
    })
    engine!!.startListening(recognizerIntent())
    }catch(failure:Exception){error="Не удалось включить службу распознавания. Проверьте речевой пакет и доступ к микрофону. Текст сохранён.";stop()}
  }
}
